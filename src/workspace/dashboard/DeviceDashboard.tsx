/**
 * A device's Dashboard (Task 8.1; boards j1, j2, k1, k2, k3; notes ds8, ds9),
 * one component for every device type, over that type's data source
 * (`dataSources.ts`): Meshtastic and its MQTT types at `/source/:id/dashboard`,
 * MeshCore at today's `telemetry` view (inside MeshCoreScreen), Reticulum at
 * `dashboard` (inside ReticulumScreen).
 *
 * The Mesh health strip comes first (HealthStrip, from the page's own reads),
 * then the user's board (D12): today's widget types and the starred charts in
 * the user's order, drawn as Workspace cards around today's widget renderers
 * (`bare`). The board is per user (`useUserBoard`); stars stay install-wide
 * (D19). Edit mode drafts the board (↑/↓, drag, remove, Add widget, Health
 * tiles); Done saves it once. Reading only: nothing here sends on the mesh.
 *
 * Reads are today's Dashboard's, at today's cadence (GQ): the source's
 * settings and nodes every 30 s (useDashboardData), the solar estimates every
 * 5 min, each chart's telemetry and each widget's own read. The device's status
 * is the shell's poll. Gate: dashboard:read on the device, as today's tab;
 * editing needs dashboard:write there and a signed-in user.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../components/Dashboard.css';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { SourceNotConnectedNotice } from '../../components/common/SourceNotConnectedNotice';
import { useDashboardData } from '../../components/Dashboard/hooks/useDashboardData';
import { createWidget, useCustomWidgets } from '../../components/Dashboard/hooks/useCustomWidgets';
import { useChartSettings, useGlobalTimeRange } from '../../components/Dashboard/hooks/useChartSettings';
import { meshtasticDashboardSource, type DashboardDataSource } from '../../components/Dashboard/dataSources';
import type { CustomWidget, NodeInfo } from '../../components/Dashboard/types';
import { getTelemetryLabel } from '../../components/TelemetryChart';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useCachedSourceStatus, type DashboardSource } from '../../hooks/useDashboardData';
import { useDashboardFilters } from '../../components/Dashboard/hooks/useDashboardFilters';
import type { DeviceInfo } from '../../types/device';
import { getEffectiveHops } from '../../utils/nodeHops';
import { FiltersButton, FiltersSheet } from './BoardFilters';
import { useSolarEstimatesLatest } from '../../hooks/useTelemetry';
import { appBasename } from '../../init';
import ToolHead from '../meshcore/ToolHead';
import RowMenu from '../patterns/RowMenu';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { AddWidgetSheet, EditRows, TilesSheet, type ItemLabel } from './EditControls';
import HealthStrip from './HealthStrip';
import { renderChart, renderWidget, type ChartEnv, type WidgetEnv } from './boardBodies';
import { DEFAULT_TILES, healthValues, type HealthNode, type HealthTileId } from './healthTiles';
import { boardItems, chartKey, useUserBoard, type BoardItem } from './useUserBoard';
import styles from './Dashboard.module.css';

const WIDGET_TITLE: Record<CustomWidget['type'], string> = {
  nodeStatus: 'dashboard.widget.node_status.title',
  traceroute: 'dashboard.widget.traceroute.title',
  hopDistribution: 'dashboard.widget.hop_distribution.title',
  distanceDistribution: 'dashboard.widget.distance_distribution.title',
  hopDistanceHeatmap: 'dashboard.widget.hop_distance_heatmap.title',
  liveMeshActivity: 'dashboard.widget.live_mesh_activity.title',
};

const noop = () => {};

export interface DeviceDashboardProps {
  sourceId: string;
  deviceName: string;
  dataSource: DashboardDataSource;
  /** This device's own node (MeshCore: its public key); default: from the device's status (Meshtastic). */
  currentNodeId?: string | null;
  /** Inside a device screen that frames the page (Reticulum). */
  contained?: boolean;
}

/** The Meshtastic-family route (`/source/:id/dashboard`), with the providers App would mount. */
export default function MeshtasticDashboard({ sourceId, source }: { sourceId: string; source: DashboardSource }) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <DeviceDashboard sourceId={sourceId} deviceName={source.name} dataSource={meshtasticDashboardSource} />
      </SettingsProvider>
    </SourceProvider>
  );
}

export function DeviceDashboard(props: DeviceDashboardProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  if (!hasPermission('dashboard', 'read', { sourceId: props.sourceId })) {
    return (
      <Page contained={props.contained}>
        <ToolHead title={t('nav.dashboard')} back={{ label: t('workspace.tabs.home'), to: `/source/${encodeURIComponent(props.sourceId)}` }} />
        <StateView kind="noPermission" />
      </Page>
    );
  }
  return <Board {...props} isPhone={isPhone} />;
}

function Page({ contained, children }: { contained?: boolean; children: ReactNode }) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.page} data-phone={isPhone || undefined} data-contained={contained || undefined} data-testid="device-dashboard">
      {children}
    </div>
  );
}

interface Draft {
  items: BoardItem[];
  tiles: HealthTileId[];
  /** The board as the edit found it: Done measures its changes and removals against this. */
  start: { items: BoardItem[]; widgets: CustomWidget[]; tiles: HealthTileId[] };
}

function Board({ sourceId, deviceName, dataSource, currentNodeId, contained, isPhone }: DeviceDashboardProps & { isPhone: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const csrfFetch = useCsrfFetch();
  const { authStatus, hasPermission } = useAuth();
  const { temperatureUnit, favoriteTelemetryStorageDays, solarMonitoringEnabled, distanceUnit, nodeHopsCalculation } = useSettings();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const sourceQuery = `?sourceId=${encodeURIComponent(sourceId)}`;

  const data = useDashboardData({ dataSource });
  const { favorites, setFavorites, nodes } = data;
  const board = useUserBoard(sourceId);
  // The shell polls the device's status; this reads its answer and adds no timer (N/DM).
  const status = useCachedSourceStatus(sourceId);
  const localId = currentNodeId !== undefined ? currentNodeId : status?.nodeNum !== undefined ? `!${status.nodeNum.toString(16).padStart(8, '0')}` : null;
  const { getSolarVisibility, handleToggleSolar, getYRange, handleYRangeChange } = useChartSettings({
    baseUrl: appBasename,
    dataSource,
    solarVisibility: data.solarVisibility,
    setSolarVisibility: data.setSolarVisibility,
    chartYRanges: data.chartYRanges,
    setChartYRanges: data.setChartYRanges,
  });
  const { handleDataLoaded, forgetChart, globalTimeRange, globalMinTime } = useGlobalTimeRange();
  // Today's filters over the starred charts (Ruling 8.1 HV); the board's own order replaces sort.
  const filters = useDashboardFilters({ favorites, nodes, customOrder: [], favoriteTelemetryStorageDays, defaultSortOption: 'custom', dataSource });
  const { data: solarEstimates } = useSolarEstimatesLatest({ baseUrl: appBasename, limit: 500, enabled: true });

  const canEdit = hasPermission('dashboard', 'write', { sourceId });
  // Board edits are saved to the user's account: a guest has none.
  const canEditBoard = canEdit && authStatus?.authenticated === true && board.ready;
  const hasNodePages = dataSource.kind !== 'reticulum';
  const showHealth = dataSource.kind !== 'reticulum';
  const supported = dataSource.widgets.supported;

  const [hours, setHours] = useState(24);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState<'add' | 'tiles' | 'filters' | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const tiles = board.tiles ?? [...DEFAULT_TILES];
  const items = useMemo(() => boardItems(board.widgets, favorites, board.order), [board.widgets, favorites, board.order]);
  const localNum = status?.nodeNum ?? null;
  const health = useMemo(
    () =>
      healthValues({
        nodes: [...nodes.values()] as HealthNode[],
        localId,
        nodeCount: status?.nodeCount,
        // Nodes' own hop count (NodesPage hopsOf): the device itself is direct. No traceroutes are read here.
        hopsOf: (n) =>
          dataSource.kind !== 'meshtastic' ? n.hopsAway : n.user?.id === localId ? 0 : getEffectiveHops(n as DeviceInfo, nodeHopsCalculation, undefined, localNum),
        reportsFavorites: dataSource.kind === 'meshtastic',
      }),
    [nodes, localId, localNum, status?.nodeCount, dataSource.kind, nodeHopsCalculation],
  );
  const visibleCharts = useMemo(() => new Set(filters.filteredAndSortedFavorites.map(chartKey)), [filters.filteredAndSortedFavorites]);
  const shownItems = useMemo(() => items.filter((i) => i.kind === 'widget' || visibleCharts.has(i.key)), [items, visibleCharts]);

  // A widget's own settings (a node added to Node Status, a window, a bucket size) save to the user's board.
  const saveWidgets = useCallback(
    (widgets: CustomWidget[]) => board.setWidgets(widgets).catch(() => showToast(t('workspace.dashboard.save_failed'), 'error')),
    [board, showToast, t],
  );
  const widgetOps = useCustomWidgets({ baseUrl: appBasename, customWidgets: board.widgets, setCustomWidgets: noop, saveWidgets });

  const nodeName = (id: string) => dataSource.getDisplayName(nodes.get(id) as NodeInfo | undefined, id);
  const label = (item: BoardItem): ItemLabel => {
    if (item.kind === 'chart') {
      return {
        title: nodeName(item.favorite.nodeId),
        sub: t('workspace.dashboard.chart_sub', { metric: getTelemetryLabel(item.favorite.telemetryType) }),
        note: t('workspace.dashboard.chart_shared'),
      };
    }
    const w = item.widget;
    const sub = w.type === 'nodeStatus' ? t('workspace.dashboard.nodes_count', { count: w.nodeIds.length })
      : w.type === 'traceroute' && w.targetNodeId ? nodeName(w.targetNodeId)
        : undefined;
    return { title: t(WIDGET_TITLE[w.type]), sub };
  };
  const openNode = hasNodePages ? (id: string) => void navigate(`${base}/node/${encodeURIComponent(id)}`) : undefined;

  const startEdit = () => setDraft({ items, tiles: [...tiles], start: { items, widgets: board.widgets, tiles: [...tiles] } });
  const cancel = () => {
    setSheet(null);
    setDraft(null);
  };

  // Done: the user's board in one write, and only when it changed; a chart taken off is unstarred for everyone (D19).
  const done = async () => {
    if (!draft || savingRef.current) return;
    const widgets = draft.items.flatMap((i) => (i.kind === 'widget' ? [i.widget] : []));
    const order = draft.items.map((i) => i.key);
    // Only the charts this edit took off are unstarred: a star that arrived meanwhile stays (D19).
    const kept = new Set(order);
    const removed = new Set(draft.start.items.flatMap((i) => (i.kind === 'chart' && !kept.has(i.key) ? [i.key] : [])));
    const remaining = favorites.filter((f) => !removed.has(chartKey(f)));
    const { start } = draft;
    const changed =
      JSON.stringify(order) !== JSON.stringify(start.items.map((i) => i.key)) ||
      JSON.stringify(widgets) !== JSON.stringify(start.widgets) ||
      JSON.stringify(draft.tiles) !== JSON.stringify(start.tiles);
    if (!changed) {
      setDraft(null);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      // The user's board first: a failed board write must not leave stars removed install-wide.
      await board.setBoard({ widgets, order, tiles: draft.tiles });
      if (remaining.length !== favorites.length) {
        const res = await csrfFetch(`${appBasename}/api/settings${sourceQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telemetryFavorites: JSON.stringify(remaining) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFavorites(remaining);
        removed.forEach(forgetChart);
      }
      setSheet(null);
      setDraft(null);
    } catch {
      showToast(t('workspace.dashboard.save_failed'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const editLabel = t('common.edit');
  const editButton = (
    <button
      type="button"
      className={isPhone ? styles.textButton : styles.button}
      onClick={startEdit}
      disabled={!canEditBoard}
      title={canEdit ? undefined : t('workspace.node_menu.needs', { permission: 'dashboard:write' })}
    >
      {!isPhone && <UiIcon name="edit" size={18} />}
      {editLabel}
    </button>
  );
  const maxDays = Math.max(1, Math.min(7, favoriteTelemetryStorageDays || 7));
  const ranges = [...new Set([1, 24, maxDays * 24])];
  const range = (
    <div className={styles.range} role="group" aria-label={t('workspace.dashboard.range')}>
      {ranges.map((h) => (
        <button key={h} type="button" className={styles.rangeButton} aria-pressed={hours === h} onClick={() => setHours(h)}>
          {h < 48 ? t('workspace.dashboard.range_hours', { count: h }) : t('workspace.dashboard.range_days', { count: h / 24 })}
        </button>
      ))}
    </div>
  );
  const filterButton = favorites.length > 0 && <FiltersButton filters={filters} onOpen={() => setSheet('filters')} />;
  const cancelButton = (
    <button type="button" className={styles.textButton} onClick={cancel} disabled={saving}>
      {t('common.cancel')}
    </button>
  );
  const doneButton = (
    <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void done()} disabled={saving}>
      {t('common.done')}
    </button>
  );

  const head = draft ? (
    isPhone ? (
      <header className={styles.phoneEdit}>
        {cancelButton}
        <h1 className={styles.phoneEditTitle}>{t('workspace.dashboard.edit_title')}</h1>
        {doneButton}
      </header>
    ) : (
      <ToolHead
        title={t('workspace.dashboard.editing')}
        subtitle={t('workspace.dashboard.editing_hint')}
        back={{ label: t('workspace.tabs.home'), to: base }}
        actions={<>{cancelButton}{doneButton}</>}
      />
    )
  ) : (
    <ToolHead
      title={t('nav.dashboard')}
      subtitle={t('workspace.dashboard.subtitle', { device: deviceName })}
      back={{ label: t('workspace.tabs.home'), to: base }}
      actions={<>{range}{filterButton}{editButton}</>}
      phoneActions={editButton}
    />
  );

  if (data.loading) {
    return <Page contained={contained}>{head}<StateView kind="loading" /></Page>;
  }
  if (data.notConnected) {
    return <Page contained={contained}>{head}<SourceNotConnectedNotice /></Page>;
  }
  if (data.error) {
    return <Page contained={contained}>{head}<StateView kind="error" detail={data.error} /></Page>;
  }

  const shownTiles = draft ? draft.tiles : tiles;
  const strip = showHealth && (
    <HealthStrip values={health} tiles={shownTiles} deviceName={deviceName} base={base} localId={localId} inert={!!draft} />
  );
  const tilesCount = t('workspace.dashboard.tiles_count', { shown: shownTiles.length, total: 9 });

  if (draft) {
    return (
      <Page contained={contained}>
        {head}
        {showHealth && (isPhone ? (
          <button type="button" className={styles.tilesRow} onClick={() => setSheet('tiles')}>
            {t('workspace.dashboard.health_tiles')}
            <span className={styles.tilesRowCount}>{tilesCount}</span>
            <UiIcon name="chevronRight" size={20} />
          </button>
        ) : (
          <>
            <div className={styles.tilesBar}>
              <span>{t('workspace.dashboard.tiles_shown', { count: tilesCount })}</span>
              <button type="button" className={styles.button} onClick={() => setSheet('tiles')}>
                {t('workspace.dashboard.choose_tiles')}
              </button>
            </div>
            {strip}
          </>
        ))}
        {isPhone && <p className={styles.label}>{t('workspace.dashboard.your_board')}</p>}
        <EditRows items={draft.items} label={label} onChange={(next) => setDraft({ ...draft, items: next })} />
        {supported.size > 0 && (
          <button type="button" className={styles.addRow} onClick={() => setSheet('add')}>
            <UiIcon name="plus" size={20} />
            {t('dashboard.add_widget_title')}
          </button>
        )}
        {isPhone && <p className={styles.note}>{t('workspace.dashboard.phone_note')}</p>}
        <AddWidgetSheet
          open={sheet === 'add'}
          onClose={() => setSheet(null)}
          supported={supported}
          onAdd={(type) => {
            const widget = createWidget(type);
            setDraft({ ...draft, items: [...draft.items, { key: widget.id, kind: 'widget', widget }] });
          }}
        />
        <TilesSheet open={sheet === 'tiles'} onClose={() => setSheet(null)} tiles={draft.tiles} onChange={(next) => setDraft({ ...draft, tiles: next })} />
      </Page>
    );
  }

  const chartEnv: ChartEnv = {
    nodes,
    hours,
    temperatureUnit,
    globalTimeRange,
    globalMinTime,
    onDataLoaded: handleDataLoaded,
    solarEstimates: solarEstimates ?? new Map(),
    solarMonitoringEnabled,
    showSolar: (f) => getSolarVisibility(f.nodeId, f.telemetryType),
    onToggleSolar: handleToggleSolar,
    yRange: (f) => getYRange(f.nodeId, f.telemetryType),
    onYRangeChange: canEdit ? handleYRangeChange : undefined,
  };
  const widgetEnv: WidgetEnv = { nodes, localId, dataSource, distanceUnit, canEdit: canEditBoard, openNode, ops: widgetOps };

  return (
    <Page contained={contained}>
      {head}
      {showHealth && isPhone && <p className={styles.label}>{t('workspace.dashboard.health_label', { device: deviceName })}</p>}
      {strip}
      {isPhone && (
        <div className={styles.tools}>
          {range}
          {filterButton}
        </div>
      )}
      {items.length === 0 ? (
        <StateView kind="empty" title={t('workspace.dashboard.empty_title')} detail={t('workspace.dashboard.empty_detail')} />
      ) : shownItems.length === 0 ? (
        <StateView kind="empty" title={t('workspace.dashboard.no_match')} />
      ) : (
        <div className={styles.board}>
          {shownItems.map((item) => {
            const l = label(item);
            const menu = [
              ...(canEditBoard ? [{ key: 'edit', label: t('workspace.dashboard.edit_title'), icon: 'edit' as const, onSelect: startEdit }] : []),
              ...(item.kind === 'chart' && openNode
                ? [{ key: 'node', label: t('workspace.dashboard.open_node'), icon: 'nodes' as const, onSelect: () => openNode(item.favorite.nodeId) }]
                : []),
            ];
            return (
              <section key={item.key} className={styles.card} data-testid="board-card">
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>
                    {l.title}
                    {item.kind === 'chart' && <span className={styles.muted}>{getTelemetryLabel(item.favorite.telemetryType)}</span>}
                  </h3>
                  {item.kind === 'widget' && l.sub && <span className={styles.muted}>{l.sub}</span>}
                  {menu.length > 0 && <RowMenu label={t('workspace.dashboard.card_menu', { name: l.title })} items={menu} />}
                </div>
                <div className={styles.cardBody}>{item.kind === 'chart' ? renderChart(item.favorite, chartEnv) : renderWidget(item.widget, widgetEnv)}</div>
              </section>
            );
          })}
        </div>
      )}
      <FiltersSheet open={sheet === 'filters'} onClose={() => setSheet(null)} filters={filters} showRoles={dataSource.showRoleFilter} />
    </Page>
  );
}
