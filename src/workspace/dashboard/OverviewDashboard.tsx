/**
 * The Overview dashboard (Task 8.2; boards j3-overview-dashboard,
 * 16-04-overview-dashboard; notes ds9, s16n0) at `/overview/dashboard`.
 *
 * One row per device the viewer can read (the shell's devices), each opening
 * that device's dashboard. The numbers come from what is already read: the
 * shell's status poll per device (connected, nodes heard / online) and the
 * all-devices bundle (`/api/unified/dashboard`, today's 15 s poll on this URL)
 * for the device's own channel utilisation and airtime and its low batteries.
 *
 * Then the user's Overview board (`dashboard.overview`, D12): today's widget
 * types and charts pinned from any device's stars, each tagged with its device
 * (DeviceTag). A card whose device the viewer can no longer read, or whose
 * dashboard they may not open, shows no data. Edit mode is the device
 * dashboard's (rows, ↑/↓, drag, remove), with Add widget asking for the device
 * first; Done writes the board once. Stars are never written here (D19).
 * Reading only: nothing here sends on the mesh.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import '../../components/Dashboard.css';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { createWidget, useCustomWidgets } from '../../components/Dashboard/hooks/useCustomWidgets';
import { useGlobalTimeRange } from '../../components/Dashboard/hooks/useChartSettings';
import { dashboardQueryKeys, fetchDashboardNodes, fetchDashboardSettings } from '../../components/Dashboard/hooks/useDashboardData';
import {
  meshcoreDashboardSource,
  meshtasticDashboardSource,
  reticulumDashboardSource,
  type DashboardDataSource,
} from '../../components/Dashboard/dataSources';
import type { CustomWidget, FavoriteChart, NodeInfo } from '../../components/Dashboard/types';
import { getTelemetryLabel } from '../../components/TelemetryChart';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { useUnifiedDashboardBundles, type SourceDashboardBundle } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';
import ToolHead from '../meshcore/ToolHead';
import DeviceTag from '../patterns/DeviceTag';
import RowMenu from '../patterns/RowMenu';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useShellDevices } from '../shell/shellDevices';
import { isMeshtasticFamily, statusLabel } from '../shell/deviceTabs';
import { useIsPhone } from '../shell/useIsPhone';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { renderChart, renderWidget, type ChartEnv, type WidgetEnv } from './boardBodies';
import { AddWidgetSheet, EditRows, type ItemLabel } from './EditControls';
import { CHANNEL_UTIL_AMBER, isLowBattery } from './healthTiles';
import { boardItems, chartKey, useUserBoard, type BoardItem } from './useUserBoard';
import styles from './Dashboard.module.css';
import own from './OverviewDashboard.module.css';

const WIDGET_TITLE: Record<CustomWidget['type'], string> = {
  nodeStatus: 'dashboard.widget.node_status.title',
  traceroute: 'dashboard.widget.traceroute.title',
  hopDistribution: 'dashboard.widget.hop_distribution.title',
  distanceDistribution: 'dashboard.widget.distance_distribution.title',
  hopDistanceHeatmap: 'dashboard.widget.hop_distance_heatmap.title',
  liveMeshActivity: 'dashboard.widget.live_mesh_activity.title',
};

type Tagged<T> = T & { sourceId: string };
type OverviewChart = Tagged<FavoriteChart>;

/** An Overview chart's key carries its device: two devices can star the same node. */
const overviewChartKey = (f: FavoriteChart) => `${(f as OverviewChart).sourceId}/${chartKey(f)}`;
const sourceOf = (item: BoardItem) => (item.kind === 'widget' ? (item.widget as Tagged<CustomWidget>) : (item.favorite as OverviewChart)).sourceId;

/** The device's Dashboard: MeshCore's is today's `telemetry` view; the MeshCore MQTT feed has none. */
const hasDashboard = (type: string) => type !== 'meshcore_mqtt';
const dashboardPath = (s: WorkspaceSource) => `/source/${encodeURIComponent(s.id)}/${s.type === 'meshcore' ? 'telemetry' : 'dashboard'}`;
const dataSourceFor = (type: string): DashboardDataSource =>
  type === 'meshcore' ? meshcoreDashboardSource : type === 'reticulum' ? reticulumDashboardSource : meshtasticDashboardSource;

const AGE_WINDOW = { ageWindow: true };
const NO_SOLAR = new Map<number, number>();
const NO_NODES = new Map<string, NodeInfo>();
const noop = () => {};

/** A database row from the all-devices bundle (flat fields). */
type BundleRow = { nodeNum?: number | string; nodeId?: string; publicKey?: string; longName?: string; shortName?: string; batteryLevel?: number; channelUtilization?: number; airUtilTx?: number };

interface RowValues {
  live: boolean;
  online: number | null;
  total: number | null;
  chUtil: number | null;
  airtime: number | null;
  lowBattery: number | null;
}

/** A device row: nothing live while the device is not connected (16-04's "No live numbers while offline"). */
function rowValues(s: WorkspaceSource, bundle: SourceDashboardBundle | undefined): RowValues {
  const live = s.status === 'connected';
  const total = s.live?.nodeCount ?? null;
  if (!live) return { live, online: null, total, chUtil: null, airtime: null, lowBattery: null };
  const rows = (bundle?.nodes ?? []) as BundleRow[];
  const local = s.live?.nodeNum !== undefined ? rows.find((n) => Number(n.nodeNum) === s.live?.nodeNum) : undefined;
  return {
    live,
    online: s.live?.activeNodeCount ?? null,
    total,
    chUtil: local?.channelUtilization ?? null,
    airtime: local?.airUtilTx ?? null,
    // A device whose nodes carry no battery level (MeshCore reports volts) has no answer.
    lowBattery: rows.some((n) => typeof n.batteryLevel === 'number')
      ? rows.filter((n) => isLowBattery({ deviceMetrics: { batteryLevel: n.batteryLevel } } as Parameters<typeof isLowBattery>[0])).length
      : null,
  };
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 10) / 10}%`);
const num = (v: number | null) => (v === null ? '—' : String(v));

interface Draft {
  items: BoardItem[];
  start: BoardItem[];
}

export default function OverviewDashboard() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { authStatus, hasPermission } = useAuth();
  const { temperatureUnit, distanceUnit, favoriteTelemetryStorageDays } = useSettings();
  const { sources } = useShellDevices();

  const devices = useMemo(() => sources.filter((s) => s.status !== 'disabled'), [sources]);
  // Disabled devices too, so a saved widget from one says so (it is still readable).
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  // `dashboard` is a global resource (not in SOURCEY_RESOURCES): the device gate is the readable list itself.
  const mayReadDashboard = hasPermission('dashboard', 'read');
  const canOpen = useCallback(
    (s: WorkspaceSource | undefined): s is WorkspaceSource => !!s && s.status !== 'disabled' && hasDashboard(s.type) && mayReadDashboard,
    [mayReadDashboard],
  );

  const { data: bundles } = useUnifiedDashboardBundles(devices.map((s) => s.id), true, AGE_WINDOW);
  const bundleOf = (id: string) => bundles?.find((b) => b.sourceId === id);

  const board = useUserBoard('overview');
  const charts = useMemo(() => (board.charts ?? []) as FavoriteChart[], [board.charts]);
  const items = useMemo(() => boardItems(board.widgets, charts, board.order, overviewChartKey), [board.widgets, charts, board.order]);

  // One node read per device on the board that the viewer may open, on the device dashboard's key (shared cache).
  // No interval here (Ruling 8.2 HY): read on open, refreshed on focus or revisit; the device page keeps its own 30 s timer.
  const boardDevices = useMemo(
    () => [...new Set(items.map(sourceOf))].map((id) => byId.get(id)).filter(canOpen),
    [items, byId, canOpen],
  );
  const nodeQueries = useQueries({
    queries: boardDevices.map((s) => {
      const ds = dataSourceFor(s.type);
      return {
        queryKey: [...dashboardQueryKeys.nodes(s.id), ds.kind] as const,
        queryFn: () => fetchDashboardNodes(ds, s.id),
        staleTime: 10 * 1000,
        gcTime: 5 * 60 * 1000,
      };
    }),
  });
  const nodesOf = (id: string): Map<string, NodeInfo> => nodeQueries[boardDevices.findIndex((s) => s.id === id)]?.data ?? NO_NODES;

  const canEditBoard = authStatus?.authenticated === true && board.ready;
  const [hours, setHours] = useState(24);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState<'device' | 'add' | null>(null);
  const [addDevice, setAddDevice] = useState<WorkspaceSource | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { handleDataLoaded, globalTimeRange, globalMinTime } = useGlobalTimeRange();

  // The picked device's stars, read once when Telemetry chart can be offered (the device dashboard's settings key).
  const starredQuery = useQuery({
    queryKey: dashboardQueryKeys.settings(addDevice?.id ?? null),
    queryFn: () => fetchDashboardSettings(addDevice?.id ?? null),
    enabled: sheet === 'add' && !!addDevice,
    staleTime: 10 * 1000,
  });

  const saveWidgets = useCallback(
    (widgets: CustomWidget[]) => board.setWidgets(widgets).catch(() => showToast(t('workspace.dashboard.save_failed'), 'error')),
    [board, showToast, t],
  );
  const widgetOps = useCustomWidgets({ baseUrl: appBasename, customWidgets: board.widgets, setCustomWidgets: noop, saveWidgets });

  // A node's name from the device's nodes, else the all-devices bundle (a chart pinned in this edit, before its device is read).
  const nameFromBundle = (sourceId: string, id: string) => {
    const row = ((bundleOf(sourceId)?.nodes ?? []) as BundleRow[]).find((n) => n.nodeId === id || n.publicKey === id);
    return row?.longName || row?.shortName || id;
  };
  const nodeName = (sourceId: string, id: string) =>
    dataSourceFor(byId.get(sourceId)?.type ?? '').getDisplayName(nodesOf(sourceId).get(id) as NodeInfo | undefined, nameFromBundle(sourceId, id));
  const label = (item: BoardItem): ItemLabel => {
    const ok = canOpen(byId.get(sourceOf(item)));
    if (item.kind === 'chart') {
      const metric = getTelemetryLabel(item.favorite.telemetryType);
      return ok ? { title: nodeName(sourceOf(item), item.favorite.nodeId), sub: t('workspace.dashboard.chart_sub', { metric }) } : { title: metric };
    }
    const w = item.widget;
    const sub = !ok ? undefined
      : w.type === 'nodeStatus' ? t('workspace.dashboard.nodes_count', { count: w.nodeIds.length })
        : w.type === 'traceroute' && w.targetNodeId ? nodeName(sourceOf(item), w.targetNodeId)
          : undefined;
    return { title: t(WIDGET_TITLE[w.type]), sub };
  };

  const startEdit = () => setDraft({ items, start: items });
  const cancel = () => {
    setSheet(null);
    setDraft(null);
  };
  const done = async () => {
    if (!draft || savingRef.current) return;
    const order = draft.items.map((i) => i.key);
    if (JSON.stringify(order) === JSON.stringify(draft.start.map((i) => i.key))) {
      setDraft(null);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await board.setBoard({
        widgets: draft.items.flatMap((i) => (i.kind === 'widget' ? [i.widget] : [])),
        charts: draft.items.flatMap((i) => (i.kind === 'chart' ? [i.favorite as OverviewChart] : [])),
        order,
      });
      setSheet(null);
      setDraft(null);
    } catch {
      showToast(t('workspace.dashboard.save_failed'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const editButton = (
    <button type="button" className={isPhone ? styles.textButton : styles.button} onClick={startEdit} disabled={!canEditBoard}>
      {!isPhone && <UiIcon name="edit" size={18} />}
      {t('common.edit')}
    </button>
  );
  const maxDays = Math.max(1, Math.min(7, favoriteTelemetryStorageDays || 7));
  const range = (
    <div className={styles.range} role="group" aria-label={t('workspace.dashboard.range')}>
      {[...new Set([1, 24, maxDays * 24])].map((h) => (
        <button key={h} type="button" className={styles.rangeButton} aria-pressed={hours === h} onClick={() => setHours(h)}>
          {h < 48 ? t('workspace.dashboard.range_hours', { count: h }) : t('workspace.dashboard.range_days', { count: h / 24 })}
        </button>
      ))}
    </div>
  );
  const back = { label: t('workspace.shell.overview'), to: '/overview' };
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
      <ToolHead title={t('workspace.dashboard.editing')} subtitle={t('workspace.dashboard.editing_hint')} back={back} actions={<>{cancelButton}{doneButton}</>} />
    )
  ) : (
    <ToolHead
      title={t('nav.dashboard')}
      subtitle={t('workspace.overview_dashboard.subtitle')}
      back={back}
      actions={<>{range}{editButton}</>}
      phoneActions={editButton}
    />
  );

  const deviceRows = (
    <DeviceRows devices={devices} isPhone={isPhone} values={(s) => rowValues(s, bundleOf(s.id))} link={(s) => (canOpen(s) ? dashboardPath(s) : null)} />
  );

  // Add widget: the device first (readable, with a dashboard), then today's widget types for it, or one of its stars.
  const addable = devices.filter(canOpen);
  const pinned = new Set(items.map((i) => i.key));
  const starred = addDevice
    ? (starredQuery.data?.favorites ?? [])
        .map((f): OverviewChart => ({ ...f, sourceId: addDevice.id }))
        .filter((f) => !pinned.has(overviewChartKey(f)) && !draft?.items.some((i) => i.key === overviewChartKey(f)))
        .map((f) => ({
          key: overviewChartKey(f),
          title: `${nameFromBundle(addDevice.id, f.nodeId)} · ${getTelemetryLabel(f.telemetryType)}`,
          onAdd: () => draft && setDraft({ ...draft, items: [...draft.items, { key: overviewChartKey(f), kind: 'chart', favorite: f }] }),
        }))
    : undefined;

  if (draft) {
    return (
      <Page isPhone={isPhone}>
        {head}
        {isPhone && <p className={styles.label}>{t('workspace.dashboard.your_board')}</p>}
        <EditRows items={draft.items} label={label} onChange={(next) => setDraft({ ...draft, items: next })} />
        <button type="button" className={styles.addRow} onClick={() => setSheet('device')}>
          <UiIcon name="plus" size={20} />
          {t('dashboard.add_widget_title')}
        </button>
        {isPhone && <p className={styles.note}>{t('workspace.dashboard.phone_note')}</p>}
        <Sheet open={sheet === 'device'} onClose={() => setSheet(null)} title={t('dashboard.add_widget_title')}>
          <div className={styles.sheetBody} data-phone={isPhone || undefined}>
            <p className={styles.note}>{t('workspace.overview_dashboard.pick_device')}</p>
            <ul className={styles.options}>
              {addable.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={styles.option}
                    onClick={() => {
                      setAddDevice(s);
                      setSheet('add');
                    }}
                  >
                    <span className={styles.optionIcon}><DeviceTag sourceId={s.id} /></span>
                    <span className={styles.optionText}><span className={styles.optionTitle}>{s.name}</span></span>
                    <UiIcon name="chevronRight" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
        <AddWidgetSheet
          open={sheet === 'add' && !!addDevice}
          onClose={() => setSheet(null)}
          supported={dataSourceFor(addDevice?.type ?? '').widgets.supported}
          device={addDevice ? { name: addDevice.name, onChange: () => setSheet('device') } : undefined}
          starred={starred}
          onAdd={(type) => {
            if (!addDevice) return;
            const widget: CustomWidget = Object.assign(createWidget(type), { sourceId: addDevice.id });
            setDraft({ ...draft, items: [...draft.items, { key: widget.id, kind: 'widget', widget }] });
          }}
        />
      </Page>
    );
  }

  const chartEnv = (sourceId: string): ChartEnv => ({
    nodes: nodesOf(sourceId),
    hours,
    temperatureUnit,
    globalTimeRange,
    globalMinTime,
    onDataLoaded: handleDataLoaded,
    // The solar overlay and Y range are each device's own chart settings: on its dashboard.
    solarEstimates: NO_SOLAR,
  });
  const widgetEnv = (s: WorkspaceSource): WidgetEnv => ({
    nodes: nodesOf(s.id),
    // Meshtastic-backed devices only: MeshCore's home is its key, Reticulum has none (as 8.1).
    localId: isMeshtasticFamily(s.type) && s.live?.nodeNum !== undefined ? `!${s.live.nodeNum.toString(16).padStart(8, '0')}` : null,
    dataSource: dataSourceFor(s.type),
    distanceUnit,
    canEdit: canEditBoard,
    openNode: s.type === 'reticulum' ? undefined : (id) => void navigate(`/source/${encodeURIComponent(s.id)}/node/${encodeURIComponent(id)}`),
    ops: widgetOps,
  });

  return (
    <Page isPhone={isPhone}>
      {head}
      {isPhone && (
        <div className={own.phoneIntro}>
          <p className={own.phoneSubtitle}>{t('workspace.overview_dashboard.subtitle_phone')}</p>
          {range}
        </div>
      )}
      {deviceRows}
      {isPhone && items.length > 0 && <p className={styles.label}>{t('workspace.dashboard.your_board_list')}</p>}
      {items.length === 0 ? (
        <StateView kind="empty" title={t('workspace.dashboard.empty_title')} detail={t('workspace.overview_dashboard.empty_detail')} />
      ) : (
        <div className={styles.board}>
          {items.map((item) => {
            const sid = sourceOf(item);
            const s = byId.get(sid);
            const ok = canOpen(s);
            // Readable but disabled: say so (no data is read for it), rather than no permission.
            const disabledName = !ok && mayReadDashboard && byId.get(sid)?.status === 'disabled' ? byId.get(sid)?.name : undefined;
            const disabled = disabledName !== undefined;
            const l = label(item);
            const menu = [
              ...(canEditBoard ? [{ key: 'edit', label: t('workspace.dashboard.edit_title'), icon: 'edit' as const, onSelect: startEdit }] : []),
              ...(ok && item.kind === 'chart' && s.type !== 'reticulum'
                ? [{ key: 'node', label: t('workspace.dashboard.open_node'), icon: 'nodes' as const, onSelect: () => void navigate(`/source/${encodeURIComponent(sid)}/node/${encodeURIComponent(item.favorite.nodeId)}`) }]
                : []),
            ];
            return (
              <section key={item.key} className={styles.card} data-testid="board-card">
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>
                    {l.title}
                    {ok && item.kind === 'chart' && <span className={styles.muted}>{getTelemetryLabel(item.favorite.telemetryType)}</span>}
                  </h3>
                  {(ok || disabled) && <DeviceTag sourceId={sid} />}
                  {menu.length > 0 && <RowMenu label={t('workspace.dashboard.card_menu', { name: l.title })} items={menu} />}
                </div>
                <div className={styles.cardBody}>
                  {ok ? (
                    <SourceProvider sourceId={s.id} sourceName={s.name} sourceType={s.type}>
                      {item.kind === 'chart' ? renderChart(item.favorite, chartEnv(sid)) : renderWidget(item.widget, widgetEnv(s))}
                    </SourceProvider>
                  ) : disabled ? (
                    <StateView kind="empty" title={t('workspace.overview_dashboard.device_disabled', { name: disabledName })} />
                  ) : (
                    <StateView kind="noPermission" />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function Page({ isPhone, children }: { isPhone: boolean; children: ReactNode }) {
  return (
    <div className={styles.page} data-phone={isPhone || undefined} data-testid="overview-dashboard">
      {children}
    </div>
  );
}

interface DeviceRowsProps {
  devices: WorkspaceSource[];
  isPhone: boolean;
  values(s: WorkspaceSource): RowValues;
  /** The device's dashboard, or null where the viewer may not open it. */
  link(s: WorkspaceSource): string | null;
}

/** One row per device: a table on desktop (j3), two-line rows on the phone (16-04). */
function DeviceRows({ devices, isPhone, values, link }: DeviceRowsProps) {
  const { t } = useTranslation();
  const status = (s: WorkspaceSource) => {
    // An MQTT bridge's gateways, in today's words (DashboardSidebar's publisher badge).
    const publishers = Object.values((s.live?.publishers ?? {}) as Record<string, { connected?: boolean }>);
    if (s.status === 'connected' && publishers.length > 0) {
      const up = publishers.filter((p) => p.connected).length;
      return up === publishers.length
        ? t('source.publishers_all_connected', { count: up })
        : t('source.publishers_partial', { connected: up, total: publishers.length });
    }
    return statusLabel(t, s.status);
  };
  const avatar = (s: WorkspaceSource) => (
    <span className={own.avatar} style={{ background: s.colorToken }} aria-hidden="true">
      {s.abbrev}
    </span>
  );
  const name = (s: WorkspaceSource) => {
    const to = link(s);
    return to ? (
      <Link className={own.name} to={to}>
        {avatar(s)}
        <span className={own.nameText}>{s.name}</span>
      </Link>
    ) : (
      <span className={own.name}>
        {avatar(s)}
        <span className={own.nameText}>{s.name}</span>
      </span>
    );
  };
  const state = (s: WorkspaceSource) => (
    <span className={own.status}>
      <span className={own.dot} data-status={s.status} aria-hidden="true" />
      {status(s)}
    </span>
  );

  if (isPhone) {
    return (
      <ul className={own.cards} aria-label={t('workspace.shell.devices')} data-testid="device-rows">
        {devices.map((s) => {
          const v = values(s);
          return (
            <li key={s.id} className={own.card} data-offline={!v.live || undefined}>
              <div className={own.cardTop}>
                {name(s)}
                {state(s)}
              </div>
              <p className={own.figures}>
                <span>{t('workspace.overview_dashboard.nodes_of', { online: num(v.online), total: num(v.total) })}</span>
                {v.live ? (
                  <>
                    {v.chUtil !== null && (
                      <span>
                        {t('workspace.overview_dashboard.col_ch_util')}{' '}
                        <b data-amber={v.chUtil > CHANNEL_UTIL_AMBER || undefined}>{pct(v.chUtil)}</b>
                      </span>
                    )}
                    {v.airtime !== null && <span>{t('workspace.dashboard.tile.airtimeTx')} <b>{pct(v.airtime)}</b></span>}
                    {v.lowBattery !== null && <span>{t('workspace.dashboard.tile.lowBattery')} <b>{v.lowBattery}</b></span>}
                  </>
                ) : (
                  <span>{t('workspace.overview_dashboard.offline_note')}</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={own.tableWrap} data-testid="device-rows">
      <table className={own.table} aria-label={t('workspace.shell.devices')}>
        <thead>
          <tr>
            <th scope="col">{t('workspace.overview_dashboard.col_device')}</th>
            <th scope="col">{t('workspace.overview_dashboard.col_nodes')}</th>
            <th scope="col">{t('workspace.overview_dashboard.col_ch_util')}</th>
            <th scope="col">{t('workspace.dashboard.tile.airtimeTx')}</th>
            <th scope="col">{t('workspace.dashboard.tile.lowBattery')}</th>
            <th scope="col">{t('workspace.overview_dashboard.col_status')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((s) => {
            const v = values(s);
            return (
              <tr key={s.id} data-offline={!v.live || undefined}>
                <th scope="row">{name(s)}</th>
                <td>{`${num(v.online)} / ${num(v.total)}`}</td>
                <td><span data-amber={(v.chUtil ?? 0) > CHANNEL_UTIL_AMBER || undefined}>{pct(v.chUtil)}</span></td>
                <td>{pct(v.airtime)}</td>
                <td>{num(v.lowBattery)}</td>
                <td>{state(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
