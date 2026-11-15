/**
 * Overview › Packets (boards 7-05, 7-08; s7n0–s7n3): today's cross-source
 * packet monitor on its shared hook (`useUnifiedPacketMonitor`: the 5 s
 * stream, the 30 s charts and capture, Ruling BF).
 *
 * - Desktop: Capture, Pause, Charts and Filters in the head; the By source /
 *   By device / By type charts with 1 h / 24 h / All; today's filters; the
 *   table with a device tag per row and the four columns right of Content
 *   behind the "4 more columns" cue; the raw packet side panel.
 * - Phone: Pause and Charts in the top bar, Capture and Filters above the
 *   list, two-line rows; filters, charts and the raw packet open as sheets.
 *
 * Capture writes `packet_log_enabled` (settings:write), server-side logging
 * for every source: it sends nothing on the mesh (s7n1). Every row, tag,
 * chart entry and filter option keeps to the devices the viewer can read
 * (Review Focus 2, `readableSources`).
 */
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { UiIcon } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { CrossSourcePacketFilter, UnifiedPacketFilters } from '../../types/packet';
import { MESHCORE_PAYLOAD_TYPES, MESHCORE_ROUTE_TYPES } from '../../utils/meshcorePacketDecode';
import { TRANSPORT_MECHANISM_NAMES } from '../../utils/packetFormat';
import { RANGE_OPTIONS, useUnifiedPacketMonitor } from '../../pages/useUnifiedPacketMonitor';
import DeviceTag from '../patterns/DeviceTag';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import PacketDetailPanel from './PacketDetailPanel';
import { PacketList, PacketTable } from './PacketStream';
import { packetKey } from './packetRows';
import { useReadableSourceIds } from './readableSources';
import styles from './OverviewPackets.module.css';

type Monitor = ReturnType<typeof useUnifiedPacketMonitor>;

/** Today's Meshtastic type options (UnifiedPacketMonitorPage). */
const PORTNUMS: Array<[number, string]> = [
  [1, 'TEXT_MESSAGE'], [3, 'POSITION'], [4, 'NODEINFO'], [5, 'ROUTING'], [6, 'ADMIN'], [67, 'TELEMETRY'], [70, 'TRACEROUTE'], [71, 'NEIGHBORINFO'],
];
/** Today's transport options, in today's order, under their short names. */
const TRANSPORTS = [1, 6, 5, 7, 0];
const TRANSPORT_TITLES: Record<number, string> = {
  1: 'packet_monitor.filter.transport_lora', 6: 'packet_monitor.filter.transport_udp', 5: 'packet_monitor.filter.transport_mqtt',
  7: 'packet_monitor.filter.transport_api', 0: 'packet_monitor.filter.transport_internal',
};

function Segmented<T>({ label, options, value, onChange }: {
  label: string; options: Array<{ value: T; label: string; title?: string }>; value: T; onChange(v: T): void;
}) {
  const id = useId();
  return (
    <div className={styles.segmentedRow}>
      <span className={styles.label} id={id}>{label}</span>
      <div className={styles.segmented} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" title={o.title} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Today's filters: source, Meshtastic type, MeshCore payload and route, encrypted/decoded, transport, cross-source. */
function Filters({ m, sources }: { m: Monitor; sources: Monitor['sources'] }) {
  const { t } = useTranslation();
  const f = m.filters;
  const num = (v: string) => (v ? parseInt(v, 10) : undefined);
  const select = <K extends keyof UnifiedPacketFilters>(key: K, label: string, value: string, options: ReactNode, parse: (v: string) => UnifiedPacketFilters[K], title?: string) => (
    <Field label={label}>
      <select className={styles.select} aria-label={label} title={title} value={value} onChange={(e) => m.updateFilter(key, parse(e.target.value))}>
        {options}
      </select>
    </Field>
  );
  const hint = t('unified.packets.meshcore_filter_hint');
  return (
    <>
      <div className={styles.filterRow}>
        {select('sourceId', t('unified.packets.column_source'), f.sourceId ?? '', (
          <>
            <option value="">{t('unified.telemetry.all_sources')}</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </>
        ), (v) => v || undefined)}
        {select('portnum', t('unified.packets.filter_portnum'), String(f.portnum ?? ''), (
          <>
            <option value="">{t('packet_monitor.filter.all_types')}</option>
            {PORTNUMS.map(([n, name]) => <option key={n} value={n}>{name}</option>)}
          </>
        ), num)}
        {m.hasMeshCoreSource && (
          <>
            {select('payload_type', t('unified.packets.filter_payload_type'), String(f.payload_type ?? ''), (
              <>
                <option value="">{t('unified.packets.all_payload_types')}</option>
                {MESHCORE_PAYLOAD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </>
            ), num, hint)}
            {select('route_type', t('unified.packets.filter_route_type'), String(f.route_type ?? ''), (
              <>
                <option value="">{t('unified.packets.all_route_types')}</option>
                {MESHCORE_ROUTE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </>
            ), num, hint)}
          </>
        )}
        <button type="button" className={styles.button} onClick={() => m.setFilters({})}>
          {t('packet_monitor.filter.clear')}
        </button>
      </div>
      <div className={styles.filterRow}>
        <Segmented
          label={t('workspace.packets.payload')}
          value={f.encrypted}
          onChange={(v) => m.updateFilter('encrypted', v)}
          options={[
            { value: undefined, label: t('common.all') },
            { value: true, label: t('packet_monitor.filter.encrypted_only') },
            { value: false, label: t('packet_monitor.filter.decoded_only') },
          ]}
        />
        <Segmented
          label={t('workspace.packets.transport')}
          value={f.transport_mechanism}
          onChange={(v) => m.updateFilter('transport_mechanism', v)}
          options={[
            { value: undefined, label: t('common.all'), title: t('packet_monitor.filter.all_transports') },
            ...TRANSPORTS.map((n) => ({ value: n as number | undefined, label: TRANSPORT_MECHANISM_NAMES[n].short, title: t(TRANSPORT_TITLES[n]) })),
          ]}
        />
        {sources.length > 1 &&
          select('crossSource', t('cross_source.filter_label'), f.crossSource ?? '', (
            <>
              <option value="">{t('cross_source.filter_all')}</option>
              <option value="any">{t('cross_source.filter_any')}</option>
              <option value="origin">{t('cross_source.filter_origin')}</option>
              <option value="relay">{t('cross_source.filter_relay')}</option>
            </>
          ), (v) => (v || undefined) as CrossSourcePacketFilter | undefined, t('cross_source.filter_tooltip'))}
      </div>
      {m.hasMeshCoreSource && (
        <p className={styles.hint}>
          <UiIcon name="info" size={16} />
          {hint}
        </p>
      )}
      {m.meshcoreFilterActive && m.meshtasticFilterActive && (
        <p className={styles.hint} role="status">{t('unified.packets.meshcore_filter_conflict')}</p>
      )}
    </>
  );
}

function ChartCard({ title, rows }: { title: string; rows: Array<{ key: string; label: ReactNode; value: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className={styles.chart} aria-label={title}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <ul className={styles.bars}>
        {rows.map((r) => (
          <li key={r.key} className={styles.bar}>
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className={styles.barValue}>{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** By source / By device / By type, with today's 1 h / 24 h / All. */
function Charts({ m, readable, title }: { m: Monitor; readable: Set<string>; title?: ReactNode }) {
  const { t } = useTranslation();
  const bySource = (m.distribution?.bySource ?? []).filter((s) => readable.has(s.sourceId));
  return (
    <>
      <div className={styles.chartsHead}>
        {title}
        <div className={styles.segmented} role="group" aria-label={t('unified.telemetry.range_aria')}>
          {RANGE_OPTIONS.map((r) => (
            <button key={r} type="button" aria-pressed={m.rangeHours === r} onClick={() => m.setRangeHours(r)}>
              {r === 0 ? t('unified.packets.range_all') : `${r} h`}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.charts}>
        <ChartCard
          title={t('unified.packets.by_source')}
          rows={bySource.map((s) => ({ key: s.sourceId, label: <DeviceTag sourceId={s.sourceId} />, value: s.count }))}
        />
        <ChartCard title={t('unified.packets.by_device')} rows={m.byDeviceData.map((d) => ({ key: d.name, label: d.name, value: d.value }))} />
        <ChartCard title={t('unified.packets.by_type')} rows={m.byTypeData.map((d) => ({ key: d.name, label: d.name, value: d.value }))} />
      </div>
    </>
  );
}

export default function OverviewPackets() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { loading: authLoading } = useAuth();
  const m = useUnifiedPacketMonitor();
  const readable = useReadableSourceIds();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);

  const packets = useMemo(() => m.packets.filter((p) => readable.has(p.sourceId ?? '')), [m.packets, readable]);
  const sources = useMemo(() => m.sources.filter((s) => readable.has(s.id)), [m.sources, readable]);
  const selected = packets.find((p) => packetKey(p) === selectedKey) ?? null;
  const title = t('unified.packets.title');

  // The grants decide what shows: no "no permission" flash while they load.
  if (authLoading) return <RouteLoading />;
  if (!m.canView) {
    return (
      <div className={styles.page} data-phone={isPhone ? '' : undefined}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.state}>{t('packet_monitor.no_permission')}</p>
      </div>
    );
  }

  const status = (
    <>
      <span className={styles.dot} data-paused={m.paused || undefined} aria-hidden="true" />
      {t(m.paused ? 'workspace.packets.paused' : 'workspace.packets.live')} · {t('unified.packets.count', { shown: packets.length.toLocaleString() })}
    </>
  );
  const captureLabel = m.captureEnabled ? t('packet_monitor.stop_capture', 'Stop capturing') : t('packet_monitor.start_capture', 'Start capturing');
  const capture = m.canWriteSettings && m.captureEnabled !== null && (
    <button
      type="button"
      className={styles.button}
      data-danger={m.captureEnabled || undefined}
      disabled={m.togglingCapture}
      onClick={() => void m.handleToggleCapture()}
    >
      <UiIcon name={m.captureEnabled ? 'statusOff' : 'statusOn'} size={16} />
      {captureLabel}
    </button>
  );
  const pauseLabel = m.paused ? t('packet_monitor.resume_autoscroll') : t('packet_monitor.pause_autoscroll');
  const note = <p className={styles.note}>{t('workspace.packets.capture_all')}</p>;
  const stream = {
    packets, hasMore: m.hasMore, loadingMore: m.loadingMore, loadMore: m.loadMore, selectedKey, withSource: true,
    onSelect: (p: (typeof packets)[number]) => setSelectedKey(packetKey(p)),
  };
  const states = (
    <>
      {m.rateLimitError && <p className={styles.warning}><UiIcon name="alert" size={16} />{t('packet_monitor.rate_limit_warning')}</p>}
      {m.loading ? (
        <p className={styles.state}>{t('packet_monitor.loading')}</p>
      ) : packets.length === 0 ? (
        <p className={styles.state}>{t('packet_monitor.no_packets')}</p>
      ) : null}
    </>
  );
  const detail = selected && <PacketDetailPanel packet={selected} onClose={() => setSelectedKey(null)} />;

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <header className={styles.phoneHead}>
          <Link to="/overview" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.shell.overview')}
          </Link>
          <h1 className={styles.phoneTitle}>{title}</h1>
          <span className={styles.phoneActions}>
            <button type="button" className={styles.iconButton} aria-label={t('workspace.packets.charts')} onClick={() => setChartsOpen(true)}>
              <UiIcon name="telemetry" size={22} />
            </button>
            <button type="button" className={styles.iconButton} aria-label={pauseLabel} aria-pressed={m.paused} onClick={() => m.setPaused((p) => !p)}>
              <UiIcon name={m.paused ? 'play' : 'pause'} size={22} />
            </button>
          </span>
        </header>
        <div className={styles.phoneBar}>
          <span className={styles.status}>{status}</span>
          {capture}
          <button type="button" className={styles.button} onClick={() => setFiltersOpen(true)}>
            <UiIcon name="filter" size={16} />
            {t('common.filters')}
          </button>
        </div>
        {note}
        {states}
        {packets.length > 0 && <PacketList {...stream} />}
        {detail}
        <Sheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('common.filters')}
          footer={
            <button type="button" className={styles.primary} onClick={() => setFiltersOpen(false)}>
              {t('workspace.packets.show_count', { count: packets.length })}
            </button>
          }
        >
          <div className={styles.sheetBody}><Filters m={m} sources={sources} /></div>
        </Sheet>
        <Sheet open={chartsOpen} onClose={() => setChartsOpen(false)} title={t('workspace.packets.charts')}>
          <div className={styles.sheetBody}><Charts m={m} readable={readable} /></div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {status} · {t('workspace.packets.capture_all')}
          </p>
        </div>
        {capture}
        <button type="button" className={styles.button} aria-pressed={m.paused} onClick={() => m.setPaused((p) => !p)}>
          <UiIcon name={m.paused ? 'play' : 'pause'} size={16} />
          {pauseLabel}
        </button>
        <button type="button" className={styles.button} aria-pressed={m.showCharts} onClick={() => m.setShowCharts((s: boolean) => !s)}>
          <UiIcon name="telemetry" size={16} />
          {t('workspace.packets.charts')}
        </button>
        <button type="button" className={styles.button} aria-pressed={m.showFilters} onClick={() => m.setShowFilters((s: boolean) => !s)}>
          <UiIcon name="filter" size={16} />
          {t('common.filters')}
        </button>
      </header>
      {m.showCharts && (
        <div className={styles.chartsBlock}>
          <Charts m={m} readable={readable} title={<h2 className={styles.blockTitle}>{t('workspace.packets.charts')}</h2>} />
        </div>
      )}
      {m.showFilters && <div className={styles.filters}><Filters m={m} sources={sources} /></div>}
      <div className={styles.body} data-panel={selected ? '' : undefined}>
        <div className={styles.streamCol}>
          {states}
          {packets.length > 0 && <PacketTable {...stream} moreCue />}
        </div>
        {detail}
      </div>
    </div>
  );
}
