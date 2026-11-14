/**
 * The device map (boards Main, f2-layers, 15-09): `/source/:id/map` on a
 * Meshtastic-family device. The map composes `BaseMap` and today's layers
 * (`DeviceMapLayers`, shared with NodesTab); a toolbar, the "On the map"
 * list, and one right-hand panel at a time: a node's peek, a neighbour
 * link's peek, or the Layers drawer.
 *
 * One owner per screen (Ruling AD): App is not mounted here. The screen runs
 * the source's node state with the hooks App uses (useChatRuntime's poll,
 * useSourceView) inside the providers App mounts for itself, handed Classic's
 * `/nodes` location so the quick age filter and sort apply as on Nodes.
 * Nothing here polls on a timer (Ruling N): neighbour links are read once
 * while their layer is on, traceroutes come with the poll.
 *
 * A node to centre on arrives as `location.state.focusNodeId` (Center on Map,
 * Ruling AJ); it opens that node's peek and is dropped from the history entry.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import { UiIcon } from '../../components/icons';
import { AdvancedNodeFilterPopup } from '../../components/AdvancedNodeFilterPopup';
import { BaseMap } from '../../components/map/BaseMap';
import { Map3DView } from '../../components/map/Map3DView';
import { DeviceMapLayers } from '../../components/map/DeviceMapLayers';
import { MapInstanceBridge } from '../../components/map/MapInstanceBridge';
import { MapLoadingOverlay } from '../../components/map/MapLoadingOverlay';
import { MapModeIndicator } from '../../components/map/MapModeIndicator';
import AircraftTrailsLayer from '../../components/map/layers/AircraftTrailsLayer';
import { CrossSourceLinksLayer } from '../../components/map/layers/CrossSourceLinksLayer';
import { TracerouteConfirmedLinksLayer } from '../../components/map/layers/TracerouteConfirmedLinksLayer';
import { PacketFlightsLayer } from '../../components/map/layers/PacketFlightsLayer';
import DuctingLayer from '../../components/map/layers/DuctingLayer';
import { LocalMarkers } from '../../components/map/layers/MapMarkersLayer';
import { useAircraftTrailLayer } from '../../components/map/useAircraftTrailLayer';
import DashboardWaypoints from '../../components/Dashboard/DashboardWaypoints';
import DashboardAtakContacts from '../../components/Dashboard/DashboardAtakContacts';
import DashboardNodePopup from '../../components/Dashboard/DashboardNodePopup';
import { MapCenterController } from '../../components/MapCenterController';
import MapPositionHandler from '../../components/MapPositionHandler';
import MeasureDistanceController from '../../components/MeasureDistanceController';
import PacketMonitorPanel from '../../components/PacketMonitorPanel';
import RouteSegmentTraceroutesModal from '../../components/RouteSegmentTraceroutesModal';
import ZoomHandler from '../../components/ZoomHandler';
import type { OverlayColors } from '../../config/overlayColors';
import { MapProvider, useMapContext, type EnrichedNeighborInfo } from '../../contexts/MapContext';
import { useMapViewStore } from '../../contexts/mapViewStore';
import { useData } from '../../contexts/DataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useMap3DToggle } from '../../hooks/useMap3DToggle';
import { usePersistedNodeFilters } from '../../hooks/usePersistedNodeFilters';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import { useChannels, useNodes } from '../../hooks/useServerData';
import { useSourceView } from '../../hooks/useSourceView';
import type { ThemeColors } from '../../hooks/useTraceroutePaths';
import { appBasename } from '../../init';
import api from '../../services/api';
import type { DbTraceroute } from '../../services/database';
import type { DeviceInfo } from '../../types/device';
import { getEffectivePosition } from '../../utils/nodeHelpers';
import { resolveClusteredMapCenterTargetZoom } from '../../utils/mapZoomAnimation';
import type { PacketFlightStats } from '../../utils/packetFlightEdges';
import ChatProviders from '../chat/ChatProviders';
import { useChatRuntime } from '../chat/useChatRuntime';
import { useNodeQuickAgeFilter } from '../../hooks/useNodeQuickAgeFilter';
import { useDeviceLayerGroups } from './deviceLayerGroups';
import LayersDrawer from './LayersDrawer';
import MapNodeList from './MapNodeList';
import MapToolbar, { MapControls } from './MapToolbar';
import NeighbourPeek, { type NeighbourLink } from './NeighbourPeek';
import NodePeek from './NodePeek';
import { markerKey, useDeviceMap } from './useDeviceMap';
import styles from './DeviceMap.module.css';

export interface DeviceMapRouteProps {
  sourceId: string;
  source: DashboardSource;
}

export default function DeviceMapRoute({ sourceId, source }: DeviceMapRouteProps) {
  // The real location: under ChatProviders the location is Classic's `/nodes`.
  const location = useLocation();
  const navigate = useNavigate();
  const focusNodeId = (location.state as { focusNodeId?: string } | null)?.focusNodeId ?? null;
  const { pathname, search, hash } = location;
  const onFocusHandled = useCallback(
    () => void navigate({ pathname, search, hash }, { replace: true, state: null }),
    [navigate, pathname, search, hash],
  );
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="nodes">
      <MapProvider>
        <DeviceMap sourceId={sourceId} focusNodeId={focusNodeId} onFocusHandled={onFocusHandled} />
      </MapProvider>
    </ChatProviders>
  );
}

type Panel = { kind: 'layers' } | { kind: 'node'; key: string } | { kind: 'link'; link: NeighbourLink } | null;

/** Leaflet polylines take colours, not CSS variables: read the theme's, as App does. */
function themeColors(overlay: OverlayColors): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    accentAlt: v('--color-accent-alt'),
    error: v('--color-error'),
    accent: v('--color-accent'),
    faint: v('--color-text-faint'),
    tracerouteForward: overlay.tracerouteForward,
    tracerouteReturn: overlay.tracerouteReturn,
    mqttSegment: overlay.mqttSegment,
    neighborLine: overlay.neighborLine,
    snrColors: overlay.snrColors,
  };
}

const noop = () => {};

interface DeviceMapProps {
  sourceId: string;
  focusNodeId: string | null;
  onFocusHandled(): void;
}

function DeviceMap({ sourceId, focusNodeId, onFocusHandled }: DeviceMapProps) {
  const { t } = useTranslation();
  const { pollData } = useChatRuntime(-1);
  const map = useMapContext();
  const { setTraceroutes, setNeighborInfo, setSelectedNodeId, setMapCenterTarget } = map;
  const settings = useSettings();
  const { currentNodeId } = useData();
  const mapView = useMapViewStore();
  const { channels } = useChannels();
  const { nodes, isLoading } = useNodes();
  const { securityFilter, setSecurityFilter, showNodeFilterPopup, setShowNodeFilterPopup } = useUI();
  const [nodeFilters, setNodeFilters] = usePersistedNodeFilters('nodeFilters');
  const [quickAgeHours] = useNodeQuickAgeFilter();
  const csrfFetch = useCsrfFetch();
  const queryClient = useQueryClient();
  const authFetch = useCallback((url: string, init?: RequestInit) => csrfFetch(url, init), [csrfFetch]);
  const refetchPoll = useCallback(() => queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) }), [queryClient, sourceId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 a theme change re-reads the CSS variables, as App does
  const mergedThemeColors = useMemo(() => themeColors(settings.overlayColors), [settings.overlayColors, settings.theme]);
  const [segment, setSegment] = useState<{ nodeNum1: number; nodeNum2: number } | null>(null);
  const view = useSourceView({
    baseUrl: appBasename,
    authFetch,
    refetchPoll,
    nodeFilters,
    mergedThemeColors,
    setSelectedRouteSegment: setSegment,
    setShowPurgeDataModal: noop,
  });
  const showData = view.shouldShowData();

  // As App's poll processing: traceroutes arrive with the poll.
  const polledTraceroutes = pollData?.traceroutes;
  useEffect(() => {
    if (polledTraceroutes) setTraceroutes(polledTraceroutes as unknown as DbTraceroute[]);
  }, [polledTraceroutes, setTraceroutes]);
  // Neighbour links: read while their layer is on; no refresh timer (Ruling N).
  const { data: neighbours } = useQuery({
    queryKey: ['workspace', 'neighbor-info', sourceId],
    queryFn: () => api.get<EnrichedNeighborInfo[]>(`/api/sources/${encodeURIComponent(sourceId)}/neighbor-info`),
    enabled: map.showNeighborInfo && showData,
  });
  useEffect(() => {
    if (neighbours) setNeighborInfo(neighbours);
  }, [neighbours, setNeighborInfo]);

  const [panel, setPanel] = useState<Panel>(null);
  const data = useDeviceMap({
    processedNodes: view.processedNodes,
    agedOutAircraftNodes: view.agedOutAircraftNodes,
    tracerouteNodeNums: view.tracerouteNodeNums,
    visibleNodeNums: view.visibleNodeNums,
    onLinkClick: (link) => setPanel({ kind: 'link', link }),
  });
  const { canUse3D, viewMode, setViewMode, effective3D, basemap3D, terrainTileUrl } = useMap3DToggle(
    settings.mapTileset,
    settings.customTilesets,
    settings.cartoApiKey,
  );
  const ownNode = nodes.find((n) => n.user?.id === currentNodeId);
  const ownNodePosition = ownNode?.position?.latitude && ownNode.position.longitude
    ? { lat: ownNode.position.latitude, lng: ownNode.position.longitude }
    : null;
  const [flightStats, setFlightStats] = useState<PacketFlightStats | null>(null);
  const layers = useDeviceLayerGroups({
    mqttOnly: data.mqttOnly,
    canUse3D,
    viewMode,
    setViewMode,
    effective3D,
    ownNodePosition,
    aircraftCount: data.aircraftCount,
    agedOutCount: data.agedOutCount,
    listAgeHours: data.listAgeHours,
    capFromQuickFilter: quickAgeHours != null,
    packetFlightsStats: flightStats,
  });
  const trails = useAircraftTrailLayer({ drawnNodes: data.visibleMapNodes, mode: { kind: 'source', sourceId }, available: !effective3D });
  const [measureActive, setMeasureActive] = useState(false);
  const [leaflet, setLeaflet] = useState<L.Map | null>(null);

  const positionOf = useCallback(
    (node: DeviceInfo): [number, number] | null => {
      const drawn = data.nodePositions.get(node.nodeNum);
      if (drawn) return drawn;
      const eff = getEffectivePosition(node);
      return eff.latitude != null && eff.longitude != null ? [eff.latitude, eff.longitude] : null;
    },
    [data.nodePositions],
  );
  const openNode = (node: DeviceInfo, center: boolean) => {
    setPanel({ kind: 'node', key: markerKey(node) });
    setSelectedNodeId(node.user?.id ?? null);
    const p = center ? positionOf(node) : null;
    if (p) setMapCenterTarget(p);
  };
  const closePanel = () => {
    if (panel?.kind === 'node') setSelectedNodeId(null);
    setPanel(null);
  };

  // Center on Map from elsewhere (Ruling AJ): handled once the nodes are in, then dropped.
  useEffect(() => {
    if (!focusNodeId || isLoading) return;
    const node = nodes.find((n) => n.user?.id === focusNodeId);
    if (node) openNode(node, true);
    onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 runs once per focus request, after the nodes load
  }, [focusNodeId, isLoading]);

  const peekNode = panel?.kind === 'node' ? nodes.find((n) => markerKey(n) === panel.key) : undefined;
  const fitPositions = data.visibleMapNodes.flatMap((n) => {
    const p = data.nodePositions.get(n.nodeNum);
    return p ? [p] : [];
  });
  const fitAll = () => {
    if (leaflet && fitPositions.length > 0) leaflet.fitBounds(L.latLngBounds(fitPositions), { padding: [40, 40] });
  };
  const [initial] = useState(() => initialView());
  function initialView(): { center: [number, number]; zoom: number } {
    const saved = mapView.get();
    if (saved.center) return { center: saved.center, zoom: saved.zoom };
    const { defaultMapCenterLat: lat, defaultMapCenterLon: lon, defaultMapCenterZoom: zoom } = settings;
    if (lat !== null && lon !== null && zoom !== null) return { center: [lat, lon], zoom };
    return { center: [20, 0], zoom: 2 };
  }
  // With nothing saved or configured, start on the own node (else a node) at the saved zoom, as NodesTab does.
  const [startOnNodes, setStartOnNodes] = useState(() => initial.zoom === 2);
  // Read before the map reports its own (world) zoom into the store.
  const [startZoom] = useState(() => mapView.get().zoom);
  const firstFix = fitPositions[0];
  useEffect(() => {
    if (!leaflet || !startOnNodes || !firstFix) return;
    setStartOnNodes(false);
    const own = ownNode ? positionOf(ownNode) : null;
    leaflet.setView(own ?? firstFix, startZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 one-time start view once a position is known
  }, [leaflet, startOnNodes, !!firstFix]);

  const sourceIds = useMemo(() => [sourceId], [sourceId]);

  return (
    <div className={styles.page}>
      <div className={styles.mapArea} data-panel={panel ? 'open' : undefined}>
        {effective3D ? (
          <Map3DView
            center={initial.center}
            zoom={initial.zoom}
            basemap={basemap3D}
            terrainTileUrl={terrainTileUrl}
            nodes={data.node3DFeatures}
            sourceIds={sourceIds}
            showNeighbors={map.showNeighborInfo}
            showTraceroutes={map.showPaths || map.showRoute}
            showCrossSourceLinks={map.showCrossSourceLinks}
            showTracerouteConfirmedLinks={map.showCrossSourceLinks && map.showTracerouteConfirmedLinks}
            lookbackHours={data.effectiveMapMaxAge}
            visibleNodeNums={new Set(data.visibleMapNodes.map((n) => n.nodeNum))}
            renderPopup={(key) => {
              const node = data.visibleMapNodes.find((n) => markerKey(n) === key);
              const p = node && data.nodePositions.get(node.nodeNum);
              return node && p ? <DashboardNodePopup node={node} pos={{ lat: p[0], lng: p[1] }} /> : null;
            }}
            onUnsupported={() => setViewMode('2d')}
          />
        ) : (
          <BaseMap
            center={initial.center}
            zoom={initial.zoom}
            tilesetId={settings.mapTileset}
            customTilesets={settings.customTilesets}
            cartoApiKey={settings.cartoApiKey}
            styleJson={settings.activeStyleJson ?? undefined}
            resizeTrigger={`${layers.showPacketMonitor}`}
          >
            <MapInstanceBridge onMap={setLeaflet} />
            <MapCenterController
              centerTarget={map.mapCenterTarget}
              onCenterComplete={() => setMapCenterTarget(null)}
              targetZoom={resolveClusteredMapCenterTargetZoom(settings.mapCenterTargetZoom, data.clusterZoomThreshold)}
            />
            <ZoomHandler onZoomChange={mapView.setZoom} />
            <MapPositionHandler />
            {map.showWaypoints && <DashboardWaypoints sourceId={sourceId} />}
            {map.showLocalMarkers && <LocalMarkers sourceId={sourceId} />}
            {map.showAtakContacts && <DashboardAtakContacts sourceId={sourceId} />}
            {measureActive && <MeasureDistanceController active points={data.measurePoints} onExit={() => setMeasureActive(false)} />}
            {map.showAircraftTrails && <AircraftTrailsLayer trails={trails.trails} formatTooltip={trails.formatTooltip} />}
            <DeviceMapLayers
              mapState={{ showPolarGrid: map.showPolarGrid, showPaths: map.showPaths, showRoute: map.showRoute }}
              nodes={data.nodeMarkers}
              onOmsClick={(_marker, key) => {
                const node = data.visibleMapNodes.find((n) => markerKey(n) === key);
                if (node) openNode(node, false);
              }}
              clusterZoomThreshold={data.clusterZoomThreshold}
              estimatedRadii={data.estimatedRadii}
              accuracyRegions={data.accuracyRegions}
              ownNodePosition={ownNodePosition}
              geoJsonLayers={layers.geoJsonLayers}
              traceroutePaths={view.traceroutePathsElements}
              selectedTraceroute={view.selectedNodeTraceroute}
              neighborLinks={data.neighborLinks}
            />
            {map.showCrossSourceLinks && (
              <CrossSourceLinksLayer enabled sourceIds={sourceIds} lookbackHours={data.effectiveMapMaxAge} />
            )}
            {map.showCrossSourceLinks && map.showTracerouteConfirmedLinks && (
              <TracerouteConfirmedLinksLayer enabled sourceIds={sourceIds} lookbackHours={data.effectiveMapMaxAge} />
            )}
            {map.showPacketFlights && (
              <PacketFlightsLayer sourceIds={sourceIds} nodes={data.flightNodes} maxPerSecond={map.packetFlightRate} onStatsChange={setFlightStats} />
            )}
            {map.showDucting && <DuctingLayer hoursAhead={map.ductingHoursAhead} />}
          </BaseMap>
        )}
        {isLoading && <MapLoadingOverlay />}

        <div className={styles.overlay}>
          <MapToolbar layersOpen={panel?.kind === 'layers'} onLayers={() => (panel?.kind === 'layers' ? closePanel() : setPanel({ kind: 'layers' }))} />
          <div className={styles.columns}>
            <MapNodeList
              sourceId={sourceId}
              nodes={data.visibleMapNodes}
              selectedId={map.selectedNodeId}
              hopsOf={data.hopsOf}
              onPick={(node) => openNode(node, true)}
            />
            <span className={styles.spacer} />
            <div className={styles.panel}>
              {panel?.kind === 'layers' && <LayersDrawer groups={layers.groups} onClose={closePanel} />}
              {panel?.kind === 'link' && <NeighbourPeek link={panel.link} onClose={closePanel} />}
            </div>
          </div>
          <div className={styles.foot}>
            {map.showNeighborInfo && (
              // Above the Traceroute mode banner, which takes the bottom centre.
              <p className={styles.hint} role="status" data-raised={map.showRoute || undefined}>
                <UiIcon name="map" size={16} />
                {t('workspace.map.neighbours_hint')}
              </p>
            )}
            {map.showRoute && (
              <MapModeIndicator
                icon="route"
                label={t('map.tracerouteModeActive', 'Traceroute mode')}
                hint={t('map.tracerouteModeHint', 'Clicking a node with a stored route shows its path instead of its info popup')}
                onDisable={() => map.setShowRoute(false)}
                disableLabel={t('map.tracerouteModeDisable', 'Turn off Show Traceroute')}
              />
            )}
            <span className={styles.spacer} />
            {!effective3D && (
              <MapControls
                canFit={fitPositions.length > 0}
                onFit={fitAll}
                measureActive={measureActive}
                measureDisabled={data.measurePoints.length < 2}
                onMeasure={setMeasureActive}
              />
            )}
          </div>
        </div>
        {/* The node peek is a side panel here and a sheet on phone (NodePeek decides). */}
        {peekNode && (
          <div className={styles.peekSlot}>
            <NodePeek node={peekNode} sourceId={sourceId} onClose={closePanel} />
          </div>
        )}
      </div>
      {layers.showPacketMonitor && (
        <div className={styles.packets}>
          <PacketMonitorPanel
            onClose={layers.closePacketMonitor}
            onNodeClick={(nodeId) => {
              const node = nodes.find((n) => n.user?.id === nodeId);
              if (node) openNode(node, true);
            }}
          />
        </div>
      )}
      <AdvancedNodeFilterPopup
        isOpen={showNodeFilterPopup}
        nodeFilters={nodeFilters}
        securityFilter={securityFilter}
        channels={channels}
        onNodeFiltersChange={setNodeFilters}
        onSecurityFilterChange={setSecurityFilter}
        onClose={() => setShowNodeFilterPopup(false)}
      />
      {segment && (
        <RouteSegmentTraceroutesModal
          nodeNum1={segment.nodeNum1}
          nodeNum2={segment.nodeNum2}
          traceroutes={map.traceroutes}
          nodes={nodes}
          onClose={() => setSegment(null)}
        />
      )}
      {!showData && !isLoading && nodes.length === 0 && (
        <p className={styles.empty} role="status">{t('workspace.map.not_connected')}</p>
      )}
    </div>
  );
}
