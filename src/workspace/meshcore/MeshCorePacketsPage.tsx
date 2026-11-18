/**
 * A MeshCore radio's packet monitor (boards 8-12, 8-29; Task 7.5), native at
 * `/source/:id/packets`, and a region feed's Packets tab (s8n5), on today's
 * parts (MeshCorePacketMonitorView): `useMeshCorePackets` (paging, live rows
 * over the socket, a 5 s poll only without one, Pause, Grouped / All), today's
 * filters, the distribution charts, capture settings and Clear.
 *
 * - A row opens Packet Decode: a side panel on desktop, a sheet on the phone.
 *   It decodes the frame in the browser as today; a group frame asks the
 *   server to open it (`packets/decode`, one request per opened frame, as
 *   today). The server answers with plaintext and where the key lives, never
 *   the key, and only with a key the viewer may read (today's rule).
 * - A grouped row lists the observers that heard it (today's
 *   `packets/receptions` read, once per opened row).
 * - Capture is server-side logging (settings:write on any source, as today);
 *   Clear needs packetmonitor:write and asks first with today's words.
 *
 * Nothing on this page sends on the mesh.
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useMeshCorePackets, meshCoreFilterParams, type MeshCorePacketFilters, type MeshCorePacketRow } from '../../hooks/useMeshCorePackets';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import SearchableSelect, { type SearchableSelectOption } from '../../components/common/SearchableSelect';
import PacketSearchInput from '../../components/packets/PacketSearchInput';
import TimeWindowSelect from '../../components/packets/TimeWindowSelect';
import { windowToSince, type TimeWindowKey } from '../../components/packets/timeWindow';
import { toChartEntries } from '../../components/packetStatsChartData';
import { formatTime, observerLabel, payloadLabel, resolvePacketFrom, routeLabel, validHash } from '../../components/MeshCore/meshcorePacketRows';
import { candidatesTitle, hopText, useResolvedRouteHops } from '../../components/MeshCore/useResolvedRouteHops';
import { isSourceNotConnectedError } from '../../utils/sourceNotConnected';
import { openPacketMonitorPopout } from '../../utils/packetMonitorPopout';
import { decodeMeshCorePacket, MESHCORE_PAYLOAD_TYPES, MESHCORE_ROUTE_TYPES } from '../../utils/meshcorePacketDecode';
import { hopByteForKey, type RepeaterOption } from '../../utils/meshcorePath';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import ConfirmSheet from '../patterns/ConfirmSheet';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from './ToolHead';
import styles from './McTools.module.css';

const PacketStatsChart = lazy(() => import('../../components/PacketStatsChart'));

type Row = MeshCorePacketRow & { observerCount?: number; receptionCount?: number };

const NO_CONTACTS: MeshCoreContact[] = [];
const fmtHex = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;
const keyOf = (p: Row, i = 0) => String(p.id ?? `${p.timestamp}-${p.rawHex ?? i}`);

/** A payload type's badge colour family. */
function family(p: Row): string | undefined {
  switch (p.payloadType) {
    case 2: case 5: case 6: return 'text';
    case 4: return 'advert';
    case 3: return 'ack';
    case 8: return 'path';
    case 9: return 'trace';
    case 0: case 1: case 7: return 'req';
    default: return undefined;
  }
}

export interface MeshCorePacketsPageProps {
  sourceId: string;
  /** This radio's contacts: they name senders and relay hops. A region feed has none. */
  contacts?: MeshCoreContact[];
  /** Inside the region feed's page, under its tabs. */
  embedded?: boolean;
}

export default function MeshCorePacketsPage({ sourceId, contacts = NO_CONTACTS, embedded = false }: MeshCorePacketsPageProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const csrfFetch = useCsrfFetch();
  const { hasPermission } = useAuth();
  const { state: ws } = useWebSocketContext();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const mcPrefix = `${appBasename}/api/sources/${encodeURIComponent(sourceId)}/meshcore`;
  // Today's grants (MeshCorePacketMonitorView): the capture keys are global settings.
  const canWriteSettings = hasPermission('settings', 'write', { anySource: true });
  const canClear = hasPermission('packetmonitor', 'write', { sourceId });
  const canSeeNames = hasPermission('nodes', 'read', { sourceId });

  const [paused, setPaused] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [payloadFilter, setPayloadFilter] = useState<number | ''>('');
  const [routeFilter, setRouteFilter] = useState<number | ''>('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>('all');
  const [senderFilter, setSenderFilter] = useState('');
  const [srcHashInput, setSrcHashInput] = useState('');
  const [pathHashInput, setPathHashInput] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'charts' | 'capture' | 'filters' | 'clear' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(() => windowToSince(timeWindow), [timeWindow]);
  const srcHash = validHash(srcHashInput) ? srcHashInput.toLowerCase() : undefined;
  const pathHash = validHash(pathHashInput) ? pathHashInput.toLowerCase() : undefined;
  const filters = useMemo<MeshCorePacketFilters>(() => ({
    payloadType: payloadFilter === '' ? undefined : payloadFilter,
    routeType: routeFilter === '' ? undefined : routeFilter,
    since,
    search,
    srcHash,
    sender: senderFilter || undefined,
    pathHash,
  }), [payloadFilter, routeFilter, since, search, srcHash, senderFilter, pathHash]);
  const hasFilters = Object.values(filters).some((v) => v !== undefined) || srcHashInput !== '' || pathHashInput !== '';

  const m = useMeshCorePackets({ baseUrl: appBasename, sourceId, filters, grouped, paused, socket: ws.socket });
  const packets = m.packets as Row[];
  const { enabled, maxAgeHours, maxCount, isIngestSource } = m.meta;
  const notConnected = isSourceNotConnectedError(m.error);
  const errorText = error ?? (notConnected ? null : m.error?.message) ?? null;

  const contactOptions = useMemo<RepeaterOption[]>(
    () => contacts.map((c) => ({ publicKey: c.publicKey, name: c.advName || c.name || `${c.publicKey.slice(0, 8)}…`, hopByte: hopByteForKey(c.publicKey, 1) })),
    [contacts],
  );
  const contactByKey = useMemo(() => new Map(contactOptions.map((o) => [o.publicKey.toLowerCase(), o])), [contactOptions]);
  const from = (p: Row) => resolvePacketFrom(p, { canSeeNames, contactByKey, contactOptions });
  // Today's searchable sender list (SearchableSelect), by name.
  const senderOptions = useMemo<SearchableSelectOption[]>(
    () => contactOptions.map((o) => ({ value: o.publicKey, label: o.name, keywords: o.publicKey })).sort((a, b) => a.label.localeCompare(b.label)),
    [contactOptions],
  );

  const distParams = meshCoreFilterParams(filters).toString();
  const { data: distribution } = useQuery({
    queryKey: ['meshcore-packet-distribution', sourceId, distParams],
    enabled: sheet === 'charts',
    queryFn: async () => {
      const res = await csrfFetch(`${mcPrefix}/packets/stats/distribution?${distParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        byPayloadType: Array<{ payloadType: number; payloadTypeName: string | null; count: number }>;
        byRouteType: Array<{ routeType: number | null; routeTypeName: string | null; count: number }>;
        topSenders: Array<{ senderPubKey: string; advertName: string | null; count: number }>;
        total: number;
      }>;
    },
    staleTime: 10_000,
  });

  /** Today's capture writes: global settings, saved once per change. */
  const saveSettings = async (patch: Record<string, string>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await csrfFetch(`${appBasename}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const toggleCapture = async () => {
    const next = !enabled;
    if (await saveSettings({ meshcore_packet_log_enabled: next ? '1' : '0' })) m.setMeta((x) => ({ ...x, enabled: next }));
  };
  const clear = async () => {
    const res = await csrfFetch(`${mcPrefix}/packets`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSheet(null);
    setSelectedKey(null);
    void m.refresh();
  };
  const exportLog = async () => {
    try {
      const res = await csrfFetch(`${mcPrefix}/packets/export?${meshCoreFilterParams(filters).toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const match = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') ?? '');
      const url = window.URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = match?.[1] ?? 'meshcore-packet-monitor.jsonl';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export packets');
    }
  };
  const clearFilters = () => {
    setPayloadFilter('');
    setRouteFilter('');
    setSearch(undefined);
    setTimeWindow('all');
    setSenderFilter('');
    setSrcHashInput('');
    setPathHashInput('');
  };

  const selected = packets.find((p, i) => keyOf(p, i) === selectedKey) ?? null;
  const title = t('meshcore.packets.title', 'Packet Monitor');
  const pauseLabel = paused ? t('common.resume', 'Resume') : t('common.pause', 'Pause');
  const live = `${paused ? t('workspace.packets.paused') : t('workspace.packets.live')} · ${t('workspace.meshcore.packet_count', { count: m.total })} · ${t('workspace.meshcore.capture_server_side')}`;

  const captureButton = canWriteSettings && (
    <button type="button" className={`${styles.button} ${enabled ? styles.danger : ''}`} disabled={saving} onClick={() => void toggleCapture()}>
      <UiIcon name={enabled ? 'close' : 'statusOn'} size={16} />
      {enabled ? t('workspace.meshcore.stop_capturing') : t('workspace.meshcore.start_capturing')}
    </button>
  );
  const pauseButton = (
    <button type="button" className={isPhone ? styles.iconButton : styles.button} aria-pressed={paused} aria-label={isPhone ? pauseLabel : undefined} onClick={() => setPaused((x) => !x)}>
      <UiIcon name={paused ? 'play' : 'pause'} size={isPhone ? 22 : 16} />
      {!isPhone && pauseLabel}
    </button>
  );
  const icon = (name: Parameters<typeof UiIcon>[0]['name'], label: string, onClick: () => void, extra = '') => (
    <button type="button" className={`${styles.iconButton} ${extra}`} title={label} onClick={onClick}>
      <UiIcon name={name} size={18} />
      <span className={styles.srOnly}>{label}</span>
    </button>
  );
  const tools = (
    <>
      {icon('refresh', t('common.refresh', 'Refresh'), () => void m.refresh())}
      {icon('download', t('common.export', 'Export'), () => void exportLog())}
      {!embedded && !isPhone && icon('maximize', t('packet_monitor.popout', 'Pop out'), () => openPacketMonitorPopout(sourceId))}
      {canWriteSettings && icon('settings', t('workspace.meshcore.capture_settings'), () => setSheet('capture'))}
      {canClear && icon('delete', t('common.clear', 'Clear'), () => setSheet('clear'), styles.danger)}
    </>
  );

  const groupSwitch = (
    <div className={styles.segmented} role="group" aria-label={t('meshcore.packets.groupHelp', 'Collapse receptions of the same frame into one row')}>
      <button type="button" className={styles.segment} aria-pressed={grouped} onClick={() => setGrouped(true)}>{t('meshcore.packets.grouped', 'Grouped')}</button>
      <button type="button" className={styles.segment} aria-pressed={!grouped} onClick={() => setGrouped(false)}>{t('meshcore.packets.flat', 'All')}</button>
    </div>
  );
  const select = (label: string, value: number | '', onChange: (v: number | '') => void, options: Array<{ value: number; label: string }>) => (
    <select className={styles.select} aria-label={label} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
      <option value="">{label}: {t('common.all', 'All')}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  const filterControls = (
    <>
      <PacketSearchInput
        className={styles.input}
        value={search}
        onCommit={setSearch}
        maxLength={100}
        placeholder={t('meshcore.packets.searchPlaceholder', 'Search name, type, hex, key…')}
        title={t('meshcore.packets.searchTitle', 'Matches advert name, payload type, raw hex and sender key. Channel text is encrypted and is not searched.')}
      />
      <TimeWindowSelect className={styles.select} value={timeWindow} onChange={setTimeWindow} />
      {select(t('meshcore.packets.payloadType', 'Payload'), payloadFilter, setPayloadFilter, MESHCORE_PAYLOAD_TYPES)}
      {select(t('meshcore.packets.routeType', 'Route'), routeFilter, setRouteFilter, MESHCORE_ROUTE_TYPES)}
      <span className={styles.senderSelect}>
        <SearchableSelect
          value={senderFilter}
          onChange={setSenderFilter}
          options={senderOptions}
          emptyLabel={t('meshcore.packets.anySender', 'Any sender')}
          placeholder={t('meshcore.packets.sender', 'Sender')}
          ariaLabel={t('meshcore.packets.sender', 'Sender')}
        />
      </span>
      <label className={styles.hashField} title={t('meshcore.packets.srcHashHelp', 'Sender hash, 2 to 6 hex digits')}>
        <span>{t('meshcore.packets.srcHash', 'Src hash')}</span>
        <input className={`${styles.input} ${styles.hashInput}`} value={srcHashInput} maxLength={6} onChange={(e) => setSrcHashInput(e.target.value.trim())} placeholder="2f" />
      </label>
      <label className={styles.hashField} title={t('meshcore.packets.pathHashHelp', 'Relay hash anywhere in the path, 2 to 6 hex digits')}>
        <span>{t('meshcore.packets.pathHash', 'Path hash')}</span>
        <input className={`${styles.input} ${styles.hashInput}`} value={pathHashInput} maxLength={6} onChange={(e) => setPathHashInput(e.target.value.trim())} placeholder="a7" />
      </label>
      <button type="button" className={styles.button} disabled={!hasFilters} onClick={clearFilters}>{t('meshcore.packets.clearFilters', 'Clear filters')}</button>
    </>
  );
  const chartsButton = (
    <button type="button" className={styles.chip} aria-pressed={sheet === 'charts'} onClick={() => setSheet('charts')}>
      <UiIcon name="reports" size={16} />
      {t('workspace.packets.charts')}
    </button>
  );

  const banner = !enabled && !notConnected && (
    <p className={styles.banner} role="status">
      <UiIcon name="info" size={16} />
      <span>{t('meshcore.packets.disabled', 'MeshCore packet capture is off. No new packets will be recorded until you enable it.')}</span>
      {canWriteSettings && (
        <button type="button" className={styles.button} disabled={saving} onClick={() => void toggleCapture()}>{t('meshcore.packets.enable', 'Enable capture')}</button>
      )}
    </p>
  );
  const empty = notConnected ? (
    <StateView kind="empty" title={t('source_not_connected.title', 'This source is not connected')} />
  ) : m.loading ? (
    <StateView kind="loading" />
  ) : packets.length === 0 ? (
    <p className={styles.note}>
      {enabled ? t('meshcore.packets.empty', 'No packets captured yet. Waiting for OTA traffic…') : t('meshcore.packets.emptyDisabled', 'No packets captured. Enable capture to start recording.')}
    </p>
  ) : null;

  const fromCell = (p: Row) => {
    const f = from(p);
    return f.label === null ? <span className={styles.muted}>—</span> : <span title={f.title}>{f.label}</span>;
  };
  const obs = (p: Row) => observerLabel(Number(p.observerCount ?? 0), t('meshcore.packets.observersLocal', 'Local'));
  const n = (v: number | null | undefined, digits?: number) => (typeof v === 'number' ? (digits === undefined ? String(v) : v.toFixed(digits)) : '—');

  // Today's paging (useMeshCorePackets): one page per press, on the phone and desktop alike.
  const older = m.hasMore && (
    <button type="button" className={styles.button} disabled={m.loadingMore} onClick={() => void m.loadMore()}>
      {m.loadingMore ? t('common.loading', 'Loading…') : t('workspace.meshcore.load_older')}
    </button>
  );
  const list = isPhone ? (
    <>
    <div className={styles.card}>
      {packets.map((p, i) => (
        <button key={keyOf(p, i)} type="button" className={styles.rowButton} data-testid="mc-packet-row" onClick={() => setSelectedKey(keyOf(p, i))}>
          <span className={styles.badge} data-family={family(p)}>{payloadLabel(p)}</span>
          <span className={styles.headText}>
            <span className={styles.rowTitle}>{fromCell(p)}</span>
            <span className={styles.rowSub}>
              {[routeLabel(p), t('workspace.meshcore.hops', { count: p.hopCount ?? 0 }), typeof p.snr === 'number' ? `${p.snr.toFixed(1)} dB` : null,
                grouped ? `${obs(p)} ${t('workspace.meshcore.obs')}` : null].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className={`${styles.muted} ${styles.mono}`}>{formatTime(p.timestamp).slice(0, 5)}</span>
        </button>
      ))}
    </div>
    {older}
    </>
  ) : (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('meshcore.packets.time', 'Time')}</th>
            <th>{t('meshcore.packets.payloadType', 'Payload')}</th>
            <th>{t('meshcore.packets.from', 'From')}</th>
            <th>{t('meshcore.packets.routeType', 'Route')}</th>
            <th>{t('meshcore.packets.hops', 'Hops')}</th>
            <th>{t('meshcore.packets.snr', 'SNR')}</th>
            <th>{t('meshcore.packets.rssi', 'RSSI')}</th>
            {grouped && <th title={t('meshcore.packets.observersHelp', 'Distinct observers that heard this frame. "Local" means your own radio heard it.')}>{t('workspace.meshcore.obs')}</th>}
            <th>{t('meshcore.packets.size', 'Size')}</th>
            <th>{t('meshcore.packets.path', 'Path')}</th>
          </tr>
        </thead>
        <tbody>
          {packets.map((p, i) => {
            const k = keyOf(p, i);
            return (
              <tr key={k} className={styles.clickRow} data-testid="mc-packet-row" data-selected={k === selectedKey || undefined} tabIndex={0}
                title={t('meshcore.packets.clickToDecode', 'Click to decode this packet')}
                onClick={() => setSelectedKey(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(k); } }}>
                <td className={styles.mono}>{formatTime(p.timestamp)}</td>
                <td><span className={styles.badge} data-family={family(p)}>{payloadLabel(p)}</span></td>
                <td>{fromCell(p)}</td>
                <td>{routeLabel(p)}</td>
                <td>{n(p.hopCount)}</td>
                <td>{n(p.snr, 2)}</td>
                <td>{n(p.rssi)}</td>
                {grouped && <td>{obs(p)}</td>}
                <td>{n(p.payloadSize)}</td>
                <td className={styles.mono}>{p.pathHops || (p.pathLenRaw === 255 ? 'direct' : '—')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {older}
    </div>
  );

  const fromOfSelected = selected ? from(selected) : null;
  const decode = selected && (
    <Decode
      packet={selected}
      sourceId={sourceId}
      contacts={contacts}
      grouped={grouped}
      nameOf={(key) => contactByKey.get(key.toLowerCase())?.name ?? null}
    />
  );
  const decodeTitle = selected && (
    <>
      <span className={styles.badge} data-family={family(selected)}>{payloadLabel(selected)}</span> {t('meshcore.packets.detailTitle', 'Packet Decode')}
    </>
  );
  const decodeFooter = selected && (
    <div className={styles.footerButtons}>
      <button type="button" className={styles.button} onClick={() => void navigator.clipboard?.writeText(JSON.stringify(selected, null, 2))}>{t('workspace.meshcore.copy_json')}</button>
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!fromOfSelected?.publicKey}
        onClick={() => fromOfSelected?.publicKey && void navigate(`${base}/node/${encodeURIComponent(fromOfSelected.publicKey)}`)}>
        {t('workspace.meshcore.show_sender')}
      </button>
    </div>
  );

  const sheets = (
    <>
      <Sheet open={!!selected && isPhone} onClose={() => setSelectedKey(null)} title={decodeTitle} footer={decodeFooter}>
        <div className={styles.sheet} data-phone="">{decode}</div>
      </Sheet>
      <Sheet open={sheet === 'charts'} onClose={() => setSheet(null)} title={t('meshcore.packets.stats', 'Distribution charts')}>
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          {distribution && distribution.total > 0 ? (
            <Suspense fallback={<StateView kind="loading" />}>
              <PacketStatsChart bare stacked chartId="mc-by-payload" title={t('meshcore.packets.byPayload', 'By payload')}
                data={toChartEntries(distribution.byPayloadType, (r) => r.payloadTypeName ?? `0x${r.payloadType.toString(16)}`, (r) => r.count)} total={distribution.total} />
              <PacketStatsChart bare stacked chartId="mc-by-route" title={t('meshcore.packets.byRoute', 'By route')}
                data={toChartEntries(distribution.byRouteType, (r) => r.routeTypeName ?? '—', (r) => r.count)} total={distribution.total} />
              <PacketStatsChart bare stacked chartId="mc-by-sender" title={t('meshcore.packets.bySender', 'Top senders')}
                data={toChartEntries(distribution.topSenders, (r) => r.advertName || contactByKey.get(r.senderPubKey.toLowerCase())?.name || r.senderPubKey.slice(0, 8), (r) => r.count)}
                total={distribution.total} />
            </Suspense>
          ) : (
            <p className={styles.note}>{t('meshcore.packets.statsEmpty', 'No packets in this window.')}</p>
          )}
        </div>
      </Sheet>
      <Sheet open={sheet === 'capture'} onClose={() => setSheet(null)} title={t('workspace.meshcore.capture_settings')}>
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          <label className={styles.actions}>
            <input type="checkbox" role="switch" checked={enabled} disabled={saving} onChange={() => void toggleCapture()} />
            {t('meshcore.packets.captureEnabled', 'Capture enabled')}
          </label>
          <label className={styles.field}>
            {t('meshcore.packets.maxCount', 'Max count')}
            <NumberInput min={100} max={isIngestSource ? 500000 : 50000} step={100} integer value={maxCount} className={styles.input}
              onChange={(v) => m.setMeta((x) => ({ ...x, maxCount: v }))}
              onBlur={(e) => {
                if (e.currentTarget.dataset.numberInvalid === 'true') return;
                // Retention is per source kind (#5040): a region feed has its own key.
                void saveSettings(isIngestSource ? { meshcore_mqtt_packet_log_max_count: String(maxCount) } : { meshcore_packet_log_max_count: String(maxCount) });
              }} />
          </label>
          {isIngestSource && (
            <p className={styles.warn}>
              {t('meshcore.packets.ingestCapWarning', 'A region feed stores one row per observer that heard each frame. At 50,000 rows expect roughly 50–100MB of database per source — noticeable on a Pi or a small container volume.')}
            </p>
          )}
          <label className={styles.field}>
            {t('meshcore.packets.maxAgeHours', 'Max age (h)')}
            <NumberInput min={1} max={720} integer value={maxAgeHours} className={styles.input}
              onChange={(v) => m.setMeta((x) => ({ ...x, maxAgeHours: v }))}
              onBlur={(e) => {
                if (e.currentTarget.dataset.numberInvalid === 'true') return;
                void saveSettings({ meshcore_packet_log_max_age_hours: String(maxAgeHours) });
              }} />
          </label>
          <p className={styles.note}>{t('workspace.packets.capture_one')}</p>
        </div>
      </Sheet>
      <Sheet open={sheet === 'filters'} onClose={() => setSheet(null)} title={t('common.filters', 'Filters')}>
        <div className={`${styles.sheet} ${styles.filters}`} data-phone="">{filterControls}</div>
      </Sheet>
      <ConfirmSheet
        open={sheet === 'clear'}
        title={t('common.clear', 'Clear')}
        body={t('meshcore.packets.clearConfirm', 'Clear the captured MeshCore packet log for this source?')}
        confirmLabel={t('common.clear', 'Clear')}
        danger
        submitOnEnter={false}
        onCancel={() => setSheet(null)}
        onConfirm={clear}
      />
    </>
  );

  const body: ReactNode = (
    <>
      {banner}
      {errorText && <p className={styles.error} role="alert">{errorText}</p>}
      {empty}
      {packets.length > 0 && !notConnected && list}
    </>
  );

  if (isPhone) {
    const content = (
      <>
        <div className={styles.filters}>
          {groupSwitch}
          {chartsButton}
          <button type="button" className={styles.chip} onClick={() => setSheet('filters')}>
            <UiIcon name="filter" size={16} />
            {t('common.filters', 'Filters')}
          </button>
        </div>
        <div className={styles.actions}>{captureButton}{tools}</div>
        <p className={styles.note}>{live}</p>
        {body}
        {sheets}
      </>
    );
    return embedded ? (
      <section className={styles.section} aria-label={title}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {content}
      </section>
    ) : (
      <div className={styles.page} data-phone="">
        <ToolHead title={title} back={{ label: t('workspace.home.tools'), to: base }} phoneActions={pauseButton} />
        {content}
      </div>
    );
  }

  const desktop = (
    <>
      <ToolHead title={title} subtitle={<><span className={styles.dot} data-live={!paused || undefined} aria-hidden="true" />{live}</>} back={{ label: '', to: base }}
        actions={<>{captureButton}{pauseButton}{tools}</>} />
      <div className={styles.filters}>
        {groupSwitch}
        {filterControls}
        {chartsButton}
      </div>
      <div className={styles.body} data-panel={selected ? '' : undefined}>
        <div>{body}</div>
        {selected && (
          <aside className={styles.panel} aria-label={t('meshcore.packets.detailTitle', 'Packet Decode')}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{decodeTitle}</h2>
              <button type="button" className={styles.iconButton} aria-label={t('common.close')} onClick={() => setSelectedKey(null)}>
                <UiIcon name="close" size={18} />
              </button>
            </div>
            {decode}
          </aside>
        )}
      </div>
      {sheets}
    </>
  );
  return embedded ? (
    <section className={styles.section} aria-label={title}>{desktop}</section>
  ) : (
    <div className={styles.page} data-panel={selected ? '' : undefined}>{desktop}</div>
  );
}

interface Reception {
  observerId?: string | null;
  snr?: number | null;
  hopCount?: number | null;
}

/** Packet Decode (MeshCorePacketDetailModal's content, redrawn): header, path, the group frame, observers, raw. */
function Decode({ packet, sourceId, contacts, grouped, nameOf }: {
  packet: Row; sourceId: string; contacts: MeshCoreContact[]; grouped: boolean; nameOf(key: string): string | null;
}) {
  const { t } = useTranslation();
  const rawHex = packet.rawHex ?? '';
  const decoded = useMemo(() => decodeMeshCorePacket(rawHex), [rawHex]);
  const group = decoded?.payload.groupText ?? decoded?.payload.groupData;
  const relayHops = useMemo(() => (decoded && !decoded.path.direct ? decoded.path.hops : []), [decoded]);
  const { rows: relayRows } = useResolvedRouteHops(relayHops, sourceId, contacts);
  // Today's decrypt-on-read (#5567): one request per opened frame. The reply has plaintext and the key's place, never the key.
  const { data: plainReply, isError, isLoading } = useQuery({
    queryKey: ['meshcore-decode', sourceId, rawHex],
    enabled: !!group,
    queryFn: () => apiService.decodeMeshCoreGroupPacket(sourceId, rawHex),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const plain = plainReply?.decrypted ? plainReply : null;
  // A grouped row's observers: today's receptions read, once per opened row.
  const { data: receptions } = useQuery({
    queryKey: ['meshcore-receptions', sourceId, rawHex],
    enabled: grouped && !!rawHex,
    queryFn: () =>
      apiService.get<{ receptions: Reception[] }>(`/api/sources/${encodeURIComponent(sourceId)}/meshcore/packets/receptions?raw_hex=${encodeURIComponent(rawHex)}`),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const row = (label: string, value: ReactNode, mono = false) => (
    <div className={styles.decodeRow}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={`${styles.kvValue} ${mono ? styles.mono : ''}`}>{value}</span>
    </div>
  );
  const title = (text: string) => <h3 className={styles.decodeTitle}>{text}</h3>;
  if (!decoded) return <div className={styles.decode}><p className={styles.error}>{t('meshcore.packets.noRaw', 'No raw packet bytes available to decode.')}</p></div>;
  const keyOrigin = plain
    ? plain.keyOrigin.kind === 'virtual'
      ? t('meshcore.packets.keyOriginVirtual', 'virtual channel')
      : plain.keyOrigin.currentSource
        ? t('meshcore.packets.keyOriginThisSource', 'this source')
        : t('meshcore.packets.keyOriginSource', 'key from source {{name}}', { name: plain.keyOrigin.sourceName })
    : null;
  const time = new Date(packet.timestamp);
  return (
    <div className={styles.decode}>
      {title(t('meshcore.packets.reception', 'Reception'))}
      {row(t('meshcore.packets.time', 'Time'), `${time.toLocaleString()}.${String(time.getMilliseconds()).padStart(3, '0')}`, true)}
      {row(t('meshcore.packets.snr', 'SNR'), typeof packet.snr === 'number' ? `${packet.snr.toFixed(2)} dB` : '—', true)}
      {row(t('meshcore.packets.rssi', 'RSSI'), typeof packet.rssi === 'number' ? `${packet.rssi} dBm` : '—', true)}
      {title(t('meshcore.packets.header', 'Header'))}
      {row(t('meshcore.packets.version', 'Version'), decoded.header.payloadVersion, true)}
      {row(t('meshcore.packets.routeType', 'Route'), `${decoded.header.routeTypeName} (${fmtHex(decoded.header.routeType)})`, true)}
      {row(t('meshcore.packets.payloadType', 'Payload'), `${decoded.header.payloadTypeName} (${fmtHex(decoded.header.payloadType)})`, true)}
      {decoded.transportCodes && row(t('meshcore.packets.transportCodes', 'Transport codes'), `${fmtHex(decoded.transportCodes.code1)} · ${fmtHex(decoded.transportCodes.code2)}`, true)}
      {title(t('meshcore.packets.path', 'Path'))}
      {decoded.path.direct ? (
        row(t('meshcore.packets.routing', 'Routing'), t('meshcore.packets.directNoRelay', 'Direct (no relays)'))
      ) : (
        <>
          {row(t('meshcore.packets.path', 'Path'), decoded.path.hops.join(' → ') || '—', true)}
          {row(t('meshcore.packets.hashWidth', 'Hash width'), `${decoded.path.hashSize} B · ${t('workspace.meshcore.hops', { count: decoded.path.hopCount })}`, true)}
          {relayRows.map((r, i) => (
            <div key={`${r.byte}-${i}`} className={styles.decodeRow} title={candidatesTitle(r)}>
              <span className={styles.kvLabel}>#{i + 1}</span>
              <span className={`${styles.kvValue} ${styles.mono}`}>
                {r.byte} → {r.origin === 'none' ? t('meshcore.route_detail_unknown', 'unknown repeater') : hopText(r)}
                {r.origin === 'other' && r.via?.sourceName ? ` (${t('meshcore.route_detail_via', 'via {{source}}', { source: r.via.sourceName })})` : ''}
              </span>
            </div>
          ))}
        </>
      )}
      {title(`${t('meshcore.packets.payload', 'Payload')} · ${decoded.payload.sizeBytes} B`)}
      {decoded.payload.advert && (
        <>
          {row(t('meshcore.packets.advType', 'Advert type'), `${decoded.payload.advert.advTypeName} (${decoded.payload.advert.advType})`, true)}
          {decoded.payload.advert.name !== undefined && row(t('meshcore.packets.nodeName', 'Node name'), decoded.payload.advert.name || '(empty)')}
          {row(t('meshcore.packets.publicKey', 'Public key'), decoded.payload.advert.publicKey, true)}
          {row(t('meshcore.packets.advTimestamp', 'Advert time'), decoded.payload.advert.timestampIso ?? decoded.payload.advert.timestamp, true)}
          {decoded.payload.advert.latitude !== undefined &&
            row(t('meshcore.packets.location', 'Location'), `${decoded.payload.advert.latitude.toFixed(5)}, ${decoded.payload.advert.longitude?.toFixed(5)}`, true)}
          {decoded.payload.advert.feat1 !== undefined && row('feat1', fmtHex(decoded.payload.advert.feat1), true)}
          {decoded.payload.advert.feat2 !== undefined && row('feat2', fmtHex(decoded.payload.advert.feat2), true)}
          {row(t('meshcore.packets.signature', 'Signature'), decoded.payload.advert.signature, true)}
        </>
      )}
      {group && (
        <>
          {row(t('meshcore.packets.channelHash', 'Channel hash'), `0x${group.channelHash}`, true)}
          {row(t('meshcore.packets.cipherMac', 'Cipher MAC'), `0x${group.cipherMacHex}`, true)}
          {row(t('meshcore.packets.ciphertext', 'Ciphertext'), `${group.ciphertextHex.length / 2} B`, true)}
          <div className={styles.decrypt}>
            <span className={styles.decryptTag}>
              <UiIcon name="key" size={16} />
              {t('channel_database.decrypt', 'Decrypt')}
            </span>
            <span className={plain ? styles.keyOrigin : styles.muted} role="status">
              {isLoading
                ? t('meshcore.packets.decrypting', 'Decrypting…')
                : isError
                  ? t('meshcore.packets.decryptError', 'Could not ask the server to decrypt this packet.')
                  : plain
                    ? `${plain.channelName || t('meshcore.packets.channelUnnamed', '(unnamed)')} · ${keyOrigin}`
                    : t('meshcore.packets.unknownChannel', 'Unknown channel (hash 0x{{hash}})', { hash: group.channelHash })}
            </span>
          </div>
          {plain?.text && (
            <>
              <p className={styles.quote}>{t('workspace.meshcore.quoted', { text: plain.text.text })}</p>
              {row(t('meshcore.packets.sender', 'Sender'), plain.text.sender ?? t('meshcore.packets.senderUnknown', '(not given)'))}
              {row(t('meshcore.packets.senderTime', 'Sender time'), plain.text.timestampSec > 0 ? new Date(plain.text.timestampSec * 1000).toLocaleString() : '—', true)}
            </>
          )}
          {plain?.data && (
            <>
              {row(t('meshcore.packets.dataType', 'Data type'), `0x${plain.data.dataType.toString(16).padStart(4, '0')}`, true)}
              {row(t('meshcore.packets.dataLength', 'Data length'), `${plain.data.dataHex.length / 2} B`, true)}
              <pre className={styles.raw}>{plain.data.dataHex || '—'}</pre>
            </>
          )}
        </>
      )}
      {!group && decoded.payload.message && (
        <>
          {row(t('meshcore.packets.destHash', 'Dest hash'), decoded.payload.message.destHash, true)}
          {row(t('meshcore.packets.srcHash', 'Src hash'), decoded.payload.message.srcHash, true)}
        </>
      )}
      {!group && decoded.payload.message &&
        row(t('meshcore.packets.encrypted', 'Encrypted body'), decoded.payload.message.encryptedHex || '(none)', true)}
      {decoded.payload.ack && row(t('meshcore.packets.ackCode', 'ACK code'), decoded.payload.ack.ackCodeHex, true)}
      {decoded.payload.multipart && (
        <>
          {row(t('meshcore.packets.multipartRemaining', 'Parts remaining'), decoded.payload.multipart.remaining, true)}
          {row(t('meshcore.packets.multipartInner', 'Wrapped payload'), `${decoded.payload.multipart.innerTypeName} (${fmtHex(decoded.payload.multipart.innerType)})`, true)}
          {decoded.payload.multipart.ack
            ? row(t('meshcore.packets.ackCode', 'ACK code'), decoded.payload.multipart.ack.ackCodeHex, true)
            : row(t('meshcore.packets.multipartInnerHex', 'Wrapped payload (hex)'), decoded.payload.multipart.innerHex || '—', true)}
        </>
      )}
      {decoded.payload.control && (
        <>
          {row(t('meshcore.packets.controlSubType', 'Control type'), `${decoded.payload.control.subTypeName} (${fmtHex(decoded.payload.control.subType)})`, true)}
          {decoded.payload.control.discoverRequest && (
            <>
              {row(t('meshcore.packets.discoverFilter', 'Type filter'), fmtHex(decoded.payload.control.discoverRequest.filter), true)}
              {row(t('meshcore.packets.discoverKeyLength', 'Key requested'), decoded.payload.control.discoverRequest.prefixOnly
                ? t('meshcore.packets.discoverKeyPrefix', 'Prefix (8 B)') : t('meshcore.packets.discoverKeyFull', 'Full (32 B)'), true)}
              {row(t('meshcore.packets.discoverTag', 'Tag'), decoded.payload.control.discoverRequest.tag, true)}
            </>
          )}
          {decoded.payload.control.discoverResponse && (
            <>
              {row(t('meshcore.packets.advType', 'Advert type'), `${decoded.payload.control.discoverResponse.advTypeName} (${decoded.payload.control.discoverResponse.advType})`, true)}
              {row(t('meshcore.packets.discoverSnrToNode', 'SNR at responder'), `${decoded.payload.control.discoverResponse.snr.toFixed(2)} dB`, true)}
              {row(t('meshcore.packets.discoverTag', 'Tag'), decoded.payload.control.discoverResponse.tag, true)}
              {row(t('meshcore.packets.publicKey', 'Public key'), decoded.payload.control.discoverResponse.publicKey || '—', true)}
            </>
          )}
        </>
      )}
      {row(t('meshcore.packets.payloadHex', 'Payload (hex)'), decoded.payload.hex || '—', true)}
      {grouped && (
        <>
          {title(`${t('meshcore.packets.observers', 'Observers')} · ${t('meshcore.packets.grouped', 'Grouped')} · ${receptions?.receptions.length ?? observerLabel(Number(packet.observerCount ?? 0), t('meshcore.packets.observersLocal', 'Local'))}`)}
          {(receptions?.receptions ?? []).map((r, i) => (
            <div key={`${r.observerId ?? 'local'}-${i}`} className={styles.decodeRow}>
              <span data-observer="">
                {r.observerId ? (nameOf(r.observerId) ?? `${r.observerId.slice(0, 8)}…`) : t('workspace.meshcore.this_source')}
              </span>
              <span className={styles.kvValue}>
                {[typeof r.snr === 'number' ? `SNR ${r.snr.toFixed(1)}` : null, typeof r.hopCount === 'number' ? t('workspace.meshcore.hops', { count: r.hopCount }) : null]
                  .filter(Boolean).join(' · ')}
              </span>
            </div>
          ))}
        </>
      )}
      {title(`${t('meshcore.packets.raw', 'Raw')} · ${t('workspace.meshcore.size_bytes', { count: decoded.totalBytes })}`)}
      <pre className={styles.raw}>{rawHex.match(/../g)?.join(' ') ?? rawHex}</pre>
      {decoded.errors.length > 0 && <p className={styles.note}>{t('meshcore.packets.decodeNote', 'Partial decode')}: {decoded.errors.join('; ')}</p>}
    </div>
  );
}
