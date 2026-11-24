/**
 * A rule's Runs tab (Task 8.4; m4, 14-13): today's run log (RunLog, GET
 * /api/automations/:id/runs, read once per visit) as a table on desktop and
 * rows on the phone. A run opens to show its steps and today's trigger
 * payload. Its result is read from today's stored status and steps: Failed,
 * Skipped (no action ran, e.g. IF not met), Sent (an action that transmits
 * ran) or Done. Export downloads the runs shown as JSON (no request).
 */
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { BLOCK_BY_TYPE } from '../../components/automations/catalog';
import { parseJsonColumn, summarizeTriggerEvent } from '../../components/automations/eventSummary';
import { pretty } from '../../components/automations/automationsPageLogic';
import type { TraceStep } from '../../components/automations/outcomeMeta';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { runKind, runsQuery, type RunKind } from './rules';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** One step of a run or a trace: the keyword, what ran, and how it went. */
export function StepLines({ steps }: { steps: TraceStep[] }) {
  const { t } = useTranslation();
  return (
    <dl className={own.stepLines}>
      {steps.map((s, i) => {
        const word = String(s.type).startsWith('condition.') ? t('workspace.rules.word.if') : String(s.type).startsWith('trigger.') ? t('workspace.rules.word.when') : t('workspace.rules.word.then');
        const detail = s.error ?? (s.detail ? (typeof s.detail.reason === 'string' ? s.detail.reason : Object.entries(s.detail).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ')) : '');
        return (
          <Fragment key={i}>
            <dt>{word}</dt>
            <dd data-outcome={s.outcome}>
              {BLOCK_BY_TYPE[s.type]?.label ?? s.type} → {t(`workspace.rules.outcome.${s.outcome.replace(':', '_')}`, { defaultValue: s.outcome })}
              {detail && <span className={styles.muted}> · {detail}</span>}
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

export default function RunsTab({ ruleId, name, limited }: { ruleId: string; name: string; limited: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { data: runs, isLoading, isError } = useQuery(runsQuery(ruleId));
  const [filter, setFilter] = useState<RunKind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  if (isError) return <StateView kind="error" />;
  if (isLoading || !runs) return <StateView kind="loading" />;

  const rows = runs.map((run) => {
    const steps = parseJsonColumn<TraceStep[]>(run.log);
    return { run, steps, kind: runKind(run, steps), summary: summarizeTriggerEvent(parseJsonColumn<Record<string, unknown>>(run.triggerEvent)) };
  });
  const count = (k: RunKind) => rows.filter((r) => r.kind === k).length;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);
  const kinds: RunKind[] = ['sent', 'skipped', 'failed', ...(count('done') ? ['done' as const] : [])];
  const dayAgo = Date.now() - 86_400_000;
  const sentDay = rows.filter((r) => r.kind === 'sent' && r.run.startedAt >= dayAgo).length;

  const exportRuns = () => {
    const blob = new Blob([JSON.stringify(shown.map((r) => r.run), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w.-]+/g, '_')}-runs.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const result = (r: (typeof rows)[number]) => {
    const failedStep = r.steps?.find((s) => s.outcome.endsWith('error'));
    const reason = r.kind === 'skipped' && r.steps?.some((s) => s.outcome === 'condition:false') ? t('workspace.rules.runs_tab.if_not_met') : r.kind === 'failed' ? failedStep?.error : null;
    return (
      <span className={own.result} data-kind={r.kind}>
        <span className={own.dot} aria-hidden="true" />
        {t(`workspace.rules.runs_tab.${r.kind}`)}{reason && !isPhone ? ` · ${reason}` : ''}
      </span>
    );
  };
  const who = (r: (typeof rows)[number]) => [r.summary.node, r.summary.text && `“${r.summary.text}”`].filter(Boolean).join(': ') || r.summary.detail || r.run.sourceId || '—';
  const details = (r: (typeof rows)[number]) => (
    <div className={own.runDetail}>
      {(r.summary.channel || r.run.sourceId) && <p className={styles.muted}>{[r.summary.channel, r.run.sourceId, new Date(r.run.startedAt).toLocaleString()].filter(Boolean).join(' · ')}</p>}
      {r.steps && r.steps.length > 0 && <StepLines steps={r.steps} />}
      {!r.steps && r.run.log && <pre className={own.raw}>{r.run.log}</pre>}
      {r.run.triggerEvent && (
        <details className={own.payload}>
          <summary>{t('workspace.rules.runs_tab.payload')}</summary>
          <pre className={own.raw}>{pretty(r.run.triggerEvent)}</pre>
        </details>
      )}
    </div>
  );

  return (
    <div className={own.column}>
      <div className={own.toolbar}>
        <div className={styles.filters} role="group" aria-label={t('workspace.rules.runs')}>
          <button type="button" className={styles.chip} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('common.all', 'All')}</button>
          {kinds.map((k) => (
            <button key={k} type="button" className={styles.chip} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {t(`workspace.rules.runs_tab.${k}`)} <span className={styles.chipCount}>{count(k)}</span>
            </button>
          ))}
        </div>
        {!isPhone && <button type="button" className={styles.button} disabled={shown.length === 0} onClick={exportRuns}><UiIcon name="download" size={16} />{t('workspace.rules.export')}</button>}
      </div>
      {runs.length === 0 ? <p className={styles.note}>{t('workspace.rules.runs_tab.none')}</p> : isPhone ? (
        <ul className={`${styles.card} ${own.list}`} aria-label={t('workspace.rules.runs')}>
          {shown.map((r) => (
            <li key={r.run.id} className={own.runRow}>
              <button type="button" className={own.runButton} aria-expanded={open === r.run.id} onClick={() => setOpen((x) => (x === r.run.id ? null : r.run.id))}>
                <span className={styles.mono}>{time(r.run.startedAt)}</span>
                <strong className={own.runWho}>{who(r)}</strong>
                {result(r)}
              </button>
              {open === r.run.id && details(r)}
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${styles.card} ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr><th>{t('workspace.rules.runs_tab.time')}</th><th>{t('workspace.rules.runs_tab.triggered_by')}</th><th>{t('workspace.rules.runs_tab.result')}</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <Fragment key={r.run.id}>
                  <tr data-selected={open === r.run.id || undefined}>
                    <td>{time(r.run.startedAt)}</td>
                    <td>
                      <button type="button" className={styles.rowButton} aria-expanded={open === r.run.id} onClick={() => setOpen((x) => (x === r.run.id ? null : r.run.id))}>{who(r)}</button>
                    </td>
                    <td>{result(r)}</td>
                  </tr>
                  {open === r.run.id && <tr><td colSpan={3}>{details(r)}</td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.note}>{[t('workspace.rules.runs_tab.sent_day', { count: sentDay }), !limited && t('workspace.rules.runs_tab.no_limit')].filter(Boolean).join(' ')}</p>
    </div>
  );
}
