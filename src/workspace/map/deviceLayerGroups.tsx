/**
 * The device map's Layers groups (board f2-layers, ds2): every control of
 * NodesTab's Map controls panel, placed once, with today's label, tooltip
 * and 3D gate. Toggles write MapContext (or the same browser setting NodesTab
 * uses), so the two layouts stay in step.
 *
 * Not here, and where it is: "Measure Distance" and the fit-all button are
 * the map's own buttons (MapToolbar); "Dismiss Traceroute" is closing the
 * peek; "+ Waypoint" / "+ Local marker" are the map's right-click menu (3.6).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import MapAgeFilterControl from '../../components/map/MapAgeFilterControl';
import MapAircraftDisplayControl from '../../components/map/MapAircraftDisplayControl';
import { DuctingControl } from '../../components/map/DuctingControl';
import { PacketFlightsControl } from '../../components/map/PacketFlightsControl';
import { TilesetSelector } from '../../components/TilesetSelector';
import MapLegend, { type PositionHistoryData } from '../../components/MapLegend';
import { PositionHistoryHoursSlider } from '../../components/map/PositionHistoryHoursSlider';
import { useAuth } from '../../contexts/AuthContext';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTelemetryNodes } from '../../hooks/useServerData';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { getTilesetById } from '../../config/tilesets';
import { effectiveMapMaxAgeHours } from '../../utils/mapAge';
import api from '../../services/api';
import { getPacketStats } from '../../services/packetApi';
import type { GeoJsonLayer } from '../../server/services/geojsonService.js';
import type { PacketFlightStats } from '../../utils/packetFlightEdges';
import { appBasename } from '../../init';
import { SubToggle, type LayerGroupSpec, type LayerItem, type LayerToggle } from './LayerGroup';
import styles from './LayersDrawer.module.css';

export interface DeviceLayerParams {
  /** MQTT bridge/broker: every node arrived over MQTT, so RF/UDP/MQTT are hidden (#5283). */
  mqttOnly: boolean;
  canUse3D: boolean;
  viewMode: '2d' | '3d';
  setViewMode(mode: '2d' | '3d'): void;
  effective3D: boolean;
  ownNodePosition: { lat: number; lng: number } | null;
  aircraftCount: number;
  agedOutCount: number;
  /** The node list's window (Settings, or the quick filter). */
  listAgeHours: number;
  capFromQuickFilter: boolean;
  packetFlightsStats: PacketFlightStats | null;
  /** The trail's time span for the legend (`usePositionTrail`). */
  positionHistoryLegend?: PositionHistoryData;
  /** "Showing N of M fixes (thinned)" for a tracked asset (`usePositionTrail`). */
  trailThinnedHint?: string | null;
}

/** A browser setting NodesTab keeps under the same key. */
function useStoredFlag(key: string): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* storage unavailable: the toggle still works for this visit */
    }
  };
  return [value, set];
}

export function useDeviceLayerGroups(p: DeviceLayerParams) {
  const { t } = useTranslation();
  const m = useMapContext();
  const s = useSettings();
  const { hasPermission } = useAuth();
  const csrfFetch = useCsrfFetch();
  const queryClient = useQueryClient();
  const { unmappedCount } = useTelemetryNodes();
  const [showLegend, setShowLegend] = useStoredFlag('meshmonitor-showLegend');
  const [showPacketMonitor, setShowPacketMonitor] = useStoredFlag('showPacketMonitor');
  const [tilesOpen, setTilesOpen] = useState(false);
  const off3D = p.effective3D ? 'Not available in 3D' : undefined;

  const canViewPacketMonitor = hasPermission('packetmonitor', 'read');
  const { data: packetStats } = useQuery({
    queryKey: ['packets', 'stats', 'enabled'],
    queryFn: () => getPacketStats(),
    enabled: canViewPacketMonitor,
    staleTime: 60_000,
  });
  const packetMonitorAvailable = canViewPacketMonitor && packetStats?.enabled === true;

  const geoKey = ['geojson', 'layers'];
  const { data: geoJsonLayers = [] } = useQuery({ queryKey: geoKey, queryFn: () => api.get<GeoJsonLayer[]>('/api/geojson/layers') });
  const setLayerVisible = (id: string, visible: boolean) => {
    queryClient.setQueryData<GeoJsonLayer[]>(geoKey, (old = []) => old.map((l) => (l.id === id ? { ...l, visible } : l)));
    // As NodesTab: the visibility is saved for everyone, and a failure is only logged.
    csrfFetch(`${appBasename}/api/geojson/layers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible }),
    }).catch((err) => console.error('Failed to update layer visibility:', err));
  };

  const toggle = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, extra: Partial<LayerToggle> = {}): LayerToggle => ({
    kind: 'toggle', id, label, checked, onChange, ...extra,
  });

  const tileset = getTilesetById(s.mapTileset, s.customTilesets);
  const base: LayerItem[] = [
    {
      kind: 'custom',
      id: 'tiles',
      label: t('workspace.map.tiles'),
      node: (
        <>
          <button type="button" className={styles.row} aria-expanded={tilesOpen} onClick={() => setTilesOpen((o) => !o)}>
            <span className={styles.label}>{t('workspace.map.tiles')}</span>
            <span className={styles.value}>{tileset.name}</span>
            <UiIcon name={tilesOpen ? 'chevronUp' : 'chevronRight'} size={16} />
          </button>
          {tilesOpen && <TilesetSelector selectedTilesetId={s.mapTileset} onTilesetChange={s.setMapTileset} embedded />}
        </>
      ),
    },
    ...(p.canUse3D
      ? [{
          kind: 'custom' as const,
          id: 'view',
          label: t('workspace.map.view'),
          node: (
            <div className={styles.row} role="group" aria-label={t('workspace.map.view')}>
              <span className={styles.label}>{t('workspace.map.view')}</span>
              <span className={styles.segmented}>
                {(['2d', '3d'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={p.viewMode === v} onClick={() => p.setViewMode(v)}>
                    {t(v === '2d' ? 'workspace.map.view_2d' : 'workspace.map.view_3d')}
                  </button>
                ))}
              </span>
            </div>
          ),
        }]
      : []),
    // Style-based presets bring their own GL style, so a custom style has nothing to apply to (#5448).
    ...(tileset.isVector && !tileset.styleUrl && s.mapStyles.length > 0
      ? [{
          kind: 'custom' as const,
          id: 'style',
          label: t('workspace.map.map_style'),
          node: (
            <label className={styles.row}>
              <span className={styles.label}>{t('workspace.map.map_style')}</span>
              <select className={styles.select} value={s.activeStyleId ?? ''} onChange={(e) => void s.setActiveMapStyleId(e.target.value || null)}>
                <option value="">{t('workspace.map.default_style')}</option>
                {s.mapStyles.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </label>
          ),
        }]
      : []),
  ];
  const baseMore: LayerItem[] = [
    toggle('legend', t('workspace.map.legend'), showLegend, setShowLegend, {
      disabled: p.effective3D,
      title: off3D,
      children: !p.effective3D && <MapLegend positionHistory={p.positionHistoryLegend} unmappedCount={unmappedCount} showRoleMarkers embedded />,
    }),
  ];

  const nodes: LayerItem[] = [
    {
      kind: 'custom',
      id: 'age',
      label: t('map.ageFilter', { defaultValue: 'Map age filter' }),
      node: (
        <MapAgeFilterControl
          maxNodeAgeHours={p.listAgeHours}
          effectiveMaxAgeHours={effectiveMapMaxAgeHours(m.mapMaxAgeHours, p.listAgeHours)}
          onChange={m.setMapMaxAgeHours}
          capFromQuickFilter={p.capFromQuickFilter}
        />
      ),
    },
    ...(p.mqttOnly
      ? []
      : [
          toggle('rf', t('map.showRf', 'Show RF'), m.showRfNodes, m.setShowRfNodes),
          toggle('udp', t('map.showUdp', 'Show UDP'), m.showUdpNodes, m.setShowUdpNodes),
          toggle('mqtt', t('map.showMqtt'), m.showMqttNodes, m.setShowMqttNodes),
        ]),
    toggle('estimated', t('map.showEstimatedPositions'), m.showEstimatedPositions, m.setShowEstimatedPositions),
    toggle('accuracy', t('map.showAccuracyRegions'), m.showAccuracyRegions, m.setShowAccuracyRegions, { disabled: p.effective3D, title: off3D }),
  ];
  const nodesMore: LayerItem[] = [
    {
      kind: 'custom',
      id: 'aircraft',
      label: t('map.aircraftDisplay', { defaultValue: 'Likely aircraft' }),
      node: (
        <MapAircraftDisplayControl
          mode={m.aircraftDisplayMode}
          onChange={m.setAircraftDisplayMode}
          aircraftCount={p.aircraftCount}
          showAgedOut={m.showAgedOutAircraft}
          onShowAgedOutChange={m.setShowAgedOutAircraft}
          agedOutCount={p.agedOutCount}
          showTrails={m.showAircraftTrails}
          onShowTrailsChange={m.setShowAircraftTrails}
          trailHours={m.aircraftTrailHours}
          onTrailHoursChange={m.setAircraftTrailHours}
        />
      ),
    },
  ];

  const links: LayerItem[] = [
    toggle('paths', t('map.showRouteSegments'), m.showPaths, m.setShowPaths),
    toggle('cross-source', t('map.cross_source.toggle', 'Show Cross-Source Links'), m.showCrossSourceLinks, m.setShowCrossSourceLinks, {
      title: t('map.cross_source.toggle_hint', 'One-way edges: one of your sources was heard by another. Dotted = likely relay (inferred). Dashed = heard by an MQTT gateway.'),
      // #5580: offered only while the parent is on.
      children: (
        <ul className={styles.subList}>
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

  const analysis: LayerItem[] = [
    toggle('route', t('map.showTraceroute'), m.showRoute, m.setShowRoute),
    toggle('neighbors', t('map.showNeighborInfo'), m.showNeighborInfo, m.setShowNeighborInfo),
  ];

  const overlays: LayerItem[] = [
    toggle('history', t('map.showPositionHistory'), m.showMotion, m.setShowMotion, {
      children: (
        <ul className={styles.subList}>
          <SubToggle label={t('map.positionHistoryPointsOnly', 'Points only (no line)')} checked={m.positionHistoryPointsOnly} onChange={m.setPositionHistoryPointsOnly} />
          {m.positionHistory.length > 1 && (
            <li className={styles.subRow}>
              <PositionHistoryHoursSlider positionHistory={m.positionHistory} hours={m.positionHistoryHours} onChange={m.setPositionHistoryHours} />
            </li>
          )}
          {p.trailThinnedHint && <li className={styles.subRow}>{p.trailThinnedHint}</li>}
        </ul>
      ),
    }),
    toggle('waypoints', t('map.showWaypoints', 'Show Waypoints'), m.showWaypoints, m.setShowWaypoints, { disabled: p.effective3D, title: off3D }),
    ...geoJsonLayers.map((layer) =>
      toggle(`geojson-${layer.id}`, layer.name, layer.visible, (v) => setLayerVisible(layer.id, v), {
        disabled: p.effective3D,
        title: off3D,
        swatch: layer.style.color,
      }),
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
  ];
  const overlaysMore: LayerItem[] = [
    toggle('atak', t('map.showAtakContacts', 'Show ATAK Contacts'), m.showAtakContacts, m.setShowAtakContacts, { disabled: p.effective3D, title: off3D }),
    toggle('polar', t('map.showPolarGrid'), m.showPolarGrid, m.setShowPolarGrid, {
      disabled: p.effective3D || !p.ownNodePosition,
      title: off3D ?? (!p.ownNodePosition ? t('map.polarGridDisabledTooltip') : undefined),
    }),
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
          stats={p.packetFlightsStats}
          disabledTitle={off3D}
        />
      ),
    },
    toggle('local-markers', t('map.showLocalMarkers', 'Show Local Markers'), m.showLocalMarkers, m.setShowLocalMarkers, { disabled: p.effective3D, title: off3D }),
    toggle('spread', t('map.spreadNodes', 'Spread Nodes'), m.spreadNodes, m.setSpreadNodes, {
      title: t('map.spreadNodesHelp', 'Offset low-precision nodes within their accuracy area so same-cell markers do not stack. Turn off to pin every node at exactly the position it reported.'),
    }),
    toggle('animations', t('map.showAnimations'), m.showAnimations, m.setShowAnimations),
    ...(packetMonitorAvailable ? [toggle('packet-monitor', t('workspace.map.packet_monitor'), showPacketMonitor, setShowPacketMonitor)] : []),
  ];

  const groups: LayerGroupSpec[] = [
    { id: 'base', title: t('workspace.map.group_base'), items: base, more: baseMore },
    { id: 'nodes', title: t('workspace.map.group_nodes'), items: nodes, more: nodesMore },
    { id: 'links', title: t('workspace.map.group_links'), items: links },
    { id: 'analysis', title: t('workspace.map.group_analysis'), items: analysis },
    { id: 'overlays', title: t('workspace.map.group_overlays'), items: overlays, more: overlaysMore },
  ];

  return {
    groups,
    geoJsonLayers,
    showPacketMonitor: packetMonitorAvailable && showPacketMonitor,
    closePacketMonitor: () => setShowPacketMonitor(false),
  };
}

