/**
 * The passkey-only switch (#5841, spec §8). Turning password sign-in off
 * runs a fresh passkey prompt (D6), asks the only admin to type DISABLE
 * (D3), then shows the recovery codes once (D2). Turning it back on needs
 * only the session.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from './icons';
import { LAST_ADMIN_CONFIRM } from '../services/passkeyClient';
import { usePasswordLogin } from './account/usePasswordLogin';
import RecoveryCodesDialog from './RecoveryCodesDialog';
import styles from './PasskeyManagement.module.css';

interface PasswordLoginControlProps {
  /** How many passkeys the user has; off needs at least one. */
  passkeyCount: number;
  /** False when the browser cannot run a passkey prompt. */
  supported: boolean;
}

const PasswordLoginControl: React.FC<PasswordLoginControlProps> = ({ passkeyCount, supported }) => {
  const { t } = useTranslation();
  const {
    state, step, setStep, busy, typed, setTyped, codes, username,
    reset, continueOff: handleContinue, confirmOff, turnOn: handleTurnOn, codesClosed: handleCodesClosed,
  } = usePasswordLogin();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    await confirmOff(typed);
  };

  if (!state) return null;

  return (
    <div className={styles.switchBox} data-testid="password-login-control">
      <h4 className={styles.subheading}>
        <UiIcon name="security" size={16} />
        {t('passkey_only.title')}
      </h4>

      {state.disabled ? (
        <>
          <p className={styles.description}>
            {t('passkey_only.is_off', { count: state.recoveryCodesLeft })}
          </p>
          <button type="button" className="button" onClick={handleTurnOn} disabled={busy}>
            {t('passkey_only.turn_on')}
          </button>
        </>
      ) : step === 'idle' ? (
        <>
          <p className={styles.description}>{t('passkey_only.is_on')}</p>
          {passkeyCount === 0 && <p className={styles.muted}>{t('passkey_only.need_passkey')}</p>}
          <button
            type="button"
            className="button"
            onClick={() => setStep('explain')}
            disabled={busy || passkeyCount === 0 || !supported}
          >
            {t('passkey_only.turn_off')}
          </button>
        </>
      ) : step === 'explain' ? (
        <>
          <ul className={styles.explainList}>
            <li>{t('passkey_only.explain_password')}</li>
            <li>{t('passkey_only.explain_prompt')}</li>
            <li>{t('passkey_only.explain_codes')}</li>
          </ul>
          <div className={styles.actions}>
            <button type="button" className={`button ${styles.danger}`} onClick={handleContinue} disabled={busy}>
              {busy ? t('passkey.signing_in') : t('passkey_only.continue')}
            </button>
            <button type="button" className="button" onClick={reset} disabled={busy}>
              {t('common.cancel')}
            </button>
          </div>
        </>
      ) : (
        <form className={styles.warning} onSubmit={handleConfirm}>
          <p className={styles.warningText}>
            <UiIcon name="alert" size={16} />
            {t('passkey_only.last_admin_warning')}
          </p>
          <label className={styles.confirmLabel}>
            {t('passkey_only.last_admin_type', { word: LAST_ADMIN_CONFIRM })}
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={busy}
              autoFocus
            />
          </label>
          <div className={styles.actions}>
            <button
              type="submit"
              className={`button ${styles.danger}`}
              disabled={busy || typed !== LAST_ADMIN_CONFIRM}
            >
              {t('passkey_only.confirm_off')}
            </button>
            <button type="button" className="button" onClick={reset} disabled={busy}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {codes && (
        <RecoveryCodesDialog
          codes={codes}
          username={username}
          onClose={handleCodesClosed}
        />
      )}
    </div>
  );
};

export default PasswordLoginControl;
