/**
 * The Overview map's Layers drawer (boards 5-01, 5-02; s5n1): the Analysis
 * group first (`/analysis` opens on it), then Base map, Nodes, Links and
 * Overlays. Map Analysis's View and Layers menus are placed here with their
 * labels, gates and 3D rule (`analysisControls`), beside today's all-devices
 * toggles that the Map Analysis canvas also draws (MapContext: aircraft,
 * spread, cross-source links, GeoJSON, ducting, packet flights) and today's
 * Dashboard map controls (Ruling CE: the map age filter, Colour nodes by, Hide
 * nodes without a current position advert, Show Route Segments, Show
 * Traceroute, Show Neighbor Info).
 *
 * Not here, and where it is: Time is the bar's Time Slider button; the tools
 * are the Tools menu; the node filters and Zoom to fit are the bar over the map.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import MapAgeFilterControl from '../../../components/map/MapAgeFilterControl';
import MapAircraftDisplayControl from '../../../components/map/MapAircraftDisplayControl';
import { DuctingControl } from '../../../components/map/DuctingControl';
import { PacketFlightsControl } from '../../../components/map/PacketFlightsControl';
import { TilesetSelector } from '../../../components/TilesetSelector';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import { UNTIMED_LAYERS, type useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import { useMapContext } from '../../../contexts/MapContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { getTilesetById } from '../../../config/tilesets';
import type { LayerKey } from '../../../hooks/useMapAnalysisConfig';
import type { PacketFlightStats } from '../../../utils/packetFlightEdges';
import { SubToggle, type LayerGroupSpec, type LayerItem, type LayerToggle } from '../../map/LayerGroup';
import { useGeoJsonLayers } from '../../map/deviceLayerGroups';
import drawer from '../../map/LayersDrawer.module.css';
import { useAnalysisLayersGroup } from './AnalysisLayersGroup';

/** Where each of Map Analysis's plain layers sits; a new one is placed nowhere until listed (analysisCoverage.test). */
const GROUP_OF: Partial<Record<LayerKey, 'nodes' | 'overlays'>> = {
  markers: 'nodes',
  hopShading: 'nodes',
  accuracyRegions: 'nodes',
  waypoints: 'overlays',
  localMarkers: 'overlays',
  atakContacts: 'overlays',
};

/** Today's Dashboard map controls that live outside MapContext (Ruling CE). */
export interface DashboardControls {
  /** 2+ devices: the Unified map, where Colour nodes by applies (DashboardMap's rule). */
  unified: boolean;
  /** #5578, offered while the map holds MeshCore nodes. */
  hidePositionless: boolean;
  onHidePositionless(v: boolean): void;
  hasMeshCoreNodes: boolean;
  /** The widest node-age setting across devices, and the map age filter over it. */
  maxNodeAgeHours: number;
  mapAgeHours: number;
}

export interface OverviewLayerParams {
  controls: ReturnType<typeof useAnalysisControls>;
  packetFlightsStats: PacketFlightStats | null;
  aircraftCount: number;
  agedOutCount: number;
  dashboard: DashboardControls;
}

export function useOverviewLayerGroups({ controls, packetFlightsStats, aircraftCount, agedOutCount, dashboard }: OverviewLayerParams): LayerGroupSpec[] {
  const { t } = useTranslation();
  const m = useMapContext();
  const s = useSettings();
  const a = useMapAnalysisCtx();
  const analysis = useAnalysisLayersGroup(controls);
  const { geoJsonLayers, setLayerVisible } = useGeoJsonLayers();
  const [tilesOpen, setTilesOpen] = useState(false);
  const { config } = a;
  const { in3D, twoDOnly, twoDOnlyTitle, hasOwnNode, threeD } = controls;
  // Today's DashboardMap words for its own 2D-only overlays.
  const off3D = in3D ? 'Not available in 3D' : undefined;

  const toggle = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, extra: Partial<LayerToggle> = {}): LayerToggle => ({
    kind: 'toggle', id, label, checked, onChange, ...extra,
  });
  /** One of Map Analysis's plain layers, with its 2D-only gate. */
  const layer = (key: LayerKey, label: string, extra: Partial<LayerToggle> = {}): LayerToggle =>
    toggle(key, label, config.layers[key].enabled, (v) => a.setLayerEnabled(key, v), {
      disabled: twoDOnly(key),
      title: twoDOnly(key) ? twoDOnlyTitle(label) : undefined,
      ...extra,
    });
  const placed = (group: 'nodes' | 'overlays') =>
    UNTIMED_LAYERS.filter((l) => GROUP_OF[l.key] === group).map((l) => layer(l.key, l.label));

  const tileset = getTilesetById(s.mapTileset, s.customTilesets);
  const base: LayerItem[] = [
    {
      kind: 'custom',
      id: 'tiles',
      label: t('workspace.map.tiles'),
      node: (
        <>
          <button type="button" className={drawer.row} aria-expanded={tilesOpen} onClick={() => setTilesOpen((o) => !o)}>
            <span className={drawer.label}>{t('workspace.map.tiles')}</span>
            <span className={drawer.value}>{tileset.name}</span>
            <UiIcon name={tilesOpen ? 'chevronUp' : 'chevronRight'} size={16} />
          </button>
          {tilesOpen && <TilesetSelector selectedTilesetId={s.mapTileset} onTilesetChange={s.setMapTileset} embedded />}
        </>
      ),
    },
    // Map Analysis's View menu: 3D (only with DEM tiles), Follow, Auto-zoom.
    toggle('3d', '3D View', config.viewMode === '3d', (v) => a.setViewMode(v ? '3d' : '2d'), { disabled: threeD.disabled, title: threeD.title }),
    toggle('follow', 'Follow', config.followMode, a.setFollowMode, {
      title: 'Follow — recenter on the selected nodes as they move (keeps zoom)',
    }),
    toggle('auto-zoom', 'Auto-zoom', config.autoZoom, a.setAutoZoom, {
      title: 'Auto-zoom — zoom to fit the selected nodes as they move',
    }),
  ];

  const nodes: LayerItem[] = [
    // Today's Dashboard map age filter (#3322, #5344): narrows the devices' window for markers and links.
    {
      kind: 'custom',
      id: 'age',
      label: t('map.ageFilter', { defaultValue: 'Map age filter' }),
      node: (
        <MapAgeFilterControl
          maxNodeAgeHours={dashboard.maxNodeAgeHours}
          effectiveMaxAgeHours={dashboard.mapAgeHours}
          onChange={m.setMapMaxAgeHours}
        />
      ),
    },
    ...placed('nodes'),
    // Map Analysis follows the aircraft and spread choices of today's map panels (useAnalysisNodes).
    {
      kind: 'custom',
      id: 'aircraft',
      label: t('map.aircraftDisplay', { defaultValue: 'Likely aircraft' }),
      node: (
        <MapAircraftDisplayControl
          mode={m.aircraftDisplayMode}
          onChange={m.setAircraftDisplayMode}
          aircraftCount={aircraftCount}
          showAgedOut={m.showAgedOutAircraft}
          onShowAgedOutChange={m.setShowAgedOutAircraft}
          agedOutCount={agedOutCount}
          showTrails={m.showAircraftTrails}
          onShowTrailsChange={m.setShowAircraftTrails}
          trailHours={m.aircraftTrailHours}
          onTrailHoursChange={m.setAircraftTrailHours}
        />
      ),
    },
    toggle('spread', t('map.spreadNodes', 'Spread Nodes'), m.spreadNodes, m.setSpreadNodes, {
      title: t('map.spreadNodesHelp', 'Offset low-precision nodes within their accuracy area so same-cell markers do not stack. Turn off to pin every node at exactly the position it reported.'),
    }),
    // #6125/#6175: Off / By source / By gateway, one 3-state mode; Unified map only, as DashboardMap.
    ...(dashboard.unified
      ? [{
          kind: 'custom' as const,
          id: 'colour-by',
          label: t('map.colorNodesBy', 'Colour nodes by'),
          node: (
            <div className={drawer.row} role="radiogroup" aria-label={t('map.colorNodesBy', 'Colour nodes by')}>
              <span className={drawer.label}>{t('map.colorNodesBy', 'Colour nodes by')}</span>
              <span className={drawer.segmented}>
                {([
                  ['off', t('map.colorNodesOff', 'Off'), t('map.colorNodesOffHelp'), !m.colorNodesBySource && !m.colorNodesByGateway,
                    () => { m.setColorNodesBySource(false); m.setColorNodesByGateway(false); }],
                  ['source', t('map.colorNodesBySource', 'Colour nodes by source'), t('map.colorNodesBySourceHelp'), m.colorNodesBySource && !m.colorNodesByGateway,
                    () => m.setColorNodesBySource(true)],
                  ['gateway', t('map.colorNodesByGateway', 'Colour nodes by gateway'), t('map.colorNodesByGatewayHelp'), m.colorNodesByGateway,
                    () => m.setColorNodesByGateway(true)],
                ] as const).map(([id, label, title, on, pick]) => (
                  <button key={id} type="button" role="radio" aria-checked={on} aria-label={label} title={title} onClick={pick}>
                    {id === 'off' ? label : t(id === 'source' ? 'workspace.overview.colour_source' : 'workspace.overview.colour_gateway')}
                  </button>
                ))}
              </span>
            </div>
          ),
        }]
      : []),
    // #5578: MeshCore only — offered when the map holds MeshCore nodes.
    ...(dashboard.hasMeshCoreNodes
      ? [toggle('positionless', t('map.hidePositionlessAdverts', 'Hide nodes without a current position advert'), dashboard.hidePositionless, dashboard.onHidePositionless, {
          title: t('map.hidePositionlessAdvertsHelp'),
        })]
      : []),
  ];

  // Today's Dashboard map links (MapContext): drawn by DashboardMap's own functions in OverviewOverlays.
  const links: LayerItem[] = [
    toggle('paths', t('map.showRouteSegments'), m.showPaths, m.setShowPaths),
    toggle('route', t('map.showTraceroute'), m.showRoute, m.setShowRoute),
    toggle('neighbors', t('map.showNeighborInfo'), m.showNeighborInfo, m.setShowNeighborInfo),
    toggle('cross-source', t('map.cross_source.toggle', 'Show Cross-Source Links'), m.showCrossSourceLinks, m.setShowCrossSourceLinks, {
      disabled: in3D,
      title: off3D ?? t('map.cross_source.toggle_hint', 'One-way edges: one of your sources was heard by another. Dotted = likely relay (inferred). Dashed = heard by an MQTT gateway.'),
      // #5580: offered only while the parent is on.
      children: (
        <ul className={drawer.subList}>
          <SubToggle
            label={t('map.traceroute_confirmed.toggle', 'Traceroute-Confirmed Links')}
            title={t('map.traceroute_confirmed.toggle_hint')}
            checked={m.showTracerouteConfirmedLinks}
            onChange={m.setShowTracerouteConfirmedLinks}
          />
        </ul>
      ),
    }),
  ];

  const overlays: LayerItem[] = [
    ...placed('overlays'),
    // Polar grid (#3971): centred on each source's own-node position.
    layer('polarGrid', 'Polar Grid', {
      checked: config.layers.polarGrid.enabled && hasOwnNode,
      disabled: !hasOwnNode || twoDOnly('polarGrid'),
      title: twoDOnly('polarGrid')
        ? twoDOnlyTitle('Polar Grid')
        : hasOwnNode ? undefined : 'Polar Grid — no source has a known own-node position',
    }),
    // GNSS DOP (#4729): a server-side satellite-geometry overlay, with its panel.
    toggle('gnss-dop', 'GNSS DOP', a.gnssDopMode, a.setGnssDopMode, {
      title: 'GNSS DOP — GPS position-fix quality over the map, by time of day',
    }),
    ...geoJsonLayers.map((g) =>
      toggle(`geojson-${g.id}`, g.name, g.visible, (v) => setLayerVisible(g.id, v), { disabled: in3D, title: off3D, swatch: g.style.color }),
    ),
    {
      kind: 'custom',
      id: 'ducting',
      label: t('map.ducting.toggle'),
      node: (
        <DuctingControl
          checked={m.showDucting}
          onCheckedChange={m.setShowDucting}
          hoursAhead={m.ductingHoursAhead}
          onHoursAheadChange={m.setDuctingHoursAhead}
          disabledTitle={off3D}
        />
      ),
    },
    {
      kind: 'custom',
      id: 'packet-flights',
      label: t('map.packet_flights.toggle'),
      node: (
        <PacketFlightsControl
          checked={m.showPacketFlights}
          onCheckedChange={m.setShowPacketFlights}
          rate={m.packetFlightRate}
          onRateChange={m.setPacketFlightRate}
          stats={packetFlightsStats}
          disabledTitle={off3D}
        />
      ),
    },
  ];

  return [
    analysis,
    { id: 'base', title: t('workspace.map.group_base'), items: base },
    { id: 'nodes', title: t('workspace.map.group_nodes'), items: nodes },
    { id: 'links', title: t('workspace.map.group_links'), items: links },
    { id: 'overlays', title: t('workspace.map.group_overlays'), items: overlays },
  ];
}
