/**
 * The selected node's position-history trail (#3492, #4743, #5354), moved
 * unchanged from NodesTab (#6365) so the Workspace device map draws the same
 * trail: the hours window, the asset playback cursor cut, the render cap, the
 * gap breaks, the legend span, the "thinned" hint and the Polyline elements
 * (drawn as children of a BaseMap). Reads the history MapContext holds
 * (`usePositionHistory` loads it) and the Map / Node Display settings.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Polyline, Popup } from 'react-leaflet';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { DeviceInfo } from '../../types/device';
import { formatDateTime } from '../../utils/datetime';
import { getPositionHistoryColor, generateHeadingAwarePath, generatePositionHistoryArrows } from '../../utils/mapHelpers.tsx';
import { downsamplePositionHistory, segmentBreaks, MAX_RENDERED_POSITION_POINTS, MAX_RENDERED_ASSET_POSITION_POINTS } from '../../utils/positionHistoryDownsample';
import { convertSpeed } from '../../utils/speedConversion';
import { indexAtOrBefore, shouldShowAssetPlayback } from '../../utils/trackPlayback';

/** `nodes`: the source's nodes, to tell whether the selected node is a tracked asset. */
export function usePositionTrail(nodes: DeviceInfo[]) {
  const { t } = useTranslation();
  const {
    showMotion,
    positionHistory,
    positionHistoryHours,
    positionHistoryTotalFixes,
    positionHistoryPointsOnly,
    selectedNodeId,
  } = useMapContext();
  const { timeFormat, dateFormat, distanceUnit, positionHistoryLineStyle, overlayColors } = useSettings();

  // Memoize filtered position history to avoid recomputation on every render
  const filteredPositionHistory = useMemo(() => {
    if (!showMotion || positionHistory.length < 2) return [];
    if (positionHistoryHours != null) {
      return positionHistory.filter(p => p.timestamp >= Date.now() - (positionHistoryHours * 60 * 60 * 1000));
    }
    return positionHistory;
  }, [showMotion, positionHistory, positionHistoryHours]);

  /**
   * Trail actually drawn, bounded to `MAX_RENDERED_POSITION_POINTS` (#4743).
   *
   * A node using estimated positions is relocated every time a neighbour
   * reports, so its history reaches thousands of fixes — one `<Polyline>` plus
   * one rich `<Popup>` each, which froze the UI for about a minute on mobile.
   * A time window alone does not bound this: even 24 hours of estimated
   * positions can hold thousands of entries.
   *
   * `filteredPositionHistory` stays the source of truth for the legend's time
   * span, so the reported oldest/newest remain exact while the drawing is
   * capped.
   */
  // A tracked asset's trail (#5354 Phase 2) arrives already thinned by the
  // server to at most 2,000 points, so draw up to that many rather than
  // resampling it down to the regular 500.
  const isAssetTrail = positionHistoryTotalFixes !== null;

  /**
   * Timeline playback (#5354 Phase 3): shown for a selected asset whose own
   * track is loaded (not a previous node's) with Show Position History on and
   * more than one fix after the hours filter. 2D only.
   */
  const selectedMapNode = useMemo(
    () => (selectedNodeId ? nodes.find(n => n.user?.id === selectedNodeId) : undefined),
    [nodes, selectedNodeId],
  );
  const showAssetPlayback = shouldShowAssetPlayback({
    isAsset: Boolean(selectedMapNode?.asset),
    assetTrackLoaded: isAssetTrail,
    showPositionHistory: showMotion,
    fixCount: filteredPositionHistory.length,
  });
  // Cursor time from the playback bar while "trail up to cursor" is on (null = whole trail).
  const [playbackTrailCursor, setPlaybackTrailCursor] = useState<number | null>(null);
  // Cut the trail by fix INDEX, not time, so the ~5 Hz cursor only rebuilds
  // the polylines when it crosses a fix.
  const trailCutIndex = showAssetPlayback && playbackTrailCursor !== null
    ? indexAtOrBefore(filteredPositionHistory, playbackTrailCursor)
    : null;
  const trailPositionHistory = useMemo(
    () => (trailCutIndex === null ? filteredPositionHistory : filteredPositionHistory.slice(0, trailCutIndex + 1)),
    [filteredPositionHistory, trailCutIndex],
  );

  const renderedPositionHistory = useMemo(
    () => downsamplePositionHistory(
      trailPositionHistory,
      isAssetTrail ? MAX_RENDERED_ASSET_POSITION_POINTS : MAX_RENDERED_POSITION_POINTS,
    ),
    [trailPositionHistory, isAssetTrail],
  );

  /** Per drawn pair: true when it spans a gap segment (#5354), so no line is drawn. */
  const positionHistorySegmentBreaks = useMemo(
    () => segmentBreaks(trailPositionHistory, renderedPositionHistory),
    [trailPositionHistory, renderedPositionHistory],
  );

  /**
   * "Showing N of M fixes (thinned)" for an asset whose server-side track
   * holds fewer points than the fixes it stands for.
   */
  const assetTrailThinnedHint = isAssetTrail && positionHistoryTotalFixes > positionHistory.length
    ? t('map.assetTrailThinned', {
        shown: renderedPositionHistory.length.toLocaleString(),
        total: positionHistoryTotalFixes.toLocaleString(),
        defaultValue: 'Showing {{shown}} of {{total}} fixes (thinned)',
      })
    : null;

  /**
   * True when the drawn trail omits intermediate fixes — surfaced in the popup.
   * An asset trail thinned on the server counts too (#5354).
   */
  const positionHistoryDownsampled = renderedPositionHistory.length < trailPositionHistory.length
    || assetTrailThinnedHint !== null;

  // Memoize position history legend data for MapLegend
  const positionHistoryLegendData = useMemo(() => {
    if (filteredPositionHistory.length < 2) return undefined;
    return {
      oldestTime: filteredPositionHistory[0].timestamp,
      newestTime: filteredPositionHistory[filteredPositionHistory.length - 1].timestamp,
      timeFormat,
      dateFormat,
    };
  }, [filteredPositionHistory, timeFormat, dateFormat]);

  // Memoize position history polyline elements
  const positionHistoryElements = useMemo(() => {
    if (renderedPositionHistory.length < 2) return null;

    const elements: React.ReactElement[] = [];
    const segmentCount = renderedPositionHistory.length - 1;
    const segmentColors: string[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const startPos = renderedPositionHistory[i];
      const endPos = renderedPositionHistory[i + 1];
      const color = getPositionHistoryColor(i, segmentCount, overlayColors.positionHistoryOld, overlayColors.positionHistoryNew);
      segmentColors.push(color);

      // Points-only mode (#3492): skip the connecting line; keep the per-fix dots.
      if (positionHistoryPointsOnly) continue;

      // Gap between two asset drives (#5354): never join across it.
      if (positionHistorySegmentBreaks[i]) continue;

      const segmentPath = positionHistoryLineStyle === 'spline' && startPos.groundTrack !== undefined
        ? generateHeadingAwarePath(
            [startPos.latitude, startPos.longitude],
            [endPos.latitude, endPos.longitude],
            startPos.groundTrack,
            startPos.groundSpeed,
            10
          )
        : [[startPos.latitude, startPos.longitude] as [number, number], [endPos.latitude, endPos.longitude] as [number, number]];

      elements.push(
        <Polyline
          key={`position-history-segment-${i}`}
          positions={segmentPath}
          pathOptions={{
            color,
            weight: 3,
            opacity: 0.8,
          }}
        >
          <Popup>
            <div className="route-popup">
              <h4>Position Segment {i + 1}</h4>
              <div className="route-usage">
                <strong>From:</strong> {formatDateTime(new Date(startPos.timestamp), timeFormat, dateFormat)}
              </div>
              <div className="route-usage">
                <strong>To:</strong> {formatDateTime(new Date(endPos.timestamp), timeFormat, dateFormat)}
              </div>
              {/* The trail is thinned for very dense histories (#4743), so a
                  segment can span more fixes than it draws. Say so rather than
                  implying these two points were consecutive. */}
              {positionHistoryDownsampled && (
                <div className="route-usage">
                  <em>{t('nodes.position_history_simplified')}</em>
                </div>
              )}
              {startPos.groundSpeed !== undefined && (() => {
                const { speed, unit } = convertSpeed(startPos.groundSpeed, distanceUnit);
                return (
                  <div className="route-usage">
                    <strong>Speed:</strong> {speed.toFixed(1)} {unit}
                  </div>
                );
              })()}
              {startPos.groundTrack !== undefined && (() => {
                let heading = startPos.groundTrack;
                if (heading > 360) heading = heading / 1000;
                return (
                  <div className="route-usage">
                    <strong>Heading:</strong> {heading.toFixed(0)}°
                  </div>
                );
              })()}
            </div>
          </Popup>
        </Polyline>
      );
    }

    const historyArrows = generatePositionHistoryArrows(
      renderedPositionHistory,
      segmentColors,
      30,
      distanceUnit
    );
    elements.push(...historyArrows);

    return elements;
  }, [renderedPositionHistory, positionHistorySegmentBreaks, positionHistoryDownsampled, t, overlayColors.positionHistoryOld, overlayColors.positionHistoryNew, positionHistoryLineStyle, positionHistoryPointsOnly, timeFormat, dateFormat, distanceUnit]);

  return {
    filteredPositionHistory,
    isAssetTrail,
    selectedMapNode,
    showAssetPlayback,
    playbackTrailCursor,
    setPlaybackTrailCursor,
    renderedPositionHistory,
    assetTrailThinnedHint,
    positionHistoryDownsampled,
    positionHistoryLegendData,
    positionHistoryElements,
  };
}
