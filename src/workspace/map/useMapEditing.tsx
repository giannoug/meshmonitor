/**
 * Map editing on the device map (Task 3.6; supersedes 3.1's view-only
 * waypoints): the context menu, the waypoint and local marker sheets, the
 * waypoint popup's Edit / Delete… and the delete confirms. One thing is open at
 * a time (D9c). Writes go through today's calls (useWaypoints, useMapMarkers)
 * under today's gate, waypoints:write on this source; without it the menu
 * offers Measure only and the popups have no actions. Nothing here runs a
 * timer or sends anything until a sheet's button is pressed.
 */
import { useCallback, useState, type ReactNode } from 'react';
import type L from 'leaflet';
import type { WaypointPopupActions } from '../../components/map/layers/WaypointsLayer';
import type { MapMarkerPopupActions } from '../../components/map/layers/MapMarkersLayer';
import type { WaypointChannelOption } from '../../components/useWaypointEditorForm';
import { useAuth } from '../../contexts/AuthContext';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import { useWaypoints } from '../../hooks/useWaypoints';
import type { MapMarker, MapMarkerInput } from '../../types/mapMarker';
import type { Waypoint, WaypointInput } from '../../types/waypoint';
import LocalMarkerSheet, { DeleteMarkerSheet } from './LocalMarkerSheet';
import MapContextMenu, { MapContextBridge, MapEditHint, type MapSpot } from './MapContextMenu';
import WaypointSheet, { DeleteWaypointSheet, WaypointPopupFooter } from './WaypointSheet';

type Coords = { lat: number; lon: number };
type Open =
  | { kind: 'menu'; spot: MapSpot }
  | { kind: 'waypoint'; initial: Waypoint | null; coords: Coords | null }
  | { kind: 'deleteWaypoint'; waypoint: Waypoint }
  | { kind: 'marker'; initial: MapMarker | null; coords: Coords | null }
  | { kind: 'deleteMarker'; marker: MapMarker }
  | null;

export interface MapEditingOptions {
  sourceId: string;
  sourceName: string;
  /** Only a Meshtastic radio sends waypoints (Map Analysis's rule): elsewhere only local markers are offered. */
  canSendWaypoints: boolean;
  channels: WaypointChannelOption[];
  selfNodeNum: number | null;
  isPhone: boolean;
  leaflet: L.Map | null;
  /** Today's Measure Distance gate. */
  measureDisabled: boolean;
  onMeasure(): void;
  /** A new local marker turns its layer on, as today's "+ Local marker" does. */
  onMarkerCreated(): void;
}

export function useMapEditing(o: MapEditingOptions) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('waypoints', 'write', { sourceId: o.sourceId });
  const canWaypoint = canEdit && o.canSendWaypoints;
  const waypoints = useWaypoints(o.sourceId);
  // Mutations only: LocalMarkers runs the list query.
  const markers = useMapMarkers(o.sourceId, false);
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const { leaflet } = o;

  const openMenu = useCallback((spot: MapSpot) => setOpen({ kind: 'menu', spot }), []);
  /** The keyboard path: the menu at the map's centre. */
  const openAtCentre = () => {
    if (!leaflet) return;
    const c = leaflet.getCenter();
    const size = leaflet.getSize();
    openMenu({ lat: c.lat, lon: c.lng, x: size.x / 2, y: size.y / 2 });
  };

  const lockedToOther = (wp: Waypoint) => Boolean(wp.lockedTo && o.selfNodeNum != null && Number(wp.lockedTo) !== o.selfNodeNum);
  const waypointActions: WaypointPopupActions | undefined = canWaypoint ? {
    canEdit: true,
    canDelete: true,
    lockedToOther,
    renderActions: (wp, locked) => (
      <WaypointPopupFooter
        locked={locked}
        onEdit={() => { leaflet?.closePopup(); setOpen({ kind: 'waypoint', initial: wp, coords: null }); }}
        onDelete={() => { leaflet?.closePopup(); setOpen({ kind: 'deleteWaypoint', waypoint: wp }); }}
      />
    ),
  } : undefined;
  const markerActions: MapMarkerPopupActions | undefined = canEdit ? {
    canEdit: true,
    onEdit: (m) => { leaflet?.closePopup(); setOpen({ kind: 'marker', initial: m, coords: null }); },
    onDelete: (m) => { leaflet?.closePopup(); setOpen({ kind: 'deleteMarker', marker: m }); },
  } : undefined;

  const editing = open?.kind === 'waypoint' ? open : null;
  const saveWaypoint = async (input: WaypointInput) => {
    if (editing?.initial) await waypoints.update.mutateAsync({ waypointId: editing.initial.waypointId, input });
    else await waypoints.create.mutateAsync(input);
  };
  const marker = open?.kind === 'marker' ? open : null;
  const saveMarker = async (input: MapMarkerInput) => {
    if (marker?.initial) await markers.update({ id: marker.initial.id, input });
    else {
      await markers.create(input);
      o.onMarkerCreated();
    }
  };
  const spotOf = (spot: MapSpot) => ({ lat: Math.round(spot.lat * 1e6) / 1e6, lon: Math.round(spot.lon * 1e6) / 1e6 });

  const bridge = <MapContextBridge onOpen={openMenu} />;
  const hint = canWaypoint ? <MapEditHint phone={o.isPhone} /> : null;
  const overlay: ReactNode = (
    <>
      {open?.kind === 'menu' && (
        <MapContextMenu
          spot={open.spot}
          phone={o.isPhone}
          canWaypoint={canWaypoint}
          canMarker={canEdit}
          measureDisabled={o.measureDisabled}
          onWaypoint={() => setOpen({ kind: 'waypoint', initial: null, coords: spotOf(open.spot) })}
          onMarker={() => setOpen({ kind: 'marker', initial: null, coords: spotOf(open.spot) })}
          onMeasure={o.onMeasure}
          onClose={close}
        />
      )}
      <WaypointSheet
        open={!!editing}
        sourceId={o.sourceId}
        sourceName={o.sourceName}
        initial={editing?.initial ?? null}
        defaultCoords={editing?.coords ?? null}
        channels={o.channels}
        selfNodeNum={o.selfNodeNum}
        onClose={close}
        onSave={saveWaypoint}
      />
      <DeleteWaypointSheet
        waypoint={open?.kind === 'deleteWaypoint' ? open.waypoint : null}
        sourceName={o.sourceName}
        channels={o.channels}
        onClose={close}
        onDelete={(wp) => waypoints.remove.mutateAsync(wp.waypointId)}
      />
      <LocalMarkerSheet
        open={!!marker}
        initial={marker?.initial ?? null}
        defaultCoords={marker?.coords ?? null}
        onClose={close}
        onSave={saveMarker}
      />
      <DeleteMarkerSheet
        marker={open?.kind === 'deleteMarker' ? open.marker : null}
        onClose={close}
        onDelete={(m) => markers.remove(m.id)}
      />
    </>
  );

  return { bridge, hint, overlay, waypointActions, markerActions, openAtCentre };
}
