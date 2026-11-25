/**
 * Today's Dashboard map overlays (4.1's map; Ruling CE), drawn inside the Map
 * Analysis canvas's 2D map:
 *
 * - Show Route Segments / Show Traceroute and Show Neighbors: DashboardMap's
 *   own layers built by its own functions (`dashboardMapLinks`) from the same
 *   Dashboard data (`/api/unified/dashboard` with the age window, and MeshCore
 *   neighbours fetched only while Show Neighbors is on), against these
 *   markers' positions;
 * - GeoJSON layers, cross-source and traceroute-confirmed links, live packet
 *   traffic, the ducting forecast and aircraft trails;
 * - the one fit to the nodes on opening, and Zoom to fit (#4898).
 *
 * Each is today's layer, mounted only while its MapContext switch is on, so it
 * reads nothing when off. Every one is a read; none sends on the mesh.
 */
import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import type L from 'leaflet';
import { FitAllNodesController, MapBoundsUpdater } from '../../../components/Dashboard/mapFitControllers';
import {
  dashboardMeshCoreNeighborLinks,
  dashboardMeshtasticNeighborLinks,
  dashboardTracerouteSegments,
} from '../../../components/Dashboard/dashboardMapLinks';
import GeoJsonOverlay from '../../../components/GeoJsonOverlay';
import { CrossSourceLinksLayer } from '../../../components/map/layers/CrossSourceLinksLayer';
import { TracerouteConfirmedLinksLayer } from '../../../components/map/layers/TracerouteConfirmedLinksLayer';
import { PacketFlightsLayer } from '../../../components/map/layers/PacketFlightsLayer';
import { TraceroutePathsLayer } from '../../../components/map/layers/TraceroutePathsLayer';
import { NeighborLinksLayer } from '../../../components/map/layers/NeighborLinksLayer';
import DuctingLayer from '../../../components/map/layers/DuctingLayer';
import AircraftTrailsLayer from '../../../components/map/layers/AircraftTrailsLayer';
import { useAircraftTrailLayer } from '../../../components/map/useAircraftTrailLayer';
import type { AnalysisNode } from '../../../components/MapAnalysis/useAnalysisNodes';
import { useMapContext } from '../../../contexts/MapContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useDashboardUnifiedData, type DashboardSource } from '../../../hooks/useDashboardData';
import { useMeshCoreNeighbors } from '../../../hooks/useMapAnalysisData';
import { useGeoJsonLayers } from '../../map/deviceLayerGroups';
import type { FlightNodeEntry, PacketFlightStats } from '../../../utils/packetFlightEdges';
import { getSourceColor } from '../../../utils/sourceColors';
import { buildLiveNodePositionMap } from '../../../utils/tracerouteSegments';

export interface OverviewOverlaysProps {
  /** Every device (the Unified map's set). */
  sources: DashboardSource[];
  /** The nodes the map draws (Map Analysis's `useAnalysisNodes`, with the Dashboard age gate). */
  nodes: AnalysisNode[];
  /** Those of `nodes` that have a marker: packet flights anchor on these only. */
  markerNodes: AnalysisNode[];
  /** The widest node-age setting across devices: MeshCore neighbours' lookback, as 4.1. */
  lookbackHours: number;
  /** The map age filter over that window: DashboardMap's `effectiveMaxAge`. */
  mapAgeHours: number;
  /** The map's Show RF / UDP / MQTT (Map Analysis's Transport filter). */
  transports: { rf: boolean; udp: boolean; mqtt: boolean };
  /** Zoom to fit: each increment re-frames (DashboardMap's counter). */
  fitRequest: number;
  onPacketFlightsStats(stats: PacketFlightStats | null): void;
  /** The Leaflet map, for closing a popup when its sheet opens. */
  onMap(map: L.Map): void;
  /** An admin set a Default Map Center: open there, never fit to the nodes (DashboardMap's rule, #4125). */
  hasDefaultCenter: boolean;
}

export default function OverviewOverlays(p: OverviewOverlaysProps) {
  const { sources, nodes, onMap } = p;
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  const m = useMapContext();
  const { overlayColors } = useSettings();
  const { geoJsonLayers } = useGeoJsonLayers();
  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);

  const positions = useMemo(() => nodes.map((n) => n.latLng), [nodes]);
  const positionByNodeNum = useMemo(
    () => buildLiveNodePositionMap(nodes, ({ node, latLng }) =>
      typeof node.nodeNum === 'number' && !node.isMeshCore ? { nodeNum: node.nodeNum, lat: latLng[0], lng: latLng[1] } : null),
    [nodes],
  );
  const positionByPublicKey = useMemo(() => {
    const out = new Map<string, [number, number]>();
    for (const { node, latLng } of nodes) {
      if (node.isMeshCore && typeof node.publicKey === 'string' && node.publicKey.length > 0) out.set(node.publicKey, latLng);
    }
    return out;
  }, [nodes]);

  // The Dashboard's own links, from its own data (the same request the markers came from).
  const linksOn = m.showPaths || m.showRoute || m.showNeighborInfo;
  const dashboard = useDashboardUnifiedData(sources, linksOn && sourceIds.length > 0);
  const meshcoreNeighbors = useMeshCoreNeighbors({
    enabled: m.showNeighborInfo && sourceIds.length > 0,
    sources: sourceIds,
    lookbackHours: p.lookbackHours,
  });
  const transportFlags = useMemo(
    () => ({ showRfNodes: p.transports.rf, showUdpNodes: p.transports.udp, showMqttNodes: p.transports.mqtt }),
    [p.transports.rf, p.transports.udp, p.transports.mqtt],
  );
  const segments = useMemo(
    () => (m.showPaths || m.showRoute
      ? dashboardTracerouteSegments(dashboard.traceroutes, positionByNodeNum, p.mapAgeHours, transportFlags)
      : []),
    [m.showPaths, m.showRoute, dashboard.traceroutes, positionByNodeNum, p.mapAgeHours, transportFlags],
  );
  const meshcoreLinks = useMemo(
    () => (m.showNeighborInfo ? dashboardMeshCoreNeighborLinks(meshcoreNeighbors.data?.items, positionByPublicKey) : []),
    [m.showNeighborInfo, meshcoreNeighbors.data, positionByPublicKey],
  );
  const meshtasticLinks = useMemo(
    () => (m.showNeighborInfo ? dashboardMeshtasticNeighborLinks(dashboard.neighborInfo, positionByNodeNum, transportFlags) : []),
    [m.showNeighborInfo, dashboard.neighborInfo, positionByNodeNum, transportFlags],
  );

  const flightNodes = useMemo<FlightNodeEntry[]>(
    () => (m.showPacketFlights
      ? p.markerNodes.map(({ node, latLng }) => ({
          nodeNum: node.isMeshCore ? null : node.nodeNum,
          publicKey: node.isMeshCore ? node.publicKey : null,
          lat: latLng[0],
          lng: latLng[1],
        }))
      : []),
    [m.showPacketFlights, p.markerNodes],
  );
  // As DashboardMap's Unified map: a flight takes its device's colour.
  const idsKey = sourceIds.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 keyed on the ids' contents, as DashboardMap (#4835)
  const sourceColor = useMemo(() => (id: string) => getSourceColor(id, sourceIds), [idsKey]);

  // The trail label reads the flat names; Map Analysis's `user` carries only the role.
  const drawn = useMemo(() => nodes.map((n) => ({ ...n.node, user: undefined })), [nodes]);
  const trails = useAircraftTrailLayer({ drawnNodes: drawn, mode: { kind: 'unified' }, available: true });

  const any = sourceIds.length > 0;
  return (
    <>
      <MapBoundsUpdater positions={positions} sourceId={null} skip={p.hasDefaultCenter} />
      <FitAllNodesController request={p.fitRequest} positions={positions} />
      {geoJsonLayers.length > 0 && <GeoJsonOverlay layers={geoJsonLayers} />}
      {/* DashboardMap's route segments and traceroute highlight, with its props. */}
      {m.showPaths && (
        <TraceroutePathsLayer
          segments={segments}
          snrColors={overlayColors.snrColors}
          mqttColor={overlayColors.mqttSegment}
          colorMode="snr"
          weight={2}
          opacity={0.85}
          dashMode="mqtt-unknown"
        />
      )}
      {m.showRoute && (
        <TraceroutePathsLayer
          segments={segments}
          snrColors={overlayColors.snrColors}
          colorMode="fixed"
          fixedColor="#facc15"
          weight={4}
          opacity={0.6}
          dashMode="never"
        />
      )}
      <NeighborLinksLayer links={meshcoreLinks} />
      <NeighborLinksLayer links={meshtasticLinks} />
      {m.showCrossSourceLinks && any && <CrossSourceLinksLayer enabled sourceIds={sourceIds} lookbackHours={p.mapAgeHours} />}
      {m.showCrossSourceLinks && m.showTracerouteConfirmedLinks && any && (
        <TracerouteConfirmedLinksLayer enabled sourceIds={sourceIds} lookbackHours={p.mapAgeHours} />
      )}
      {m.showPacketFlights && any && (
        <PacketFlightsLayer
          sourceIds={sourceIds}
          nodes={flightNodes}
          maxPerSecond={m.packetFlightRate}
          sourceColor={sourceColor}
          onStatsChange={p.onPacketFlightsStats}
        />
      )}
      {m.showDucting && <DuctingLayer hoursAhead={m.ductingHoursAhead ?? 0} />}
      {m.showAircraftTrails && <AircraftTrailsLayer trails={trails.trails} formatTooltip={trails.formatTooltip} />}
    </>
  );
}
