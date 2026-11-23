/**
 * A rule's steps (Task 8.4; m2, n2): today's builder form (WHEN → IF → THEN
 * per rule, an optional FINALLY) drawn as step cards. A card opens its step in
 * a sheet with today's fields (AutomationBuilder's BlockFields, the same
 * renderer TemplateGallery reuses) and its picker (WhenSheet). The LIMITS card
 * reads the trigger's cooldown and rate limit literally; "Add a limit" opens
 * the trigger's own Cooldown field and picks no value. Every change edits the
 * page's draft only; the page's Save sends it.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { BlockFields, defaultParams } from '../../components/automations/AutomationBuilder';
import { ACTIONS, BLOCK_BY_TYPE } from '../../components/automations/catalog';
import { blockNodeId, compile, formOutputNames, type BlockLocation, type CollapseMode, type FormBlock, type WorkflowForm } from '../../components/automations/compile';
import type { StepTokenScope } from '../../components/automations/tokenHints';
import { stepOutputScopes } from '../../types/automation';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { useShellDevices } from '../shell/shellDevices';
import { TRANSMITTING } from './engineRules';
import { isLimited, limitOf, sendsWhat, stepSummary, wouldSend } from './rules';
import { useBuilderData } from './useBuilderData';
import WhenSheet, { type PickerKind } from './WhenSheet';
import TokensSheet from './TokensSheet';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

type At = { kind: 'trigger' } | { kind: 'condition' | 'action'; rule: number; index: number } | { kind: 'finally'; index: number } | { kind: 'finallyMode' };

const NO_NAMES: ReadonlySet<string> = new Set<string>();

export interface RuleStepsProps {
  form: WorkflowForm;
  onChange(form: WorkflowForm): void;
  canWrite: boolean;
  /** Extra controls in the WHEN card (Reset homes from history on a Left-home rule, s14n4). */
  whenExtra?: ReactNode;
  /** A phone page opens "+ Step" from its dock: the page holds the picker's open state. */
  picker?: PickerKind | null;
  setPicker?(kind: PickerKind | null): void;
}

export default function RuleSteps({ form, onChange, canWrite, whenExtra, picker: outerPicker, setPicker: setOuterPicker }: RuleStepsProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sources: readable } = useShellDevices();
  const [at, setAt] = useState<At | null>(null);
  const [ownPicker, setOwnPicker] = useState<{ kind: PickerKind; replace: boolean } | null>(null);
  const [why, setWhy] = useState(false);
  const [tokens, setTokens] = useState(false);
  const picker = ownPicker ?? (outerPicker ? { kind: outerPicker, replace: false } : null);
  const closePicker = () => { setOwnPicker(null); setOuterPicker?.(null); };
  const data = useBuilderData(at !== null);
  const triggerType = form.trigger.type;
  const last = Math.max(0, form.rules.length - 1);

  // Which run outputs each block can read (#5636), as the builder works it out.
  const stepInfo = useMemo(() => {
    const names = formOutputNames(form);
    const all = new Set(names);
    const duplicates = new Set(names.filter((n, i) => names.indexOf(n) !== i));
    const scopes = stepOutputScopes(compile(form));
    const scopeAt = (loc: BlockLocation | null): StepTokenScope => {
      const scope = loc ? scopes.get(blockNodeId(form, loc)) : undefined;
      return { guaranteed: scope?.guaranteed ?? NO_NAMES, possible: scope?.possible ?? NO_NAMES, all };
    };
    return { duplicates, scopeAt };
  }, [form]);

  const blockAt = (a: At): FormBlock | null => {
    if (a.kind === 'trigger') return form.trigger;
    if (a.kind === 'finally') return form.combine?.actions[a.index] ?? null;
    if (a.kind === 'finallyMode') return null;
    const rule = form.rules[a.rule];
    return (a.kind === 'condition' ? rule?.conditions : rule?.actions)?.[a.index] ?? null;
  };
  const setBlock = (a: At, block: FormBlock | null) => {
    if (a.kind === 'trigger') {
      if (block) onChange({ ...form, trigger: block });
      return;
    }
    if (a.kind === 'finally') {
      if (!form.combine) return;
      const actions = [...form.combine.actions];
      if (block) actions[a.index] = block;
      else actions.splice(a.index, 1);
      onChange({ ...form, combine: { ...form.combine, actions } });
      return;
    }
    if (a.kind === 'finallyMode') return;
    const rules = form.rules.map((r, i) => {
      if (i !== a.rule) return r;
      const list = [...(a.kind === 'condition' ? r.conditions : r.actions)];
      if (block) list[a.index] = block;
      else list.splice(a.index, 1);
      return a.kind === 'condition' ? { ...r, conditions: list } : { ...r, actions: list };
    });
    onChange({ ...form, rules });
  };

  const onPick = (type: string) => {
    const p = picker;
    closePicker();
    if (!p) return;
    const block = { type, params: defaultParams(type, type.startsWith('trigger.') ? type : triggerType) };
    if (p.kind === 'when') {
      onChange({ ...form, trigger: block });
      setAt({ kind: 'trigger' });
      return;
    }
    if (p.replace && at && at.kind !== 'trigger' && at.kind !== 'finallyMode') {
      setBlock(at, block);
      return;
    }
    if (p.kind === 'then') {
      const combine = form.combine ?? { mode: 'ANY' as CollapseMode, actions: [] };
      onChange({ ...form, combine: { ...combine, actions: [...combine.actions, block] } });
      setAt({ kind: 'finally', index: combine.actions.length });
      return;
    }
    const isCondition = type.startsWith('condition.');
    const rules = form.rules.length ? [...form.rules] : [{ conditions: [], actions: [] }];
    const rule = rules[last];
    const index = (isCondition ? rule.conditions : rule.actions).length;
    rules[last] = isCondition ? { ...rule, conditions: [...rule.conditions, block] } : { ...rule, actions: [...rule.actions, block] };
    onChange({ ...form, rules });
    setAt({ kind: isCondition ? 'condition' : 'action', rule: last, index });
  };

  const addRule = () =>
    onChange({ ...form, rules: [...form.rules, { conditions: [], actions: [{ type: ACTIONS[0].type, params: defaultParams(ACTIONS[0].type, triggerType) }] }] });

  const summary = (b: FormBlock) => stepSummary(b, triggerType, t, readable);
  const card = (key: string, word: string, b: FormBlock, a: At, tone: string, extra?: ReactNode) => {
    const sends = TRANSMITTING.has(b.type) ? wouldSend({ version: 1, nodes: [{ id: 'x', type: b.type as never, params: b.params }], edges: [] }, t)[0] : null;
    return (
      <li key={key} className={own.step} data-tone={tone}>
        <button type="button" className={own.stepButton} onClick={() => setAt(a)} aria-label={`${word}: ${summary(b)}`}>
          <span className={own.stepWord}>{word}</span>
          <span className={own.stepText}>{summary(b)}</span>
          <UiIcon name="chevronRight" size={18} />
        </button>
        {sends && <div className={own.stepExtra}><SendsLine>{sends.type === 'action.runScript' ? t('workspace.rules.sends.script_only', { script: sends.script || '—' }) : t('workspace.rules.sends.sends', { what: sendsWhat(sends, t) })}</SendsLine></div>}
        {extra && <div className={own.stepExtra}>{extra}</div>}
      </li>
    );
  };

  const limit = limitOf({ id: 't', type: triggerType as never, params: form.trigger.params });
  const hasCooldownField = !!BLOCK_BY_TYPE[triggerType]?.fields.some((f) => f.name === 'cooldownSeconds');
  const limitsCard = isLimited(limit) ? (
    <li className={own.step} data-tone="limits">
      <button type="button" className={own.stepButton} onClick={() => setAt({ kind: 'trigger' })}>
        <span className={own.stepWord}>{t('workspace.rules.limits.word')}</span>
        <span className={own.stepText}>{[
          limit.cooldownSeconds > 0 && t('workspace.rules.limits.cooldown', { seconds: limit.cooldownSeconds }),
          limit.rateLimit && t('workspace.rules.limits.rate', { max: limit.rateLimit.maxActions, seconds: limit.rateLimit.windowSeconds }),
        ].filter(Boolean).join(' · ')}</span>
        <UiIcon name="chevronRight" size={18} />
      </button>
    </li>
  ) : (
    <li className={own.limits}>
      <span className={own.stepWord}>{t('workspace.rules.limits.word')}</span>
      <div className={own.limitsBody}>
        <p>{t('workspace.rules.limits.none')}</p>
        <div className={own.limitsButtons}>
          {hasCooldownField && <button type="button" className={own.limitButton} disabled={!canWrite} onClick={() => setAt({ kind: 'trigger' })}>{t('workspace.rules.limits.add')}</button>}
          {!isPhone && <button type="button" className={own.linkButton} aria-expanded={why} onClick={() => setWhy((x) => !x)}>{t('workspace.rules.limits.why')}</button>}
        </div>
        {!hasCooldownField && <p className={styles.muted}>{t('workspace.rules.limits.no_field')}</p>}
        {why && <p className={styles.muted}>{t('workspace.rules.limits.why_text')}</p>}
      </div>
    </li>
  );

  const ruleCards = form.rules.map((r, i) => {
    const multi = form.rules.length > 1 || !!form.combine;
    return (
      <li key={`rule${i}`} className={own.ruleGroup}>
        {multi && (
          <div className={own.ruleGroupHead}>
            <span className={styles.sectionTitle}>{t('workspace.rules.rule_n', { n: i + 1 })}</span>
            {form.rules.length > 1 && canWrite && (
              <button type="button" className={own.linkButton} onClick={() => onChange({ ...form, rules: form.rules.filter((_, j) => j !== i) })}>{t('workspace.rules.remove_rule')}</button>
            )}
          </div>
        )}
        <ol className={own.steps}>
          {r.conditions.map((c, k) => card(`c${k}`, t('workspace.rules.word.if'), c, { kind: 'condition', rule: i, index: k }, 'if'))}
          {r.actions.map((a, k) => card(`a${k}`, t('workspace.rules.word.then'), a, { kind: 'action', rule: i, index: k }, 'then'))}
        </ol>
      </li>
    );
  });

  const open = at ? blockAt(at) : null;
  const sheetTitle = at?.kind === 'finallyMode' ? t('workspace.rules.word.finally') : open ? BLOCK_BY_TYPE[open.type]?.label ?? open.type : '';
  const loc: BlockLocation | null = !at || at.kind === 'trigger' || at.kind === 'finallyMode' ? null
    : at.kind === 'finally' ? { section: 'finally', index: at.index } : { section: at.kind, rule: at.rule, index: at.index };

  return (
    <div className={own.stepsView} data-phone={isPhone || undefined}>
      <ol className={own.steps}>
        {card('when', t('workspace.rules.word.when'), form.trigger, { kind: 'trigger' }, 'when', whenExtra)}
        {ruleCards}
        {form.combine && (
          <li className={own.ruleGroup}>
            <ol className={own.steps}>
              <li className={own.step} data-tone="finally">
                <button type="button" className={own.stepButton} onClick={() => setAt({ kind: 'finallyMode' })}>
                  <span className={own.stepWord}>{t('workspace.rules.word.finally')}</span>
                  <span className={own.stepText}>{t(`workspace.rules.finally.${form.combine.mode}`)}</span>
                  <UiIcon name="chevronRight" size={18} />
                </button>
              </li>
              {form.combine.actions.map((a, k) => card(`f${k}`, t('workspace.rules.word.then'), a, { kind: 'finally', index: k }, 'then'))}
            </ol>
          </li>
        )}
        {limitsCard}
      </ol>
      {canWrite && (
        <div className={own.addRow}>
          {!isPhone && <button type="button" className={own.addButton} onClick={() => setOwnPicker({ kind: 'step', replace: false })}><UiIcon name="plus" size={16} />{t('workspace.rules.add_step')}</button>}
          <button type="button" className={own.addButton} onClick={() => setOwnPicker({ kind: 'then', replace: false })}><UiIcon name="plus" size={16} />{t('workspace.rules.finally_add')}</button>
          <button type="button" className={own.addButton} onClick={addRule}><UiIcon name="plus" size={16} />{t('workspace.rules.add_rule')}</button>
        </div>
      )}

      <Sheet open={!!at && !picker && !tokens && (!!open || at.kind === 'finallyMode')} onClose={() => setAt(null)} title={sheetTitle}>
        <div className={own.stepSheet} data-phone={isPhone || undefined}>
          {at?.kind === 'finallyMode' && form.combine ? (
            <>
              <label className={styles.field}>
                <span>{t('workspace.rules.finally.when')}</span>
                <select className={styles.select} value={form.combine.mode} disabled={!canWrite} onChange={(e) => onChange({ ...form, combine: { ...form.combine!, mode: e.target.value as CollapseMode } })}>
                  {(['ANY', 'ALL', 'NONE', 'ALWAYS'] as const).map((m) => <option key={m} value={m}>{t(`workspace.rules.finally.${m}`)}</option>)}
                </select>
              </label>
              <p className={styles.muted}>{t('workspace.rules.finally.matched')}</p>
              {canWrite && <button type="button" className={`${styles.button} ${own.dangerButton}`} onClick={() => { onChange({ ...form, combine: null }); setAt(null); }}>{t('workspace.rules.finally.remove')}</button>}
            </>
          ) : open && at ? (
            <>
              <p className={styles.muted}>{BLOCK_BY_TYPE[open.type]?.description}</p>
              {/* s14n4: today's substitutions help, replacing this sheet until it closes (D9c). */}
              <button type="button" className={own.linkButton} onClick={() => setTokens(true)}>{t('workspace.rules.tokens')}</button>
              <fieldset className={own.fields} disabled={!canWrite}>
                <BlockFields
                  block={open}
                  triggerType={triggerType}
                  variables={data.variables}
                  sources={data.sources}
                  channels={data.channels}
                  scripts={data.scripts}
                  regions={data.regions}
                  nodes={data.nodes}
                  automations={data.automations}
                  onParams={(params) => setBlock(at, { ...open, params })}
                  steps={stepInfo.scopeAt(loc)}
                  duplicateOutputNames={stepInfo.duplicates}
                />
              </fieldset>
              {canWrite && (
                <div className={own.sheetButtons}>
                  <button type="button" className={styles.button} onClick={() => setOwnPicker({ kind: at.kind === 'trigger' ? 'when' : at.kind === 'condition' ? 'if' : 'then', replace: true })}>
                    {t('workspace.rules.change_step')}
                  </button>
                  {at.kind !== 'trigger' && (
                    <button type="button" className={`${styles.button} ${own.dangerButton}`} onClick={() => { setBlock(at, null); setAt(null); }}>{t('workspace.rules.remove_step')}</button>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </Sheet>
      <TokensSheet open={tokens} onClose={() => setTokens(false)} triggerType={triggerType} variables={data.variables} stepNames={[...new Set(formOutputNames(form))]} />
      {/* One sheet at a time (D9c): the picker replaces the step sheet while it is open. */}
      <WhenSheet kind={picker?.kind ?? 'step'} open={!!picker} onClose={closePicker} onPick={onPick} />
    </div>
  );
}
