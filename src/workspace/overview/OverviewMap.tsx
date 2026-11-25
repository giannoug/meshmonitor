/**
 * The all-devices map with Analysis merged in (boards f6-overview, 5-01 …
 * 5-06, 5-08; s5n1): `/`, `/overview`, `/overview/map`, `/analysis` and
 * `/overview/analysis`, one route element so the map stays mounted between
 * them. The map is today's Map Analysis canvas, every device's nodes merged,
 * as is (Rule X: it takes one optional prop for the Workspace's extra layers
 * and pin sheets). Over it:
 *
 * - the bar: today's Map Analysis filters (devices, node types, transports,
 *   the node filter, the node picker), then Tools, Time Slider and Layers;
 * - a chip per analysis layer that is on, and the pin placement hint;
 * - one right-hand panel (Ruling 3.1): the Layers drawer (Analysis first:
 *   `/analysis` opens on it), or today's inspector with "Open node page"
 *   while something is selected.
 *
 * The all-devices overlays 4.1's map drew (GeoJSON, cross-source links, packet
 * traffic, ducting, aircraft trails) are drawn inside the canvas.
 *
 * The phone (5-08 … 5-13) keeps 4.1's frame (Back, the node filter, the map)
 * with the chips and the placement hint under it. Below the map: the inspect
 * hint or today's inspector (PhoneInspector), then the bar (PhoneMapBar:
 * Tools, Time, Layers, Zoom to fit) with its Tools and Layers sheets. The
 * canvas docks today's Link Profile drawer and Site Planner / GNSS DOP panels
 * along its bottom as sheets (`stackedPanels`), so the map above them still
 * takes taps.
 *
 * One owner per screen (Ruling AD): neither DashboardPage nor MapAnalysisPage
 * is mounted. The reads are today's polled hooks and Map Analysis's own
 * queries; this adds no timer and sends nothing until a pin sheet's button is
 * pressed. On `/` only (`landing`), the admin's default landing page applies,
 * as on Classic's `/`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type L from 'leaflet';
import { UiIcon } from '../../components/icons';
import MapAnalysisCanvas from '../../components/MapAnalysis/MapAnalysisCanvas';
import MapLegend from '../../components/MapAnalysis/MapLegend';
import NodeMultiSelect from '../../components/MapAnalysis/NodeMultiSelect';
import NodeTypeFilterControl from '../../components/MapAnalysis/NodeTypeFilterControl';
import SourceMultiSelect from '../../components/MapAnalysis/SourceMultiSelect';
import TransportFilterControl from '../../components/MapAnalysis/TransportFilterControl';
import { MapAnalysisProvider, useMapAnalysisCtx } from '../../components/MapAnalysis/MapAnalysisContext';
import { TIMED_LAYERS, useAnalysisControls } from '../../components/MapAnalysis/analysisControls';
import { isAgedOutAircraft } from '../../components/map/agedOutAircraft';
import { AnalysisSurfaceContext, type AnalysisSurface } from '../../components/MapAnalysis/analysisSurface';
import type { NodeSourceRef } from '../../components/Dashboard/DashboardNodePopup';
import { nodeGatewayRingColor, nodeSourceRingColor } from '../../components/Dashboard/nodeSourceRing';
import { MapProvider, useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useDashboardSources, useDashboardUnifiedData, type NodeGatewayRef } from '../../hooks/useDashboardData';
import { DashboardDataOptionsContext } from '../../hooks/dashboardDataScope';
import { useDefaultLandingRedirect } from '../../hooks/useDefaultLandingRedirect';
import { useMaxInfraNodeAgeHoursAcross, useMaxNodeAgeHoursAcross } from '../../hooks/useNodeDisplaySettings';
import { effectiveMapMaxAgeHours } from '../../utils/mapAge';
import { isHiddenByPositionlessAdvert, readHidePositionlessAdverts, writeHidePositionlessAdverts } from '../../utils/meshcoreAdvertPosition';
import type { PacketFlightStats } from '../../utils/packetFlightEdges';
import LayersDrawer from '../map/LayersDrawer';
import type { LayerGroupSpec, LayerItem } from '../map/LayerGroup';
import { useStoredFlag } from '../map/deviceLayerGroups';
import { useIsPhone } from '../shell/useIsPhone';
import AnalysisChips from './analysis/AnalysisChips';
import InspectorPanelD from './analysis/InspectorPanelD';
import NodeColourKey from './analysis/NodeColourKey';
import MapToolsMenu from './analysis/MapToolsMenu';
import OverviewOverlays from './analysis/OverviewOverlays';
import PhoneInspector from './analysis/PhoneInspector';
import PhoneMapBar from './analysis/PhoneMapBar';
import TimeControl from './analysis/TimeControl';
import { useOverviewLayerGroups, type DashboardControls } from './analysis/overviewLayerGroups';
import { useOverviewPins } from './analysis/useOverviewPins';
import '../../styles/map-analysis.css';
import styles from './OverviewMap.module.css';

/** `/analysis` and `/overview/analysis` open on the Analysis group (s5n1). */
const ANALYSIS_ROUTE = /^\/(overview\/)?analysis\/?$/;

/** As 4.1 (DashboardPage): the server leaves out nodes the Dashboard map hides by age. */
const AGE_WINDOW = { ageWindow: true };

export default function OverviewMap({ landing = false }: { landing?: boolean }) {
  return (
    <MapProvider>
      <MapAnalysisProvider>
        <DashboardDataOptionsContext.Provider value={AGE_WINDOW}>
          <OverviewSurface landing={landing} />
        </DashboardDataOptionsContext.Provider>
      </MapAnalysisProvider>
    </MapProvider>
  );
}

/**
 * Today's Dashboard map rules, given to the Map Analysis components through
 * `AnalysisSurfaceContext` (Ruling CE): the per-node age gate (the map age
 * filter over each device's window, MeshCore infrastructure by its own,
 * #4899), hiding MeshCore nodes without a current position advert (#5578),
 * the colour ring by source or gateway (#6125, #6175), and a popup's "seen by"
 * row opening the Workspace node page (4.1).
 */
function OverviewSurface({ landing }: { landing: boolean }) {
  const navigate = useNavigate();
  const m = useMapContext();
  const { data: sources = [] } = useDashboardSources();
  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);
  const maxNodeAgeHours = useMaxNodeAgeHoursAcross(sourceIds);
  const maxInfraNodeAgeHours = useMaxInfraNodeAgeHoursAcross(sourceIds);
  const mapAgeHours = effectiveMapMaxAgeHours(m.mapMaxAgeHours, maxNodeAgeHours);
  // DashboardMap's infra window: the map age filter narrows it too; 0 = never expires.
  const infraAgeHours = maxInfraNodeAgeHours === 0 ? 0 : effectiveMapMaxAgeHours(m.mapMaxAgeHours, maxInfraNodeAgeHours);

  // #5578: the MeshCore map's browser setting, as DashboardMap.
  const [hidePositionless, setHidePositionless] = useState(readHidePositionlessAdverts);
  useEffect(() => writeHidePositionlessAdverts(hidePositionless), [hidePositionless]);

  // #6125/#6175: Unified only (2+ devices), as DashboardMap; the colour domains are sorted ids.
  const { nodes } = useDashboardUnifiedData(sources, sourceIds.length > 0);
  const colorSourceIds = useMemo(() => [...sourceIds].sort(), [sourceIds]);
  const gatewayIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes as Array<{ gateways?: NodeGatewayRef[] }>) {
      for (const g of n.gateways ?? []) if (g?.gatewayId) ids.add(g.gatewayId);
    }
    return Array.from(ids).sort();
  }, [nodes]);
  const unified = sources.length >= 2;
  const { colorNodesBySource, colorNodesByGateway } = m;
  const ringColor = useCallback(
    (node: { sourceId?: string; gateways?: unknown }) =>
      colorNodesByGateway
        ? nodeGatewayRingColor(colorNodesByGateway, unified, node.gateways as NodeGatewayRef[] | undefined, gatewayIds)
        : nodeSourceRingColor(colorNodesBySource, unified, node.sourceId, colorSourceIds),
    [colorNodesBySource, colorNodesByGateway, unified, gatewayIds, colorSourceIds],
  );

  // 4.1: a popup's "seen by" row opens that device's node page (Meshtastic) or the device (MeshCore).
  const onSourceSelect = useCallback(
    (source: NodeSourceRef, nodeId: string | undefined) => {
      const base = `/source/${encodeURIComponent(source.sourceId)}`;
      void navigate(source.protocol !== 'MeshCore' && nodeId ? `${base}/node/${encodeURIComponent(nodeId)}` : base);
    },
    [navigate],
  );

  const surface = useMemo<AnalysisSurface>(
    () => ({
      ageGate: { maxAgeHours: mapAgeHours, infraMaxAgeHours: infraAgeHours },
      hidePositionlessAdverts: hidePositionless,
      ringColor,
      onSourceSelect,
    }),
    [mapAgeHours, infraAgeHours, hidePositionless, ringColor, onSourceSelect],
  );
  const colourKey = unified && (colorNodesBySource || colorNodesByGateway)
    ? { title: colorNodesByGateway ? 'gateway' as const : 'source' as const, ids: colorNodesByGateway ? gatewayIds : colorSourceIds }
    : null;

  return (
    <AnalysisSurfaceContext.Provider value={surface}>
      <AllDevicesMap
        landing={landing}
        unified={unified}
        hidePositionless={hidePositionless}
        onHidePositionless={setHidePositionless}
        hasMeshCoreNodes={(nodes as Array<{ isMeshCore?: boolean }>).some((n) => n.isMeshCore)}
        maxNodeAgeHours={maxNodeAgeHours}
        mapAgeHours={mapAgeHours}
        colourKey={colourKey && { ...colourKey, names: new Map(sources.map((s) => [s.id, s.name])) }}
      />
    </AnalysisSurfaceContext.Provider>
  );
}

interface AllDevicesMapProps extends DashboardControls {
  landing: boolean;
  colourKey: ({ title: 'source' | 'gateway'; ids: string[]; names: Map<string, string> }) | null;
}

function AllDevicesMap({ landing, colourKey, ...dashboard }: AllDevicesMapProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { pathname, state } = useLocation();
  const { defaultLandingPage, defaultMapCenterLat, defaultMapCenterLon, defaultMapCenterZoom } = useSettings();
  const { data: sources = [], isSuccess } = useDashboardSources();
  // Classic's "Sources" button opens `/` with `state.showList`: stay on the list.
  useDefaultLandingRedirect({ skip: !landing || !!(state as { showList?: boolean } | null)?.showList, isSuccess, defaultLandingPage, sources });

  const ctx = useMapAnalysisCtx();
  const { config, nodeFilter, setNodeFilter } = ctx;
  const controls = useAnalysisControls();
  const { analysisNodes, in3D } = controls;


  // The Layers drawer: open on the analysis URLs, also when the map was already open.
  const analysisRoute = ANALYSIS_ROUTE.test(pathname);
  const [layersOpen, setLayersOpen] = useState(analysisRoute);
  useEffect(() => {
    if (analysisRoute) setLayersOpen(true);
  }, [analysisRoute]);
  // One right-hand panel at a time (Ruling 3.1): a new selection opens the inspector in the drawer's place.
  const { selected } = ctx;
  useEffect(() => {
    if (selected) setLayersOpen(false);
  }, [selected]);

  const [leaflet, setLeaflet] = useState<L.Map | null>(null);
  const [packetFlightsStats, setPacketFlightsStats] = useState<PacketFlightStats | null>(null);
  const pins = useOverviewPins(!in3D, leaflet);

  const aircraftCount = analysisNodes.filter(({ node }) => node.likelyAircraft === true && !isAgedOutAircraft(node)).length;
  const agedOutCount = analysisNodes.filter(({ node }) => isAgedOutAircraft(node)).length;
  const groups = useOverviewLayerGroups({ controls, packetFlightsStats, aircraftCount, agedOutCount, dashboard });
  // #4898: Zoom to fit, a monotonic request as DashboardMap's.
  const [fitRequest, setFitRequest] = useState(0);

  // Today's node picker options (MapAnalysisToolbar): the nodes the map draws, by name.
  const nodeOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const { key, node } of analysisNodes) {
      if (!byKey.has(key)) byKey.set(key, node.longName || node.shortName || node.nodeId || key);
    }
    return [...byKey].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [analysisNodes]);

  // The nodes with a marker: the markers layer also drops MeshCore nodes without a current position advert (#5578).
  const markerNodes = useMemo(
    () => dashboard.hidePositionless
      ? analysisNodes.filter(({ node }) => !(node.isMeshCore && isHiddenByPositionlessAdvert(node as Parameters<typeof isHiddenByPositionlessAdvert>[0], true)))
      : analysisNodes,
    [analysisNodes, dashboard.hidePositionless],
  );

  const onMap = useCallback((map: L.Map) => setLeaflet(map), []);
  const layers = (
    <OverviewOverlays
      sources={sources}
      nodes={analysisNodes}
      markerNodes={markerNodes}
      lookbackHours={dashboard.maxNodeAgeHours}
      mapAgeHours={dashboard.mapAgeHours}
      transports={config.transports}
      fitRequest={fitRequest}
      onPacketFlightsStats={setPacketFlightsStats}
      onMap={onMap}
      hasDefaultCenter={defaultMapCenterLat != null && defaultMapCenterLon != null && defaultMapCenterZoom != null}
    />
  );

  const layersOn = TIMED_LAYERS.filter((l) => config.layers[l.key].enabled).length;
  // Today's Map Analysis filters: on the desktop bar, in the phone's Layers sheet (Filters).
  const filters = [
    { id: 'sources', label: 'Sources', node: <SourceMultiSelect sources={sources.map((s) => ({ id: s.id, name: s.name }))} value={config.sources} onChange={ctx.setSources} /> },
    { id: 'node-types', label: 'Node types', node: <NodeTypeFilterControl /> },
    { id: 'transports', label: 'Transports', node: <TransportFilterControl /> },
    { id: 'nodes', label: 'Nodes', node: <NodeMultiSelect nodes={nodeOptions} value={config.selectedNodeIds} onChange={ctx.setSelectedNodeIds} /> },
  ];
  const filterNode = (id: string) => filters.find((f) => f.id === id)?.node;
  const fit = (
    <button
      type="button"
      className={styles.fit}
      onClick={() => setFitRequest((n) => n + 1)}
      disabled={analysisNodes.length === 0}
      title={analysisNodes.length === 0 ? 'No positioned nodes to zoom to' : `Zoom to fit all ${analysisNodes.length} positioned nodes`}
      aria-label="Zoom to fit all nodes"
    >
      <UiIcon name="fitBounds" size={18} />
    </button>
  );
  const reset = (
    <button type="button" className={styles.reset} onClick={ctx.reset}>
      {t('common.reset')}
    </button>
  );
  // Today's Dashboard map "Show Legend" browser setting: a phone map has no room for a standing legend.
  const [showLegend, setShowLegend] = useStoredFlag('meshmonitor-showLegend');
  const phoneGroups: LayerGroupSpec[] = groups.flatMap((g) =>
    g.id === 'analysis'
      ? [g, { id: 'filters', title: t('workspace.overview.filters'), items: filters.map((f): LayerItem => ({ kind: 'custom', ...f })) }]
      : g.id === 'base'
        ? [{ ...g, items: [...g.items, { kind: 'toggle', id: 'legend', label: t('workspace.map.legend'), checked: showLegend, onChange: setShowLegend }] }]
        : [g],
  );
  // One at a time on the phone: a tool, or a panel in the map's bottom dock, holds the place of the inspector.
  const toolHolds = Object.values(controls.tools).some((tool) => tool.shown && tool.active)
    || ctx.linkProfileMode || ctx.linkEndpoints.length > 0 || ctx.sitePlannerMode;
  const heldBy = toolHolds ? 'tool' : ctx.gnssDopMode ? 'dop' : null;
  const search = (
    <label className={styles.search}>
      <UiIcon name="search" size={18} />
      <input
        type="search"
        value={nodeFilter}
        onChange={(e) => setNodeFilter(e.target.value)}
        placeholder={t('nodes.filter_placeholder')}
        aria-label={t('nodes.filter_title')}
      />
    </label>
  );

  return (
    <div className={`${styles.page} ${isPhone ? styles.phone : ''}`}>
      <div className={styles.map}>
        <MapAnalysisCanvas workspace={{ layers, pins: pins.pins, stackedPanels: isPhone }} />
        <div className={styles.overlay}>
          <div className={styles.bar} role="toolbar" aria-label={t('workspace.overview.map_bar')}>
            {isPhone ? (
              <>
                <Link className={styles.back} to="/overview">
                  <UiIcon name="back" size={22} />
                  <span className={styles.srOnly}>{t('common.back')}</span>
                </Link>
                {search}
              </>
            ) : (
              <>
                <div className={styles.filters}>
                  {filterNode('sources')}
                  {filterNode('node-types')}
                  {filterNode('transports')}
                  {search}
                  {filterNode('nodes')}
                </div>
                <div className={styles.actions}>
                  {fit}
                  <MapToolsMenu tools={controls.tools} />
                  <TimeControl />
                  <button
                    type="button"
                    className={styles.layers}
                    aria-pressed={layersOpen}
                    aria-label={layersOn > 0 ? t('workspace.overview.layers_count', { count: layersOn }) : undefined}
                    onClick={() => setLayersOpen((o) => !o)}
                  >
                    {t('workspace.map.layers')}
                    {layersOn > 0 && <span className={styles.badge}>{layersOn}</span>}
                  </button>
                </div>
              </>
            )}
          </div>
          <AnalysisChips />
          {pins.hint}
        </div>
        {!isPhone && (layersOpen || selected) && (
          // Beside today's Site Planner / GNSS DOP panels, which keep the map's top-right corner.
          <div className={`${styles.slot} ${layersOpen ? styles.drawerSlot : ''} ${ctx.sitePlannerMode || ctx.gnssDopMode ? styles.besideTools : ''}`}>
            {layersOpen ? (
              <LayersDrawer
                groups={groups}
                onClose={() => setLayersOpen(false)}
                actions={reset}
              />
            ) : (
              <InspectorPanelD />
            )}
          </div>
        )}
        {(!isPhone || showLegend) && <MapLegend />}
        {colourKey && <NodeColourKey {...colourKey} />}
      </div>
      {isPhone && (
        <>
          <PhoneInspector heldBy={heldBy} />
          <PhoneMapBar
            tools={controls.tools}
            groups={phoneGroups}
            layersOpen={layersOpen}
            onLayersOpen={setLayersOpen}
            layersOn={layersOn}
            layersActions={reset}
            fit={fit}
          />
        </>
      )}
      {pins.overlay}
    </div>
  );
}
