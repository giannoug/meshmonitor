/**
 * The packet monitor window (boards 18-01, 18-02; s18n1): `/packet-monitor`
 * in the Workspace layout, opened by Pop out (`openPacketMonitorPopout`, a
 * 1200×800 window; a new tab on a phone). It is one Meshtastic device's
 * monitor on today's hook (`usePacketMonitor`): today's filters, Capture
 * (`packet_log_enabled`, settings:write; server-side logging, it sends nothing
 * on the mesh), Pause, Export, Clear (admins, asks first), the raw packet
 * panel, and Close window (today's `window.close()`). There is no Pop out and
 * no shell; sender names stay plain text, as the window cannot open a node.
 * A MeshCore device (`?sourceId=`) keeps today's MeshCore window.
 */
import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/fonts.css';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { ToastProvider } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import PacketHiddenChip from '../../components/PacketHiddenChip';
import PacketSearchInput from '../../components/packets/PacketSearchInput';
import TimeWindowSelect from '../../components/packets/TimeWindowSelect';
import SearchableSelect from '../../components/common/SearchableSelect';
import { PORTNUM_FILTER_OPTIONS, usePacketMonitor } from '../../components/usePacketMonitor';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { CsrfProvider } from '../../contexts/CsrfContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { useDashboardSources } from '../../hooks/useDashboardData';
import { clearPackets } from '../../services/packetApi';
import ConfirmSheet from '../patterns/ConfirmSheet';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import PacketDetailPanel from '../overview/PacketDetailPanel';
import { PacketList, PacketTable } from '../overview/PacketStream';
import { packetKey } from '../overview/packetRows';
import styles from './PacketsPopout.module.css';

// Today's MeshCore window, in its own chunk as Classic loads it.
const PacketMonitorPage = lazy(() => import('../../pages/PacketMonitorPage.tsx'));

type Monitor = ReturnType<typeof usePacketMonitor>;

/** Today's filters: search, time window, type, encrypted, transport, from node, last hop, Hide Own Packets, Clear Filters. */
function Filters({ m }: { m: Monitor }) {
  const { t } = useTranslation();
  const { filters, setFilters } = m;
  const moreMatches = (n: number) => t('packet_monitor.filter.more_matches', { count: n, defaultValue: '…and {{count}} more — keep typing to narrow' });
  return (
    <div className={styles.filters}>
      <PacketSearchInput
        value={filters.search}
        onCommit={(next) => setFilters((f) => (f.search === next ? f : { ...f, search: next }))}
        placeholder={t('packet_monitor.filter.search_placeholder', 'Search content / JSON…')}
        title={t('packet_monitor.filter.search_tooltip', 'Filters packets whose decoded content or metadata JSON contains this text (case-insensitive). Use this instead of the browser find, which cannot see off-screen rows.')}
      />
      <TimeWindowSelect value={m.timeWindow} onChange={m.setTimeWindow} />
      <select
        value={filters.portnum ?? ''}
        onChange={(e) => setFilters({ ...filters, portnum: e.target.value ? parseInt(e.target.value, 10) : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_types')}</option>
        {PORTNUM_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={filters.encrypted !== undefined ? String(filters.encrypted) : ''}
        onChange={(e) => setFilters({ ...filters, encrypted: e.target.value ? e.target.value === 'true' : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_packets')}</option>
        <option value="true">{t('packet_monitor.filter.encrypted_only')}</option>
        <option value="false">{t('packet_monitor.filter.decoded_only')}</option>
      </select>
      <select
        value={filters.transport_mechanism ?? ''}
        title={t('packet_monitor.filter.transport_tooltip')}
        onChange={(e) => setFilters({ ...filters, transport_mechanism: e.target.value !== '' ? parseInt(e.target.value, 10) : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_transports')}</option>
        <option value="1">{t('packet_monitor.filter.transport_lora')}</option>
        <option value="6">{t('packet_monitor.filter.transport_udp')}</option>
        <option value="5">{t('packet_monitor.filter.transport_mqtt')}</option>
        <option value="7">{t('packet_monitor.filter.transport_api')}</option>
        <option value="0">{t('packet_monitor.filter.transport_internal')}</option>
      </select>
      <SearchableSelect
        value={filters.from_node !== undefined ? String(filters.from_node) : ''}
        onChange={(val) => setFilters({ ...filters, from_node: val ? parseInt(val, 10) : undefined })}
        options={m.fromNodeOptions}
        emptyLabel={t('packet_monitor.filter.all_nodes')}
        placeholder={t('packet_monitor.filter.search_nodes', 'Search nodes…')}
        title={t('packet_monitor.filter.from_node_tooltip')}
        ariaLabel={t('packet_monitor.filter.from_node_tooltip')}
        noMatchesText={t('packet_monitor.filter.no_matches', 'No matches')}
        moreMatchesText={moreMatches}
      />
      <SearchableSelect
        value={filters.relay_node !== undefined ? String(filters.relay_node) : ''}
        onChange={(val) => setFilters({ ...filters, relay_node: val === '' ? undefined : val === 'unknown' ? 'unknown' : parseInt(val, 10) })}
        options={m.relayFilterOptions}
        emptyLabel={t('packet_monitor.filter.all_last_hops')}
        placeholder={t('packet_monitor.filter.search_last_hops', 'Search last hops…')}
        title={t('packet_monitor.filter.last_hop_tooltip')}
        ariaLabel={t('packet_monitor.filter.last_hop_tooltip')}
        noMatchesText={t('packet_monitor.filter.no_matches', 'No matches')}
        moreMatchesText={moreMatches}
      />
      <label className={styles.check} title={t('packet_monitor.filter.hide_own_tooltip')}>
        <input type="checkbox" checked={m.hideOwnPackets} onChange={(e) => m.setHideOwnPackets(e.target.checked)} />
        <span>{t('packet_monitor.filter.hide_own')}</span>
      </label>
      <button type="button" className={styles.link} onClick={() => { setFilters({}); m.setTimeWindow('all'); }}>
        {t('packet_monitor.filter.clear')}
      </button>
    </div>
  );
}

function PopoutWindow() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, loading: authLoading } = useAuth();
  const m = usePacketMonitor();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const isAdmin = authStatus?.user?.isAdmin === true;
  const device = m.deviceInfo?.localNodeInfo?.longName;
  const monitor = t('packet_monitor.title');
  const title = device ? t('workspace.packets.window_title', { title: monitor, device }) : monitor;
  const selected = m.packets.find((p) => packetKey(p) === selectedKey) ?? null;
  const live = t(m.autoScroll ? 'workspace.packets.live' : 'workspace.packets.paused');
  const count = t('packet_monitor.count', { shown: m.packets.length.toLocaleString(), total: m.total.toLocaleString() });
  const closeWindow = (
    <button type="button" className={isPhone ? styles.textLink : styles.button} onClick={() => window.close()}>
      {!isPhone && <UiIcon name="close" size={16} />}
      {t('workspace.packets.close_window')}
    </button>
  );

  // The grants decide what shows: no "no permission" flash while they load.
  if (authLoading) return <RouteLoading />;
  if (!m.canView) {
    return (
      <div className={styles.window} data-phone={isPhone ? '' : undefined}>
        <header className={styles.head}>
          <h1 className={styles.title}>{monitor}</h1>
          {closeWindow}
        </header>
        <p className={styles.state}>{t('packet_monitor.no_permission')}</p>
      </div>
    );
  }

  const exportLabel = t('packet_monitor.export_title');
  const pauseLabel = m.autoScroll ? t('packet_monitor.pause_autoscroll') : t('packet_monitor.resume_autoscroll');
  const controls = (
    <>
      {m.canWriteSettings && m.captureEnabled !== null && (
        <button type="button" className={styles.button} data-danger={m.captureEnabled || undefined} disabled={m.togglingCapture} onClick={() => void m.handleToggleCapture()}>
          <UiIcon name={m.captureEnabled ? 'statusOff' : 'statusOn'} size={16} />
          {m.captureEnabled ? t('packet_monitor.stop_capture', 'Stop capturing') : t('packet_monitor.start_capture', 'Start capturing')}
        </button>
      )}
      <button type="button" className={styles.button} aria-pressed={!m.autoScroll} onClick={() => m.setAutoScroll(!m.autoScroll)}>
        <UiIcon name={m.autoScroll ? 'pause' : 'play'} size={16} />
        {pauseLabel}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={isPhone ? undefined : m.showFilters}
        onClick={() => (isPhone ? setFiltersOpen(true) : m.setShowFilters(!m.showFilters))}
      >
        <UiIcon name="filter" size={16} />
        {t('common.filters')}
      </button>
      <PacketHiddenChip count={m.hiddenCount} onClick={() => (isPhone ? setFiltersOpen(true) : m.setShowFilters(true))} />
    </>
  );
  const clear = isAdmin && (
    <button type="button" className={styles.button} onClick={() => setClearOpen(true)}>
      <UiIcon name="delete" size={16} />
      {t('packet_monitor.clear_all')}
    </button>
  );
  const states = (
    <>
      {m.rateLimitError && <p className={styles.warning}><UiIcon name="alert" size={16} />{t('packet_monitor.rate_limit_warning')}</p>}
      {m.loading ? (
        <p className={styles.state}>{t('packet_monitor.loading')}</p>
      ) : m.packets.length === 0 ? (
        <p className={styles.state}>{t('packet_monitor.no_packets')}</p>
      ) : null}
    </>
  );
  const stream = {
    packets: m.packets, hasMore: m.hasMore, loadingMore: m.loadingMore, loadMore: m.loadMore, selectedKey,
    onSelect: (p: Monitor['packets'][number]) => setSelectedKey(packetKey(p)),
  };
  const detail = selected && <PacketDetailPanel packet={selected} onClose={() => setSelectedKey(null)} />;
  const confirm = (
    <ConfirmSheet
      open={clearOpen}
      title={t('packet_monitor.clear_all')}
      body={t('packet_monitor.confirm_clear')}
      confirmLabel={t('packet_monitor.clear_all')}
      danger
      busy={clearing}
      onCancel={() => setClearOpen(false)}
      onConfirm={async () => {
        setClearing(true);
        try {
          await clearPackets();
          await m.fetchPackets();
          setClearOpen(false);
        } catch {
          throw new Error(t('packet_monitor.clear_failed'));
        } finally {
          setClearing(false);
        }
      }}
    />
  );

  if (isPhone) {
    return (
      <div className={styles.window} data-phone="">
        <header className={styles.phoneHead}>
          <h1 className={styles.title}>{monitor}</h1>
          <button type="button" className={styles.iconButton} aria-label={exportLabel} title={exportLabel} disabled={m.total === 0} onClick={m.handleExport}>
            <UiIcon name="download" size={22} />
          </button>
          {closeWindow}
        </header>
        <p className={styles.status}>
          <span className={styles.dot} data-paused={!m.autoScroll || undefined} aria-hidden="true" />
          {device ? `${device} · ` : ''}{live} · {count}
        </p>
        <div className={styles.controls}>
          {controls}
          {clear}
        </div>
        <p className={styles.note}>{t('workspace.packets.capture_one')}</p>
        {states}
        {m.packets.length > 0 && <PacketList {...stream} />}
        {detail}
        <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
          <div className={styles.sheetBody}><Filters m={m} /></div>
        </Sheet>
        {confirm}
      </div>
    );
  }

  return (
    <div className={styles.window}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.status}>
            <span className={styles.dot} data-paused={!m.autoScroll || undefined} aria-hidden="true" />
            {live} · <span title={t('packet_monitor.count_tooltip', { shown: m.packets.length, total: m.total })}>{count}</span> · {t('workspace.packets.capture_one')}
          </p>
        </div>
      </header>
      <div className={styles.controls}>
        {controls}
        <button type="button" className={styles.button} disabled={m.total === 0} onClick={m.handleExport}>
          <UiIcon name="download" size={16} />
          {exportLabel}
        </button>
        {clear}
        {closeWindow}
      </div>
      {m.showFilters && <Filters m={m} />}
      <div className={styles.body} data-panel={selected ? '' : undefined}>
        <div className={styles.streamCol}>
          {states}
          {m.packets.length > 0 && <PacketTable {...stream} moreCue />}
        </div>
        {detail}
      </div>
      {confirm}
    </div>
  );
}

/** `?sourceId=` naming a MeshCore device opens today's MeshCore window; anything else is the Meshtastic monitor. */
function PopoutDispatch() {
  const [params] = useSearchParams();
  const requested = params.get('sourceId');
  const { data: sources, isLoading } = useDashboardSources();
  if (requested) {
    if (isLoading && !sources) return <RouteLoading />;
    const type = sources?.find((s) => s.id === requested)?.type;
    if (type === 'meshcore' || type === 'meshcore_mqtt') {
      return (
        <Suspense fallback={<RouteLoading />}>
          <PacketMonitorPage />
        </Suspense>
      );
    }
  }
  return <PopoutWindow />;
}

export default function PacketsPopout() {
  return (
    <CsrfProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <PopoutDispatch />
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </CsrfProvider>
  );
}
