/**
 * Waypoints and local markers on the Overview map (boards 5-04, 5-05): Map
 * Analysis's own pin flow (`usePinAuthoring`: the placement click, the source
 * a new pin starts on, today's saves and gates), drawn with the Workspace
 * sheets of Task 3.6 instead of today's modals:
 *
 * - the waypoint sheet (one waypoint on the picked channel; its Sends line;
 *   Enter sends nothing) and the local marker sheet (never transmitted), each
 *   with today's device picker, since this map shows every device;
 * - a waypoint popup's Edit / Delete… with the lock reason as text, and the
 *   delete confirms (one waypoint delete on its channel; a marker sends
 *   nothing), in place of `window.confirm`.
 *
 * Placing a pin sends nothing; only a sheet's button does, through today's
 * calls (`createWaypoint` / `updateWaypoint` / `deleteWaypoint`, and the marker
 * equivalents), so the server's limits and rebroadcast rules are today's.
 */
import { useCallback, useState, type ReactNode } from 'react';
import type L from 'leaflet';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePinAuthoring, type PinAuthoring } from '../../../components/MapAnalysis/usePinAuthoring';
import { deleteWaypoint } from '../../../hooks/useWaypoints';
import { deleteMapMarker } from '../../../hooks/useMapMarkers';
import { useSourceChannels } from '../../../hooks/useSourceChannels';
import type { Waypoint } from '../../../types/waypoint';
import type { MapMarker } from '../../../types/mapMarker';
import LocalMarkerSheet, { DeleteMarkerSheet } from '../../map/LocalMarkerSheet';
import WaypointSheet, { DeleteWaypointSheet, WaypointPopupFooter } from '../../map/WaypointSheet';
import styles from './useOverviewPins.module.css';

type Deleting = { kind: 'waypoint'; waypoint: Waypoint; sourceName: string } | { kind: 'marker'; marker: MapMarker } | null;

export function useOverviewPins(active2D: boolean, leaflet: L.Map | null) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const authoring = usePinAuthoring(active2D);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const { channels: deleteChannels } = useSourceChannels(deleting?.kind === 'waypoint' ? deleting.waypoint.sourceId : null);
  const { waypointActionsFor: ownWaypointActions, markerActionsFor: ownMarkerActions } = authoring;

  // Today's actions (gate, lock rule, edit), with the 3.6 footer and confirm sheets.
  const waypointActionsFor = useCallback<PinAuthoring['waypointActionsFor']>(
    (source) => {
      const own = ownWaypointActions(source);
      if (!own) return undefined;
      return {
        ...own,
        renderActions: (wp, locked) => (
          <WaypointPopupFooter
            locked={locked}
            onEdit={() => { leaflet?.closePopup(); own.onEdit?.(wp); }}
            onDelete={() => { leaflet?.closePopup(); setDeleting({ kind: 'waypoint', waypoint: wp, sourceName: source.name ?? source.id }); }}
          />
        ),
      };
    },
    [ownWaypointActions, leaflet],
  );
  const markerActionsFor = useCallback<PinAuthoring['markerActionsFor']>(
    (source) => {
      const own = ownMarkerActions(source);
      if (!own) return undefined;
      return {
        ...own,
        onEdit: (m) => { leaflet?.closePopup(); own.onEdit?.(m); },
        onDelete: (m) => { leaflet?.closePopup(); setDeleting({ kind: 'marker', marker: m }); },
      };
    },
    [ownMarkerActions, leaflet],
  );

  const pins: PinAuthoring = { ...authoring, waypointActionsFor, markerActionsFor };
  const { waypoint, marker } = authoring;
  const close = () => setDeleting(null);

  const hint: ReactNode = authoring.placing && (
    <div className={styles.hint} role="status">
      <span>
        {authoring.placing === 'waypoint'
          ? t('mapPins.placeWaypointHint', 'Click the map to place the waypoint. Nothing is sent until you save.')
          : t('localMarkers.placeHint', 'Click the map to place the local marker')}
      </span>
      <button type="button" className={styles.cancel} onClick={authoring.cancelPlacing}>{t('common.cancel')}</button>
    </div>
  );

  const overlay: ReactNode = (
    <>
      <WaypointSheet
        open={waypoint.open}
        sourceId={waypoint.sourceChoice.value ?? ''}
        sourceName={waypoint.sourceChoice.options.find((o) => o.id === waypoint.sourceChoice.value)?.name ?? ''}
        sourceChoice={waypoint.sourceChoice}
        initial={waypoint.initial}
        defaultCoords={waypoint.coords}
        channels={waypoint.channels}
        selfNodeNum={waypoint.selfNodeNum}
        onClose={waypoint.onClose}
        onSave={waypoint.onSave}
      />
      <DeleteWaypointSheet
        waypoint={deleting?.kind === 'waypoint' ? deleting.waypoint : null}
        sourceName={deleting?.kind === 'waypoint' ? deleting.sourceName : ''}
        channels={deleteChannels}
        onClose={close}
        onDelete={async (wp) => {
          await deleteWaypoint(wp.sourceId, wp.waypointId);
          void qc.invalidateQueries({ queryKey: ['waypoints', wp.sourceId] });
        }}
      />
      <LocalMarkerSheet
        open={marker.open}
        initial={marker.initial}
        defaultCoords={marker.coords}
        storingSource={marker.sourceChoice}
        onClose={marker.onClose}
        onSave={marker.onSave}
      />
      <DeleteMarkerSheet
        marker={deleting?.kind === 'marker' ? deleting.marker : null}
        onClose={close}
        onDelete={async (m) => {
          await deleteMapMarker(m.sourceId, m.id);
          void qc.invalidateQueries({ queryKey: ['mapMarkers', m.sourceId] });
        }}
      />
    </>
  );

  return { pins, hint, overlay };
}
