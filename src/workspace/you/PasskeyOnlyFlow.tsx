/**
 * Password sign-in, the passkey-only switch (boards 11-04, 11-12; s11n2),
 * over Classic's `usePasswordLogin` (Rule X), so the order is today's:
 *
 * 1. Turn off password sign-in opens the explain sheet (today's 3 bullets).
 * 2. Continue with a passkey runs the step-up browser prompt; the button reads
 *    "Waiting for passkey…" meanwhile.
 * 3. Only when the server answers `requireConfirm` (the caller is the only
 *    admin): "Type DISABLE to confirm", resending the same assertion.
 * 4. Your recovery codes, shown once; the sheet has no close, and Done waits
 *    for "I saved these codes".
 *
 * The off state shows today's codes-left line and Turn password sign-in back
 * on. One sheet at a time (D9c): each step replaces the last.
 */
import { useTranslation } from 'react-i18next';
import { LAST_ADMIN_CONFIRM } from '../../services/passkeyClient';
import { usePasswordLogin } from '../../components/account/usePasswordLogin';
import { downloadRecoveryCodes } from '../../components/account/recoveryCodes';
import ConfirmSheet from '../patterns/ConfirmSheet';
import OneTimeReveal from '../patterns/OneTimeReveal';
import Sheet from '../patterns/Sheet';
import styles from './YouAccount.module.css';

const noop = () => {};

export default function PasskeyOnlyFlow({ passkeyCount, supported }: { passkeyCount: number; supported: boolean }) {
  const { t } = useTranslation();
  const { state, step, setStep, busy, codes, username, reset, continueOff, confirmOff, turnOn, codesClosed } = usePasswordLogin();

  if (!state) return null;

  return (
    <div className={styles.row} data-testid="password-sign-in">
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{t('passkey_only.title')}</span>
        <span className={styles.rowSub}>
          {state.disabled ? t('passkey_only.is_off', { count: state.recoveryCodesLeft }) : t('passkey_only.is_on')}
        </span>
        {!state.disabled && passkeyCount === 0 && <span className={styles.rowSub}>{t('passkey_only.need_passkey')}</span>}
      </span>
      <span className={styles.actions}>
        {state.disabled ? (
          <button type="button" className={styles.btn} onClick={() => void turnOn()} disabled={busy}>
            {t('passkey_only.turn_on')}
          </button>
        ) : (
          <button type="button" className={styles.btn} onClick={() => setStep('explain')} disabled={busy || passkeyCount === 0 || !supported}>
            {t('passkey_only.turn_off')}
          </button>
        )}
      </span>

      <ConfirmSheet
        open={step === 'explain'}
        title={t('passkey_only.turn_off')}
        consequences={[t('passkey_only.explain_password'), t('passkey_only.explain_prompt'), t('passkey_only.explain_codes')]}
        confirmLabel={busy ? t('passkey.signing_in') : t('passkey_only.continue')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={continueOff}
        // While the browser prompt is open, Cancel waits for it, as today.
        onCancel={() => !busy && reset()}
      />
      <ConfirmSheet
        open={step === 'confirm'}
        title={t('passkey_only.title')}
        body={t('passkey_only.last_admin_warning')}
        confirmWord={LAST_ADMIN_CONFIRM}
        confirmLabel={t('passkey_only.confirm_off')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => confirmOff(LAST_ADMIN_CONFIRM)}
        onCancel={() => !busy && reset()}
      />
      <Sheet open={codes !== null} dismissible={false} onClose={noop} title={t('passkey_only.codes_title')}>
        {codes && (
          <div className={styles.sheetPad}>
            <OneTimeReveal
              secrets={codes}
              mustAck
              onDownload={() => downloadRecoveryCodes(codes, username, t)}
              onDone={codesClosed}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}
