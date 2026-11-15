/**
 * The Map Analysis controls' lists and rules, shared by the Classic toolbar
 * (MapAnalysisToolbar) and the Workspace Overview map (#6365): the layer
 * lists, the lookbacks, which layers the 3D canvas can draw, the 3D gate, and
 * the Tools (one at a time, each with its gate and tooltip). Moved verbatim
 * out of MapAnalysisToolbar so the two layouts cannot drift.
 */
import type { ReactNode } from 'react';
import { MapPin, Palette, Flag, CircleDashed, Route, Share2, Flame, Spline, Signal, Users, StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMapAnalysisCtx } from './MapAnalysisContext';
import { useAnalysisNodes } from './useAnalysisNodes';
import { useEffectiveViewMode } from './useEffectiveViewMode';
import { usePinSources } from '../../hooks/usePinSources';
import { useOwnNodePositions } from '../../hooks/useOwnNodePositions';
import { useElevationEnabled } from '../../hooks/useElevationEnabled';
import { useTerrainCapabilities } from '../../hooks/useTerrainCapabilities';
import type { LayerKey } from '../../hooks/useMapAnalysisConfig';

export const LOOKBACK_OPTIONS: Array<number | null> = [1, 6, 24, 72, 168, 720];
export const SNR_LOOKBACK_OPTIONS: Array<number | null> = [null, 1, 6, 24, 72, 168, 720];

const ICON = 16;
export const TIMED_LAYERS: { key: LayerKey; label: string; options: Array<number | null>; icon: ReactNode }[] = [
  { key: 'traceroutes', label: 'Traceroutes', options: LOOKBACK_OPTIONS,     icon: <Route size={ICON} /> },
  { key: 'neighbors',   label: 'Neighbors',   options: LOOKBACK_OPTIONS,     icon: <Share2 size={ICON} /> },
  { key: 'heatmap',     label: 'Heatmap',     options: LOOKBACK_OPTIONS,     icon: <Flame size={ICON} /> },
  { key: 'trails',      label: 'Trails',      options: LOOKBACK_OPTIONS,     icon: <Spline size={ICON} /> },
  { key: 'snrOverlay',  label: 'SNR Overlay', options: SNR_LOOKBACK_OPTIONS, icon: <Signal size={ICON} /> },
];
/**
 * Layers the 3D (MapLibre) canvas can actually draw (#4371 C). Everything else
 * is Leaflet-only rendering — raster heatmaps, SVG rings, DOM marker overlays —
 * and its toggle is disabled with an explanatory tooltip while in 3D, rather
 * than silently doing nothing. The config value is left untouched, so the layer
 * comes back exactly as it was on switching to 2D.
 */
export const THREE_D_CAPABLE_LAYERS = new Set<LayerKey>(['markers', 'traceroutes', 'neighbors']);

export const UNTIMED_LAYERS: { key: LayerKey; label: string; icon: ReactNode }[] = [
  { key: 'markers',     label: 'Markers',          icon: <MapPin size={ICON} /> },
  { key: 'hopShading',  label: 'Hop Shading',      icon: <Palette size={ICON} /> },
  { key: 'waypoints',   label: 'Waypoints',        icon: <Flag size={ICON} /> },
  { key: 'accuracyRegions', label: 'Accuracy Regions', icon: <CircleDashed size={ICON} /> },
  { key: 'atakContacts', label: 'ATAK Contacts',    icon: <Users size={ICON} /> },
  { key: 'localMarkers', label: 'Local Markers',    icon: <StickyNote size={ICON} /> },
];

/** One tool of the Tools menu: shown or not, on or off, its gate and tooltip. */
export interface AnalysisTool {
  shown: boolean;
  active: boolean;
  disabled: boolean;
  title: string;
  label: string;
  toggle(): void;
}

/**
 * The 3D gate, the 2D-only rule, the polar grid's own-node gate, and the Tools.
 * The tools install a capture-phase click listener (or wait for a map click),
 * so they're mutually exclusive: enabling one disables the others (#4111
 * Phase 2, extended for #4727 and #5685).
 */
export function useAnalysisControls() {
  const {
    config,
    setLayerEnabled,
    measureMode,
    setMeasureMode,
    linkProfileMode,
    setLinkProfileMode,
    sitePlannerMode,
    setSitePlannerMode,
    pinPlaceMode,
    setPinPlaceMode,
  } = useMapAnalysisCtx();
  const { t } = useTranslation();
  // #5685: who may add a pin, and from which sources.
  const { waypointSources, markerSources } = usePinSources();
  const elevationEnabled = useElevationEnabled();
  // #3826 Phase 2 WP-D: 2D/3D toggle gating. `useTerrainCapabilities` (not
  // `useElevationEnabled`) because the toggle must also distinguish a
  // configured JSON elevation source (no DEM tiles available) from the
  // simple enabled/disabled flag the Link Profile button above uses.
  const terrainCaps = useTerrainCapabilities();
  const threeDUnavailableReason = terrainCaps.isLoading
    ? null
    : !terrainCaps.enabled
      ? 'Elevation is disabled'
      : !terrainCaps.terrainTiles
        ? '3D terrain is unavailable with the configured elevation source'
        : null;
  const threeDDisabled = terrainCaps.isLoading || threeDUnavailableReason !== null;
  const threeDTitle = threeDUnavailableReason
    ?? (terrainCaps.isLoading
      ? 'Checking 3D availability…'
      : config.viewMode === '3d' ? 'Switch to 2D map' : 'Switch to 3D map (pitched terrain)');

  const analysisNodes = useAnalysisNodes();

  // #4371 C: which toggles are inert because the 3D canvas can't draw them.
  // Keyed on the EFFECTIVE view mode, not raw `config.viewMode`: when a
  // persisted `'3d'` is force-corrected to 2D (capabilities unavailable), the
  // canvas falls back immediately while the config write-back lands a render
  // later — reading the raw value greyed out the 2D-only toggles while a 2D
  // map was on screen.
  const in3D = useEffectiveViewMode().effectiveViewMode === '3d';
  const twoDOnly = (key: LayerKey) => in3D && !THREE_D_CAPABLE_LAYERS.has(key);
  const twoDOnlyTitle = (label: string) => `${label} — 2D view only`;

  // #5685: arm (or disarm) pin placement. It captures the next map click, so
  // it turns the other click tools off, and it turns the pin's layer on so the
  // new pin is not saved out of sight.
  const togglePinPlace = (kind: 'waypoint' | 'marker') => {
    if (pinPlaceMode === kind) {
      setPinPlaceMode(null);
      return;
    }
    setMeasureMode(false);
    setLinkProfileMode(false);
    setSitePlannerMode(false);
    const layer: LayerKey = kind === 'waypoint' ? 'waypoints' : 'localMarkers';
    if (!config.layers[layer]?.enabled) setLayerEnabled(layer, true);
    setPinPlaceMode(kind);
  };

  // Polar grid (#3971): centered on each active source's own-node position.
  // Disable the toggle when no active source has a resolvable own node.
  const ownNodePositions = useOwnNodePositions(config.sources);
  const hasOwnNode = ownNodePositions.length > 0;

  const tools: Record<'measure' | 'linkProfile' | 'sitePlanner' | 'addWaypoint' | 'addMarker', AnalysisTool> = {
    // #3636: node-to-node LOS distance. Disabled until two positioned nodes.
    measure: {
      shown: true,
      label: 'Measure',
      active: measureMode,
      toggle: () => {
        const next = !measureMode;
        setMeasureMode(next);
        if (next) {
          setLinkProfileMode(false);
          setSitePlannerMode(false);
          setPinPlaceMode(null);
        }
      },
      disabled: analysisNodes.length < 2,
      title: analysisNodes.length < 2
        ? 'Measure — need at least two positioned nodes'
        : 'Measure straight-line distance between two nodes',
    },
    // #4111 Phase 2: terrain link profile. Hidden when elevation sampling
    // is disabled; disabled until two positioned nodes for parity with Measure.
    linkProfile: {
      shown: elevationEnabled,
      label: 'Link Profile',
      active: linkProfileMode,
      toggle: () => {
        const next = !linkProfileMode;
        setLinkProfileMode(next);
        if (next) {
          setMeasureMode(false);
          setSitePlannerMode(false);
          setPinPlaceMode(null);
        }
      },
      disabled: analysisNodes.length < 2,
      title: analysisNodes.length < 2
        ? 'Link Profile — need at least two positioned nodes'
        : 'Link Profile — terrain, Fresnel clearance, and link budget between two points',
    },
    // Site Planner (#4727). Gated on elevation like Link Profile, but needs
    // no existing nodes — siting a repeater is the main use.
    sitePlanner: {
      shown: elevationEnabled,
      label: 'Site Planner',
      active: sitePlannerMode,
      toggle: () => {
        const next = !sitePlannerMode;
        setSitePlannerMode(next);
        if (next) {
          setMeasureMode(false);
          setLinkProfileMode(false);
          setPinPlaceMode(null);
        }
      },
      disabled: false,
      title: 'Site Planner — predict outbound coverage over terrain from any point',
    },
    // #5685: add an on-air waypoint. Hidden without waypoints:write on any
    // source; shown disabled when no source the user can write to has a
    // radio that can send one. Placement sends nothing: the broadcast
    // happens on Save in the editor.
    addWaypoint: {
      shown: markerSources.length > 0,
      label: t('mapPins.addWaypoint', 'Add Waypoint'),
      active: pinPlaceMode === 'waypoint',
      toggle: () => togglePinPlace('waypoint'),
      disabled: in3D || waypointSources.length === 0,
      title: in3D
        ? twoDOnlyTitle(t('mapPins.addWaypoint', 'Add Waypoint'))
        : waypointSources.length === 0
          ? t('mapPins.noWaypointSource', 'Add Waypoint — none of your sources has a Meshtastic radio that can send one')
          : t('mapPins.addWaypointTitle', 'Add Waypoint — click the map, then choose the source that broadcasts it to the mesh'),
    },
    // Local marker (#5686): stored in MeshMonitor, never transmitted.
    addMarker: {
      shown: markerSources.length > 0,
      label: t('mapPins.addMarker', 'Add Local Marker'),
      active: pinPlaceMode === 'marker',
      toggle: () => togglePinPlace('marker'),
      disabled: in3D,
      title: in3D
        ? twoDOnlyTitle(t('mapPins.addMarker', 'Add Local Marker'))
        : t('mapPins.addMarkerTitle', 'Add Local Marker — click the map to place a note. It is never sent to the mesh.'),
    },
  };

  return {
    tools,
    analysisNodes,
    threeD: { disabled: threeDDisabled, title: threeDTitle },
    in3D,
    twoDOnly,
    twoDOnlyTitle,
    hasOwnNode,
  };
}
