/**
 * The all-devices overlays the Overview drew before Analysis merged in (Task
 * 4.1's DashboardMap), now drawn inside the Map Analysis canvas's 2D map:
 * GeoJSON layers, cross-source and traceroute-confirmed links, live packet
 * traffic, the ducting forecast and aircraft trails, and its one fit to the
 * nodes on opening. Each is today's layer,
 * mounted only while its MapContext switch is on, so it reads nothing when
 * off. Every one is a read; none sends on the mesh.
 */
import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import type L from 'leaflet';
import { MapBoundsUpdater } from '../../../components/Dashboard/DashboardMap';
import GeoJsonOverlay from '../../../components/GeoJsonOverlay';
import { CrossSourceLinksLayer } from '../../../components/map/layers/CrossSourceLinksLayer';
import { TracerouteConfirmedLinksLayer } from '../../../components/map/layers/TracerouteConfirmedLinksLayer';
import { PacketFlightsLayer } from '../../../components/map/layers/PacketFlightsLayer';
import DuctingLayer from '../../../components/map/layers/DuctingLayer';
import AircraftTrailsLayer from '../../../components/map/layers/AircraftTrailsLayer';
import { useAircraftTrailLayer } from '../../../components/map/useAircraftTrailLayer';
import type { AnalysisNode } from '../../../components/MapAnalysis/useAnalysisNodes';
import { useMapContext } from '../../../contexts/MapContext';
import { useGeoJsonLayers } from '../../map/deviceLayerGroups';
import type { FlightNodeEntry, PacketFlightStats } from '../../../utils/packetFlightEdges';
import { getSourceColor } from '../../../utils/sourceColors';

export interface OverviewOverlaysProps {
  /** Every device's id (the Unified map's set). */
  sourceIds: string[];
  /** The nodes the map draws (Map Analysis's `useAnalysisNodes`). */
  nodes: AnalysisNode[];
  /** Today's map age window across devices: the cross-source links' lookback, as DashboardMap. */
  lookbackHours: number;
  onPacketFlightsStats(stats: PacketFlightStats | null): void;
  /** The Leaflet map, for closing a popup when its sheet opens. */
  onMap(map: L.Map): void;
  /** An admin set a Default Map Center: open there, never fit to the nodes (DashboardMap's rule, #4125). */
  hasDefaultCenter: boolean;
}

export default function OverviewOverlays({ sourceIds, nodes, lookbackHours, onPacketFlightsStats, onMap, hasDefaultCenter }: OverviewOverlaysProps) {
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  const m = useMapContext();
  const { geoJsonLayers } = useGeoJsonLayers();

  const flightNodes = useMemo<FlightNodeEntry[]>(
    () => (m.showPacketFlights
      ? nodes.map(({ node, latLng }) => ({
          nodeNum: node.isMeshCore ? null : node.nodeNum,
          publicKey: node.isMeshCore ? node.publicKey : null,
          lat: latLng[0],
          lng: latLng[1],
        }))
      : []),
    [m.showPacketFlights, nodes],
  );
  // As DashboardMap's Unified map: a flight takes its device's colour.
  const idsKey = sourceIds.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 keyed on the ids' contents, as DashboardMap (#4835)
  const sourceColor = useMemo(() => (id: string) => getSourceColor(id, sourceIds), [idsKey]);

  // The trail label reads the flat names; Map Analysis's `user` carries only the role.
  const drawn = useMemo(() => nodes.map((n) => ({ ...n.node, user: undefined })), [nodes]);
  const trails = useAircraftTrailLayer({ drawnNodes: drawn, mode: { kind: 'unified' }, available: true });

  // 4.1's map opened fitted to the nodes when no Default Map Center is set; Map Analysis alone opens on the fallback centre.
  const positions = useMemo(() => nodes.map((n) => n.latLng), [nodes]);

  const any = sourceIds.length > 0;
  return (
    <>
      <MapBoundsUpdater positions={positions} sourceId={null} skip={hasDefaultCenter} />
      {geoJsonLayers.length > 0 && <GeoJsonOverlay layers={geoJsonLayers} />}
      {m.showCrossSourceLinks && any && <CrossSourceLinksLayer enabled sourceIds={sourceIds} lookbackHours={lookbackHours} />}
      {m.showCrossSourceLinks && m.showTracerouteConfirmedLinks && any && (
        <TracerouteConfirmedLinksLayer enabled sourceIds={sourceIds} lookbackHours={lookbackHours} />
      )}
      {m.showPacketFlights && any && (
        <PacketFlightsLayer
          sourceIds={sourceIds}
          nodes={flightNodes}
          maxPerSecond={m.packetFlightRate}
          sourceColor={sourceColor}
          onStatsChange={onPacketFlightsStats}
        />
      )}
      {m.showDucting && <DuctingLayer hoursAhead={m.ductingHoursAhead ?? 0} />}
      {m.showAircraftTrails && <AircraftTrailsLayer trails={trails.trails} formatTooltip={trails.formatTooltip} />}
    </>
  );
}
