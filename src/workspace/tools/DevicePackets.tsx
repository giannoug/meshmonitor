/**
 * A Meshtastic device's packet monitor (boards o1-packets, q2-packets,
 * q3-packet; note ds12): `/source/:id/packetmonitor` for a device with its
 * own radio (an MQTT source keeps its receptions page, Task 4.7; MeshCore its
 * own, Task 7.5). It follows the Nodes pattern: a table with a column picker
 * on desktop (today's fourteen columns, any order), two-line rows and a
 * detail sheet on the phone.
 *
 * Everything is today's PacketMonitorPanel on its hook (`usePacketMonitor`):
 * the same packet query at today's 5 s interval, the filters (the type chips
 * are shortcuts into today's type and encrypted filters; the Filters panel
 * keeps every one), Hide Own Packets, Pause (client-side auto-scroll), Export
 * (today's JSONL download), Pop out (today's window), Clear all packets
 * (admins, asks first) and Capture (`packet_log_enabled`, settings:write).
 * Capture is server-side logging: nothing here sends on the mesh. Logging is
 * opt-in, so with capture off the page says so above whatever is stored.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import PacketHiddenChip from '../../components/PacketHiddenChip';
import { mostLikelyRelayName, usePacketMonitor, type DirectNeighborStats } from '../../components/usePacketMonitor';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import apiService from '../../services/api';
import { clearPackets } from '../../services/packetApi';
import type { PacketFilters as Filters } from '../../types/packet';
import { openPacketMonitorPopout } from '../../utils/packetMonitorPopout';
import ChatProviders from '../chat/ChatProviders';
import { useChatRuntime } from '../chat/useChatRuntime';
import ToolHead from '../meshcore/ToolHead';
import ColumnPicker from '../nodes/ColumnPicker';
import { PacketList, PacketTable } from '../overview/PacketStream';
import { PACKET_COLUMNS, packetKey, type PacketColumnId } from '../overview/packetRows';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu, { type RowMenuItem } from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { PacketFilters, PacketFiltersSheetBody, PacketSearch } from './PacketFilters';
import PacketSheet from './PacketSheet';
import mc from '../meshcore/McTools.module.css';
import StateView from '../patterns/StateView';
import styles from './Tools.module.css';

type Monitor = ReturnType<typeof usePacketMonitor>;

/** The board's columns until the viewer picks others. */
const DEFAULT_COLUMNS: PacketColumnId[] = ['time', 'from', 'to', 'type', 'hops', 'snr'];
const COLUMNS_KEY = 'workspace.packetColumns';

/** Per-viewer convenience only: the picked columns, in this browser. */
function useColumns(): [PacketColumnId[], (next: string[]) => void] {
  const known = new Set<string>(PACKET_COLUMNS.map((c) => c.id));
  const [columns, setColumns] = useState<PacketColumnId[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? 'null') as unknown;
      if (Array.isArray(saved)) {
        const valid = saved.filter((id): id is PacketColumnId => typeof id === 'string' && known.has(id));
        if (valid.length) return valid;
      }
    } catch {
      // Storage blocked or bad JSON: the defaults.
    }
    return DEFAULT_COLUMNS;
  });
  const set = (next: string[]) => {
    const valid = next.filter((id): id is PacketColumnId => known.has(id));
    setColumns(valid);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(valid));
    } catch {
      // Not kept; this visit still shows them.
    }
  };
  return [columns, set];
}

/** Type chips (the board's): shortcuts into today's type (portnum) and encrypted filters. */
const CHIPS: Array<{ key: string; label: string; portnum?: number; encrypted?: true }> = [
  { key: 'all', label: 'workspace.packets.chip_all' },
  { key: 'text', label: 'workspace.packets.chip_text', portnum: 1 },
  { key: 'position', label: 'workspace.packets.chip_position', portnum: 3 },
  { key: 'telemetry', label: 'workspace.packets.chip_telemetry', portnum: 67 },
  { key: 'nodeinfo', label: 'workspace.packets.chip_nodeinfo', portnum: 4 },
  { key: 'routing', label: 'workspace.packets.chip_routing', portnum: 5 },
  { key: 'traceroute', label: 'workspace.packets.chip_traceroute', portnum: 70 },
  { key: 'encrypted', label: 'workspace.packets.chip_encrypted', encrypted: true },
];

function chipOn(chip: (typeof CHIPS)[number], f: Filters): boolean {
  if (chip.encrypted) return f.encrypted === true && f.portnum === undefined;
  if (chip.portnum !== undefined) return f.portnum === chip.portnum && f.encrypted === undefined;
  return f.portnum === undefined && f.encrypted === undefined;
}

function Chips({ m, phone }: { m: Monitor; phone: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.chips} data-phone={phone ? '' : undefined} role="group" aria-label={t('packet_monitor.column.type')}>
      {CHIPS.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={mc.chip}
          aria-pressed={chipOn(chip, m.filters)}
          onClick={() => m.setFilters((f) => ({ ...f, portnum: chip.portnum, encrypted: chip.encrypted }))}
        >
          {t(chip.label)}
        </button>
      ))}
    </div>
  );
}

export default function DevicePacketsRoute({ sourceId, source }: { sourceId: string; source: DashboardSource }) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="nodes">
      <DevicePackets sourceId={sourceId} deviceName={source.name} />
    </ChatProviders>
  );
}

function DevicePackets({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, loading: authLoading } = useAuth();
  // The device's status and poll, as on the other device pages; the poll feeds the node filters.
  useChatRuntime(-1);
  const m = usePacketMonitor();
  const [columns, setColumns] = useColumns();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  // One clear per confirm: a second press before the first re-render waits for it.
  const clearingRef = useRef(false);
  const [neighbours, setNeighbours] = useState<DirectNeighborStats>({});
  const isAdmin = authStatus?.user?.isAdmin === true;
  const base = `/source/${encodeURIComponent(sourceId)}`;

  // Today's Last Hop reads the direct-neighbour stats once (PacketMonitorPanel's mount read).
  useEffect(() => {
    if (!m.canView) return;
    let cancelled = false;
    apiService
      .getDirectNeighborStats(24, sourceId)
      .then((s) => !cancelled && setNeighbours(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [m.canView, sourceId]);
  const lastHop = useMemo(
    () => (p: Monitor['packets'][number]) => mostLikelyRelayName(p.relay_node, p.rssi, m.nodes, neighbours),
    [m.nodes, neighbours],
  );

  const title = t('nav.packet_monitor');
  const back = { label: t('workspace.home.tools'), to: `${base}/tools` };
  if (authLoading) return <div className={`${mc.page} ${styles.phoneScope}`} />;
  if (!m.canView) {
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
        <ToolHead title={title} back={back} />
        <StateView kind="noPermission" title={t('packet_monitor.no_permission')} />
      </div>
    );
  }

  const selected = m.packets.find((p) => packetKey(p) === selectedKey) ?? null;
  const live = t(m.autoScroll ? 'workspace.packets.live' : 'workspace.packets.paused');
  const count = t('packet_monitor.count', { shown: m.packets.length.toLocaleString(), total: m.total.toLocaleString() });
  const pauseLabel = m.autoScroll ? t('packet_monitor.pause_autoscroll') : t('packet_monitor.resume_autoscroll');
  const captureLabel = m.captureEnabled ? t('packet_monitor.stop_capture', 'Stop capturing') : t('packet_monitor.start_capture', 'Start capturing');
  const canCapture = m.canWriteSettings && m.captureEnabled !== null;

  const states = (
    <>
      {m.captureEnabled === false && (
        <div className={mc.banner} role="status">
          <UiIcon name="statusOff" size={18} />
          <span>{t('workspace.packets.capture_off_note')}</span>
          {canCapture && (
            <button type="button" className={mc.button} disabled={m.togglingCapture} onClick={() => void m.handleToggleCapture()}>
              {captureLabel}
            </button>
          )}
        </div>
      )}
      {m.rateLimitError && <p className={mc.note}><UiIcon name="alert" size={16} />{t('packet_monitor.rate_limit_warning')}</p>}
      {m.loading ? (
        <StateView kind="loading" title={t('packet_monitor.loading')} />
      ) : m.packets.length === 0 ? (
        <StateView kind="empty" icon="list" title={t('packet_monitor.no_packets')} />
      ) : null}
    </>
  );
  const stream = {
    packets: m.packets, hasMore: m.hasMore, loadingMore: m.loadingMore, loadMore: m.loadMore, selectedKey,
    onSelect: (p: Monitor['packets'][number]) => setSelectedKey(packetKey(p)),
  };
  const detail = selected && <PacketSheet packet={selected} sourceId={sourceId} onClose={() => setSelectedKey(null)} />;
  const confirm = (
    <ConfirmSheet
      open={clearOpen}
      title={t('packet_monitor.clear_all')}
      body={
        <>
          <p>{t('packet_monitor.confirm_clear')}</p>
          <SendsLine>{t('workspace.packets.sends_nothing')}</SendsLine>
        </>
      }
      confirmLabel={t('packet_monitor.clear_all')}
      danger
      busy={clearing}
      submitOnEnter={false}
      onCancel={() => setClearOpen(false)}
      onConfirm={async () => {
        if (clearingRef.current) return;
        clearingRef.current = true;
        setClearing(true);
        try {
          await clearPackets();
          await m.fetchPackets();
          setClearOpen(false);
        } catch {
          throw new Error(t('packet_monitor.clear_failed'));
        } finally {
          clearingRef.current = false;
          setClearing(false);
        }
      }}
    />
  );
  const exportLabel = t('packet_monitor.export_title');
  const popoutLabel = t('packet_monitor.popout');

  if (isPhone) {
    // Every control the desktop head has stays reachable: Pause in the bar, the rest under ⋯.
    const menu: RowMenuItem[] = [
      { key: 'filters', label: t('common.filters'), icon: 'filter', onSelect: () => setFiltersOpen(true) },
      { key: 'export', label: exportLabel, icon: 'download', disabled: m.total === 0, onSelect: m.handleExport },
      { key: 'popout', label: popoutLabel, icon: 'maximize', onSelect: () => openPacketMonitorPopout() },
      ...(canCapture ? [{ key: 'capture', label: captureLabel, icon: (m.captureEnabled ? 'statusOff' : 'statusOn') as 'statusOff' | 'statusOn', disabled: m.togglingCapture, onSelect: () => void m.handleToggleCapture() }] : []),
      ...(isAdmin ? [{ key: 'clear', label: t('packet_monitor.clear_all'), icon: 'delete' as const, danger: true, onSelect: () => setClearOpen(true) }] : []),
    ];
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone="">
        <ToolHead
          title={title}
          back={back}
          phoneActions={
            <>
              <button type="button" className={mc.iconButton} aria-label={pauseLabel} title={pauseLabel} aria-pressed={!m.autoScroll} onClick={() => m.setAutoScroll(!m.autoScroll)}>
                <UiIcon name={m.autoScroll ? 'pause' : 'play'} size={22} />
              </button>
              <RowMenu label={t('workspace.packets.more_actions')} items={menu} />
            </>
          }
        />
        <Chips m={m} phone />
        <p className={styles.live}>
          <span className={styles.liveDot} data-paused={!m.autoScroll || undefined} aria-hidden="true" />
          {live} · {t('workspace.packets.newest_first')}
          <PacketHiddenChip count={m.hiddenCount} onClick={() => setFiltersOpen(true)} />
        </p>
        {states}
        {m.packets.length > 0 && <PacketList {...stream} />}
        {detail}
        <Sheet open={filtersOpen && !selected} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
          <PacketFiltersSheetBody m={m} />
        </Sheet>
        {confirm}
        <p className={mc.note}>{t('workspace.packets.capture_one')}</p>
      </div>
    );
  }

  return (
    <div className={`${mc.page} ${styles.phoneScope}`} data-panel={selected ? '' : undefined}>
      <ToolHead
        title={title}
        back={back}
        subtitle={
          <>
            <span className={styles.liveDot} data-paused={!m.autoScroll || undefined} aria-hidden="true" />
            {live} · <span title={t('packet_monitor.count_tooltip', { shown: m.packets.length, total: m.total })}>{count}</span> · {deviceName}
          </>
        }
        actions={
          <>
            {canCapture && (
              <button type="button" className={mc.button} data-danger={m.captureEnabled || undefined} disabled={m.togglingCapture} onClick={() => void m.handleToggleCapture()}>
                <UiIcon name={m.captureEnabled ? 'statusOff' : 'statusOn'} size={16} />
                {captureLabel}
              </button>
            )}
            <button type="button" className={mc.button} aria-pressed={!m.autoScroll} onClick={() => m.setAutoScroll(!m.autoScroll)}>
              <UiIcon name={m.autoScroll ? 'pause' : 'play'} size={16} />
              {pauseLabel}
            </button>
            <ColumnPicker columns={columns} onChange={setColumns} options={[...PACKET_COLUMNS]} />
            <button type="button" className={mc.button} aria-pressed={m.showFilters} onClick={() => m.setShowFilters(!m.showFilters)}>
              <UiIcon name="filter" size={16} />
              {t('common.filters')}
            </button>
            <PacketHiddenChip count={m.hiddenCount} onClick={() => m.setShowFilters(true)} />
            <button type="button" className={mc.iconButton} aria-label={exportLabel} title={exportLabel} disabled={m.total === 0} onClick={m.handleExport}>
              <UiIcon name="download" size={18} />
            </button>
            <button type="button" className={mc.iconButton} aria-label={popoutLabel} title={popoutLabel} onClick={() => openPacketMonitorPopout()}>
              <UiIcon name="maximize" size={18} />
            </button>
            {isAdmin && (
              <button type="button" className={mc.iconButton} aria-label={t('packet_monitor.clear_all')} title={t('packet_monitor.clear_all')} onClick={() => setClearOpen(true)}>
                <UiIcon name="delete" size={18} />
              </button>
            )}
          </>
        }
      />
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.srOnly}>{t('workspace.packets.filter_label')}</span>
          <PacketSearch m={m} />
        </label>
        <Chips m={m} phone={false} />
      </div>
      {m.showFilters && <PacketFilters m={m} withSearch={false} />}
      <p className={mc.note}>{t('workspace.packets.capture_one')}</p>
      {states}
      <div className={mc.body} data-panel={selected ? '' : undefined}>
        <div>{m.packets.length > 0 && <PacketTable {...stream} columns={columns} lastHop={lastHop} />}</div>
        {detail}
      </div>
      {confirm}
    </div>
  );
}
