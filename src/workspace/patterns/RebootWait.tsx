/**
 * RebootWait (boards 17-03 / 17-10): waits for the connected radio to come
 * back after a restart, on RebootModal's polling (`useRebootWait`, moved
 * verbatim: 30 s, then up to 3 connection checks 3 s apart, then up to 20 (5
 * for a possible restart) config reads 3 s apart; MeshMonitor's server only,
 * nothing on the mesh). Drawn as three steps, done / current / to come, the
 * current one in today's words, with the elapsed time and today's "do not
 * close" warning; it ends with today's messages and closes itself, as today.
 * It cannot be dismissed (today's modal has no close either).
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useRebootWait, type RebootExpectation } from '../../hooks/useRebootWait';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './RebootWait.module.css';

export interface RebootWaitProps {
  open: boolean;
  expectation: RebootExpectation;
  deviceName: string;
  onClose(): void;
}

const STEP_OF: Record<string, number> = {
  'reboot.rebooting': 0,
  'reboot.rebooting_please_wait': 0,
  'reboot.possible_please_wait': 0,
  'reboot.verifying_connection': 1,
  'reboot.waiting_for_config': 2,
  'reboot.checking_config': 2,
};
/** Today's endings: the radio came back, or it did not. */
const FAILED = new Set(['reboot.reconnection_timeout', 'reboot.error_reload']);

export default function RebootWait(props: RebootWaitProps) {
  // The hook runs while closed too, as in RebootModal: closing resets it and stops the polling.
  const wait = useRebootWait(props.open, props.expectation, props.onClose);
  return props.open ? createPortal(<OpenWait {...props} {...wait} />, document.body) : null;
}

function OpenWait({
  expectation,
  deviceName,
  statusKey,
  statusParams,
  elapsedSeconds,
}: RebootWaitProps & ReturnType<typeof useRebootWait>) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    card.current?.focus();
    return () => opener?.focus?.();
  }, []);
  const current = STEP_OF[statusKey] ?? 3;
  const failed = FAILED.has(statusKey);
  const labels = [
    t(expectation === 'possible' ? 'reboot.possible_please_wait' : 'reboot.rebooting_please_wait'),
    t('reboot.verifying_connection'),
    t('workspace.reboot.step_config'),
  ];
  return (
    <div className={styles.layer} data-phone={isPhone || undefined}>
      <div
        ref={card}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // The card has no control to move to, so Tab stays on it.
        onKeyDown={(e) => e.key === 'Tab' && e.preventDefault()}
      >
        <div className={styles.head}>
          <span className={styles.spin} aria-hidden="true">
            <UiIcon name="refresh" size={24} />
          </span>
          <div className={styles.titles}>
            <h2 id={titleId} className={styles.title}>
              <span>{t(expectation === 'possible' ? 'reboot.title_possible' : 'reboot.title')}</span>{' '}
              <span className={styles.device}>· {deviceName}</span>
            </h2>
          </div>
          <span className={styles.elapsed}>{t('reboot.elapsed', { seconds: elapsedSeconds })}</span>
        </div>
        <ol className={styles.steps}>
          {labels.map((label, i) => {
            const state = i < current ? 'done' : i === current ? 'current' : 'todo';
            return (
              <li key={i} className={styles.step} data-step={state}>
                <span className={styles.mark} aria-hidden="true">
                  {state === 'done' ? <UiIcon name="check" size={18} /> : <span className={styles.dot} />}
                </span>
                {state === 'current' ? t(statusKey, statusParams) : label}
              </li>
            );
          })}
        </ol>
        {current === 3 && (
          <p className={styles.end} data-failed={failed || undefined} role="status">
            <UiIcon name={failed ? 'alert' : 'check'} size={16} />
            {t(statusKey, statusParams)}
          </p>
        )}
        <p className={styles.warn}>
          <UiIcon name="alert" size={18} />
          {t('reboot.do_not_close')}
        </p>
      </div>
    </div>
  );
}
