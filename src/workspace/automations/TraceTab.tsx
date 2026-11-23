/**
 * A rule's Live trace tab (Task 8.4; 14-04, 14-13): today's LiveTracePanel
 * transport, unchanged (`useLiveTrace`: the same socket subscription, the
 * server's 5-minute session, today's 1 s countdown), drawn on the kit. Each
 * evaluation shows newest first, with why it did or did not run. Leaving the
 * tab stops the trace, as closing today's panel does. Nothing is sent.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { summarizeTriggerEvent, summaryLine } from '../../components/automations/eventSummary';
import { mmss, useLiveTrace } from '../../components/automations/useLiveTrace';
import { StepLines } from './RunsTab';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

const OUTCOME: Record<string, string> = { prefiltered: 'filtered', cooldown: 'cooldown', ratelimited: 'ratelimited' };

export default function TraceTab({ ruleId, enabled, onClose }: { ruleId: string; enabled: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const { entries, clear, status, errorMsg, remaining } = useLiveTrace(ruleId);
  const badge = status === 'live'
    ? t('workspace.rules.trace_tab.live', { left: mmss(remaining) })
    : status === 'error' ? t('workspace.rules.trace_tab.error', { error: errorMsg ?? '' }) : t(`workspace.rules.trace_tab.${status}`);

  return (
    <div className={own.column}>
      <section className={`${styles.card} ${own.trace}`} aria-label={t('workspace.rules.live_trace')}>
        <div className={own.traceHead}>
          <span className={own.liveBadge} data-status={status}><span className={own.dot} aria-hidden="true" />{badge}</span>
          <span className={styles.muted}>{t('workspace.rules.trace_tab.about')}</span>
          <span className={own.traceButtons}>
            <button type="button" className={styles.button} onClick={clear}>{t('workspace.rules.trace_tab.clear')}</button>
            <button type="button" className={styles.button} onClick={onClose}>{t('common.close')}</button>
          </span>
        </div>
        {!enabled && <p className={own.traceNote}>{t('workspace.rules.trace_tab.disabled')}</p>}
        <ol className={own.traceFeed}>
          {entries.map((e, i) => {
            const fired = e.outcome === 'fired';
            const kind = fired ? (e.status === 'failed' ? 'failed' : 'fired') : OUTCOME[e.outcome] ?? e.outcome;
            return (
              <li key={`${e.ts}-${i}`} className={own.traceEntry}>
                <div className={own.traceLine}>
                  <span className={styles.mono}>{new Date(e.ts).toLocaleTimeString()}</span>
                  <strong>{summaryLine(summarizeTriggerEvent(e.event))}</strong>
                  <span className={own.result} data-kind={fired ? (e.status === 'failed' ? 'failed' : 'sent') : 'skipped'}>
                    <span className={own.dot} aria-hidden="true" />
                    {t(`workspace.rules.trace_tab.${kind}`, { defaultValue: kind })}
                  </span>
                </div>
                {!fired && e.reason && <p className={styles.muted}>{e.reason}</p>}
                {fired && e.steps && e.steps.length > 0 && <StepLines steps={e.steps} />}
              </li>
            );
          })}
          {status === 'live' && (
            <li className={own.traceEntry}>
              <div className={own.traceLine}>
                <strong>{t('workspace.rules.trace_tab.started')}</strong>
                <span className={own.result} data-kind="listening"><span className={own.dot} aria-hidden="true" />{t('workspace.rules.trace_tab.listening')}</span>
              </div>
            </li>
          )}
        </ol>
        {entries.length === 0 && <p className={own.traceNote}>{t('workspace.rules.trace_tab.waiting')}</p>}
      </section>
      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.rules.trace_tab.note')}</span>
      </p>
    </div>
  );
}
