/**
 * LiveTracePanel — in-app "view logs" for a single automation rule.
 *
 * Opt-in, live-only debugging: while open it asks the server (over the shared
 * Socket.io connection) to stream every event the engine evaluates against THIS
 * rule, and shows why each did or didn't run (fired + step trace / filtered-out
 * + reason / cooldown). Nothing is persisted — entries live in a capped in-memory
 * buffer and the session auto-stops after 5 minutes (and on close / disconnect).
 */
import { StepList } from './outcomeMeta';
import { summarizeTriggerEvent, summaryLine } from './eventSummary';
import { UiIcon } from '../icons';
import { mmss, useLiveTrace } from './useLiveTrace';

interface LiveTracePanelProps {
  automationId: string;
  automationName: string;
  /** Whether the rule is enabled — disabled rules never evaluate, so warn. */
  enabled: boolean;
  onClose: () => void;
}

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  prefiltered: { label: 'filtered out', cls: 'no' },
  cooldown: { label: 'cooldown', cls: 'muted' },
  ratelimited: { label: 'rate limited', cls: 'muted' },
};

export default function LiveTracePanel({ automationId, automationName, enabled, onClose }: LiveTracePanelProps) {
  const { entries, clear, status, errorMsg, remaining } = useLiveTrace(automationId);

  return (
    <div className="ae-trace-panel">
      <div className="ae-trace-panel-head">
        <div>
          <strong>Live trace</strong> · {automationName}
          {status === 'live' && <span className="ae-chip" style={{ marginLeft: '0.5rem' }}><UiIcon name="statusOn" size={11} /> live · {mmss(remaining)} left</span>}
          {status === 'connecting' && <span className="ae-chip" style={{ marginLeft: '0.5rem' }}>connecting…</span>}
          {status === 'stopped' && <span className="ae-chip" style={{ marginLeft: '0.5rem' }}>stopped (auto)</span>}
          {status === 'error' && <span className="ae-test-badge ae-test-badge--err" style={{ marginLeft: '0.5rem' }}>error: {errorMsg}</span>}
        </div>
        <div className="ae-row" style={{ gap: '0.4rem' }}>
          <button className="ae-btn ae-btn--ghost" onClick={clear}>Clear</button>
          <button className="ae-btn ae-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      {!enabled && (
        <div className="ae-test-note">This rule is <strong>disabled</strong> — the engine never evaluates it, so no events will appear. Enable the rule to see live evaluations.</div>
      )}

      <div className="ae-trace-feed">
        {entries.length === 0 && (
          <div className="ae-muted" style={{ padding: '0.6rem 0' }}>
            Waiting for events… send traffic that this rule's trigger listens for (e.g. a message on its channel) and each evaluation will appear here.
          </div>
        )}
        {entries.map((e, i) => {
          const fired = e.outcome === 'fired';
          const badge = fired
            ? { label: e.status === 'failed' ? 'fired · failed' : 'fired', cls: e.status === 'failed' ? 'err' : 'ok' }
            : (OUTCOME_BADGE[e.outcome] ?? { label: e.outcome, cls: 'muted' });
          return (
            <div className="ae-trace-entry" key={`${e.ts}-${i}`}>
              <div className="ae-trace-entry-head">
                <span className={`ae-test-badge ae-test-badge--${badge.cls}`}>{badge.label}</span>
                <span className="ae-muted">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="ae-trace-entry-summary">{summaryLine(summarizeTriggerEvent(e.event))}</span>
              </div>
              {!fired && e.reason && <div className="ae-muted ae-trace-reason">↳ {e.reason}</div>}
              {fired && e.steps && e.steps.length > 0 && (
                <details className="ae-trace-steps-wrap">
                  <summary className="ae-muted">execution trace ({e.steps.length} steps)</summary>
                  <StepList steps={e.steps} />
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
