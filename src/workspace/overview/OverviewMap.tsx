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
 * The phone keeps 4.1's frame (Back, the node filter, the map); its Analysis
 * sheets are Task 4.3.
 *
 * One owner per screen (Ruling AD): neither DashboardPage nor MapAnalysisPage
 * is mounted. The reads are today's polled hooks and Map Analysis's own
 * queries; this adds no timer and sends nothing until a pin sheet's button is
 * pressed. On `/` only (`landing`), the admin's default landing page applies,
 * as on Classic's `/`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { MapProvider } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useDashboardSources } from '../../hooks/useDashboardData';
import { useDefaultLandingRedirect } from '../../hooks/useDefaultLandingRedirect';
import { useMaxNodeAgeHoursAcross } from '../../hooks/useNodeDisplaySettings';
import type { PacketFlightStats } from '../../utils/packetFlightEdges';
import LayersDrawer from '../map/LayersDrawer';
import { useIsPhone } from '../shell/useIsPhone';
import AnalysisChips from './analysis/AnalysisChips';
import InspectorPanelD from './analysis/InspectorPanelD';
import MapToolsMenu from './analysis/MapToolsMenu';
import OverviewOverlays from './analysis/OverviewOverlays';
import TimeControl from './analysis/TimeControl';
import { useOverviewLayerGroups } from './analysis/overviewLayerGroups';
import { useOverviewPins } from './analysis/useOverviewPins';
import '../../styles/map-analysis.css';
import styles from './OverviewMap.module.css';

/** `/analysis` and `/overview/analysis` open on the Analysis group (s5n1). */
const ANALYSIS_ROUTE = /^\/(overview\/)?analysis\/?$/;

export default function OverviewMap({ landing = false }: { landing?: boolean }) {
  return (
    <MapProvider>
      <MapAnalysisProvider>
        <AllDevicesMap landing={landing} />
      </MapAnalysisProvider>
    </MapProvider>
  );
}

function AllDevicesMap({ landing }: { landing: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { pathname } = useLocation();
  const { defaultLandingPage, defaultMapCenterLat, defaultMapCenterLon, defaultMapCenterZoom } = useSettings();
  const { data: sources = [], isSuccess } = useDashboardSources();
  useDefaultLandingRedirect({ skip: !landing, isSuccess, defaultLandingPage, sources });

  const ctx = useMapAnalysisCtx();
  const { config, nodeFilter, setNodeFilter } = ctx;
  const controls = useAnalysisControls();
  const { analysisNodes, in3D } = controls;

  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);
  const maxNodeAgeHours = useMaxNodeAgeHoursAcross(sourceIds);

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
  const groups = useOverviewLayerGroups({ controls, packetFlightsStats, aircraftCount, agedOutCount });

  // Today's node picker options (MapAnalysisToolbar): the nodes the map draws, by name.
  const nodeOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const { key, node } of analysisNodes) {
      if (!byKey.has(key)) byKey.set(key, node.longName || node.shortName || node.nodeId || key);
    }
    return [...byKey].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [analysisNodes]);

  const onMap = useCallback((map: L.Map) => setLeaflet(map), []);
  const layers = (
    <OverviewOverlays
      sourceIds={sourceIds}
      nodes={analysisNodes}
      lookbackHours={maxNodeAgeHours}
      onPacketFlightsStats={setPacketFlightsStats}
      onMap={onMap}
      hasDefaultCenter={defaultMapCenterLat != null && defaultMapCenterLon != null && defaultMapCenterZoom != null}
    />
  );

  const layersOn = TIMED_LAYERS.filter((l) => config.layers[l.key].enabled).length;
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
    <div className={styles.page}>
      <div className={styles.map}>
        <MapAnalysisCanvas workspace={{ layers, pins: pins.pins }} />
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
                  <SourceMultiSelect
                    sources={sources.map((s) => ({ id: s.id, name: s.name }))}
                    value={config.sources}
                    onChange={ctx.setSources}
                  />
                  <NodeTypeFilterControl />
                  <TransportFilterControl />
                  {search}
                  <NodeMultiSelect nodes={nodeOptions} value={config.selectedNodeIds} onChange={ctx.setSelectedNodeIds} />
                </div>
                <div className={styles.actions}>
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
          {!isPhone && <AnalysisChips />}
          {!isPhone && pins.hint}
        </div>
        {!isPhone && (layersOpen || selected) && (
          // Beside today's Site Planner / GNSS DOP panels, which keep the map's top-right corner.
          <div className={`${styles.slot} ${layersOpen ? styles.drawerSlot : ''} ${ctx.sitePlannerMode || ctx.gnssDopMode ? styles.besideTools : ''}`}>
            {layersOpen ? (
              <LayersDrawer
                groups={groups}
                onClose={() => setLayersOpen(false)}
                actions={(
                  <button type="button" className={styles.reset} onClick={ctx.reset}>
                    {t('common.reset')}
                  </button>
                )}
              />
            ) : (
              <InspectorPanelD />
            )}
          </div>
        )}
        {!isPhone && <MapLegend />}
      </div>
      {pins.overlay}
    </div>
  );
}
