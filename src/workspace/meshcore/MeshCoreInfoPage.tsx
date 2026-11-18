/**
 * A MeshCore radio's Info (boards 8-13, 8-30; Task 7.5), native at
 * `/source/:id/info`, on today's reads (MeshCoreInfoView): `meshcore/info`
 * (identity and the latest poll, refetched every 30 s as today) and the local
 * node's `mc_*` telemetry for the graphs and the cumulative counters.
 *
 * - Identity, Radio, Current health and Cumulative counters are today's rows.
 * - Clock: RTC drift vs server and today's Sync (Companion only, as today):
 *   one `config/sync-time` per press. It writes the clock over the radio
 *   connection and sends nothing on the mesh.
 * - History: today's range buttons and graphs, each with today's favourite
 *   ("Add to favorites" puts it on the Dashboard; settings:write on this
 *   source, as today). The phone shows the battery and "All graphs ›".
 * - The Virtual Node card is today's (read-only).
 *
 * Opening the page sends nothing; it only reads.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites, useToggleFavorite } from '../../hooks/useFavorites';
import { useTelemetry } from '../../hooks/useTelemetry';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { getTelemetryLabel } from '../../components/TelemetryChart';
import { useToast } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import { logger } from '../../utils/logger';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { useMeshCoreRuntime } from './runtime';
import ToolHead from './ToolHead';
import styles from './McTools.module.css';

const HOURS_OPTIONS = [1, 6, 24, 72, 168] as const;

/** Today's graphed `mc_*` types, in today's order, with their units. */
const GRAPHS: Array<{ type: string; unit?: string; family: string }> = [
  { type: 'mc_battery_volts', unit: 'V', family: 'battery' },
  { type: 'mc_queue_len', family: 'queue' },
  { type: 'mc_noise_floor', unit: 'dBm', family: 'noise' },
  { type: 'mc_last_rssi', unit: 'dBm', family: 'noise' },
  { type: 'mc_last_snr', unit: 'dB', family: 'battery' },
  { type: 'mc_tx_duty_pct', unit: '%', family: 'queue' },
  { type: 'mc_rx_duty_pct', unit: '%', family: 'noise' },
  { type: 'mc_pkt_sent_rate', unit: '/min', family: 'battery' },
  { type: 'mc_pkt_recv_rate', unit: '/min', family: 'noise' },
  { type: 'mc_rtc_drift_secs', unit: 's', family: 'queue' },
  { type: 'mc_uptime_secs', unit: 's', family: 'battery' },
];

/** Today's cumulative counters (shown as rows, not graphed). */
const COUNTERS: Array<{ type: string; unit?: string }> = [
  { type: 'mc_pkt_recv' }, { type: 'mc_pkt_sent' }, { type: 'mc_pkt_flood_tx' }, { type: 'mc_pkt_direct_tx' }, { type: 'mc_pkt_flood_rx' },
  { type: 'mc_pkt_direct_rx' }, { type: 'mc_pkt_recv_errors' }, { type: 'mc_tx_air_secs', unit: 's' }, { type: 'mc_rx_air_secs', unit: 's' },
];

const withUnit = (type: string, unit?: string) => (unit ? `${getTelemetryLabel(type)} (${unit})` : getTelemetryLabel(type));
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fmt = (v: number | undefined | null, suffix = '') => (num(v) ? `${Math.round(v * 100) / 100}${suffix}` : '—');

function fmtUptime(secs?: number): string {
  if (!num(secs)) return '—';
  const s = Math.floor(secs);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return [days > 0 ? `${days}d` : '', hours > 0 || days > 0 ? `${hours}h` : '', `${mins}m`].filter(Boolean).join(' ');
}

interface InfoReply {
  data?: {
    deviceType: number;
    deviceTypeName: string;
    identity: {
      publicKey: string; name: string; advType: number; txPower?: number; maxTxPower?: number; radioFreq?: number; radioBw?: number;
      radioSf?: number; radioCr?: number; latitude?: number; longitude?: number; firmwareVer?: number; firmwareBuild?: string; model?: string; ver?: string;
    } | null;
    latest: {
      timestamp: number; batteryMv?: number; uptimeSecs?: number; errors?: number; queueLen?: number; noiseFloor?: number; lastRssi?: number;
      lastSnr?: number; rtcDriftSecs?: number;
    } | null;
    telemetryRef: { nodeId: string; sourceId: string } | null;
  };
}

interface VirtualNodeStatus {
  sourceId: string; enabled: boolean; isRunning: boolean; allowAdminCommands?: boolean; allowPkiExport?: boolean; allowPkiImport?: boolean; clientCount: number;
}

/** A small area chart of one series, oldest to newest. */
function Spark({ points, family, label }: { points: Array<{ value: number }>; family: string; label: string }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const y = (v: number) => 28 - ((v - min) / span) * 26;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  return (
    <svg className={styles.spark} data-family={family} viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
      <title>{label}</title>
      <path className={styles.sparkArea} d={`${line} L${x(values.length - 1)},30 L${x(0)},30 Z`} />
      <path className={styles.sparkLine} d={line} />
    </svg>
  );
}

export default function MeshCoreInfoPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sourceId, deviceName, meshCore } = useMeshCoreRuntime();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [hours, setHours] = useState<number>(24);
  const [allGraphs, setAllGraphs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const canFavorite = hasPermission('settings', 'write', { sourceId });
  const base = `/source/${encodeURIComponent(sourceId)}`;

  // Today's read and cadence (MeshCoreInfoView).
  const { data: reply, isLoading, error } = useQuery({
    queryKey: ['meshcore-info', sourceId],
    queryFn: () => apiService.get<InfoReply>(`/api/sources/${encodeURIComponent(sourceId)}/meshcore/info`),
    refetchInterval: 30_000,
    staleTime: 25_000,
    refetchOnWindowFocus: false,
  });
  const info = reply?.data;
  const identity = info?.identity ?? meshCore.status?.localNode ?? null;
  const latest = info?.latest ?? null;
  const ref = info?.telemetryRef ?? null;
  const { data: rows = [] } = useTelemetry({ nodeId: ref?.nodeId ?? '', sourceId: ref?.sourceId, hours, baseUrl: appBasename, enabled: !!ref?.nodeId });
  const favoriteNodeId = ref?.nodeId ?? '';
  const { data: favorites = new Set<string>() } = useFavorites({ nodeId: favoriteNodeId, baseUrl: appBasename, enabled: canFavorite });
  const toggleFavorite = useToggleFavorite({
    baseUrl: appBasename,
    onError: (message) => {
      logger.error('Error saving favorite:', message);
      showToast(t('telemetry.favorite_save_failed'), 'error');
    },
  });
  const { data: virtualNode } = useQuery({
    queryKey: ['virtual-node-status'],
    queryFn: async (): Promise<{ sources?: VirtualNodeStatus[] }> => apiService.getVirtualNodeStatus(),
    refetchInterval: 60_000,
    staleTime: 55_000,
    refetchOnWindowFocus: false,
  });
  const vn = Array.isArray(virtualNode?.sources) ? virtualNode.sources.find((s) => s.sourceId === sourceId) : undefined;

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ timestamp: number; value: number }>>();
    for (const row of rows) {
      if (!row.telemetryType.startsWith('mc_')) continue;
      const list = map.get(row.telemetryType) ?? [];
      list.push({ timestamp: row.timestamp, value: row.value });
      map.set(row.telemetryType, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.timestamp - b.timestamp);
    return map;
  }, [rows]);

  const title = t('nav.info', 'Info');
  const head = (
    <ToolHead
      title={title}
      subtitle={t('workspace.meshcore.info_subtitle', { device: deviceName })}
      back={{ label: t('workspace.home.tools'), to: base }}
    />
  );
  if (isLoading && !info) return <div className={styles.page} data-phone={isPhone || undefined}>{head}<StateView kind="loading" /></div>;
  if (error) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {head}
        <p className={styles.error} role="alert">{t('meshcore.info.load_failed', 'Failed to load node info')}: {String(error)}</p>
      </div>
    );
  }
  if (!identity) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {head}
        <p className={styles.note}>{t('meshcore.info.not_connected', 'No local node info — source disconnected.')}</p>
      </div>
    );
  }

  const deviceType = info?.deviceType ?? identity.advType;
  const isCompanion = deviceType === 1;
  // #5533: a directly attached Repeater reports the same local stats over its serial CLI.
  const hasLocalStats = isCompanion || deviceType === 2;
  const typeName = info?.deviceTypeName ?? (identity.advType === 1 ? 'Companion' : 'Other');
  const firmware =
    identity.ver || identity.firmwareVer !== undefined
      ? `${identity.ver ?? `v${identity.firmwareVer}`}${identity.firmwareBuild ? ` (${identity.firmwareBuild})` : ''}`
      : '—';
  const pubkey = identity.publicKey ? `${identity.publicKey.substring(0, 12)}…${identity.publicKey.substring(identity.publicKey.length - 4)}` : '—';
  const freq = num(identity.radioFreq) ? `${identity.radioFreq.toFixed(3)} MHz` : '—';
  const bw = identity.radioBw !== undefined ? `${identity.radioBw} kHz` : '—';
  const cr = identity.radioCr ? `4/${identity.radioCr}` : '—';
  const tx = identity.txPower !== undefined ? `${identity.txPower}${identity.maxTxPower !== undefined ? ` / ${identity.maxTxPower}` : ''} dBm` : '—';
  const volts = num(latest?.batteryMv) ? `${(latest.batteryMv / 1000).toFixed(2)} V` : '—';
  const drift = num(latest?.rtcDriftSecs) ? `${latest.rtcDriftSecs > 0 ? '+' : ''}${latest.rtcDriftSecs} s` : '—';

  const kv = (rowsIn: Array<[string, string, boolean?]>) => (
    <dl className={`${styles.card} ${styles.kv}`}>
      {rowsIn.map(([label, value, mono]) => (
        <div key={label} className={styles.kvRow}>
          <dt className={styles.kvLabel}>{label}</dt>
          <dd className={`${styles.kvValue} ${mono ? styles.mono : ''}`} title={label === t('meshcore.info.pubkey', 'Public key') ? identity.publicKey : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
  const section = (heading: string, body: ReactNode, extra?: ReactNode) => (
    <section className={styles.section} aria-label={heading}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{heading}</h2>
        {extra}
      </div>
      {body}
    </section>
  );

  const identityRows: Array<[string, string, boolean?]> = [
    [t('meshcore.info.name', 'Name'), identity.name || '—'],
    [t('meshcore.info.device_type', 'Device type'), isPhone ? [typeName, identity.model].filter(Boolean).join(' · ') : typeName],
    [t('meshcore.info.pubkey', 'Public key'), pubkey, true],
    ...(isPhone ? [] : ([[t('meshcore.info.model', 'Model'), identity.model || '—']] as Array<[string, string]>)),
    [t('meshcore.info.firmware', 'Firmware'), firmware],
    [t('meshcore.info.position', 'Advertised position'),
      num(identity.latitude) && num(identity.longitude) ? `${identity.latitude.toFixed(5)}, ${identity.longitude.toFixed(5)}` : '—'],
  ];
  const radioRows: Array<[string, string]> = isPhone
    ? [
        [`${t('meshcore.info.frequency', 'Frequency')} · BW`, `${freq} · ${bw}`],
        ['SF · CR · TX', `${identity.radioSf ?? '—'} · ${cr} · ${tx}`],
      ]
    : [
        [t('meshcore.info.frequency', 'Frequency'), freq],
        [t('meshcore.info.bandwidth', 'Bandwidth'), bw],
        [t('meshcore.info.sf', 'Spreading factor'), String(identity.radioSf ?? '—')],
        [t('meshcore.info.cr', 'Coding rate'), cr],
        [t('meshcore.info.tx_power', 'TX power'), tx],
      ];

  const health = !hasLocalStats ? (
    <p className={styles.note}>{t('meshcore.info.repeater_no_stats', 'Local stats are only available for Companion and Repeater devices.')}</p>
  ) : !latest ? (
    <p className={styles.note}>{t('meshcore.info.awaiting_poll', 'Waiting for first telemetry poll…')}</p>
  ) : isPhone ? (
    <div className={`${styles.card} ${styles.stats}`}>
      {([
        [t('meshcore.info.battery', 'Battery'), volts],
        [t('meshcore.info.uptime', 'Uptime'), fmtUptime(latest.uptimeSecs)],
        [t('meshcore.info.noise_floor', 'Noise floor'), fmt(latest.noiseFloor, ' dBm')],
        [t('meshcore.info.last_snr', 'Last SNR'), fmt(latest.lastSnr, ' dB')],
        [t('meshcore.info.queue', 'TX queue'), fmt(latest.queueLen)],
        [t('meshcore.info.last_rssi', 'Last RSSI'), fmt(latest.lastRssi, ' dBm')],
      ] as Array<[string, string]>).map(([label, value]) => (
        <div key={label} className={styles.stat}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
        </div>
      ))}
    </div>
  ) : (
    kv([
      [t('meshcore.info.battery', 'Battery'), volts],
      [t('meshcore.info.uptime', 'Uptime'), fmtUptime(latest.uptimeSecs)],
      [t('meshcore.info.noise_floor', 'Noise floor'), fmt(latest.noiseFloor, ' dBm')],
      [t('meshcore.info.last_rssi', 'Last RSSI'), fmt(latest.lastRssi, ' dBm')],
      [t('meshcore.info.last_snr', 'Last SNR'), fmt(latest.lastSnr, ' dB')],
      [t('meshcore.info.queue', 'TX queue'), fmt(latest.queueLen)],
      [t('meshcore.info.last_poll', 'Last poll'), new Date(latest.timestamp).toLocaleString()],
    ])
  );

  const allowed = (flag?: boolean) => (flag ? t('info.virtual_node_admin_allowed') : t('info.virtual_node_admin_blocked'));
  const counters = COUNTERS.filter(({ type }) => (grouped.get(type)?.length ?? 0) > 0);
  const sync = async () => {
    setSyncing(true);
    try {
      await meshCore.actions.syncDeviceTime();
    } finally {
      setSyncing(false);
    }
  };
  const clock = (
    <div className={styles.card}>
      <div className={styles.kvRow}>
        <span className={styles.kvLabel}>{t('meshcore.info.rtc_drift', 'RTC drift vs server')}</span>
        <span className={styles.kvValue}>{latest ? drift : '—'}</span>
      </div>
      {isCompanion && (
        <div className={styles.cardBody}>
          <div className={styles.actions}>
            <button type="button" className={styles.button} disabled={syncing} aria-busy={syncing || undefined} onClick={() => void sync()}>
              <UiIcon name="time" size={16} />
              {t('meshcore.info.sync_time_button', 'Sync')}
            </button>
          </div>
          <SendsLine>{t('workspace.meshcore.sends_sync')}</SendsLine>
        </div>
      )}
    </div>
  );

  const graph = (type: string, unit: string | undefined, family: string, short = false) => {
    const data = grouped.get(type) ?? [];
    if (data.length === 0) return null;
    const isFavorite = favorites.has(type);
    const label = isFavorite ? t('telemetry.remove_favorite') : t('telemetry.add_favorite');
    return (
      <div key={type} className={`${styles.card} ${styles.chart}`} data-testid={`meshcore-info-graph-${type}`}>
        <div className={styles.chartHead}>
          <h3 className={styles.chartTitle}>
            {short ? t('workspace.meshcore.graph_range', { name: getTelemetryLabel(type), range: hoursLabel(hours) }) : withUnit(type, unit)}
          </h3>
          {canFavorite && favoriteNodeId && !short && (
            <button
              type="button"
              className={styles.button}
              aria-pressed={isFavorite}
              onClick={() => toggleFavorite.mutate({ nodeId: favoriteNodeId, telemetryType: type, currentFavorites: favorites })}
            >
              <UiIcon name={isFavorite ? 'favorite' : 'favoriteOff'} size={15} />
              {label}
            </button>
          )}
          {short && (
            <button type="button" className={styles.link} onClick={() => setAllGraphs(true)}>{t('workspace.meshcore.all_graphs')}</button>
          )}
        </div>
        <Spark points={data} family={family} label={`${getTelemetryLabel(type)}: ${fmt(data[data.length - 1].value, unit ? ` ${unit}` : '')}`} />
        {!short && (
          <div className={styles.chartAxis}>
            <span>{t('workspace.meshcore.range_ago', { range: hoursLabel(hours) })}</span>
            <span>{unit}</span>
            <span>{t('workspace.meshcore.now')}</span>
          </div>
        )}
      </div>
    );
  };
  const range = (
    <div className={styles.segmented} role="group" aria-label={t('workspace.meshcore.time_range')}>
      {HOURS_OPTIONS.map((h) => (
        <button key={h} type="button" className={styles.segment} aria-pressed={hours === h} onClick={() => setHours(h)}>{hoursLabel(h)}</button>
      ))}
    </div>
  );
  const allCharts = <div className={styles.charts}>{GRAPHS.map((g) => graph(g.type, g.unit, g.family))}</div>;

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {head}
      <div className={styles.grid}>
        {section(t('meshcore.info.identity', 'Identity'), kv(identityRows))}
        {section(t('meshcore.info.radio', 'Radio'), kv(radioRows))}
        {section(t('meshcore.info.health', 'Current health'), health)}
        {!isPhone && section(
          t('meshcore.info.counters', 'Cumulative counters'),
          counters.length === 0 ? (
            <p className={styles.note}>{t('meshcore.info.no_counters', 'No counter data yet.')}</p>
          ) : (
            kv(counters.map(({ type, unit }) => {
              const list = grouped.get(type)!;
              return [withUnit(type, unit), list[list.length - 1].value.toLocaleString()] as [string, string];
            }))
          ),
        )}
        {section(t('workspace.meshcore.clock'), clock)}
        {vn && section(t('info.virtual_node'), kv([
          [t('info.virtual_node_status'), vn.enabled ? t('common.enabled') : t('common.disabled')],
          ...(vn.enabled
            ? ([
                [t('info.server_running'), vn.isRunning ? t('common.yes') : t('common.no')],
                [t('info.virtual_node_admin_commands'), allowed(vn.allowAdminCommands)],
                ...(typeof vn.allowPkiExport === 'boolean' ? [[t('info.virtual_node_pki_export'), allowed(vn.allowPkiExport)]] : []),
                ...(typeof vn.allowPkiImport === 'boolean' ? [[t('info.virtual_node_pki_import'), allowed(vn.allowPkiImport)]] : []),
                [t('info.connected_clients'), String(vn.clientCount)],
              ] as Array<[string, string]>)
            : []),
        ]))}
      </div>
      {hasLocalStats && (
        isPhone ? (
          section(t('meshcore.info.history', 'History'), graph('mc_battery_volts', 'V', 'battery', true) ?? (
            <button type="button" className={styles.button} onClick={() => setAllGraphs(true)}>{t('workspace.meshcore.all_graphs')}</button>
          ))
        ) : (
          section(t('meshcore.info.history', 'History'), allCharts, range)
        )
      )}
      <Sheet open={allGraphs} onClose={() => setAllGraphs(false)} title={t('meshcore.info.history', 'History')}>
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          {range}
          {allCharts}
          {isPhone && counters.length > 0 && kv(counters.map(({ type, unit }) => {
            const list = grouped.get(type)!;
            return [withUnit(type, unit), list[list.length - 1].value.toLocaleString()] as [string, string];
          }))}
        </div>
      </Sheet>
    </div>
  );
}

function hoursLabel(h: number): string {
  return h < 24 ? `${h}h` : `${h / 24}d`;
}
