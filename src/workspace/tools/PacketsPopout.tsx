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
import { UiIcon } from '../../components/icons';
import PacketHiddenChip from '../../components/PacketHiddenChip';
import { usePacketMonitor } from '../../components/usePacketMonitor';
import { PacketFilters, PacketFiltersSheetBody } from './PacketFilters';
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
import StateView from '../patterns/StateView';
import ToastHost from '../patterns/ToastHost';

// Today's MeshCore window, in its own chunk as Classic loads it.
const PacketMonitorPage = lazy(() => import('../../pages/PacketMonitorPage.tsx'));

type Monitor = ReturnType<typeof usePacketMonitor>;

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
  if (authLoading) return <StateView kind="loading" page />;
  if (!m.canView) {
    return (
      <div className={styles.window} data-phone={isPhone ? '' : undefined}>
        <header className={styles.head}>
          <h1 className={styles.title}>{monitor}</h1>
          {closeWindow}
        </header>
        <StateView kind="noPermission" title={t('packet_monitor.no_permission')} />
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
  const detail = selected && <PacketDetailPanel packet={selected} onClose={() => setSelectedKey(null)} />;
  const confirm = (
    <ConfirmSheet
      submitOnEnter={false}
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
          <PacketFiltersSheetBody m={m} />
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
      {m.showFilters && <PacketFilters m={m} />}
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

/**
 * `?sourceId=` naming a MeshCore device opens today's MeshCore window, which brings its own providers
 * (so none are mounted here); anything else is the Meshtastic monitor inside the Workspace's.
 */
export default function PacketsPopout() {
  const [params] = useSearchParams();
  const requested = params.get('sourceId');
  const { data: sources, isLoading } = useDashboardSources();
  if (requested) {
    if (isLoading && !sources) return <StateView kind="loading" page />;
    const type = sources?.find((s) => s.id === requested)?.type;
    if (type === 'meshcore' || type === 'meshcore_mqtt') {
      return (
        <Suspense fallback={<StateView kind="loading" page />}>
          <PacketMonitorPage />
        </Suspense>
      );
    }
  }
  return (
    <CsrfProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastHost>
            <PopoutWindow />
          </ToastHost>
        </SettingsProvider>
      </AuthProvider>
    </CsrfProvider>
  );
}
