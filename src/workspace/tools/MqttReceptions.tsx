/**
 * An MQTT device's packet monitor (boards 18-03, 18-04; s18n2) on today's
 * hooks (`useMqttPacketMonitor`: the grouped list, its 5 s poll skipped while
 * paused, Ruling BF; `useMqttReceptions`): one row per packet (deduped at
 * query time) with its gateway count. The count, or the row, opens Packet
 * Detail with one row per gateway that heard it: Gateway, Rx time, Hops, SNR,
 * RSSI, Outcome, ok_to_mqtt. Filters, Capture settings (Capture enabled, Max
 * count, Max age), Clear (asks first) and the off banner with Enable capture
 * are today's. Capture writes `mqtt_packet_log_*` (settings:write),
 * server-side logging: it sends nothing on the mesh.
 *
 * The page needs packetmonitor:read on this device; the routes check it too.
 */
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import type { MqttGroupedPacket, MqttReception } from '../../components/MQTT/mqttPacketTypes';
import { okToMqttState, type OkToMqttState } from '../../components/MQTT/okToMqttState';
import { useMqttPacketMonitor } from '../../components/MQTT/useMqttPacketMonitor';
import { useMqttReceptions } from '../../components/MQTT/useMqttReceptions';
import { useAuth } from '../../contexts/AuthContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';
import ConfirmSheet from '../patterns/ConfirmSheet';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './MqttReceptions.module.css';

type Monitor = ReturnType<typeof useMqttPacketMonitor>;

const keyOf = (p: MqttGroupedPacket) => `${p.packetId}-${p.fromNode}`;

/** Today's monitor clock: HH:MM:SS.mmm. */
function clock(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** Today's detail times. */
const heard = (ts: number) => (ts ? new Date(ts).toLocaleString() : '—');

const ENCRYPTED_OUTCOMES = new Set(['encrypted', 'ignored', 'geo-ignored', 'distance', 'unsupported-portnum', 'decode-error']);

/** Today's Type cell: the port name, or for an encrypted packet with none, its ingest outcome. */
const typeText = (p: MqttGroupedPacket) =>
  p.encrypted && !p.portnumName && ENCRYPTED_OUTCOMES.has(p.ingestOutcome) ? p.ingestOutcome : (p.portnumName ?? '—');

const hopsOf = (r: MqttReception) => (r.hopStart != null && r.hopLimit != null ? r.hopStart - r.hopLimit : null);
const snrOf = (r: MqttReception) => (r.rxSnr != null ? `${+r.rxSnr.toFixed(2)} dB` : '—');

/** One ok_to_mqtt state in today's words (MqttOkToMqttMarker); only a violation reads as an alert. */
function OkBadge({ state, scope }: { state: OkToMqttState; scope: 'packet' | 'gateway' }) {
  const { t } = useTranslation();
  const words: Record<OkToMqttState, [string, string]> = {
    violation: [
      t('mqtt.packets.violationBadge', 'violation'),
      scope === 'packet' ? t('mqtt.packets.violationPacketTitle') : t('mqtt.packets.violationGatewayTitle'),
    ],
    ok: [t('mqtt.packets.okToMqttAllowed', 'allowed'), t('mqtt.packets.okToMqttAllowedTitle')],
    optedOut: [t('mqtt.packets.okToMqttOptedOut', 'opted out'), t('mqtt.packets.okToMqttOptedOutTitle')],
    unknown: [t('mqtt.packets.okToMqttUnknown', 'unknown'), t('mqtt.packets.okToMqttUnknownTitle')],
  };
  const [label, title] = words[state];
  return (
    <span className={styles.badge} data-state={state} title={title}>
      {state === 'violation' && <UiIcon name="alert" size={12} />}
      {label}
    </span>
  );
}

function Detail({ m, packet, onClose }: { m: Monitor; packet: MqttGroupedPacket; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const titleId = useId();
  const r = useMqttReceptions(packet, m.prefix, m.csrfFetch);
  const title = t('mqtt.packets.detailTitle', 'Packet Detail');
  const state = okToMqttState(packet);
  const fields: Array<[string, ReactNode]> = [
    [t('mqtt.packets.from', 'From'), m.renderFrom(packet)],
    [t('mqtt.packets.to', 'To'), m.renderTo(packet)],
    [t('mqtt.packets.channel', 'Channel'), `${packet.channelId ?? '—'}${packet.channel != null ? ` (#${packet.channel})` : ''}`],
    [t('mqtt.packets.portnum', 'Port'), `${packet.portnumName ?? '—'}${packet.portnum != null ? ` (${packet.portnum})` : ''}`],
    [t('mqtt.packets.outcome', 'Outcome'), <span key="o" className={styles.badge}>{packet.ingestOutcome}</span>],
    [t('mqtt.packets.encrypted', 'Encrypted'), packet.encrypted ? t('common.yes') : t('common.no')],
    [t('mqtt.packets.size', 'Size'), packet.payloadSize != null ? `${packet.payloadSize} B` : '—'],
    [t('mqtt.packets.gatewayCount', 'Gateways'), String(packet.gatewayCount)],
    [t('mqtt.packets.receptions', 'Receptions'), String(packet.receptionCount)],
    [t('mqtt.packets.firstHeard', 'First heard'), heard(packet.firstHeard)],
    [t('mqtt.packets.lastHeard', 'Last heard'), heard(packet.lastHeard)],
  ];
  const sectionTitle = `${t('mqtt.packets.receptionsSection', 'Per-gateway receptions')}${r.receptions.length ? ` · ${r.receptions.length}` : ''}`;
  const gateway = (rx: MqttReception) => m.nodeName(rx.gatewayNodeNum) ?? rx.gatewayId ?? '—';
  const receptions = !r.canFetch ? (
    <p className={styles.state}>{t('mqtt.packets.noReceptions')}</p>
  ) : r.loadingReceptions ? (
    <p className={styles.state}>{t('common.loading', 'Loading…')}</p>
  ) : r.receptionsError ? (
    <p className={styles.error}>{r.receptionsError}</p>
  ) : r.receptions.length === 0 ? (
    <p className={styles.state}>{t('mqtt.packets.noReceptionsFound')}</p>
  ) : isPhone ? (
    <ul className={styles.cards} aria-label={t('mqtt.packets.receptionsSection', 'Per-gateway receptions')}>
      {r.receptions.map((rx, i) => {
        const hops = hopsOf(rx);
        return (
          <li key={`${rx.gatewayId ?? 'unknown'}-${rx.timestamp}-${i}`} className={styles.card}>
            <span className={styles.cardHead}>
              <strong>{gateway(rx)}</strong>
              <span className={styles.badges}>
                <span className={styles.badge}>{rx.ingestOutcome ?? '—'}</span>
                <OkBadge state={okToMqttState(rx)} scope="gateway" />
              </span>
            </span>
            <span className={styles.cardLine}>
              {t('mqtt.packets.rxTime', 'Rx time')} {rx.rxTime ? clock(rx.rxTime) : '—'}
              {hops !== null && ` · ${t('unified.messages.hop_count', { count: hops })}`} · {t('mqtt.packets.snr', 'SNR')} {snrOf(rx)} ·{' '}
              {t('mqtt.packets.rssi', 'RSSI')} {rx.rxRssi ?? '—'}
            </span>
          </li>
        );
      })}
    </ul>
  ) : (
    <table className={styles.receptions}>
      <thead>
        <tr>
          <th>{t('mqtt.packets.gateway', 'Gateway')}</th>
          <th>{t('mqtt.packets.rxTime', 'Rx time')}</th>
          <th>{t('mqtt.packets.hops', 'Hops')}</th>
          <th>{t('mqtt.packets.snr', 'SNR')}</th>
          <th>{t('mqtt.packets.rssi', 'RSSI')}</th>
          <th>{t('mqtt.packets.outcome', 'Outcome')}</th>
          <th>{t('mqtt.packets.okToMqtt', 'ok_to_mqtt')}</th>
        </tr>
      </thead>
      <tbody>
        {r.receptions.map((rx, i) => (
          <tr key={`${rx.gatewayId ?? 'unknown'}-${rx.timestamp}-${i}`}>
            <td className={styles.strong}>{gateway(rx)}</td>
            <td className={styles.mono}>{rx.rxTime ? clock(rx.rxTime) : '—'}</td>
            <td>{hopsOf(rx) ?? '—'}</td>
            <td>{snrOf(rx)}</td>
            <td>{rx.rxRssi ?? '—'}</td>
            <td><span className={styles.badge}>{rx.ingestOutcome ?? '—'}</span></td>
            <td><OkBadge state={okToMqttState(rx)} scope="gateway" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const body = (
    <>
      {packet.payloadPreview && <p className={styles.quote}>“{packet.payloadPreview}”</p>}
      <dl className={styles.fields}>
        {fields.map(([label, value]) => (
          <div key={label} className={styles.field}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.ok}>
        <span>{t('mqtt.packets.okToMqtt', 'ok_to_mqtt')}</span>
        <OkBadge state={state} scope="packet" />
        {state === 'violation' && <span className={styles.okNote}>{t('mqtt.packets.violationPacketTitle')}</span>}
      </p>
      <h3 className={styles.sectionTitle}>{sectionTitle}</h3>
      {receptions}
    </>
  );

  if (isPhone) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <div className={styles.sheetBody}>{body}</div>
      </Sheet>
    );
  }
  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.panelHead}>
        <h2 id={titleId} className={styles.panelTitle}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {body}
    </aside>
  );
}

/** Today's filters and, for settings:write, today's capture settings. */
function Filters({ m }: { m: Monitor }) {
  const { t } = useTranslation();
  const gatewaysId = useId();
  const encryptedId = useId();
  const encrypted: Array<['' | '1' | '0', string]> = [
    ['', t('common.all', 'All')], ['1', t('mqtt.packets.encrypted', 'Encrypted')], ['0', t('mqtt.packets.decrypted', 'Decrypted')],
  ];
  return (
    <div className={styles.filters}>
      <div className={styles.filterRow}>
        <span className={styles.label} id={gatewaysId}>{t('mqtt.packets.gateways', 'Gateways')}</span>
        <div className={styles.gateways} role="group" aria-labelledby={gatewaysId}>
          {m.gateways.length === 0 && <span className={styles.muted}>{t('common.none', 'None')}</span>}
          {m.gateways.map((gw) => (
            <label key={gw.gatewayId} className={styles.chip} title={String(gw.receptionCount)}>
              <input
                type="checkbox"
                checked={m.selectedGateways.includes(gw.gatewayId)}
                onChange={(e) => m.toggleGateway(gw.gatewayId, e.target.checked)}
              />
              <span>{m.nodeName(gw.gatewayNodeNum) ?? gw.gatewayId}</span>
            </label>
          ))}
          <span className={styles.muted}>
            {m.selectedGateways.length
              ? t('workspace.packets.gateways_selected', { selected: m.selectedGateways.length, total: m.gateways.length })
              : t('common.all', 'all')}
          </span>
          <button type="button" className={styles.link} onClick={m.selectAllGateways}>{t('mqtt.packets.selectAll', 'Select all')}</button>
          <button type="button" className={styles.link} onClick={m.clearGatewaySelection}>{t('mqtt.packets.clearSelection', 'Clear')}</button>
        </div>
      </div>
      <div className={styles.filterRow}>
        <span className={styles.label} id={encryptedId}>{t('mqtt.packets.encrypted', 'Encrypted')}</span>
        <div className={styles.segmented} role="group" aria-labelledby={encryptedId}>
          {encrypted.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={m.encryptedFilter === value} onClick={() => m.setEncryptedFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className={styles.inline}>
          <span className={styles.label}>{t('mqtt.packets.portnum', 'Port')}</span>
          <NumberInput min={0} integer allowEmpty value={m.portnumFilter === '' ? null : m.portnumFilter} onChange={(v) => m.setPortnumFilter(v === null ? '' : v)} />
        </label>
        {m.selectedGateways.length > 0 && (
          <span className={styles.note}>{t('mqtt.packets.gatewayCountFiltered', 'Gateway counts reflect the selected gateways only.')}</span>
        )}
      </div>
      {m.canWriteSettings && (
        <div className={styles.filterRow}>
          <label className={styles.inline}>
            <input type="checkbox" checked={m.enabled} disabled={m.savingSettings} onChange={() => void m.handleToggleEnabled()} />
            {t('mqtt.packets.captureEnabled', 'Capture enabled')}
          </label>
          <label className={styles.inline}>
            {t('mqtt.packets.maxCount', 'Max count')}
            <NumberInput
              min={100}
              max={50000}
              step={100}
              integer
              value={m.maxCount}
              onChange={m.setMaxCount}
              onBlur={(e) => {
                if (e.currentTarget.dataset.numberInvalid === 'true') return;
                void m.saveSettings({ mqtt_packet_log_max_count: String(m.maxCount) });
              }}
            />
          </label>
          <label className={styles.inline}>
            {t('mqtt.packets.maxAgeHours', 'Max age (h)')}
            <NumberInput
              min={1}
              max={720}
              integer
              value={m.maxAgeHours}
              onChange={m.setMaxAgeHours}
              onBlur={(e) => {
                if (e.currentTarget.dataset.numberInvalid === 'true') return;
                void m.saveSettings({ mqtt_packet_log_max_age_hours: String(m.maxAgeHours) });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function MonitorPage({ sourceId, source }: { sourceId: string; source: DashboardSource }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const m = useMqttPacketMonitor(appBasename, sourceId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const selected = m.packets.find((p) => keyOf(p) === selectedKey) ?? null;
  const title = t('mqtt.packets.title', 'Packet Monitor');
  const capture = t(m.enabled ? 'workspace.packets.capture_on' : 'workspace.packets.capture_off');
  const count = m.total > m.packets.length ? `${m.packets.length} / ${m.total}` : String(m.packets.length);
  const pauseLabel = m.paused ? t('common.resume', 'Resume') : t('common.pause', 'Pause');
  const more = [t('mqtt.packets.to', 'To'), t('mqtt.packets.channel', 'Channel'), t('mqtt.packets.size', 'Size'), t('mqtt.packets.preview', 'Preview')];

  const captureButton = m.canWriteSettings && (
    <button type="button" className={styles.button} data-danger={m.enabled || undefined} disabled={m.savingSettings} onClick={() => void m.handleToggleEnabled()}>
      <UiIcon name={m.enabled ? 'statusOff' : 'statusOn'} size={16} />
      {m.enabled ? t('mqtt.packets.stopCapture', 'Stop capturing') : t('mqtt.packets.startCapture', 'Start capturing')}
    </button>
  );
  const banner = !m.enabled && !m.loading && (
    <div className={styles.banner}>
      <p>
        {t('mqtt.packets.disabled')} <span className={styles.muted}>{t('mqtt.packets.violationsStillRecorded')}</span>
      </p>
      {m.canWriteSettings && (
        <button type="button" className={styles.button} disabled={m.savingSettings} onClick={() => void m.handleToggleEnabled()}>
          {t('mqtt.packets.enable', 'Enable capture')}
        </button>
      )}
    </div>
  );
  const empty = m.loading ? (
    <p className={styles.state}>{t('common.loading', 'Loading…')}</p>
  ) : m.packets.length === 0 ? (
    <p className={styles.state}>{m.enabled ? t('mqtt.packets.empty') : t('mqtt.packets.emptyDisabled')}</p>
  ) : null;
  const detail = selected && <Detail m={m} packet={selected} onClose={() => setSelectedKey(null)} />;
  const confirm = (
    <ConfirmSheet
      open={clearOpen}
      title={t('common.clear', 'Clear')}
      body={t('mqtt.packets.clearConfirm')}
      confirmLabel={t('common.clear', 'Clear')}
      danger
      onCancel={() => setClearOpen(false)}
      onConfirm={async () => {
        await m.clearLog();
        setClearOpen(false);
      }}
    />
  );

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <header className={styles.phoneHead}>
          <Link to={`/source/${encodeURIComponent(sourceId)}`} className={styles.iconButton} aria-label={source.name}>
            <UiIcon name="back" size={22} />
          </Link>
          <span className={styles.phoneTitle}>
            <h1>{title}</h1>
            <span>{source.name} · {capture}</span>
          </span>
          <button type="button" className={styles.iconButton} aria-label={t('common.filters', 'Filters')} onClick={() => setFiltersOpen(true)}>
            <UiIcon name="filter" size={22} />
          </button>
          <button type="button" className={styles.iconButton} aria-label={pauseLabel} aria-pressed={m.paused} onClick={() => m.setPaused((p) => !p)}>
            <UiIcon name={m.paused ? 'play' : 'pause'} size={22} />
          </button>
        </header>
        <div className={styles.controls}>
          {captureButton}
          {m.canClear && (
            <button type="button" className={styles.button} onClick={() => setClearOpen(true)}>
              <UiIcon name="delete" size={16} />
              {t('common.clear', 'Clear')}
            </button>
          )}
        </div>
        <p className={styles.note}>{t('workspace.packets.capture_one')}</p>
        {banner}
        {m.error && <p className={styles.error}>{m.error}</p>}
        {empty}
        <ul className={styles.list}>
          {m.packets.map((p) => (
            <li key={keyOf(p)}>
              <button type="button" className={styles.row} data-testid="packet-row" onClick={() => setSelectedKey(keyOf(p))}>
                <span className={styles.rowMain}>
                  <strong>{m.renderFrom(p)}</strong>
                  <span className={styles.rowLine}>{typeText(p)}{p.payloadPreview ? ` · ${p.payloadPreview}` : ''}</span>
                </span>
                <span className={styles.rowSide}>{t('workspace.packets.rx_count', { count: p.receptionCount })}</span>
                <span className={styles.rowSide}>{clock(p.lastHeard).slice(0, 5)}</span>
              </button>
            </li>
          ))}
        </ul>
        {detail}
        <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters', 'Filters')}>
          <div className={styles.sheetBody}><Filters m={m} /></div>
        </Sheet>
        {confirm}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {source.name} · {capture} · {t('workspace.packets.one_row_per_packet')} · {count}
          </p>
          <p className={styles.subtitle}>{t('workspace.packets.capture_one')}</p>
        </div>
        {captureButton}
        <button type="button" className={styles.button} aria-pressed={m.paused} onClick={() => m.setPaused((p) => !p)}>
          <UiIcon name={m.paused ? 'play' : 'pause'} size={16} />
          {pauseLabel}
        </button>
        <button type="button" className={styles.button} aria-pressed={m.showFilters} onClick={() => m.setShowFilters((s: boolean) => !s)}>
          <UiIcon name="filter" size={16} />
          {t('common.filters', 'Filters')}
        </button>
        <button type="button" className={styles.button} onClick={() => { void m.load(); void m.loadGateways(); }}>
          <UiIcon name="refresh" size={16} />
          {t('common.refresh', 'Refresh')}
        </button>
        {m.canClear && (
          <button type="button" className={styles.button} onClick={() => setClearOpen(true)}>
            <UiIcon name="delete" size={16} />
            {t('common.clear', 'Clear')}
          </button>
        )}
      </header>
      {banner}
      {m.showFilters && <Filters m={m} />}
      {m.error && <p className={styles.error}>{m.error}</p>}
      <div className={styles.body} data-panel={selected ? '' : undefined}>
        <div className={styles.tableCol}>
          {empty}
          {m.packets.length > 0 && (
            <>
              <div className={styles.scroll} data-testid="mqtt-table-scroll">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('mqtt.packets.time', 'Time')}</th>
                      <th>{t('mqtt.packets.from', 'From')}</th>
                      <th>{t('mqtt.packets.type', 'Type')}</th>
                      <th title={m.selectedGateways.length ? t('mqtt.packets.gatewayCountFiltered') : undefined}>{t('mqtt.packets.gatewayCount', 'Gateways')}</th>
                      {more.map((label) => <th key={label}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {m.packets.map((p) => (
                      <tr
                        key={keyOf(p)}
                        className={styles.tableRow}
                        data-selected={selectedKey === keyOf(p) || undefined}
                        title={t('mqtt.packets.clickToView')}
                        onClick={() => setSelectedKey(keyOf(p))}
                      >
                        <td className={styles.mono}>{clock(p.lastHeard)}</td>
                        <td className={styles.strong}>{m.renderFrom(p)}</td>
                        <td>
                          {typeText(p)}
                          {okToMqttState(p) === 'violation' && <> <OkBadge state="violation" scope="packet" /></>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.countButton}
                            aria-label={`${p.receptionCount} ${t('mqtt.packets.receptions', 'Receptions')}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKey(keyOf(p));
                            }}
                          >
                            {p.gatewayCount}
                          </button>
                        </td>
                        <td>{m.renderTo(p)}</td>
                        <td>{p.channelId ?? (p.channel != null ? `#${p.channel}` : '—')}</td>
                        <td className={styles.mono}>{p.payloadSize ?? '—'}</td>
                        <td className={styles.preview}>{p.payloadPreview ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className={styles.cue}
                onClick={(e) => {
                  const el = e.currentTarget.previousElementSibling;
                  if (el) el.scrollLeft = el.scrollWidth;
                }}
              >
                {t('workspace.packets.more_columns', { count: more.length, names: more.join(', ') })}
                <UiIcon name="chevronRight" size={16} />
              </button>
            </>
          )}
        </div>
        {detail}
      </div>
      {confirm}
    </div>
  );
}

export default function MqttReceptions({ sourceId, source }: { sourceId: string; source: DashboardSource }) {
  const isPhone = useIsPhone();
  const { hasPermission, loading } = useAuth();
  if (loading) return <StateView kind="loading" page />;
  if (!hasPermission('packetmonitor', 'read', { sourceId })) {
    return (
      <div className={styles.page} data-phone={isPhone ? '' : undefined}>
        <StateView kind="noPermission" />
      </div>
    );
  }
  // This device's poll (node names) and socket, as App gives today's monitor.
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <MonitorPage sourceId={sourceId} source={source} />
      </WebSocketProvider>
    </SourceProvider>
  );
}
