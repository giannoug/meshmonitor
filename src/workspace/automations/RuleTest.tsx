/**
 * Test run (Task 8.4; m2): today's dry run (AutomationTester) on the kit.
 * It feeds a sample event (today's fields for the trigger, today's subject-
 * node facts, variable overrides and sample script outputs) to POST
 * /api/automations/test, which sends nothing on the mesh and saves nothing,
 * and lists what matched and what it would send. One request per press.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';
import { UiIcon } from '../../components/icons';
import { BLOCK_BY_TYPE } from '../../components/automations/catalog';
import {
  KIND_BY_TRIGGER, MESHCORE_ROLE_OPTIONS, SYSTEM_EVENT_OPTIONS, TELEMETRY_METRIC_OPTIONS,
  buildTestEvent, buildTestNode, buildTestVars, leftHomeModeHint, leftHomeThresholdFromConfig, namedStepOutputs,
  type EventState, type FactState, type SimResult,
} from '../../components/automations/automationTesterHelpers';
import { useShellDevices } from '../shell/shellDevices';
import { variablesQuery } from './rules';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

type F = { key: string; label: string; type?: 'number' | 'check'; options?: Array<{ value: string; label: string }>; fact?: boolean };

/** Today's event inputs per trigger kind (AutomationTester's renderEventInputs), in its order. */
function eventFields(kind: string, ev: EventState): F[] {
  const n = (key: string, label: string): F => ({ key, label, type: 'number' });
  switch (kind) {
    case 'message':
      return [{ key: 'text', label: 'Message text' }, n('from', 'From node #'), n('channel', 'Channel #'), { key: 'channelName', label: 'Channel name' },
        n('hopStart', 'Hop start'), n('hopLimit', 'Hop limit'), n('snr', 'SNR'), n('rssi', 'RSSI'), { key: 'viaMqtt', label: 'Via MQTT', type: 'check' }];
    case 'telemetry':
      return [n('nodeNum', 'Node #'), { key: 'telemetryType', label: 'Metric', options: TELEMETRY_METRIC_OPTIONS }, n('value', 'Value')];
    case 'meshBeacon':
      return [n('nodeNum', 'Node #'), { key: 'message', label: 'Beacon text' }, { key: 'offerChannelName', label: 'Offered channel name' }, n('offerRegion', 'Offered region code'), n('offerPreset', 'Offered modem preset')];
    case 'nodeUpdated':
    case 'nodeDiscovered':
      return [n('nodeNum', 'Node #'), { key: 'changed', label: 'Changed fields (csv)' }, { key: 'publicKey', label: 'MeshCore public key' },
        ...(ev.publicKey ? [{ key: 'name', label: 'Name' }, { key: 'advType', label: 'Role', options: MESHCORE_ROLE_OPTIONS }, n('hops', 'Advert hops'), n('routeHops', 'Stored route hops'), n('lastHeard', 'Last heard (epoch ms; sets ageMinutes)')] : [])];
    case 'system':
      return [{ key: 'event', label: 'Event', options: SYSTEM_EVENT_OPTIONS }, { key: 'latestVersion', label: 'Latest version' }, { key: 'currentVersion', label: 'Current version' }];
    case 'geofence':
    case 'becameMobile':
      return [n('nodeNum', 'Node #')];
    case 'leftHome':
      return [n('nodeNum', 'Node #'), n('homeLat', 'Home lat'), n('homeLon', 'Home lon'), { ...n('latitude', 'Current lat'), fact: true }, { ...n('longitude', 'Current lon'), fact: true }, n('distanceMeters', 'Distance from home (m)')];
    default:
      return [];
  }
}

const FACTS: F[] = [
  ['batteryLevel', 'Battery %'], ['voltage', 'Voltage'], ['hopsAway', 'Hops away'], ['role', 'Role (#)'], ['channelUtilization', 'Channel util %'],
  ['airUtilTx', 'Air util TX %'], ['snr', 'SNR (node)'], ['altitude', 'Altitude'], ['longName', 'Long name'], ['shortName', 'Short name'],
  ['hwModel', 'HW model (#)'], ['latitude', 'Latitude'], ['longitude', 'Longitude'],
].map(([key, label]) => ({ key, label, type: ['longName', 'shortName'].includes(key) ? undefined : 'number' }) as F);

export interface RuleTestProps {
  /** The draft compiled to a graph, or why it cannot be. */
  getConfig(): { ok: boolean; config?: unknown; error?: string; triggerType?: string };
}

export default function RuleTest({ getConfig }: RuleTestProps) {
  const { t } = useTranslation();
  const { sources } = useShellDevices();
  const { data: vars = [] } = useQuery(variablesQuery);
  const cfg = getConfig();
  const kind = KIND_BY_TRIGGER[cfg.triggerType ?? ''] ?? 'message';
  const [ev, setEv] = useState<EventState>({});
  const [facts, setFacts] = useState<FactState>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const outputs = namedStepOutputs(cfg.config);
  const fields = eventFields(kind, ev);
  const [first, ...rest] = fields;

  const run = async () => {
    if (running) return;
    setError(null);
    setResult(null);
    if (!cfg.ok || !cfg.config) {
      setError(cfg.error ?? 'Fix the workflow before testing.');
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
      setError(details ? JSON.stringify(details) : e instanceof Error && e.message ? e.message : 'Test failed');
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
    <section className={`${styles.card} ${own.test}`} aria-label={t('workspace.rules.test.title')}>
      <div className={own.testHead}>
        <UiIcon name="test" size={18} />
        <h2 className={own.cardTitle}>{t('workspace.rules.test.title')}</h2>
        <span className={styles.muted}>{t('workspace.rules.test.nothing_sent')}</span>
      </div>
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
          {FACTS.map((f) => input(f, facts[f.key], (v) => setFacts((s) => ({ ...s, [f.key]: v }))))}
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
