/**
 * One Automation Engine rule (Task 8.4; m2, m4, n2, 14-04, 14-13) at
 * `/automations/:ruleId[/runs|/trace]`, and a new one at `/automations/new`.
 *
 * - Header: ‹ Automations, the name with "No limit set" (s14n1), today's
 *   enable switch, Test (today's dry run), Run now (s14n2: moved from the
 *   editor to the header; a ConfirmSheet with today's words that lists what
 *   the SAVED rule would send per device, one request per press) and ⋯ (Name
 *   and description, Edit as JSON / steps, Export, Duplicate, Delete).
 * - Rule: the steps (RuleSteps) or today's Advanced (JSON) editor. A graph the
 *   steps view cannot draw opens as JSON, and a save sends the saved graph
 *   untouched unless the steps or the JSON were edited (GR).
 * - Runs (RunsTab) and Live trace (TraceTab).
 *
 * Edits stay in a draft; the dock's Save sends today's POST / PUT once, after
 * today's checks (validateForm, the empty-send question). Saving or enabling
 * reloads the engine (automationRoutes → engine.load()): it does not fire the
 * rule, the persisted cooldown / rate-limit state carries over (migration 219)
 * and a schedule keeps its cron times. Gates as today: automations:read to
 * open, automations:write to change or run.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../components/common/numberInputScopeContext';
import { compile, decompile, type WorkflowForm } from '../../components/automations/compile';
import { DEFAULT_FORM, emptySendLines, pretty, validateForm, type Automation } from '../../components/automations/automationsPageLogic';
import ConfirmSheet from '../patterns/ConfirmSheet';
import DeviceTag from '../patterns/DeviceTag';
import RowMenu from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { McDock } from '../meshcore/settings/mcShared';
import ToolHead from '../meshcore/ToolHead';
import { ENGINE, ruleUrl, rulesQuery } from './engineRules';
import { drawable, isLimited, limitOf, readGraph, runsQuery, triggerOf, variablesQuery, wouldSend } from './rules';
import { useRuleActions } from './ruleActions';
import RuleSteps from './RuleSteps';
import RuleTest from './RuleTest';
import { useTestDraft } from './useTestDraft';
import TokensSheet from './TokensSheet';
import { namedStepOutputs } from '../../components/automations/automationTesterHelpers';
import RunsTab from './RunsTab';
import TraceTab from './TraceTab';
import type { PickerKind } from './WhenSheet';
import kit from '../settings/kit/kit.module.css';
import styles from '../meshcore/McTools.module.css';
import badge from './DeviceAutomations.module.css';
import own from './Rules.module.css';

const NEW_RULE: Automation = { id: 'new', name: '', description: '', enabled: false, config: JSON.stringify(compile(DEFAULT_FORM)), createdAt: 0, updatedAt: 0 };

export default function RulePage() {
  const { t } = useTranslation();
  const { ruleId = '' } = useParams();
  const isPhone = useIsPhone();
  const { hasPermission, authStatus } = useAuth();
  const canRead = hasPermission('automations', 'read');
  const { data: rules, isLoading, isError } = useQuery({ ...rulesQuery, enabled: canRead && !!authStatus?.authenticated });
  const isNew = ruleId === 'new';
  const rule = isNew ? NEW_RULE : rules?.find((r) => r.id === ruleId);

  const fallback = (view: ReactNode) => (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <ToolHead title={t('workspace.meshcore.auto.title')} back={{ label: t('workspace.meshcore.auto.title'), to: ENGINE }} />
      {view}
    </div>
  );
  if (!canRead) return fallback(<StateView kind="noPermission" />);
  if (!rule) return fallback(isError ? <StateView kind="error" /> : isLoading ? <StateView kind="loading" /> : <StateView kind="notFound" />);
  return <Rule key={rule.id} rule={rule} isNew={isNew} />;
}

type Mode = 'steps' | 'json';

function Rule({ rule, isNew }: { rule: Automation; isNew: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { '*': splat = '' } = useParams();
  const tab = isNew ? '' : splat.split('/')[0];
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('automations', 'write');
  const actions = useRuleActions({ afterDelete: ENGINE });
  const numbers = useNumberInputScope();
  const base = ruleUrl(rule.id);
  const { data: runs } = useQuery({ ...runsQuery(rule.id), enabled: !isNew });

  // The saved rule, and the draft over it.
  const savedGraph = useMemo(() => readGraph(rule.config), [rule.config]);
  const [baseline, setBaseline] = useState({ name: rule.name, description: rule.description ?? '' });
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description ?? '');
  const [enabled, setEnabled] = useState(rule.enabled);
  const canDraw = drawable(savedGraph);
  const [mode, setMode] = useState<Mode>(canDraw ? 'steps' : 'json');
  const [form, setForm] = useState<WorkflowForm>(() => (canDraw ? decompile(savedGraph)! : DEFAULT_FORM));
  const [json, setJson] = useState(() => pretty(rule.config));
  const [configDirty, setConfigDirty] = useState(isNew);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [emptyAsk, setEmptyAsk] = useState<{ lines: string[]; config: unknown } | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const [runAsk, setRunAsk] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [homesBusy, setHomesBusy] = useState(false);
  const [homesMsg, setHomesMsg] = useState<string | null>(null);
  const [phonePicker, setPhonePicker] = useState<PickerKind | null>(null);
  const testDraft = useTestDraft();
  const [tokens, setTokens] = useState(false);
  const { data: vars = [] } = useQuery({ ...variablesQuery, enabled: tokens });

  const limited = isLimited(limitOf(triggerOf(savedGraph)));
  const changes = [
    ...(name !== baseline.name ? [t('workspace.rules.var.name')] : []),
    ...(description !== baseline.description ? [t('workspace.rules.description')] : []),
    ...(configDirty ? [t('workspace.rules.steps')] : []),
  ];
  const editForm = (f: WorkflowForm) => { setForm(f); setConfigDirty(true); };
  const discard = () => {
    setName(baseline.name);
    setDescription(baseline.description);
    setForm(canDraw ? decompile(savedGraph)! : DEFAULT_FORM);
    setJson(pretty(rule.config));
    setMode(canDraw ? 'steps' : 'json');
    setConfigDirty(isNew);
    setErrors([]);
    numbers.reset();
  };

  /** What a save would store; the saved graph untouched when neither the steps nor the JSON changed. */
  const draftConfig = (): { config?: unknown; errors?: string[] } => {
    if (!configDirty) return { config: savedGraph ?? JSON.parse(rule.config) };
    if (mode === 'steps') {
      const errs = validateForm(form);
      return errs.length ? { errors: errs } : { config: compile(form) };
    }
    try {
      return { config: JSON.parse(json) };
    } catch {
      return { errors: [t('workspace.rules.json_invalid')] };
    }
  };

  const send = async (config: unknown) => {
    setSaving(true);
    try {
      if (isNew) {
        const created = await apiService.post<Automation>('/api/automations', { name, description, enabled, config });
        await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });
        void navigate(ruleUrl(created.id), { replace: true });
        return;
      }
      await apiService.put(`/api/automations/${encodeURIComponent(rule.id)}`, { name, description, config });
      setBaseline({ name, description });
      setConfigDirty(false);
      await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });
    } catch (e) {
      const details = (e as { details?: unknown; body?: { details?: unknown } })?.details ?? (e as { body?: { details?: unknown } })?.body?.details;
      setErrors(Array.isArray(details) ? details.map(String) : [e instanceof Error && e.message ? e.message : t('workspace.rules.save_failed')]);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    // #5649: a half-typed number field holds text the form never received.
    if (saving || numbers.invalid) return;
    setErrors([]);
    const d = draftConfig();
    if (d.errors) {
      setErrors(d.errors);
      return;
    }
    // #5697: an empty message is allowed, but the save asks once (today's question).
    const lines = configDirty ? emptySendLines(d.config) : [];
    if (lines.length > 0) {
      setEmptyAsk({ lines, config: d.config });
      return;
    }
    void send(d.config);
  };

  const toJson = () => {
    setJson(JSON.stringify(configDirty && mode === 'steps' ? compile(form) : savedGraph ?? JSON.parse(rule.config), null, 2));
    setMode('json');
  };
  const toSteps = () => {
    try {
      const parsed = JSON.parse(json);
      const f = drawable(parsed) ? decompile(parsed) : null;
      if (!f) {
        setErrors([t('workspace.rules.too_advanced')]);
        return;
      }
      setForm(f);
      setErrors([]);
      setMode('steps');
    } catch {
      setErrors([t('workspace.rules.json_invalid')]);
    }
  };

  const getTestConfig = () => {
    try {
      const config = (mode === 'steps' ? compile(form) : JSON.parse(json)) as { nodes?: Array<{ type?: string }> };
      return { ok: true, config, triggerType: config.nodes?.find((n) => String(n.type).startsWith('trigger.'))?.type };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'invalid config' };
    }
  };

  /** Today's Run now: the SAVED rule, once per press, after the confirm. */
  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setRunMsg(null);
    try {
      const r = await apiService.runAutomationNow(rule.id);
      setRunAsk(false);
      if (r.ran) {
        const n = r.actions?.length ?? 0;
        setRunMsg(t('workspace.rules.run.fired', { status: r.status ?? 'completed', count: n }));
      } else {
        setRunMsg(t('workspace.rules.run.not_fired', { reason: r.detail ?? r.reason ?? 'unknown reason' }));
      }
      await queryClient.invalidateQueries({ queryKey: runsQuery(rule.id).queryKey });
    } finally {
      setRunning(false);
    }
  };

  /** Today's Reset homes from history: saves the steps first, then re-seeds (local; sends nothing on the mesh). */
  const resetHomes = async () => {
    if (homesBusy || numbers.invalid) return;
    setHomesBusy(true);
    setHomesMsg(null);
    try {
      if (mode === 'steps') {
        const errs = validateForm(form);
        if (errs.length) {
          setErrors(errs);
          return;
        }
        await apiService.put(`/api/automations/${encodeURIComponent(rule.id)}`, { name, description, enabled: rule.enabled, config: compile(form) });
        setBaseline({ name, description });
        setConfigDirty(false);
        await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });
      } else {
        // JSON mode saves first too (W12-a); an unparsable draft stops here.
        let config: unknown;
        try {
          config = JSON.parse(json);
        } catch {
          setErrors([t('workspace.rules.json_invalid')]);
          return;
        }
        await apiService.put(`/api/automations/${encodeURIComponent(rule.id)}`, { name, description, enabled: rule.enabled, config });
        setBaseline({ name, description });
        setConfigDirty(false);
        await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });
      }
      const res = await apiService.post<{ reset: number; seeded: number; results: Array<{ nodeNum: number; seeded: boolean }> }>(`/api/automations/${encodeURIComponent(rule.id)}/reset-homes`, {});
      const pending = (res.results ?? []).filter((r) => !r.seeded).map((r) => r.nodeNum);
      setHomesMsg(pending.length === 0
        ? t('workspace.rules.homes.done', { reset: res.reset, seeded: res.seeded })
        : t('workspace.rules.homes.pending', { reset: res.reset, seeded: res.seeded, nodes: pending.join(', ') }));
    } catch (e) {
      setHomesMsg(e instanceof Error ? e.message : t('workspace.rules.homes.failed'));
    } finally {
      setHomesBusy(false);
    }
  };

  // ── header ──
  const sends = wouldSend(savedGraph, t);
  const switchEl = (
    <label className={own.enabled}>
      <input
        type="checkbox"
        role="switch"
        className={kit.switch}
        aria-label={t('workspace.rules.enabled_label', { name: name || t('workspace.rules.new') })}
        checked={isNew ? enabled : rule.enabled}
        disabled={!canWrite || actions.busy !== null}
        onChange={() => (isNew ? setEnabled((x) => !x) : actions.toggle(rule))}
      />
      {!isPhone && <span>{(isNew ? enabled : rule.enabled) ? t('workspace.meshcore.auto.on') : t('workspace.meshcore.auto.off')}</span>}
    </label>
  );
  const menu = (
    <RowMenu
      label={t('workspace.rules.more_for', { name: rule.name || t('workspace.rules.new') })}
      items={[
        // Phone: + Step and Test stay reachable while the dock holds unsaved changes (the bottom dock gives way to it).
        ...(isPhone && tab === '' && canWrite && mode === 'steps' ? [{ key: 'step', label: t('workspace.rules.add_step'), icon: 'plus' as const, onSelect: () => setPhonePicker('step') }] : []),
        ...(isPhone && tab === '' && changes.length > 0 ? [{ key: 'test', label: t('workspace.rules.test.button'), icon: 'test' as const, disabled: !canWrite, onSelect: () => setTestOpen(true) }] : []),
        ...(isPhone && !isNew ? [{ key: 'run', label: t('workspace.rules.run.button'), icon: 'zap' as const, disabled: !canWrite, onSelect: () => setRunAsk(true) }] : []),
        { key: 'names', label: t('workspace.rules.names'), icon: 'edit' as const, onSelect: () => setNamesOpen(true) },
        mode === 'steps'
          ? { key: 'json', label: t('workspace.rules.edit_json'), icon: 'code' as const, onSelect: toJson }
          : { key: 'steps', label: t('workspace.rules.edit_steps'), icon: 'list' as const, onSelect: toSteps },
        ...(isNew ? [] : [
          { key: 'export', label: t('workspace.rules.export'), icon: 'copy' as const, onSelect: () => actions.exportRule(rule) },
          { key: 'duplicate', label: t('workspace.rules.duplicate'), icon: 'plus' as const, disabled: !canWrite, onSelect: () => actions.askDuplicate(rule) },
          { key: 'delete', label: t('workspace.rules.delete'), icon: 'delete' as const, danger: true, disabled: !canWrite, onSelect: () => actions.askDelete(rule) },
        ]),
      ]}
    />
  );
  const testButton = (
    <button type="button" className={styles.button} aria-pressed={testOpen} disabled={!canWrite} onClick={() => setTestOpen((x) => !x)}>
      <UiIcon name="test" size={16} />{t('workspace.rules.test.button')}
    </button>
  );
  const runButton = !isNew && (
    <button type="button" className={styles.button} disabled={!canWrite || running} onClick={() => setRunAsk(true)}>
      <UiIcon name="zap" size={16} />{t('workspace.rules.run.button')}
    </button>
  );
  const title = name || (isNew ? t('workspace.rules.new') : rule.name);
  const noLimit = !isNew && !limited && <span className={badge.warnBadge}>{t('workspace.automations.no_limit')}</span>;
  const tabs = !isNew && (
    <nav className={styles.tabs} aria-label={title}>
      <Link className={styles.tab} to={base} aria-current={tab === '' ? 'page' : undefined}>{t('workspace.rules.tab_rule')}</Link>
      <Link className={styles.tab} to={`${base}/runs`} aria-current={tab === 'runs' ? 'page' : undefined}>
        {runs ? t('workspace.rules.tab_runs', { count: runs.length }) : t('workspace.rules.runs')}
      </Link>
      <Link className={styles.tab} to={`${base}/trace`} aria-current={tab === 'trace' ? 'page' : undefined}>{t('workspace.rules.live_trace')}</Link>
    </nav>
  );

  // ── Rule tab ──
  // The same predicate in both modes; JSON mode reads the trigger from the parsed text (none when it does not parse).
  const homesTrigger = mode === 'steps' ? form.trigger.type : triggerOf(readGraph(json))?.type;
  const whenExtra = !isNew && homesTrigger === 'trigger.leftHome' && (
    <div className={own.whenExtra}>
      <button type="button" className={styles.button} disabled={!canWrite || homesBusy} onClick={() => void resetHomes()}>
        {homesBusy ? t('workspace.rules.homes.busy') : t('workspace.rules.homes.button')}
      </button>
      <span className={styles.muted}>{t('workspace.rules.homes.sends')}</span>
      {homesMsg && <p className={styles.muted} role="status">{homesMsg}</p>}
    </div>
  );
  const newNames = isNew && (
    <section className={`${styles.card} ${own.formCard}`} aria-label={t('workspace.rules.names')}>
      <div className={own.formGrid}>{nameFields()}</div>
    </section>
  );
  function nameFields() {
    return (
      <>
        <label className={styles.field}>
          <span>{t('workspace.rules.var.name')}</span>
          <input className={styles.input} value={name} placeholder="e.g. Ping responder" disabled={!canWrite} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('workspace.rules.description')}</span>
          <input className={styles.input} value={description} disabled={!canWrite} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </>
    );
  }
  const editor = mode === 'steps' ? (
    <NumberInputScope scope={numbers}>
      <RuleSteps form={form} onChange={editForm} canWrite={canWrite} whenExtra={whenExtra} picker={phonePicker} setPicker={setPhonePicker} />
    </NumberInputScope>
  ) : (
    <section className={own.column} aria-label={t('workspace.rules.edit_json')}>
      {!canDraw && <p className={styles.banner} role="note"><UiIcon name="info" size={16} /><span>{t('workspace.rules.json_only')}</span></p>}
      <label className={styles.field}>
        <span>{t('workspace.rules.json_label')}</span>
        <textarea className={`${own.textarea} ${own.code}`} spellCheck={false} value={json} disabled={!canWrite} onChange={(e) => { setJson(e.target.value); setConfigDirty(true); }} />
      </label>
      <button type="button" className={styles.button} onClick={toSteps}>{t('workspace.rules.edit_steps')}</button>
      {whenExtra}
    </section>
  );
  const ruleTab = (
    <div className={testOpen && !isPhone ? own.withTest : own.column}>
      <div className={own.column}>
        {newNames}
        {editor}
        {errors.length > 0 && <ul className={own.error} role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {mode === 'steps' && <p className={styles.note}><UiIcon name="code" size={16} /><span>{t('workspace.rules.json_hint')}</span></p>}
      </div>
      {testOpen && !isPhone && <RuleTest getConfig={getTestConfig} draft={testDraft} onTokens={() => setTokens(true)} />}
    </div>
  );

  const head = isPhone ? (
    <>
      <ToolHead title="" back={{ label: t('workspace.meshcore.auto.title'), to: ENGINE }} phoneActions={menu} />
      <div className={own.phoneTitle}>
        <h1 className={styles.title}>{title}</h1>
        {switchEl}
      </div>
      {noLimit && <p>{noLimit}</p>}
    </>
  ) : (
    <>
      <Link className={own.crumb} to={ENGINE}><UiIcon name="back" size={14} /> {t('workspace.meshcore.auto.title')}</Link>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title} {noLimit}</h1>
        </div>
        <div className={styles.actions}>{switchEl}{testButton}{runButton}{menu}</div>
      </header>
    </>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {head}
      {!isNew && <p className={styles.muted}>{t('workspace.rules.enable_effect')}</p>}
      {runMsg && <p className={styles.banner} role="status"><UiIcon name="zap" size={16} /><span>{runMsg}</span></p>}
      {tabs}
      {tab === 'runs' ? <RunsTab ruleId={rule.id} name={rule.name} limited={limited} />
        : tab === 'trace' ? <TraceTab ruleId={rule.id} enabled={rule.enabled} onClose={() => navigate(base)} />
          : ruleTab}

      {isPhone && tab === '' && changes.length === 0 && (
        <div className={own.phoneDock}>
          {canWrite && mode === 'steps' && <button type="button" className={styles.button} onClick={() => setPhonePicker('step')}><UiIcon name="plus" size={16} />{t('workspace.rules.step')}</button>}
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canWrite} onClick={() => setTestOpen(true)}><UiIcon name="test" size={16} />{t('workspace.rules.test.button')}</button>
        </div>
      )}
      <McDock
        changes={changes}
        page={title}
        sends={t('workspace.rules.save_effect')}
        saveLabel={isNew ? t('workspace.rules.create') : t('common.save', 'Save')}
        saving={saving}
        blocked={!canWrite || numbers.invalid}
        error={null}
        onSave={save}
        onDiscard={discard}
      />

      <Sheet open={testOpen && isPhone && !tokens} onClose={() => setTestOpen(false)} title={t('workspace.rules.test.title')}>
        <RuleTest getConfig={getTestConfig} draft={testDraft} onTokens={() => setTokens(true)} />
      </Sheet>
      {/* s14n4: Tokens from the Test run; on the phone it replaces the test sheet until it closes (D9c). */}
      <TokensSheet
        open={tokens}
        onClose={() => setTokens(false)}
        triggerType={getTestConfig().triggerType ?? ''}
        variables={vars}
        stepNames={tokens ? namedStepOutputs(getTestConfig().config) : []}
      />
      <Sheet
        open={namesOpen}
        onClose={() => setNamesOpen(false)}
        title={t('workspace.rules.names')}
        footer={<div className={own.sheetButtons}><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => setNamesOpen(false)}>{t('common.done', 'Done')}</button></div>}
      >
        <div className={own.fields}>{nameFields()}</div>
        <p className={styles.muted}>{t('workspace.rules.names_note')}</p>
      </Sheet>
      <ConfirmSheet
        open={!!emptyAsk}
        title={t('workspace.rules.empty.title')}
        body={<ul className={own.bullets}>{emptyAsk?.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
        confirmLabel={t('workspace.rules.empty.save')}
        submitOnEnter={false}
        onConfirm={() => { const c = emptyAsk!.config; setEmptyAsk(null); void send(c); }}
        onCancel={() => setEmptyAsk(null)}
      />
      <ConfirmSheet
        open={runAsk}
        title={t('workspace.rules.run.title')}
        body={
          <div className={own.column}>
            <p>{t('workspace.rules.run.what')}</p>
            <ul className={own.bullets}>
              <li>{t('workspace.rules.run.not_dry')}</li>
              <li>{t('workspace.rules.run.limits')}</li>
            </ul>
            {changes.length > 0 && <p className={styles.muted}>{t('workspace.rules.run.unsaved')}</p>}
            <p><strong>{sends.length ? t('workspace.rules.run.would_send') : t('workspace.rules.run.sends_nothing')}</strong></p>
            {sends.map((s, i) => (
              <div key={i} className={own.would}>
                <p className={own.wouldHead}>
                  {s.sourceIds.length ? s.sourceIds.map((id) => <DeviceTag key={id} sourceId={id} />) : <span className={styles.muted}>{t('workspace.rules.run.no_source')}</span>}
                  <span>{s.label} · {s.where}</span>
                </p>
                {s.text && <p className={own.sentBox}>{s.text}</p>}
              </div>
            ))}
            <SendsLine>{sends.length ? (sends.some((s) => s.sourceIds.length) ? t('workspace.rules.run.sends', { count: sends.reduce((n, s) => n + s.sourceIds.length, 0) }) : t('workspace.rules.run.no_source')) : t('workspace.settings.savebar.sends_nothing')}</SendsLine>
          </div>
        }
        confirmLabel={t('workspace.rules.run.button')}
        busy={running}
        submitOnEnter={false}
        onConfirm={runNow}
        onCancel={() => setRunAsk(false)}
      />
      {actions.sheets}
    </div>
  );
}
