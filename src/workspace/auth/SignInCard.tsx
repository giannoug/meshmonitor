/**
 * The sign-in card (boards 11-01, 11-02, 11-07, 11-08, 11-09; note s11n0):
 * today's LoginPage / LoginModal, redrawn on the kit over the shared hooks in
 * `components/account/useSignIn` (Rule X). Steps: the password form (passkey
 * first, then Username / Password and Login, the recovery-code link, OIDC),
 * the two-factor step, and the recovery-code step.
 *
 * - `page`: SignInPage's card. Each step has its heading; the page adds the
 *   branding and footer.
 * - Otherwise `SignInDialog`: the same card in a Sheet whose title follows
 *   the step, without branding or footer. Closing the sheet unmounts the
 *   card, so what was typed is gone and the passkey autofill wait stops.
 *
 * Same requests, order, rate-limit and error words as today; no retries.
 * Secrets live only in this card's state and are never logged or stored.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { passkeysSupported } from '../../services/passkeyClient';
import { passkeyLoginErrorMessage, usePasskeyAutofill } from '../../hooks/usePasskeyLogin';
import { usePasskeySignIn, useRecoveryCodeSignIn, useSignIn } from '../../components/account/useSignIn';
import { PasswordField } from '../../components/shared/config/PasswordField';
import { UiIcon, type UiIconName } from '../../components/icons';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './SignIn.module.css';

type Step = 'password' | 'mfa' | 'recovery';

interface SignInCardProps {
  /** The full page (SignInPage): step headings on. */
  page?: boolean;
  /** The dialog's title for the current step. */
  onTitle?(title: string): void;
  /** Where LoginModal closed itself (the page reloads anyway). */
  onSignedIn?(): void;
}

export default function SignInCard({ page = false, onTitle, onSignedIn }: SignInCardProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, loginWithPasskey } = useAuth();
  const s = useSignIn(onSignedIn);
  const passkey = usePasskeySignIn(s.setError);
  const recovery = useRecoveryCodeSignIn();
  const [recovering, setRecovering] = useState(false);
  const id = useId();

  const localAuthDisabled = authStatus?.localAuthDisabled ?? false;
  const oidcEnabled = authStatus?.oidcEnabled ?? false;
  // Passkeys (#5841): local accounts only, and only in a secure context.
  const passkeysOn = !localAuthDisabled && passkeysSupported();
  const step: Step = s.mfaRequired ? 'mfa' : recovering ? 'recovery' : 'password';
  const busy = s.loading || passkey.busy;

  // Offer saved passkeys in the username field's autofill list, as today (off in the MFA step).
  usePasskeyAutofill(passkeysOn && !s.mfaRequired, loginWithPasskey, (err) => {
    s.setError(passkeyLoginErrorMessage(err, t));
  });

  const title =
    step === 'mfa' ? t('mfa.login_title') : step === 'recovery' ? t('passkey_only.recover_title') : t('auth.login');
  useEffect(() => onTitle?.(title), [onTitle, title]);

  const heading = (text: string) => page && <h2 className={styles.heading}>{text}</h2>;

  if (step === 'mfa') {
    const backup = s.useBackupCode;
    return (
      <form className={styles.card} data-phone={isPhone || undefined} onSubmit={s.submitMfa}>
        {heading(t('mfa.login_title'))}
        <p className={styles.intro}>{backup ? t('mfa.backup_code_prompt') : t('mfa.login_prompt')}</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-mfa`}>
            {backup ? t('mfa.backup_code_label') : t('mfa.code_label')}
          </label>
          <input
            id={`${id}-mfa`}
            className={`${styles.input} ${styles.code}`}
            type="text"
            value={s.mfaCode}
            onChange={(e) => s.setMfaCode(e.target.value)}
            placeholder={backup ? t('mfa.backup_code_placeholder') : '000000'}
            disabled={s.loading}
            required
            autoFocus
            autoComplete="one-time-code"
            maxLength={backup ? 8 : 6}
            pattern={backup ? undefined : '[0-9]{6}'}
            inputMode={backup ? undefined : 'numeric'}
          />
          {backup && <span className={styles.hint}>{t('workspace.auth.backup_code_hint')}</span>}
        </div>
        {s.error && <ErrorNote message={s.error} />}
        <button type="submit" className={styles.btn} data-variant="primary" disabled={s.loading || !s.mfaCode}>
          {s.loading ? t('mfa.verifying') : t('mfa.verify_button')}
        </button>
        <button type="button" className={styles.link} onClick={s.toggleBackupCode}>
          {backup ? t('mfa.use_totp_code') : t('mfa.use_backup_code')}
        </button>
        <button type="button" className={styles.btn} onClick={s.backToLogin}>
          <UiIcon name="back" size={16} />
          {t('common.back')}
        </button>
      </form>
    );
  }

  if (step === 'recovery') {
    return (
      <form
        className={styles.card}
        data-phone={isPhone || undefined}
        onSubmit={recovery.submit}
        aria-label={t('passkey_only.recover_title')}
      >
        {heading(t('passkey_only.recover_title'))}
        <p className={styles.intro}>{t('passkey_only.recover_intro')}</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-ru`}>{t('auth.username')}</label>
          <input
            id={`${id}-ru`}
            className={styles.input}
            type="text"
            value={recovery.username}
            onChange={(e) => recovery.setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={recovery.busy}
            required
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-rc`}>{t('passkey_only.recovery_code')}</label>
          <input
            id={`${id}-rc`}
            className={`${styles.input} ${styles.mono}`}
            type="text"
            value={recovery.code}
            onChange={(e) => recovery.setCode(e.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            disabled={recovery.busy}
            required
          />
        </div>
        {recovery.error && <ErrorNote message={recovery.error} />}
        <button
          type="submit"
          className={styles.btn}
          data-variant="primary"
          disabled={recovery.busy || !recovery.username || !recovery.code}
        >
          {recovery.busy ? t('auth.logging_in') : t('passkey_only.recover_submit')}
        </button>
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setRecovering(false);
            recovery.cancel();
          }}
          disabled={recovery.busy}
        >
          {t('common.cancel')}
        </button>
      </form>
    );
  }

  return (
    <div className={styles.card} data-phone={isPhone || undefined}>
      {page && (isPhone ? heading(t('auth.login')) : <p className={styles.subtitle}>{t('workspace.auth.subtitle')}</p>)}
      {s.error && <ErrorNote message={s.error} />}
      {localAuthDisabled && !oidcEnabled && <ErrorNote message={t('auth.local_disabled_no_oidc')} icon="info" />}

      {passkeysOn && (
        <>
          <button type="button" className={styles.btn} data-variant="primary" onClick={passkey.signIn} disabled={busy}>
            <UiIcon name="key" size={16} />
            {passkey.busy ? t('passkey.signing_in') : t('passkey.sign_in')}
          </button>
          <Divider />
        </>
      )}

      {!localAuthDisabled && (
        <form className={styles.form} onSubmit={s.submitPassword}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-user`}>{t('auth.username')}</label>
            <input
              id={`${id}-user`}
              className={styles.input}
              name="username"
              type="text"
              value={s.username}
              onChange={(e) => s.setUsername(e.target.value)}
              disabled={busy}
              required
              autoComplete={passkeysOn ? 'username webauthn' : 'username'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-pass`}>{t('auth.password')}</label>
            <PasswordField
              id={`${id}-pass`}
              className={styles.input}
              name="password"
              value={s.password}
              onChange={(e) => s.setPassword(e.target.value)}
              disabled={busy}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={styles.btn} disabled={busy || !s.username || !s.password}>
            {s.loading ? t('auth.logging_in') : t('auth.login')}
          </button>
        </form>
      )}

      {/* Passkey-only accounts sign in with a recovery code here (#5841). */}
      {!localAuthDisabled && (
        <button
          type="button"
          className={styles.link}
          disabled={busy}
          onClick={() => {
            // The password form leaves the screen: its password goes with it.
            s.setPassword('');
            s.setError(null);
            setRecovering(true);
          }}
        >
          {t('passkey_only.lost_passkey')}
        </button>
      )}

      {oidcEnabled && (
        <>
          {!localAuthDisabled && <Divider />}
          <button type="button" className={styles.btn} onClick={s.signInWithOidc} disabled={busy}>
            <UiIcon name="forward" size={16} />
            {t('auth.login_with_oidc')}
          </button>
        </>
      )}
    </div>
  );
}

function Divider() {
  const { t } = useTranslation();
  return (
    <div className={styles.divider} role="separator">
      <span>{t('common.or')}</span>
    </div>
  );
}

/** One of today's errors. Session expired adds Reload (s11n0: "session expired → Reload"). */
function ErrorNote({ message, icon }: { message: string; icon?: UiIconName }) {
  const { t } = useTranslation();
  const expired = message === t('auth.session_expired');
  return (
    <div className={styles.error} role="alert">
      <UiIcon name={icon ?? (expired ? 'refresh' : 'alert')} size={18} />
      <span className={styles.errorText}>{message}</span>
      {expired && (
        <button type="button" className={styles.btn} onClick={() => window.location.reload()}>
          {t('workspace.auth.reload')}
        </button>
      )}
    </div>
  );
}

/** Login for guests (rail, You, the read-only note): the card in a Sheet. */
export function SignInDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState<ReactNode>(t('auth.login'));
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className={styles.sheetPad}>
        <SignInCard onTitle={setTitle} onSignedIn={onClose} />
      </div>
    </Sheet>
  );
}
