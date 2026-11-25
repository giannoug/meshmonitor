/**
 * Test run (Task 8.4; m2): today's dry run (AutomationTester) on the kit.
 * It feeds a sample event (today's fields for the trigger, today's subject-
 * node facts, variable overrides and sample script outputs) to POST
 * /api/automations/test, which sends nothing on the mesh and saves nothing,
 * and lists what matched and what it would send. One request per press.
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';
import { UiIcon } from '../../components/icons';
import { BLOCK_BY_TYPE } from '../../components/automations/catalog';
import {
  KIND_BY_TRIGGER, MESHCORE_ROLE_OPTIONS, SYSTEM_EVENT_OPTIONS, TELEMETRY_METRIC_OPTIONS,
  buildTestEvent, buildTestNode, buildTestVars, leftHomeModeHint, leftHomeThresholdFromConfig, namedStepOutputs,
  type EventState, type SimResult,
} from '../../components/automations/automationTesterHelpers';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import { variablesQuery } from './rules';
import type { TestDraft } from './useTestDraft';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

type F = { key: string; label: string; type?: 'number' | 'check'; options?: Array<{ value: string; label: string }>; fact?: boolean };

/** Today's event inputs per trigger kind (AutomationTester's renderEventInputs), in its order. */
function eventFields(t: TFunction, kind: string, ev: EventState): F[] {
  const n = (key: string, label: string): F => ({ key, label, type: 'number' });
  switch (kind) {
    case 'message':
      return [{ key: 'text', label: t('workspace.automations.test.message_text') }, n('from', t('workspace.automations.test.from_node')), n('channel', t('workspace.automations.test.channel')), { key: 'channelName', label: t('workspace.automations.test.channel_name') },
        n('hopStart', t('workspace.automations.test.hop_start')), n('hopLimit', t('workspace.automations.test.hop_limit')), n('snr', t('node_popup.snr')), n('rssi', t('packet_monitor.column.rssi')), { key: 'viaMqtt', label: t('node_details.via_mqtt'), type: 'check' }];
    case 'telemetry':
      return [n('nodeNum', t('workspace.automations.test.node')), { key: 'telemetryType', label: t('telemetry_outliers.metric_label'), options: TELEMETRY_METRIC_OPTIONS }, n('value', t('common.value'))];
    case 'meshBeacon':
      return [n('nodeNum', t('workspace.automations.test.node')), { key: 'message', label: t('workspace.automations.test.beacon_text') }, { key: 'offerChannelName', label: t('workspace.automations.test.offered_channel_name') }, n('offerRegion', t('workspace.automations.test.offered_region_code')), n('offerPreset', t('workspace.automations.test.offered_modem_preset'))];
    case 'nodeUpdated':
    case 'nodeDiscovered':
      return [n('nodeNum', t('workspace.automations.test.node')), { key: 'changed', label: t('workspace.automations.test.changed_fields_csv') }, { key: 'publicKey', label: t('workspace.automations.test.meshcore_public_key') },
        ...(ev.publicKey ? [{ key: 'name', label: t('common.name') }, { key: 'advType', label: t('workspace.automations.test.role'), options: MESHCORE_ROLE_OPTIONS }, n('hops', t('workspace.automations.test.advert_hops')), n('routeHops', t('workspace.automations.test.stored_route_hops')), n('lastHeard', t('workspace.automations.test.last_heard_epoch_ms_sets_ageminutes'))] : [])];
    case 'system':
      return [{ key: 'event', label: t('workspace.automations.test.event'), options: SYSTEM_EVENT_OPTIONS }, { key: 'latestVersion', label: t('workspace.automations.test.latest_version') }, { key: 'currentVersion', label: t('workspace.automations.test.current_version') }];
    case 'geofence':
    case 'becameMobile':
      return [n('nodeNum', t('workspace.automations.test.node'))];
    case 'leftHome':
      return [n('nodeNum', t('workspace.automations.test.node')), n('homeLat', t('workspace.automations.test.home_lat')), n('homeLon', t('workspace.automations.test.home_lon')), { ...n('latitude', t('workspace.automations.test.current_lat')), fact: true }, { ...n('longitude', t('workspace.automations.test.current_lon')), fact: true }, n('distanceMeters', t('workspace.automations.test.distance_from_home_m'))];
    default:
      return [];
  }
}

const factFields = (t: TFunction): F[] => [
  ['batteryLevel', t('workspace.automations.test.battery')], ['voltage', t('nodes.voltage')], ['hopsAway', t('workspace.automations.test.hops_away')], ['role', t('workspace.automations.test.role')], ['channelUtilization', t('workspace.automations.test.channel_util')],
  ['airUtilTx', t('workspace.automations.test.air_util_tx')], ['snr', t('workspace.automations.test.snr_node')], ['altitude', t('workspace.automations.test.altitude')], ['longName', t('workspace.automations.test.long_name')], ['shortName', t('workspace.automations.test.short_name')],
  ['hwModel', t('workspace.automations.test.hw_model')], ['latitude', t('position_config.latitude')], ['longitude', t('position_config.longitude')],
].map(([key, label]) => ({ key, label, type: ['longName', t('workspace.automations.test.shortname')].includes(key) ? undefined : 'number' }) as F);

export interface RuleTestProps {
  /** The draft compiled to a graph, or why it cannot be. */
  getConfig(): { ok: boolean; config?: unknown; error?: string; triggerType?: string };
  draft: TestDraft;
  /** Opens Tokens (s14n4). */
  onTokens(): void;
}

export default function RuleTest({ getConfig, draft, onTokens }: RuleTestProps) {
  const { t } = useTranslation();
  const { sources } = useShellDevices();
  const isPhone = useIsPhone();
  const { data: vars = [] } = useQuery(variablesQuery);
  const cfg = getConfig();
  const kind = KIND_BY_TRIGGER[cfg.triggerType ?? ''] ?? 'message';
  const { ev, setEv, facts, setFacts, overrides, setOverrides, samples, setSamples, more, setMore, advanced, setAdvanced, result, setResult, error, setError, running, setRunning } = draft;
  const outputs = namedStepOutputs(cfg.config);
  const fields = eventFields(t, kind, ev);
  const [first, ...rest] = fields;

  const run = async () => {
    if (running) return;
    setError(null);
    setResult(null);
    if (!cfg.ok || !cfg.config) {
      setError(cfg.error ?? t('workspace.automations.test.fix_first'));
      return;
    }
    setRunning(true);
    try {
      setResult(await apiService.post<SimResult>('/api/automations/test', {
        config: cfg.config, event: buildTestEvent(kind, ev, facts), node: buildTestNode(facts), variables: buildTestVars(overrides),
        stepOutputs: Object.fromEntries(outputs.map((n) => [n, samples[n] ?? ''])),
      }));
    } catch (e) {
      const details = (e as { details?: unknown })?.details;
      setError(details ? JSON.stringify(details) : e instanceof Error && e.message ? e.message : t('workspace.automations.test.failed'));
    } finally {
      setRunning(false);
    }
  };

  const input = (f: F, value: string | undefined, set: (v: string) => void, label = f.label) => (
    <label key={f.key} className={f.type === 'check' ? own.checkRow : styles.field}>
      {f.type === 'check' ? (
        <>
          <input type="checkbox" checked={value === 'true'} onChange={(e) => set(e.target.checked ? 'true' : '')} />
          <span>{label}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          {f.options ? (
            <select className={styles.select} value={value || f.options[0].value} onChange={(e) => set(e.target.value)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input className={styles.input} inputMode={f.type === 'number' ? 'decimal' : undefined} value={value ?? ''} onChange={(e) => set(e.target.value)} />
          )}
        </>
      )}
    </label>
  );
  const evInput = (f: F, label?: string) => (f.fact
    ? input(f, facts[f.key], (v) => setFacts((s) => ({ ...s, [f.key]: v })), label)
    : input(f, ev[f.key], (v) => setEv((s) => ({ ...s, [f.key]: v })), label));

  const stepWord = (type: string) => (type.startsWith('condition.') ? t('workspace.rules.word.if') : t('workspace.rules.word.then'));
  return (
    <section className={`${styles.card} ${own.test}`} aria-label={t('workspace.rules.test.title')} data-phone={isPhone || undefined}>
      <div className={own.testHead}>
        <UiIcon name="test" size={18} />
        <h2 className={own.cardTitle}>{t('workspace.rules.test.title')}</h2>
        <span className={styles.muted}>{t('workspace.rules.test.nothing_sent')}</span>
      </div>
      <button type="button" className={own.linkButton} onClick={onTokens}>{t('workspace.rules.tokens')}</button>
      {sources.length > 0 && (
        <label className={styles.field}>
          <span>{t('workspace.rules.test.from_source')}</span>
          <select className={styles.select} value={ev.sourceId ?? ''} onChange={(e) => setEv((s) => ({ ...s, sourceId: e.target.value }))}>
            <option value="">{t('workspace.rules.test.default_source')}</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {first ? evInput(first, kind === 'message' ? t('workspace.rules.test.sample') : undefined) : <p className={styles.muted}>{t('workspace.rules.test.no_input')}</p>}
      {kind === 'leftHome' && <p className={styles.muted}>{leftHomeModeHint(ev, facts, leftHomeThresholdFromConfig(cfg.config))}</p>}
      {rest.length > 0 && (
        <>
          <button type="button" className={own.disclosure} aria-expanded={more} onClick={() => setMore((x) => !x)}>
            <UiIcon name={more ? 'chevronDown' : 'chevronRight'} size={14} />{t('workspace.rules.test.more')}
          </button>
          {more && <div className={own.testGrid}>{rest.map((f) => evInput(f))}</div>}
        </>
      )}
      {outputs.length > 0 && (
        <div className={own.testGrid}>
          <p className={styles.muted}>{t('workspace.rules.test.outputs_note')}</p>
          {outputs.map((n) => (
            <label key={n} className={styles.field}>
              <span>{n} <code>{`{{ steps.${n}.output }}`}</code></span>
              <textarea className={own.textarea} spellCheck={false} value={samples[n] ?? ''} onChange={(e) => setSamples((s) => ({ ...s, [n]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <button type="button" className={own.disclosure} aria-expanded={advanced} onClick={() => setAdvanced((x) => !x)}>
        <UiIcon name={advanced ? 'chevronDown' : 'chevronRight'} size={14} />{t('workspace.rules.test.advanced')}
      </button>
      {advanced && (
        <div className={own.testGrid}>
          {factFields(t).map((f) => input(f, facts[f.key], (v) => setFacts((s) => ({ ...s, [f.key]: v }))))}
          {vars.map((v) => input({ key: `var-${v.name}`, label: `${v.name} (${v.type})` }, overrides[v.name], (x) => setOverrides((s) => ({ ...s, [v.name]: x }))))}
        </div>
      )}

      {error && <p className={own.error} role="alert">{error}</p>}
      {result && (
        <div className={own.testResult}>
          <p className={own.check} data-ok={result.matched || undefined}>
            <UiIcon name={result.matched ? 'check' : 'close'} size={16} />
            {result.matched
              ? t('workspace.rules.test.when_matched', { status: result.status })
              : t('workspace.rules.test.filtered')}
          </p>
          {result.matched && result.steps.map((s, i) => (
            <p key={i} className={own.check} data-ok={s.outcome === 'condition:true' || s.outcome === 'action:ok' || undefined}>
              <UiIcon name={s.outcome === 'condition:false' || s.outcome.endsWith('error') ? 'close' : 'check'} size={16} />
              {stepWord(s.type)}: {BLOCK_BY_TYPE[s.type]?.label ?? s.type}{s.error ? ` — ${s.error}` : ''}
            </p>
          ))}
          {result.matched && result.actions.filter((a) => a.type === 'action.sendMessage' || a.type === 'action.tapback' || a.type === 'action.notify').map((a, i) => {
            const p = (a.resolvedParams ?? {}) as Record<string, unknown>;
            const where = p.destination != null ? t('workspace.rules.test.to_dm', { to: String(p.destination) }) : t('workspace.rules.test.to_channel', { channel: String(p.channel ?? 0) });
            const text = a.type === 'action.tapback' ? String(p.emoji ?? '') : a.type === 'action.notify' ? [p.title, p.body].filter(Boolean).join(' — ') : String(p.text ?? '');
            return (
              <div key={i}>
                <p className={styles.muted}>{a.type === 'action.notify' ? t('workspace.rules.test.would_notify') : t('workspace.rules.test.would_send', { where })}</p>
                <p className={own.sentBox}>{text}</p>
              </div>
            );
          })}
          {result.variableWrites.map((w, i) => <p key={`w${i}`} className={styles.muted}>{w.name}: {w.op}{w.value !== undefined ? ` = ${JSON.stringify(w.value)}` : ''}</p>)}
        </div>
      )}
      <button type="button" className={`${styles.button} ${result ? '' : styles.primary}`} disabled={running} aria-busy={running || undefined} onClick={() => void run()}>
        {result ? t('workspace.rules.test.again') : t('workspace.rules.test.run')}
      </button>
    </section>
  );
}
