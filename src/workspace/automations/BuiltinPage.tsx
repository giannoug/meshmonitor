/**
 * One Meshtastic built-in's page (m3, n4, 14-06/14-12, 14-07/14-15,
 * 14-08/14-16; Task 8.3) at `/source/:id/automation/<built-in>`: MeshCore's
 * built-in page (Task 7.5) on the row kit with its own dock, over this
 * built-in's today's fields, plus the parts that act at once, as today:
 *
 * - Auto Acknowledge: Convert to rule (today's conversion, as a sheet),
 *   pattern testing, the response matrix, the template previews.
 * - Auto Announce: the live preview, the next and last announcement, Send now.
 * - Auto Responder, Timer Triggers, Geofence Triggers: their lists edit one
 *   item at a time in a sheet, with the live test, the script test, the map.
 * - Auto Ping's sessions, Auto Favorite's managed nodes, the logs, Auto
 *   Delete by Distance's Run now, the ignored nodes, Airtime cutoff's status.
 *
 * Saving sends this built-in's today's request once per press and never runs
 * it. Anything that transmits asks first (ConfirmSheet, Enter does nothing).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Cron } from 'croner';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import apiService from '../../services/api';
import { appBasename } from '../../init';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { useTxStatus } from '../../hooks/useTxStatus';
import type { DashboardSource } from '../../hooks/useDashboardData';
import GeofenceMapEditor from '../../components/GeofenceMapEditor';
import { AUTOACK_CELLS, type AutoAckCellId, type AutoAckMatrix } from '../../utils/autoAckMatrix';
import { autoAckSampleMessage } from '../../utils/autoAckSample';
import { HOP_COUNT_EMOJIS } from '../../utils/hopEmoji';
import { FORWARDED_MARKER, FORWARDING_MAX_PER_WINDOW, FORWARDING_MAX_TEXT_CHARS } from '../../types/forwarding';
import { matchAutoResponderTrigger, renderSampleResponse, finalizeTrigger } from '../../components/auto-responder/triggerModel';
import type { AutoResponderTrigger, GeofenceShape, GeofenceTrigger } from '../../components/auto-responder/types';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import SettingSegmented from '../settings/kit/SettingSegmented';
import { useIsPhone } from '../shell/useIsPhone';
import { BuiltinView, type BuiltinPartProps } from '../meshcore/automations/BuiltinPage';
import type { Field, Values } from '../meshcore/automations/builtins';
import type { MeshtasticBuiltin } from './builtins';
import { nodeName, type ApiNode } from './useBuiltins';
import kit from '../settings/kit/kit.module.css';
import styles from '../meshcore/McTools.module.css';
import mine from './DeviceAutomations.module.css';

interface Props {
  b: MeshtasticBuiltin;
  sourceId: string;
  source: DashboardSource;
  result: UseQueryResult<Values>;
  channels: Array<{ id: number; name: string }>;
  nodes: ApiNode[];
  localNodeNum: number | null;
  onSaved(values: Values): void;
  reload(): void;
}

const q = (sourceId: string) => `?sourceId=${encodeURIComponent(sourceId)}`;
const when = (ms: number | null | undefined, never: string) => (ms ? new Date(ms).toLocaleString() : never);

export default function BuiltinPage({ b, sourceId, source, result, channels, nodes, localNodeNum, onSaved, reload }: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  // Today's App gate for the automations that transmit: TX off, or an MQTT source (App.tsx txGated).
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId });
  const receiveOnly = isTxDisabled || source.type === 'mqtt_broker' || source.type === 'mqtt_bridge';
  const canWrite = hasPermission('automation', 'write', { sourceId });
  const base = `/source/${encodeURIComponent(sourceId)}/automation`;
  const ctx = { b, sourceId, channels, nodes, localNodeNum, reload, receiveOnly };

  // Lists get their own parts in the item sheet (tests, the map).
  const withItems: MeshtasticBuiltin = useMemo(() => ({
    ...b,
    fields: (v: Values) => b.fields(v).map((f): Field => {
      if (f.key === 'autoResponderTriggers') return { ...f, searchLabel: t('workspace.automations.search_triggers'), itemExtra: (item) => <ResponderTests item={item} /> };
      if (f.key === 'geofenceTriggers') return { ...f, itemExtra: (item, set) => <GeofenceParts item={item} set={set} nodes={nodes} /> };
      if (f.key === 'timerTriggers') return { ...f, itemExtra: (item) => <TimerTest item={item} /> };
      return f;
    }),
  }), [b, nodes, t]);

  return (
    <BuiltinView
      b={withItems}
      result={result}
      onSaved={onSaved}
      reload={reload}
      sourceId={sourceId}
      receiveOnly={receiveOnly}
      pausedNote={t('automation.receive_only_note', 'Paused: this source cannot transmit right now. These settings are saved and unchanged, and take effect again once it can.')}
      canWrite={canWrite}
      back={{ label: t('workspace.automations.builtins'), to: `${base}/builtins` }}
      subtitle={t('workspace.automations.builtin_subtitle', { device: source.name })}
      phoneSubtitle
      headActions={(p) => (b.enabledKey ? <HeadSwitch b={b} p={p} /> : null)}
      top={(p) => (b.id === 'auto-acknowledge' ? <ConvertBanner p={p} sourceId={sourceId} onConverted={reload} /> : null)}
      extra={(p) => <Extra {...ctx} p={p} />}
    />
  );
}

function HeadSwitch({ b, p }: { b: MeshtasticBuiltin; p: BuiltinPartProps }) {
  const { t } = useTranslation();
  const on = p.values[b.enabledKey!] === true;
  return (
    <label className={mine.headSwitch}>
      <input type="checkbox" role="switch" className={kit.switch} aria-label={b.title} checked={on} disabled={p.readOnly}
        onChange={(e) => p.set({ ...p.values, [b.enabledKey!]: e.target.checked })} />
      <span>{on ? t('workspace.meshcore.auto.on') : t('workspace.meshcore.auto.off')}</span>
    </label>
  );
}

type ExtraProps = {
  b: MeshtasticBuiltin;
  sourceId: string;
  channels: Array<{ id: number; name: string }>;
  nodes: ApiNode[];
  localNodeNum: number | null;
  reload(): void;
  receiveOnly: boolean;
  p: BuiltinPartProps;
};

function Extra(props: ExtraProps) {
  switch (props.b.id) {
    case 'auto-acknowledge': return <AckParts {...props} />;
    case 'auto-responder': return <ResponderScripts {...props} />;
    case 'auto-announce': return <AnnounceParts {...props} />;
    case 'auto-welcome': return <WelcomeParts {...props} />;
    case 'auto-ping': return <PingSessions {...props} />;
    case 'forwarding': return <ForwardingLimits />;
    case 'airtime-cutoff': return <AirtimeStatus {...props} />;
    case 'auto-favorite': return <FavoriteNodes {...props} />;
    case 'auto-key-management': return <LogCard {...props} path="key-repair-log" kind="key" />;
    case 'auto-heap-management': return <HeapStatus {...props} />;
    case 'auto-traceroute': return <LogCard {...props} path="traceroute-log" kind="traceroute" />;
    case 'remote-admin-scanner': return <ScanLog {...props} />;
    case 'auto-delete-by-distance': return <DistanceParts {...props} />;
    case 'ignored-nodes': return <IgnoredNodes {...props} />;
    default: return null;
  }
}

// ── Auto Acknowledge ─────────────────────────────────────────────────────────

const MATRIX_ROWS = (['zeroHop', 'multiHop', 'ip'] as const).flatMap((hop) =>
  (['channel', 'direct'] as const).map((type) => AUTOACK_CELLS.find((c) => c.hop === hop && c.type === type)!),
);

function AckParts({ p }: ExtraProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { dateFormat, timeFormat } = useSettings();
  const matrix = p.values.matrix as AutoAckMatrix;
  const regex = String(p.values.autoAckRegex ?? '');
  const tests = String(p.values.autoAckTestMessages ?? '').split('\n').filter((l) => l.trim());
  let re: RegExp | null = null;
  try {
    re = regex && regex.length <= 100 ? new RegExp(regex, 'i') : null;
  } catch {
    re = null;
  }
  // Today's updateCell: turning Message off also turns Respond via DM off.
  const setCell = (id: AutoAckCellId, field: 'reply' | 'tapback' | 'replyDm', value: boolean) => {
    const cell = { ...matrix[id], [field]: value };
    if (field === 'reply' && !value) cell.replyDm = false;
    p.set({ ...p.values, matrix: { ...matrix, [id]: cell } });
  };
  const pathLabel = (hop: string) => t(`workspace.automations.path.${hop}`);
  return (
    <>
      <section className={styles.section} aria-label={t('automation.auto_ack.pattern_testing')}>
        <h2 className={styles.sectionTitle}>{t('automation.auto_ack.pattern_testing')}</h2>
        <ul className={mine.tests}>
          {tests.map((line, i) => {
            const hit = !!re?.test(line);
            return (
              <li key={i} className={hit ? mine.hit : mine.miss}>
                <UiIcon name={hit ? 'check' : 'close'} size={14} /> {line}
              </li>
            );
          })}
        </ul>
      </section>
      <section className={styles.section} aria-label={t('automation.auto_ack.response_matrix')}>
        <h2 className={styles.sectionTitle}>{t('automation.auto_ack.response_matrix')}</h2>
        <div className={styles.tableWrap}>
          <table className={mine.matrix} data-phone={isPhone || undefined}>
            <thead>
              <tr>
                <th>{t('workspace.automations.message_col')}</th>
                <th>{t('workspace.automations.path_col')}</th>
                <th>{t('automation.auto_ack.matrix_tapback')}</th>
                <th>{t('automation.auto_ack.matrix_message')}</th>
                <th>{t('automation.auto_ack.matrix_respond_via_dm')}</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((c) => {
                const cell = matrix[c.id];
                const name = `${c.type === 'channel' ? t('workspace.automations.channel') : t('workspace.automations.direct')} · ${pathLabel(c.hop)}`;
                return (
                  <tr key={c.id}>
                    <th scope="row">{c.type === 'channel' ? t('workspace.automations.channel') : t('workspace.automations.direct')}</th>
                    <td>{pathLabel(c.hop)}</td>
                    <td><input type="checkbox" aria-label={`${name}: ${t('automation.auto_ack.matrix_tapback')}`} checked={cell.tapback} disabled={p.readOnly} onChange={(e) => setCell(c.id, 'tapback', e.target.checked)} /></td>
                    <td><input type="checkbox" aria-label={`${name}: ${t('automation.auto_ack.matrix_message')}`} checked={cell.reply} disabled={p.readOnly} onChange={(e) => setCell(c.id, 'reply', e.target.checked)} /></td>
                    <td>
                      {/* Direct replies are always DMs (today's matrix has no box there). */}
                      {c.type === 'channel' ? (
                        <input type="checkbox" aria-label={`${name}: ${t('automation.auto_ack.matrix_respond_via_dm')}`} checked={cell.replyDm} disabled={p.readOnly || !cell.reply}
                          onChange={(e) => setCell(c.id, 'replyDm', e.target.checked)} />
                      ) : (
                        <UiIcon name="check" size={16} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.muted}>{t('automation.auto_ack.direct_reply_always_dm')}. {t('workspace.automations.ip_note')}</p>
        <p className={styles.muted}>{t('workspace.automations.hop_emojis')} {HOP_COUNT_EMOJIS.join(' ')}</p>
      </section>
      <section className={styles.section} aria-label={t('workspace.automations.preview')}>
        <h2 className={styles.sectionTitle}>{t('workspace.automations.preview')}</h2>
        <p className={styles.quote}>{autoAckSampleMessage(String(p.values.autoAckMessage ?? ''), false, { dateFormat, timeFormat })}</p>
        <p className={styles.quote}>{autoAckSampleMessage(String(p.values.autoAckMessageDirect ?? ''), true, { dateFormat, timeFormat })}</p>
      </section>
    </>
  );
}

interface ConvertReport {
  converted: Array<{ key: string; label: string; detail: string }>;
  approximated: Array<{ key: string; label: string; detail: string }>;
  notConvertible: Array<{ key: string; label: string; detail: string }>;
  dropped: Array<{ key: string; label: string; detail: string }>;
}
interface ConvertPreview {
  autoAckEnabled: boolean;
  automations: Array<{ key: string; name: string; description: string; ruleSummaries?: string[] }>;
  report: ConvertReport;
  existing: Array<{ id: string | number; name: string }>;
  blocking: 'NO_CELLS_ENABLED' | 'CHANNEL_ALLOWLIST_UNCONVERTIBLE' | null;
}

/** "Can run as a rule" and today's conversion (AutoAckConvertDialog): preview on open, report, options, one create per press. */
function ConvertBanner({ p, sourceId, onConverted }: { p: BuiltinPartProps; sourceId: string; onConverted(): void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ConvertPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ created: Array<{ id: string | number; name: string }>; updated: Array<{ id: string | number; name: string }> } | null>(null);
  const [opts, setOpts] = useState({ enable: false, disableAutoAck: true, replaceExisting: false });
  const canConvert = p.canWrite && hasPermission('automations', 'write') && !p.dirty;
  const reason = p.dirty
    ? t('workspace.automations.convert_save_first')
    : !p.canWrite ? t('automation.auto_ack.convert_no_permission', 'You need write permission for automations on this source to convert.') : undefined;
  const start = async () => {
    setOpen(true);
    setPreview(null);
    setDone(null);
    setLoadError(null);
    try {
      const body = await apiService.post<{ data?: ConvertPreview }>('/api/automations/convert/preview', { sourceId });
      if (!body?.data) throw new Error(t('workspace.automations.convert_load_failed'));
      setPreview(body.data);
      setOpts({ enable: body.data.autoAckEnabled, disableAutoAck: true, replaceExisting: false });
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : t('workspace.automations.convert_load_failed'));
    }
  };
  const convert = async () => {
    setBusy(true);
    try {
      const body = await apiService.post<{ data?: { created: Array<{ id: string; name: string }>; updated: Array<{ id: string; name: string }>; autoAckDisabled: boolean } }>(
        '/api/automations/convert/create',
        { sourceId, enable: opts.enable, disableAutoAck: opts.disableAutoAck, replaceExisting: opts.replaceExisting },
      );
      setDone({ created: body?.data?.created ?? [], updated: body?.data?.updated ?? [] });
      showToast(t('workspace.automations.converted'), 'success');
      if (body?.data?.autoAckDisabled) onConverted();
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t('workspace.automations.convert_failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const groups: Array<[keyof ConvertReport, string]> = [
    ['converted', t('workspace.automations.report.converted')],
    ['approximated', t('workspace.automations.report.approximated')],
    ['notConvertible', t('workspace.automations.report.not_convertible')],
    ['dropped', t('workspace.automations.report.dropped')],
  ];
  return (
    <section className={mine.convert} aria-label={t('workspace.automations.convert')}>
      <UiIcon name="zap" size={18} />
      <p>{isPhone ? t('workspace.automations.convert_short') : t('workspace.automations.convert_banner')}</p>
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canConvert} title={reason} onClick={() => void start()}>
        {t('workspace.automations.convert')}
      </button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t('workspace.automations.convert_title')}
        footer={
          <div className={styles.footerButtons}>
            <button type="button" className={styles.button} disabled={busy} onClick={() => setOpen(false)}>{done ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}</button>
            {!done && (
              <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy || !preview || !!preview.blocking} onClick={() => void convert()}>
                {t('workspace.automations.convert')}
              </button>
            )}
          </div>
        }
      >
        <div className={styles.sheet}>
          {loadError && <p className={styles.error} role="alert">{loadError}</p>}
          {!preview && !loadError && <p className={styles.muted}>{t('common.loading', 'Loading…')}</p>}
          {preview?.blocking && <p className={styles.error} role="alert">{t(`workspace.automations.blocking.${preview.blocking}`)}</p>}
          {preview && !done && (
            <>
              {preview.automations.map((a) => (
                <section key={a.key} className={styles.section} aria-label={a.name}>
                  <h3 className={styles.sectionTitle}>{a.name}</h3>
                  {(a.ruleSummaries ?? []).map((r) => <p key={r} className={styles.muted}>{r}</p>)}
                </section>
              ))}
              {groups.map(([key, title]) => (preview.report[key]?.length ?? 0) > 0 || key === 'notConvertible' ? (
                <section key={key} className={styles.section} aria-label={title}>
                  <h3 className={styles.sectionTitle}>{title} ({preview.report[key]?.length ?? 0})</h3>
                  {(preview.report[key] ?? []).map((e) => <p key={e.key} className={styles.muted}><strong>{e.label}</strong> · {e.detail}</p>)}
                </section>
              ) : null)}
              <label className={mine.inline}><input type="checkbox" checked={opts.enable} onChange={(e) => setOpts({ ...opts, enable: e.target.checked })} /> {t('workspace.automations.convert_enable')}</label>
              <label className={mine.inline}><input type="checkbox" checked={opts.disableAutoAck} onChange={(e) => setOpts({ ...opts, disableAutoAck: e.target.checked })} /> {t('workspace.automations.convert_disable')}</label>
              {preview.existing.length > 0 && (
                <label className={mine.inline}><input type="checkbox" checked={opts.replaceExisting} onChange={(e) => setOpts({ ...opts, replaceExisting: e.target.checked })} />
                  {t('workspace.automations.convert_replace', { names: preview.existing.map((x) => x.name).join(', ') })}</label>
              )}
            </>
          )}
          {done && (
            <>
              <p>{t('workspace.automations.converted')}</p>
              {[...done.created, ...done.updated].map((a) => <p key={String(a.id)} className={styles.muted}>{a.name}</p>)}
              <Link className={styles.link} to="/overview/automations">{t('workspace.meshcore.auto.all_in_overview')}</Link>
            </>
          )}
        </div>
      </Sheet>
    </section>
  );
}

// ── Auto Announce ────────────────────────────────────────────────────────────

function AnnounceParts({ sourceId, p, receiveOnly, channels }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  // Today's live preview: the message, 500 ms after the last keystroke.
  const message = String(p.values.autoAnnounceMessage ?? '');
  const [debounced, setDebounced] = useState(message);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(message), 500);
    return () => clearTimeout(handle);
  }, [message]);
  const { data: preview } = useQuery({
    queryKey: ['workspace', 'automation', 'announce-preview', sourceId, debounced],
    enabled: debounced !== '',
    queryFn: async () => (await apiService.get<{ preview?: string }>(`/api/announce/preview?message=${encodeURIComponent(debounced)}&sourceId=${encodeURIComponent(sourceId)}`))?.preview ?? debounced,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: last } = useQuery({
    queryKey: ['workspace', 'automation', 'announce-last', sourceId],
    queryFn: async () => (await apiService.get<{ lastAnnouncementTime: number | null }>(`/api/announce/last${q(sourceId)}`))?.lastAnnouncementTime ?? null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const saved = p.saved;
  const next = (() => {
    if (saved.autoAnnounceEnabled !== true) return t('workspace.meshcore.auto.off');
    if (saved.autoAnnounceUseSchedule === true) {
      try {
        const at = new Cron(String(saved.autoAnnounceSchedule), { paused: true }).nextRun();
        return at ? at.toLocaleString() : '—';
      } catch {
        return '—';
      }
    }
    return t('workspace.automations.next_interval', { count: Number(saved.autoAnnounceIntervalHours ?? 6) });
  })();
  const count = Array.isArray(saved.autoAnnounceChannelIndexes) ? saved.autoAnnounceChannelIndexes.length : 0;
  const names = (Array.isArray(saved.autoAnnounceChannelIndexes) ? saved.autoAnnounceChannelIndexes as number[] : [])
    .map((i) => channels.find((c) => c.id === i)?.name ?? t('forwarding.channel_n', { index: i })).join(', ');
  const send = async () => {
    setBusy(true);
    try {
      const reply = await apiService.post<{ message?: string }>('/api/announce/send', { sourceId });
      showToast(reply?.message || t('automation.auto_announce.sent_success'), 'success');
      setSentAt(Date.now());
      setConfirm(false);
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t('automation.auto_announce.send_failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || p.values.autoAnnounceEnabled !== true || receiveOnly || !p.canWrite;
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('automation.auto_announce.sample_preview')}>
      <p className={styles.kvLabel}>{t('automation.auto_announce.sample_preview')}</p>
      <p className={styles.quote}>{preview || message || '—'}</p>
      <dl className={styles.kv}>
        <div className={styles.kvRow}><dt className={styles.kvLabel}>{t('workspace.automations.next_announcement')}</dt><dd className={styles.kvValue}>{next}</dd></div>
        <div className={styles.kvRow}>
          <dt className={styles.kvLabel}>{t('automation.auto_announce.last_announcement')}</dt>
          <dd className={styles.kvValue}>{when(sentAt ?? last, t('common.never', 'Never'))}</dd>
        </div>
      </dl>
      <p className={styles.muted}>{t('workspace.automations.announce_stored')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={disabled} title={receiveOnly ? t('tx_disabled.control_tooltip') : undefined} onClick={() => setConfirm(true)}>
          {busy ? t('automation.auto_announce.sending') : t('automation.auto_announce.send_now')}
        </button>
      </div>
      <SendsLine>{t('workspace.automations.send_now_sends', { count, channels: names })}</SendsLine>
      <ConfirmSheet
        open={confirm}
        title={t('automation.auto_announce.send_now')}
        body={
          <>
            <p className={styles.quote}>{preview || message}</p>
            <SendsLine>{t('workspace.automations.send_now_sends', { count, channels: names })}</SendsLine>
          </>
        }
        confirmLabel={t('automation.auto_announce.send_now')}
        busy={busy}
        submitOnEnter={false}
        onCancel={() => setConfirm(false)}
        onConfirm={send}
      />
    </section>
  );
}

// ── Lists: tests and the map ─────────────────────────────────────────────────

/** Today's script test (ScriptTestModal's request and results), inline in the item's sheet: one request per press, nothing sent. */
function ScriptTest({ triggerType, scriptPath, scriptArgs, extra }: { triggerType: 'auto-responder' | 'geofence' | 'timer'; scriptPath: string; scriptArgs?: string; extra: Values }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [message, setMessage] = useState('');
  const [shortName, setShortName] = useState('TEST');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ success: boolean; stdout?: string; stderr?: string; wouldSendMessages?: string[]; executionTimeMs?: number; error?: string } | null>(null);
  const run = async () => {
    setBusy(true);
    setResult(null);
    const body: Values = {
      script: scriptPath, triggerType, scriptArgs,
      mockNode: { nodeNum: 12345, shortName, longName: 'Test Node', lat: 37.7749, lon: -122.4194 },
      ...extra,
    };
    if (triggerType === 'auto-responder') body.testMessage = message;
    try {
      setResult(await apiService.post('/api/scripts/test', body));
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Failed to execute test' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.section} aria-label={t('script_test.title')}>
      <h3 className={styles.sectionTitle}>{t('script_test.title')} · {scriptPath.split('/').pop()}</h3>
      <div className={mine.inline} data-phone={isPhone || undefined}>
        {triggerType === 'auto-responder' && (
          <input aria-label={t('workspace.automations.test_message')} placeholder={t('workspace.automations.test_message')} value={message} onChange={(e) => setMessage(e.target.value)} />
        )}
        <input aria-label={t('workspace.automations.from_short_name')} value={shortName} onChange={(e) => setShortName(e.target.value)} />
        <button type="button" className={styles.button} disabled={busy} onClick={() => void run()}>
          <UiIcon name="play" size={14} /> {busy ? t('script_test.running') : t('script_test.run_test')}
        </button>
      </div>
      {result && (
        <>
          <p className={result.success ? mine.hit : mine.miss}>
            {result.success ? t('script_test.success') : result.error || t('script_test.error')}
            {typeof result.executionTimeMs === 'number' && ` · ${t('script_test.execution_time', { time: result.executionTimeMs })}`}
          </p>
          <p className={styles.kvLabel}>{t('script_test.console_output')}</p>
          <pre className={mine.console}>{[result.stdout, result.stderr].filter(Boolean).join('\n') || '—'}</pre>
          <p className={styles.kvLabel}>{t('script_test.would_send')}</p>
          {(result.wouldSendMessages ?? []).length > 0
            ? result.wouldSendMessages!.map((m, i) => <p key={i} className={styles.quote}>{m}</p>)
            : <p className={styles.muted}>{t('script_test.no_messages')}</p>}
          <p className={styles.muted}>{t('script_test.would_send_note')}</p>
        </>
      )}
    </section>
  );
}

/** The responder's live test (today's local match: nothing is sent) and, for a script, the script test. */
function ResponderTests({ item }: { item: Values }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [message, setMessage] = useState('');
  const [ran, setRan] = useState<string | null>(null);
  const tr = finalizeTrigger(item as unknown as AutoResponderTrigger);
  const match = ran !== null ? matchAutoResponderTrigger(tr, ran) : null;
  return (
    <>
      <section className={styles.section} aria-label={t('workspace.automations.live_test')}>
        <h3 className={styles.sectionTitle}>{t('workspace.automations.live_test')}</h3>
        <div className={mine.inline} data-phone={isPhone || undefined}>
          <input aria-label={t('workspace.automations.test_message')} placeholder={t('workspace.automations.test_message')} value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="button" className={styles.button} onClick={() => setRan(message)}>
            <UiIcon name="play" size={14} /> {t('workspace.automations.run')}
          </button>
        </div>
        {ran !== null && (
          match ? (
            <>
              <p className={mine.hit}>{t('workspace.automations.matched', { pattern: match.matchedPattern })}</p>
              {tr.responseType === 'script' ? (
                <p className={styles.muted}>{t('workspace.automations.would_send_script', { script: tr.response.split('/').pop() })}</p>
              ) : tr.responseType === 'text' || tr.responseType === 'http' ? (
                <>
                  <p className={styles.kvLabel}>{t('workspace.automations.would_send_not_now')}</p>
                  <p className={styles.quote}>{renderSampleResponse(tr, match.params)}</p>
                </>
              ) : null}
            </>
          ) : (
            <p className={mine.miss}>{t('workspace.automations.no_match')}</p>
          )
        )}
      </section>
      {tr.responseType === 'script' && tr.response && (
        <ScriptTest triggerType="auto-responder" scriptPath={tr.response} scriptArgs={tr.scriptArgs} extra={{ trigger: tr.trigger }} />
      )}
    </>
  );
}

/** The scripts the triggers run; managing them (import, export, delete, dependencies) stays in Server › Scripts (7.5 Ruling). */
function ResponderScripts({ p }: ExtraProps) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const used = [...new Set((Array.isArray(p.values.autoResponderTriggers) ? p.values.autoResponderTriggers as AutoResponderTrigger[] : [])
    .filter((tr) => tr.responseType === 'script' && tr.response).map((tr) => tr.response))];
  return (
    <section className={styles.section} aria-label={t('workspace.automations.scripts')}>
      <h2 className={styles.sectionTitle}>{t('workspace.automations.scripts_count', { count: used.length })}</h2>
      {used.length > 0 && <ul className={`${styles.card} ${mine.column}`}>{used.map((path) => <li key={path} className={`${styles.listRow} ${styles.mono}`}>{path.split('/').pop()}</li>)}</ul>}
      <p className={styles.muted}>{t('workspace.automations.scripts_test_hint')}</p>
      {authStatus?.user?.isAdmin && <Link className={styles.link} to="/server/scripts">{t('workspace.automations.scripts_manage')}</Link>}
    </section>
  );
}

function TimerTest({ item }: { item: Values }) {
  if (item.responseType === 'text' || !item.scriptPath) return null;
  return <ScriptTest triggerType="timer" scriptPath={String(item.scriptPath)} scriptArgs={item.scriptArgs as string | undefined}
    extra={{ timerName: item.name || 'Test Timer', timerId: item.id || 'test-id' }} />;
}

/** A geofence's shape on today's map editor, its nodes (all or a picked set) and, for a script, the test. */
function GeofenceParts({ item, set, nodes }: { item: Values; set(item: Values): void; nodes: ApiNode[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const g = item as unknown as GeofenceTrigger;
  const [shapeType, setShapeType] = useState<'circle' | 'polygon'>(g.shape?.type ?? 'circle');
  const [search, setSearch] = useState('');
  const positions = nodes
    .filter((nd) => typeof nd.position?.latitude === 'number' && typeof nd.position?.longitude === 'number')
    .map((nd) => ({ nodeNum: nd.nodeNum, lat: nd.position!.latitude!, lng: nd.position!.longitude!, longName: nodeName(nd) }));
  const selected = g.nodeFilter?.type === 'selected' ? g.nodeFilter.nodeNums : [];
  const term = search.trim().toLowerCase();
  return (
    <>
      <section className={styles.section} aria-label={t('workspace.automations.shape')}>
        <SettingSegmented label={t('workspace.automations.shape')} value={shapeType}
          options={[{ value: 'circle', label: t('workspace.automations.circle') }, { value: 'polygon', label: t('workspace.automations.polygon') }]}
          onChange={(v) => {
            setShapeType(v as 'circle' | 'polygon');
            // Today's editor starts a new shape when the type changes.
            if (g.shape && g.shape.type !== v) set({ ...item, shape: null });
          }} />
        <div className={mine.mapBox}>
          <GeofenceMapEditor shape={g.shape ?? null} shapeType={shapeType} nodePositions={positions} onShapeChange={(shape: GeofenceShape) => set({ ...item, shape })} />
        </div>
        <div className={mine.inline}>
          <span className={styles.muted}>
            {g.shape?.type === 'polygon' ? t('workspace.automations.vertices', { count: g.shape.vertices.length }) : g.shape?.type === 'circle' ? t('workspace.automations.circle_km', { km: g.shape.radiusKm }) : t('workspace.automations.no_shape')}
          </span>
          <button type="button" className={styles.button} disabled={!g.shape} onClick={() => set({ ...item, shape: null })}>
            <UiIcon name="close" size={14} /> {t('workspace.automations.clear_shape')}
          </button>
        </div>
      </section>
      <section className={styles.section} aria-label={t('workspace.automations.nodes')}>
        <SettingSegmented label={t('workspace.automations.nodes')} value={g.nodeFilter?.type ?? 'all'}
          options={[{ value: 'all', label: t('workspace.automations.all_nodes') }, { value: 'selected', label: t('workspace.automations.selected_nodes') }]}
          onChange={(v) => set({ ...item, nodeFilter: v === 'all' ? { type: 'all' } : { type: 'selected', nodeNums: selected } })} />
        {g.nodeFilter?.type === 'selected' && (
          <>
            <label className={mine.inline} data-phone={isPhone || undefined}>
              <span className={styles.srOnly}>{t('workspace.automations.search_nodes')}</span>
              <input type="search" placeholder={t('workspace.automations.search_nodes')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <div className={mine.nodeChecks} data-phone={isPhone || undefined}>
              {nodes.filter((nd) => !term || nodeName(nd).toLowerCase().includes(term)).map((nd) => (
                <label key={nd.nodeNum}>
                  <input type="checkbox" checked={selected.includes(nd.nodeNum)}
                    onChange={(e) => set({ ...item, nodeFilter: { type: 'selected', nodeNums: e.target.checked ? [...selected, nd.nodeNum] : selected.filter((x) => x !== nd.nodeNum) } })} />
                  {nodeName(nd)}
                </label>
              ))}
            </div>
          </>
        )}
      </section>
      {g.responseType === 'script' && g.scriptPath && (
        <ScriptTest triggerType="geofence" scriptPath={g.scriptPath} scriptArgs={g.scriptArgs}
          extra={{ geofenceName: g.name || 'Test Geofence', geofenceId: g.id || 'test-id', eventType: g.event, nodeLat: 37.7749, nodeLon: -122.4194 }} />
      )}
    </>
  );
}

// ── Act-at-once parts and logs ───────────────────────────────────────────────

function WelcomeParts({ sourceId, p }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const mark = async () => {
    setBusy(true);
    try {
      const reply = await apiService.post<{ markedCount?: number; count?: number }>(`/api/settings/mark-all-welcomed${q(sourceId)}`, {});
      showToast(t('automation.auto_welcome.marked_all_welcomed', { count: reply?.markedCount ?? reply?.count ?? 0 }), 'success');
    } catch {
      showToast(t('automation.auto_welcome.mark_welcomed_failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('automation.auto_welcome.mark_all_welcomed')}>
      <p className={styles.muted}>{t('automation.auto_welcome.mark_all_welcomed_tooltip')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={busy || !p.canWrite} onClick={() => void mark()}>
          {busy ? t('automation.auto_welcome.marking') : t('automation.auto_welcome.mark_all_welcomed')}
        </button>
      </div>
      <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
    </section>
  );
}

interface PingSession { nodeNum: number; requestedBy?: string; requestedByName?: string; totalPings: number; completedPings: number; successfulPings: number; failedPings: number; startTime: number }

function PingSessions({ sourceId, p, reload }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const sessions = (Array.isArray(p.saved.sessions) ? p.saved.sessions : []) as PingSession[];
  const stop = async (nodeNum: number) => {
    try {
      await apiService.post(`/api/auto-ping/stop/${nodeNum}`, { sourceId });
      showToast(t('automation.auto_ping.session_stopped', 'Ping session stopped'), 'success');
      reload();
    } catch {
      showToast(t('automation.auto_ping.stop_failed', 'Failed to stop ping session'), 'error');
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('automation.auto_ping.active_sessions', 'Active Sessions')}>
      <p className={styles.kvLabel}>{t('automation.auto_ping.dm_commands', 'DM Commands')}</p>
      <p className={styles.muted}><code>ping 5</code> {t('automation.auto_ping.dm_start_help')} · <code>ping stop</code> {t('automation.auto_ping.dm_stop_help')}</p>
      <p className={styles.kvLabel}>{t('automation.auto_ping.active_sessions', 'Active Sessions')}</p>
      {sessions.length === 0 ? <p className={styles.muted}>—</p> : sessions.map((s) => (
        <div key={s.nodeNum} className={styles.actions}>
          <span className={styles.headText}>
            {s.requestedByName || s.requestedBy || `!${s.nodeNum.toString(16)}`} · {s.completedPings}/{s.totalPings} · {t('automation.auto_ping.successful', 'Successful')} {s.successfulPings} · {t('automation.auto_ping.failed', 'Failed')} {s.failedPings}
          </span>
          <button type="button" className={styles.button} disabled={!p.canWrite} onClick={() => void stop(s.nodeNum)}>{t('common.stop', 'Stop')}</button>
        </div>
      ))}
    </section>
  );
}

function ForwardingLimits() {
  const { t } = useTranslation();
  return <p className={styles.note}>{t('forwarding.limits', { max: FORWARDING_MAX_PER_WINDOW, chars: FORWARDING_MAX_TEXT_CHARS, marker: FORWARDED_MARKER })}</p>;
}

/** Today's status line (AirtimeCutoffSection), re-read every 15 s while the page is open, as today. */
function AirtimeStatus({ sourceId }: ExtraProps) {
  const { t } = useTranslation();
  const { data: s } = useQuery({
    queryKey: ['workspace', 'automation', 'airtime-status', sourceId],
    queryFn: () => apiService.get<{ threshold: number; source: string; channelUtilization: number | null; gated: boolean; sampleCount: number }>(`/api/automation/airtime-status${q(sourceId)}`),
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
  if (!s) return null;
  const label = s.source === 'neighbors' ? t('automation.airtime_cutoff.source_neighbors_label', 'neighbour-averaged') : t('automation.airtime_cutoff.source_local_label', 'local');
  const util = s.channelUtilization == null ? null : parseFloat(s.channelUtilization.toFixed(2));
  return (
    <p className={styles.banner} role="status">
      <UiIcon name="info" size={16} />
      <span>
        {s.threshold <= 0
          ? t('automation.airtime_cutoff.status_disabled', 'Airtime cutoff is disabled (threshold 0).')
          : util == null
            ? t('automation.airtime_cutoff.status_unknown', 'Waiting for the connected node to report Channel Utilization…')
            : s.gated
              ? t('automation.airtime_cutoff.status_paused', { source: label, util, threshold: s.threshold })
              : t('automation.airtime_cutoff.status_active', { source: label, util, threshold: s.threshold })}
      </span>
    </p>
  );
}

interface FavStatus { firmwareVersion: string | null; supportsFavorites: boolean; autoFavoriteNodes: Array<{ nodeNum: number; nodeId: string; longName: string | null; shortName: string | null; favoriteLocked: boolean }> }

function FavoriteNodes({ sourceId, p }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['workspace', 'automation', 'favorite-status', sourceId],
    queryFn: () => apiService.get<FavStatus>(`/api/auto-favorite/status${q(sourceId)}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const lock = async (nodeId: string) => {
    try {
      await apiService.post(`/api/nodes/${nodeId}/favorite-lock`, { locked: true, sourceId });
      showToast(t('automation.auto_favorite.node_locked', 'Node locked from automation'), 'success');
      void refetch();
    } catch {
      showToast(t('automation.auto_favorite.lock_error', 'Failed to lock node'), 'error');
    }
  };
  const rows = data?.autoFavoriteNodes ?? [];
  return (
    <section className={styles.section} aria-label={t('automation.auto_favorite.managed_nodes', 'Auto-Favorited Nodes')}>
      <h2 className={styles.sectionTitle}>{t('automation.auto_favorite.managed_nodes', 'Auto-Favorited Nodes')}</h2>
      {data && !data.supportsFavorites && <p className={styles.note}>{t('automation.auto_favorite.firmware_warning', 'Firmware {{version}} does not support favorites (requires >= 2.7.0)', { version: data.firmwareVersion || 'unknown' })}</p>}
      {p.saved.aircraftDetectionEnabled === false && <p className={styles.muted}>{t('automation.auto_favorite.exclude_aircraft_hint', '')}</p>}
      {rows.length === 0 ? <p className={styles.muted}>{t('automation.auto_favorite.no_nodes', 'No nodes auto-favorited yet.')}</p> : (
        <ul className={`${styles.card} ${mine.column}`}>
          {rows.map((nd) => (
            <li key={nd.nodeNum} className={styles.listRow}>
              <span className={styles.rowTitle}>{nd.longName || nd.shortName || nd.nodeId}</span>
              <button type="button" className={styles.button} disabled={nd.favoriteLocked || !p.canWrite} title={t('automation.auto_favorite.lock_tooltip', 'Lock this node to prevent automation changes')}
                onClick={() => void lock(nd.nodeId)}>
                {nd.favoriteLocked ? t('automation.auto_favorite.already_locked', 'Already locked') : t('automation.auto_favorite.lock_header', 'Lock')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Today's heap readout: the node's latest heapFreeBytes in the last 24 h. */
function HeapStatus({ sourceId, localNodeNum }: ExtraProps) {
  const { t } = useTranslation();
  const nodeId = localNodeNum != null ? `!${localNodeNum.toString(16).padStart(8, '0')}` : null;
  const { data: kb } = useQuery({
    queryKey: ['workspace', 'automation', 'heap', sourceId, nodeId],
    enabled: !!nodeId,
    queryFn: async () => {
      const rows = await apiService.get<Array<{ telemetryType: string; timestamp: number; value: number }>>(
        `/api/telemetry/${encodeURIComponent(nodeId!)}?hours=24&sourceId=${encodeURIComponent(sourceId)}`,
      );
      const latest = (Array.isArray(rows) ? rows : []).filter((r) => r?.telemetryType === 'heapFreeBytes').sort((a, c) => c.timestamp - a.timestamp)[0];
      return latest ? Math.round(latest.value / 1000) : null;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  return kb == null ? null : <p className={styles.note}>{t('automation.auto_heap.heap_status', { kb })}</p>;
}

/** A built-in's activity log, re-read every 30 s as today (traceroute: only while it is on). */
function LogCard({ sourceId, p, path, kind }: ExtraProps & { path: string; kind: 'key' | 'traceroute' }) {
  const { t } = useTranslation();
  const on = kind === 'key' || p.saved.enabled === true;
  const { data: log = [] } = useQuery({
    queryKey: ['workspace', 'automation', path, sourceId],
    queryFn: async () => ((await apiService.get<{ log?: Values[] }>(`/api/settings/${path}${q(sourceId)}`))?.log ?? []),
    refetchInterval: on ? 30_000 : false,
    refetchOnWindowFocus: false,
  });
  const title = kind === 'key' ? t('automation.auto_key_management.activity_log') : t('workspace.automations.recent_traceroutes');
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {log.length === 0 ? <p className={styles.muted}>{t('automation.auto_key_management.no_activity')}</p> : (
        <ul className={`${styles.card} ${mine.column}`}>
          {log.slice(0, 20).map((e, i) => (
            <li key={String(e.id ?? i)} className={styles.listRow}>
              <span className={styles.rowTitle}>{String(e.nodeName ?? e.toNodeName ?? `!${Number(e.nodeNum ?? e.toNodeNum ?? 0).toString(16)}`)}</span>
              <span className={styles.rowSub}>
                {[when(Number(e.timestamp ?? 0), '—'), kind === 'key' && e.action ? t(`automation.auto_key_management.action_${String(e.action)}`, String(e.action)) : null,
                  e.success === true ? t('workspace.automations.log_ok') : e.success === false ? t('workspace.automations.log_failed') : t('workspace.automations.log_pending')].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Today's scan log and counts, from the nodes this page read once. */
function ScanLog({ nodes }: ExtraProps) {
  const { t } = useTranslation();
  const keyed = nodes.filter((nd) => (nd.user as { publicKey?: string } | undefined)?.publicKey);
  const checked = keyed.filter((nd) => nd.lastRemoteAdminCheck).sort((a, c) => Number(!!c.hasRemoteAdmin) - Number(!!a.hasRemoteAdmin) || (c.lastRemoteAdminCheck ?? 0) - (a.lastRemoteAdminCheck ?? 0));
  return (
    <section className={styles.section} aria-label={t('automation.remote_admin_scanner.recent_log')}>
      <p className={styles.muted}>
        {t('automation.remote_admin_scanner.nodes_with_admin')}: {keyed.filter((nd) => nd.hasRemoteAdmin).length} · {t('automation.remote_admin_scanner.nodes_checked')}: {checked.length} · {t('automation.remote_admin_scanner.eligible_nodes')}: {keyed.length}
      </p>
      <h2 className={styles.sectionTitle}>{t('automation.remote_admin_scanner.recent_log')}</h2>
      {checked.length === 0 ? <p className={styles.muted}>{t('automation.remote_admin_scanner.no_log_entries')}</p> : (
        <ul className={`${styles.card} ${mine.column}`}>
          {checked.slice(0, 20).map((nd) => (
            <li key={nd.nodeNum} className={styles.listRow}>
              <span className={styles.rowTitle}>{nodeName(nd)}</span>
              <span className={styles.rowSub}>
                {when(nd.lastRemoteAdminCheck, '—')} · {nd.hasRemoteAdmin ? t('automation.remote_admin_scanner.status_has_admin') : t('automation.remote_admin_scanner.status_no_admin')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DistanceParts({ sourceId, p, nodes, localNodeNum }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: log = [], refetch } = useQuery({
    queryKey: ['workspace', 'automation', 'distance-log', sourceId],
    queryFn: async () => {
      const rows = await apiService.get<unknown>(`/api/settings/distance-delete/log${q(sourceId)}`);
      return (Array.isArray(rows) ? rows : []) as Array<{ id?: number; timestamp: number; nodesDeleted: number; thresholdKm: number }>;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const local = nodes.find((nd) => nd.nodeNum === localNodeNum);
  const lat = local?.position?.latitude;
  const lon = local?.position?.longitude;
  const run = async () => {
    setBusy(true);
    try {
      const reply = await apiService.post<{ deletedCount?: number }>(`/api/settings/distance-delete/run-now${q(sourceId)}`);
      const count = reply?.deletedCount ?? 0;
      showToast(t('automation.distance_delete.run_result', { count }), count > 0 ? 'warning' : 'success');
      setConfirm(false);
      void refetch();
    } catch {
      showToast(t('automation.settings_save_failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('automation.distance_delete.run_now')}>
        {p.values.autoDeleteByDistanceLat == null && <p className={styles.note}>{t('automation.distance_delete.no_home_coordinate')}</p>}
        <p className={styles.muted}>{t('automation.distance_delete.protected_note')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} disabled={p.readOnly || typeof lat !== 'number' || typeof lon !== 'number'}
            onClick={() => p.set({ ...p.values, autoDeleteByDistanceLat: lat, autoDeleteByDistanceLon: lon })}>
            {t('automation.distance_delete.use_node_position')}
          </button>
          <button type="button" className={`${styles.button} ${styles.danger}`} disabled={busy || !p.canWrite || p.saved.autoDeleteByDistanceLat == null}
            onClick={() => setConfirm(true)}>
            {busy ? t('automation.distance_delete.running') : t('automation.distance_delete.run_now')}
          </button>
        </div>
        <SendsLine>{t('workspace.meshcore.auto.distance_run_sends')}</SendsLine>
      </section>
      <section className={styles.section} aria-label={t('automation.distance_delete.activity_log')}>
        <h2 className={styles.sectionTitle}>{t('automation.distance_delete.activity_log')}</h2>
        {log.length === 0 ? <p className={styles.muted}>{t('automation.distance_delete.no_log_entries')}</p> : (
          <ul className={`${styles.card} ${mine.column}`}>
            {log.slice(0, 20).map((e, i) => (
              <li key={e.id ?? i} className={styles.listRow}>
                <span className={styles.rowTitle}>{when(e.timestamp, '—')}</span>
                <span className={styles.rowSub}>{t('automation.distance_delete.nodes_deleted')}: {e.nodesDeleted} · {t('automation.distance_delete.threshold_used')}: {e.thresholdKm} km</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmSheet
        open={confirm}
        title={t('automation.distance_delete.run_now')}
        body={<p>{t('automation.distance_delete.description')}</p>}
        confirmLabel={t('automation.distance_delete.run_now')}
        danger
        busy={busy}
        submitOnEnter={false}
        onCancel={() => setConfirm(false)}
        onConfirm={run}
      />
    </>
  );
}

interface IgnoredRow { nodeNum: number; nodeId: string; longName?: string | null; shortName?: string | null; ignoredAt?: number; reason?: string; sourceId: string }

function IgnoredNodes({ p, reload }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const rows = (Array.isArray(p.saved.nodes) ? p.saved.nodes : []) as IgnoredRow[];
  const reason = (r?: string) =>
    r === 'geo' ? t('automation.ignored_nodes.reason_geo', 'Geo filter') : r === 'aircraft' ? t('automation.ignored_nodes.reason_aircraft', 'Aged-out aircraft') : t('automation.ignored_nodes.reason_manual', 'Manual');
  const remove = async (nd: IgnoredRow) => {
    setBusy(nd.nodeNum);
    try {
      // Today's: the row's own source.
      await apiService.delete(`/api/ignored-nodes/${nd.nodeId}?sourceId=${encodeURIComponent(nd.sourceId)}`);
      showToast(t('automation.ignored_nodes.removed', { name: nd.longName || nd.nodeId }), 'success');
      reload();
    } catch {
      showToast(t('automation.ignored_nodes.remove_failed'), 'error');
    } finally {
      setBusy(null);
    }
  };
  const content: ReactNode = rows.length === 0 ? <p className={styles.muted}>{t('automation.ignored_nodes.empty', 'No nodes are currently ignored.')}</p> : (
    <ul className={`${styles.card} ${mine.column}`}>
      {rows.map((nd) => (
        <li key={nd.nodeNum} className={styles.listRow}>
          <span className={styles.rowTitle}>{nd.longName || nd.shortName || nd.nodeId}</span>
          <span className={styles.rowSub}>{[nd.nodeId, reason(nd.reason), nd.ignoredAt ? when(nd.ignoredAt, '') : null].filter(Boolean).join(' · ')}</span>
          <button type="button" className={styles.button} disabled={busy !== null || !p.canWrite} onClick={() => void remove(nd)}>{t('automation.ignored_nodes.unignore', 'Un-ignore')}</button>
        </li>
      ))}
    </ul>
  );
  return (
    <section className={styles.section} aria-label={t('automation.ignored_nodes.title', 'Ignored Nodes')}>
      <p className={styles.muted}>{t('automation.ignored_nodes.description', '')}</p>
      {content}
    </section>
  );
}
