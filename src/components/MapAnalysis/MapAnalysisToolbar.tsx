import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LocateFixed, Maximize, Clock, Ruler, Mountain, RadioTower, RotateCcw,
  Radar, Box, Satellite, Eye, Wrench, Layers, Activity, StickyNote, MapPinPlus,
} from 'lucide-react';
import { useDashboardSources } from '../../hooks/useDashboardData';
import { useShellEmbedded } from '../../contexts/ShellContext';
import ToolbarMenu, { ToolbarMenuItem } from './ToolbarMenu';
import SourceMultiSelect from './SourceMultiSelect';
import NodeTypeFilterControl from './NodeTypeFilterControl';
import TransportFilterControl from './TransportFilterControl';
import NodeSearchControl from './NodeSearchControl';
import NodeMultiSelect from './NodeMultiSelect';
import TracerouteControls from './TracerouteControls';
import { useMapAnalysisCtx } from './MapAnalysisContext';
import { TIMED_LAYERS, UNTIMED_LAYERS, useAnalysisControls } from './analysisControls';
import { LayerKey } from '../../hooks/useMapAnalysisConfig';
import {
  usePositions,
  useTraceroutes,
  useNeighbors,
  useAggregateProgress,
} from '../../hooks/useMapAnalysisData';

const ICON = 16;

export default function MapAnalysisToolbar() {
  const navigate = useNavigate();
  // Inside the Workspace shell (#6365) the shell owns navigation; the rest of
  // this toolbar (layers, filters) is content.
  const embedded = useShellEmbedded();
  const {
    config,
    setLayerEnabled,
    setLayerLookback,
    setSources,
    setSelectedNodeIds,
    setTimeSlider,
    setFollowMode,
    setAutoZoom,
    setViewMode,
    measureMode,
    linkProfileMode,
    sitePlannerMode,
    gnssDopMode,
    setGnssDopMode,
    pinPlaceMode,
    reset,
  } = useMapAnalysisCtx();
  const { data: sources = [] } = useDashboardSources();
  // The 3D gate, the 2D-only rule, the polar grid gate and the Tools live in
  // `useAnalysisControls`, shared with the Workspace Overview map (#6365).
  const { tools, analysisNodes, threeD, twoDOnly, twoDOnlyTitle, hasOwnNode } = useAnalysisControls();

  // Node picker (issue #3788): deduped/sorted options built from the same
  // shared node hook the markers layer uses, so the picker never lists a node
  // the map itself wouldn't render.
  const nodeOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const { key, node } of analysisNodes) {
      if (!byKey.has(key)) byKey.set(key, node.longName || node.shortName || node.nodeId || key);
    }
    return [...byKey]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [analysisNodes]);

  const sourceIds = config.sources.length === 0
    ? sources.map((s: { id: string }) => s.id)
    : config.sources;

  // Trails / heatmap / SNR overlay all consume /api/analysis/positions. Drive
  // the toolbar's shared positions hook with the longest enabled lookback so
  // the global progress bar reflects whichever fetch will take longest. Layer
  // components fire their own usePositions calls with per-layer lookbacks;
  // identical-args calls share React Query cache. SNR overlay in "Last" mode
  // (lookbackHours === null) skips the positions API entirely — it reads from
  // the unified node table — so don't include it here.
  const snrUsesPositions =
    config.layers.snrOverlay.enabled && config.layers.snrOverlay.lookbackHours !== null;
  const positionsLookback = Math.max(
    config.layers.trails.enabled ? (config.layers.trails.lookbackHours ?? 24) : 0,
    config.layers.heatmap.enabled ? (config.layers.heatmap.lookbackHours ?? 24) : 0,
    snrUsesPositions ? (config.layers.snrOverlay.lookbackHours ?? 24) : 0,
  );

  const positions = usePositions({
    enabled: positionsLookback > 0 && sourceIds.length > 0,
    sources: sourceIds,
    lookbackHours: positionsLookback || 24,
  });
  const traceroutes = useTraceroutes({
    enabled: config.layers.traceroutes.enabled && sourceIds.length > 0,
    sources: sourceIds,
    lookbackHours: config.layers.traceroutes.lookbackHours ?? 24,
  });
  const neighbors = useNeighbors({
    enabled: config.layers.neighbors.enabled && sourceIds.length > 0,
    sources: sourceIds,
    lookbackHours: config.layers.neighbors.lookbackHours ?? 24,
  });

  const aggregate = useAggregateProgress([
    positions,
    traceroutes,
    { isLoading: neighbors.isLoading },
  ]);

  // Spinner shows on a button only when that specific layer is enabled and
  // its data fetch is in flight. Without the .enabled guard the shared
  // positions.isLoading would flash on heatmap/trails/SNR buttons even when
  // only one of them is the actual driver of the fetch (issue #2884 bug 3).
  const layerLoading: Partial<Record<LayerKey, boolean>> = {
    traceroutes: config.layers.traceroutes.enabled && traceroutes.isLoading,
    neighbors:   config.layers.neighbors.enabled   && neighbors.isLoading,
    trails:      config.layers.trails.enabled      && positions.isLoading,
    heatmap:     config.layers.heatmap.enabled     && positions.isLoading,
    snrOverlay:  config.layers.snrOverlay.enabled  && snrUsesPositions && positions.isLoading,
  };

  // Active-item counts per group — rendered as a badge on each menu trigger so
  // grouping the toggles into dropdowns doesn't hide which ones are on (#4871).
  const viewActiveCount =
    (config.followMode ? 1 : 0) +
    (config.autoZoom ? 1 : 0) +
    (config.timeSlider.enabled ? 1 : 0) +
    (config.viewMode === '3d' ? 1 : 0);
  const toolsActiveCount =
    (measureMode ? 1 : 0) + (linkProfileMode ? 1 : 0) + (sitePlannerMode ? 1 : 0) + (pinPlaceMode ? 1 : 0);
  const layersActiveCount =
    UNTIMED_LAYERS.filter((l) => config.layers[l.key].enabled).length +
    (config.layers.polarGrid.enabled && hasOwnNode ? 1 : 0) +
    (gnssDopMode ? 1 : 0);
  const analysisActiveCount = TIMED_LAYERS.filter((l) => config.layers[l.key].enabled).length;

  return (
    <div className="map-analysis-toolbar-row">
      {!embedded && (
        <button
          type="button"
          className="map-analysis-back icon-only"
          onClick={() => navigate('/', { state: { showList: true } })}
          title="Back to Sources"
          aria-label="Back to Sources"
        >
          <ArrowLeft size={ICON} />
        </button>
      )}
      <SourceMultiSelect
        sources={sources.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))}
        value={config.sources}
        onChange={setSources}
      />
      <NodeTypeFilterControl />
      <TransportFilterControl />
      <NodeSearchControl />
      <NodeMultiSelect nodes={nodeOptions} value={config.selectedNodeIds} onChange={setSelectedNodeIds} />

      {/* View — viewport & camera controls. */}
      <ToolbarMenu label="View" icon={<Eye size={ICON} />} activeCount={viewActiveCount}>
        <ToolbarMenuItem
          icon={<LocateFixed size={ICON} />}
          label="Follow"
          active={config.followMode}
          onToggle={() => setFollowMode(!config.followMode)}
          title="Follow — recenter on the selected nodes as they move (keeps zoom)"
        />
        <ToolbarMenuItem
          icon={<Maximize size={ICON} />}
          label="Auto-zoom"
          active={config.autoZoom}
          onToggle={() => setAutoZoom(!config.autoZoom)}
          title="Auto-zoom — zoom to fit the selected nodes as they move"
        />
        <ToolbarMenuItem
          icon={<Clock size={ICON} />}
          label="Time Slider"
          active={config.timeSlider.enabled}
          onToggle={() => setTimeSlider({ enabled: !config.timeSlider.enabled })}
        />
        {/* #3826 Phase 2 WP-D: 2D/3D toggle. Disabled with a tooltip when the
            server can't serve DEM terrain tiles (elevation disabled, or a
            configured JSON elevation source — spec §3.11); neutral-disabled
            while the capabilities check is in flight. */}
        <ToolbarMenuItem
          icon={<Box size={ICON} />}
          label="3D View"
          active={config.viewMode === '3d'}
          onToggle={() => setViewMode(config.viewMode === '3d' ? '2d' : '3d')}
          disabled={threeD.disabled}
          title={threeD.title}
        />
      </ToolbarMenu>

      {/* Tools — measurement & planning. All three install a capture-phase click
          listener, so they're mutually exclusive: enabling one disables the
          others (#4111 Phase 2, extended for #4727). */}
      <ToolbarMenu label="Tools" icon={<Wrench size={ICON} />} activeCount={toolsActiveCount}>
        {/* #3636 Measure, #4111 Link Profile, #4727 Site Planner, #5685
            Add Waypoint / Add Local Marker: gates and tooltips in
            `useAnalysisControls`. The pin tools close the menu: their next
            step is a click on the map. */}
        <ToolbarMenuItem
          icon={<Ruler size={ICON} />}
          label={tools.measure.label}
          active={tools.measure.active}
          onToggle={tools.measure.toggle}
          disabled={tools.measure.disabled}
          title={tools.measure.title}
        />
        {tools.linkProfile.shown && (
          <ToolbarMenuItem
            icon={<Mountain size={ICON} />}
            label={tools.linkProfile.label}
            active={tools.linkProfile.active}
            onToggle={tools.linkProfile.toggle}
            disabled={tools.linkProfile.disabled}
            title={tools.linkProfile.title}
          />
        )}
        {tools.sitePlanner.shown && (
          <ToolbarMenuItem
            icon={<RadioTower size={ICON} />}
            label={tools.sitePlanner.label}
            active={tools.sitePlanner.active}
            onToggle={tools.sitePlanner.toggle}
            title={tools.sitePlanner.title}
          />
        )}
        {tools.addWaypoint.shown && (
          <ToolbarMenuItem
            icon={<MapPinPlus size={ICON} />}
            label={tools.addWaypoint.label}
            active={tools.addWaypoint.active}
            onToggle={tools.addWaypoint.toggle}
            closesMenu
            disabled={tools.addWaypoint.disabled}
            title={tools.addWaypoint.title}
          />
        )}
        {tools.addMarker.shown && (
          <ToolbarMenuItem
            icon={<StickyNote size={ICON} />}
            label={tools.addMarker.label}
            active={tools.addMarker.active}
            onToggle={tools.addMarker.toggle}
            closesMenu
            disabled={tools.addMarker.disabled}
            title={tools.addMarker.title}
          />
        )}
      </ToolbarMenu>

      {/* Layers — static map overlays. */}
      <ToolbarMenu label="Layers" icon={<Layers size={ICON} />} activeCount={layersActiveCount}>
        {UNTIMED_LAYERS.map(({ key, label, icon }) => (
          <ToolbarMenuItem
            key={key}
            icon={icon}
            label={label}
            active={config.layers[key].enabled}
            onToggle={() => setLayerEnabled(key, !config.layers[key].enabled)}
            disabled={twoDOnly(key)}
            title={twoDOnly(key) ? twoDOnlyTitle(label) : undefined}
          />
        ))}
        {/* Polar grid (#3971): centered on each source's own-node position. */}
        <ToolbarMenuItem
          icon={<Radar size={ICON} />}
          label="Polar Grid"
          active={config.layers.polarGrid.enabled && hasOwnNode}
          onToggle={() => setLayerEnabled('polarGrid', !config.layers.polarGrid.enabled)}
          disabled={!hasOwnNode || twoDOnly('polarGrid')}
          title={
            twoDOnly('polarGrid')
              ? twoDOnlyTitle('Polar Grid')
              : hasOwnNode ? undefined : 'Polar Grid — no source has a known own-node position'
          }
        />
        {/* GNSS DOP overlay (#4729): passive satellite-geometry heatmap. */}
        <ToolbarMenuItem
          icon={<Satellite size={ICON} />}
          label="GNSS DOP"
          active={gnssDopMode}
          onToggle={() => setGnssDopMode(!gnssDopMode)}
          title="GNSS DOP — GPS position-fix quality over the map, by time of day"
        />
      </ToolbarMenu>

      {/* Analysis — time-windowed data layers, each with its own lookback. */}
      <ToolbarMenu label="Analysis" icon={<Activity size={ICON} />} activeCount={analysisActiveCount}>
        {TIMED_LAYERS.map(({ key, label, options, icon }) => (
          <ToolbarMenuItem
            key={key}
            icon={icon}
            label={label}
            active={config.layers[key].enabled}
            onToggle={() => setLayerEnabled(key, !config.layers[key].enabled)}
            lookbackHours={config.layers[key].lookbackHours}
            lookbackOptions={options}
            onLookbackChange={(h) => setLayerLookback(key, h)}
            loading={layerLoading[key] ?? false}
            disabled={twoDOnly(key)}
            title={twoDOnly(key) ? twoDOnlyTitle(label) : undefined}
          />
        ))}
      </ToolbarMenu>

      {/* Traceroute filters stay inline and only appear while traceroutes are on
          — contextual, so they add no permanent width. */}
      {config.layers.traceroutes.enabled && <TracerouteControls />}
      {aggregate !== null && (
        <div
          className="map-analysis-progress"
          role="progressbar"
          aria-valuenow={aggregate}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${aggregate}%` }} />
        </div>
      )}
      <button
        type="button"
        className="map-analysis-reset icon-only"
        onClick={reset}
        style={{ marginLeft: 'auto' }}
        title="Reset"
        aria-label="Reset"
      >
        <RotateCcw size={ICON} />
      </button>
    </div>
  );
}
