/**
 * Position history for the selected node (#3791, #4743, #5354), loaded into
 * MapContext (`positionHistory`, `positionHistoryTotalFixes`) for the trail.
 * Moved unchanged from App (#6365) so the Workspace device map loads it the
 * same way. Only a mobile node loads: a tracked asset as one server-thinned
 * track, anything else in bounded pages, newest first, paced 150 ms apart.
 */
import { useEffect, useRef } from 'react';
import { useMapContext, type PositionHistoryItem } from '../contexts/MapContext';
import type { DeviceInfo } from '../types/device';
import { logger } from '../utils/logger';
import { MAX_ACCUMULATED_POSITION_FIXES, flattenAssetTrack } from '../utils/positionHistoryDownsample';
import { fetchAssetTrack } from './useAssetTracking';

export interface UsePositionHistoryParams {
  /** The selected node's id (MapContext `selectedNodeId`); null loads nothing and clears the trail. */
  selectedNodeId: string | null;
  nodes: DeviceInfo[];
  baseUrl: string;
  sourceId: string | null | undefined;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function usePositionHistory({ selectedNodeId, nodes, baseUrl, sourceId, authFetch }: UsePositionHistoryParams): void {
  const { setPositionHistory, setPositionHistoryTotalFixes } = useMapContext();

  // Signature of the asset track last put on the map (#5354 Phase 2), so a
  // node poll that returns the same (cached) track doesn't redraw 2,000 points.
  const assetTrackSignatureRef = useRef<string | null>(null);

  // Fetch position history when a mobile node is selected
  useEffect(() => {
    if (!selectedNodeId) {
      assetTrackSignatureRef.current = null;
      setPositionHistoryTotalFixes(null);
      setPositionHistory([]);
      return;
    }

    const selectedNode = nodes.find(n => n.user?.id === selectedNodeId);
    if (!selectedNode || !selectedNode.isMobile) {
      assetTrackSignatureRef.current = null;
      setPositionHistoryTotalFixes(null);
      setPositionHistory([]);
      return;
    }

    let cancelled = false;

    // Tracked asset (#5354 Phase 2): one request for the server-thinned trail
    // across the whole retention window, instead of the paged loop and its
    // 5,000-fix cap. The server returns at most 2,000 points in gap segments.
    if (selectedNode.asset) {
      const nodeNum = selectedNode.nodeNum;
      const fetchAssetTrail = async () => {
        try {
          const track = await fetchAssetTrack(nodeNum);
          if (cancelled) return;
          const items = flattenAssetTrack(track.segments);
          const last = items.length > 0 ? items[items.length - 1].timestamp : 0;
          const signature = `${nodeNum}|${track.totalFixes}|${items.length}|${last}`;
          if (signature === assetTrackSignatureRef.current) return;
          assetTrackSignatureRef.current = signature;
          setPositionHistoryTotalFixes(track.totalFixes);
          setPositionHistory(items);
        } catch (error) {
          if (!cancelled) logger.error('Error fetching asset track:', error);
        }
      };
      void fetchAssetTrail();
      return () => { cancelled = true; };
    }
    assetTrackSignatureRef.current = null;
    setPositionHistoryTotalFixes(null);

    // Progressively load the ENTIRE position history in bounded pages (#3791).
    // The server caps each response at 1500 telemetry rows (~300 fixes), so we
    // walk backwards in time using the oldest fix of each page as a `before`
    // cursor, appending until a page comes back empty. State is updated after
    // every page so the trail fills in progressively rather than all at once.
    const fetchAllPositionHistory = async () => {
      const accumulated: PositionHistoryItem[] = [];
      let beforeCursor: number | undefined;
      const MAX_PAGES = 50; // safety bound (~15k fixes) against a runaway loop


      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          const params = new URLSearchParams();
          if (sourceId) params.set('sourceId', sourceId);
          if (beforeCursor !== undefined) params.set('before', String(beforeCursor));
          const qs = params.toString();
          const response = await authFetch(
            `${baseUrl}/api/nodes/${selectedNodeId}/position-history${qs ? `?${qs}` : ''}`
          );
          if (cancelled) return;
          if (!response.ok) break;

          const pageItems: PositionHistoryItem[] = await response.json();
          if (cancelled) return;
          if (pageItems.length === 0) break; // reached the start of history

          // Server returns fixes oldest-first; prepend each older page so the
          // accumulated array stays chronological as we page back in time.
          accumulated.unshift(...pageItems);
          setPositionHistory([...accumulated]);

          // Next page: strictly older than the oldest fix just received. A
          // boundary fix split by the row cap is always older than this, so it
          // re-assembles on the next page without duplicating an emitted fix.
          // Stop paging once we hold enough (#4743) — see the constant's comment.
          if (accumulated.length >= MAX_ACCUMULATED_POSITION_FIXES) break;

          const oldest = pageItems[0].timestamp;
          if (beforeCursor !== undefined && oldest >= beforeCursor) break; // no-progress guard
          beforeCursor = oldest;

          // Gentle pacing so we neither hammer the server nor block rendering.
          await new Promise(resolve => setTimeout(resolve, 150));
          if (cancelled) return;
        }
      } catch (error) {
        if (!cancelled) logger.error('Error fetching position history:', error);
      }
    };

    void fetchAllPositionHistory();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 App's deps, moved unchanged: authFetch and the setters are stable
  }, [selectedNodeId, nodes, baseUrl, sourceId]);
}
