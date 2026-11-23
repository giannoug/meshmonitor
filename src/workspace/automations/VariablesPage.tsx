/**
 * Overview › Automations › Variables (Task 8.4; 14-02, 14-10): today's new-
 * variable form (name, type, scope, default, flag auto-clear, constant), the
 * list with Delete (asks first and names the variable, as today; s14n3), and
 * the types & scopes help (a right panel on desktop, a sheet on the phone).
 * Values are set by rules; there is no value editor, as today. Variables are
 * global (CLAUDE.md exception 3). Create and Delete need automations:write.
 */
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { UiIcon } from '../../components/icons';
import {
  VARIABLE_NAME_ERROR, VARIABLE_TYPES, isVariableName, variableConfig, type Automation, type Variable,
} from '../../components/automations/automationsPageLogic';
import ConfirmSheet from '../patterns/ConfirmSheet';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { variablesQuery } from './rules';
import kit from '../settings/kit/kit.module.css';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

const SCOPES: Variable['scope'][] = ['global', 'source', 'node', 'sourceNode'];

function configLine(v: Variable, t: TFunction): string {
  let c: { defaultValue?: unknown; flagDurationSeconds?: unknown };
  try {
    c = JSON.parse(v.config || '{}');
  } catch {
    return v.config;
  }
  if (c.flagDurationSeconds !== undefined) return t('workspace.rules.var.auto_clears', { seconds: c.flagDurationSeconds });
  return c.defaultValue !== undefined && c.defaultValue !== '' ? t('workspace.rules.var.default', { value: String(c.defaultValue) }) : t('workspace.rules.var.default_empty');
}

export default function VariablesPage({ canWrite, rules }: { canWrite: boolean; rules: Automation[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const { data: items, isLoading, isError } = useQuery(variablesQuery);
  const [name, setName] = useState('');
  const [type, setType] = useState<Variable['type']>('integer');
  const [scope, setScope] = useState<Variable['scope']>('global');
  const [readonly, setReadonly] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [flagDuration, setFlagDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [del, setDel] = useState<Variable | null>(null);
  const reload = () => queryClient.invalidateQueries({ queryKey: variablesQuery.queryKey });
  const scopeLabel = (s: Variable['scope']) => t(`workspace.rules.scope.${s}`);

  const create = async () => {
    if (busy) return;
    setError(null);
    if (!isVariableName(name)) {
      setError(VARIABLE_NAME_ERROR);
      return;
    }
    setBusy(true);
    try {
      await apiService.post('/api/automations/variables', { name, type, scope, readonly, config: variableConfig(type, defaultValue, flagDuration) });
      setName('');
      setDefaultValue('');
      setFlagDuration('');
      await reload();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!del) return;
    await apiService.delete(`/api/automations/variables/${encodeURIComponent(del.id)}`);
    await reload();
    setDel(null);
  };

  const helpBody = (
    <div className={own.help}>
      <h3 className={styles.sectionTitle}>{t('workspace.rules.var.types')}</h3>
      <dl>
        {(['string', 'integer', 'float', 'boolean', 'flag', 'json'] as const).map((k) => (
          <div key={k}><dt className={styles.mono}>{k}</dt><dd>{t(`workspace.rules.var.type_${k}`)}</dd></div>
        ))}
      </dl>
      <h3 className={styles.sectionTitle}>{t('workspace.rules.var.scopes')}</h3>
      <dl>
        {SCOPES.map((s) => <div key={s}><dt className={styles.mono}>{scopeLabel(s)}</dt><dd>{t(`workspace.rules.var.scope_${s}`)}</dd></div>)}
      </dl>
      <p className={styles.muted}>{t('workspace.rules.var.node_scoped')}</p>
      <h3 className={styles.sectionTitle}>{t('workspace.rules.var.constant')}</h3>
      <p className={styles.muted}>{t('workspace.rules.var.constant_help')}</p>
    </div>
  );
  const helpButton = (label: string) => (
    <button type="button" className={own.linkButton} onClick={() => setHelp(true)}>{label}</button>
  );

  const form = (
    <section className={`${styles.card} ${own.formCard}`} aria-label={t('workspace.rules.var.new')} data-phone={isPhone || undefined}>
      <div className={own.formHead}>
        <h2 className={own.cardTitle}>{t('workspace.rules.var.new')}</h2>
        {helpButton(isPhone ? t('workspace.rules.var.help_short') : t('workspace.rules.var.help'))}
      </div>
      <div className={own.formGrid}>
        <label className={styles.field}>
          <span>{t('workspace.rules.var.name')}</span>
          <input className={`${styles.input} ${styles.mono}`} value={name} placeholder="e.g. lowBatteryThreshold" disabled={!canWrite} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('workspace.rules.var.type')}</span>
          <select className={styles.select} value={type} disabled={!canWrite} onChange={(e) => setType(e.target.value as Variable['type'])}>
            {VARIABLE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('workspace.rules.var.scope')}</span>
          <select className={styles.select} value={scope} disabled={!canWrite} onChange={(e) => setScope(e.target.value as Variable['scope'])}>
            {SCOPES.map((s) => <option key={s} value={s}>{scopeLabel(s)}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>{readonly ? t('workspace.rules.var.default_constant') : t('workspace.rules.var.default_value')}</span>
          <input className={`${styles.input} ${styles.mono}`} value={defaultValue} disabled={!canWrite} onChange={(e) => setDefaultValue(e.target.value)} />
        </label>
        {type === 'flag' && (
          <label className={styles.field}>
            <span>{t('workspace.rules.var.flag_clear')}</span>
            <input className={`${styles.input} ${styles.mono}`} inputMode="numeric" value={flagDuration} placeholder="e.g. 86400" disabled={!canWrite} onChange={(e) => setFlagDuration(e.target.value)} />
            <span className={styles.muted}>{t('workspace.rules.var.flag_note')}</span>
          </label>
        )}
        <label className={own.checkRow}>
          <input type="checkbox" role="switch" className={kit.switch} checked={readonly} disabled={!canWrite} onChange={(e) => setReadonly(e.target.checked)} />
          <span>{t('workspace.rules.var.constant')}<span className={styles.muted}> {t('workspace.rules.var.constant_note')}</span></span>
        </label>
      </div>
      {error && <p className={own.error} role="alert">{error}</p>}
      <div className={own.formFoot}>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canWrite || !name || busy} aria-busy={busy || undefined} onClick={() => void create()}>
          <UiIcon name="plus" size={16} />
          {t('workspace.rules.var.create')}
        </button>
      </div>
    </section>
  );

  const list = isError ? <StateView kind="error" /> : isLoading || !items ? <StateView kind="loading" /> : (
    <section className={styles.section} aria-label={t('workspace.rules.variables')}>
      <h2 className={styles.sectionTitle}>{t('workspace.rules.var.list', { count: items.length })}</h2>
      {items.length === 0 ? <p className={styles.note}>{t('workspace.rules.var.none')}</p> : (
        <ul className={`${styles.card} ${own.list}`}>
          {items.map((v) => {
            const users = rules.filter((r) => r.config.includes(`var.${v.name}`)).map((r) => r.name);
            return (
              <li key={v.id} className={own.varRow} data-phone={isPhone || undefined}>
                <div className={own.ruleText}>
                  <p className={own.ruleTitle}>
                    <span className={`${own.ruleName} ${styles.mono}`}>{v.name}</span>
                    <span className={own.chip}>{[v.type, scopeLabel(v.scope), v.readonly ? t('workspace.rules.var.constant_chip') : ''].filter(Boolean).join(' · ')}</span>
                  </p>
                  <p className={own.ruleSub}>{[configLine(v, t), users.length ? t('workspace.rules.var.read_by', { names: users.join(', ') }) : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className={`${styles.button} ${own.dangerButton}`} disabled={!canWrite} onClick={() => setDel(v)}>{t('common.delete')}</button>
              </li>
            );
          })}
        </ul>
      )}
      {!isPhone && (
        <p className={styles.note}>
          <UiIcon name="info" size={16} />
          <span>{t('workspace.rules.var.note')}</span>
        </p>
      )}
    </section>
  );

  return (
    <div className={help && !isPhone ? own.withPanel : own.column}>
      <div className={own.column}>
        {form}
        {list}
      </div>
      {help && !isPhone && (
        <aside className={styles.panel} aria-label={t('workspace.rules.var.help')}>
          <div className={styles.panelHead}>
            <UiIcon name="help" size={18} />
            <h2 className={styles.panelTitle}>{t('workspace.rules.var.help')}</h2>
            <button type="button" className={styles.iconButton} aria-label={t('common.close')} onClick={() => setHelp(false)}><UiIcon name="close" size={16} /></button>
          </div>
          <div className={own.panelBody}>{helpBody}</div>
        </aside>
      )}
      <Sheet open={help && isPhone} onClose={() => setHelp(false)} title={t('workspace.rules.var.help')}>{helpBody}</Sheet>
      <ConfirmSheet
        open={!!del}
        danger
        title={t('workspace.rules.var.delete_title', { name: del?.name ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </div>
  );
}
