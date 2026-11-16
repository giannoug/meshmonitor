/**
 * You › Change password (board 11-06; s11n2, s11n4) over Classic's
 * `useChangePassword` (Rule X): today's checks, in today's order and words,
 * and today's POST /api/auth/change-password. Success shows today's message
 * and closes after 2 s, as the modal did (back to Sign-in & security).
 *
 * Forced (`passwordChangeRequired`, after a recovery-code sign-in): "Choose
 * a new password", no current password, no Cancel and no way back; it ends
 * by refreshing the session, as today. Away from `/you/password` the shell
 * shows the same form in a sheet that cannot be dismissed, over any page, as
 * Classic's forced modal does (WorkspaceShell).
 *
 * Not forced, an account that cannot change its password (OIDC,
 * password-locked, passkey-only: the user menu's and Security page's gate)
 * goes to Sign-in & security instead of a form the server would refuse.
 */
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChangePassword } from '../../components/account/useChangePassword';
import { PasswordField } from '../../components/shared/config/PasswordField';
import YouPageFrame from './YouPageFrame';
import styles from './YouAccount.module.css';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { authStatus, loading, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const forced = authStatus?.passwordChangeRequired === true;
  const user = authStatus?.authenticated ? authStatus.user : null;
  const canChange = user?.authProvider === 'local' && !user.passwordLocked && !user.passwordLoginDisabled;
  // The 2 s close can land after the user has left; then it must not pull them back.
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  const done = () => {
    if (forced) void refreshAuth();
    else if (mounted.current) void navigate('/you/security');
  };

  if (loading && !authStatus) return null;
  if (!forced && !canChange) return <Navigate replace to="/you/security" />;

  return (
    <YouPageFrame
      title={forced ? t('change_password.forced_title') : t('change_password.title')}
      scope={forced ? undefined : t('workspace.you.security.scope')}
      crumb={forced ? undefined : `${t('workspace.you.sign_in_security')} ›`}
      back={forced ? undefined : { label: t('workspace.you.sign_in_security'), to: '/you/security' }}
    >
      <div className={`${styles.card} ${styles.narrow}`} data-pad="">
        <ChangePasswordForm forced={forced} onClose={done} />
      </div>
    </YouPageFrame>
  );
}

export function ChangePasswordForm({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useChangePassword(forced, onClose);
  const busy = f.loading || f.success;
  const id = useId();

  return (
    <form className={styles.form} onSubmit={f.submit}>
      {forced ? (
        <p className={styles.sheetText}>{t('change_password.forced_intro')}</p>
      ) : (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-current`}>{t('change_password.current_password')}</label>
          <PasswordField
            id={`${id}-current`}
            className={styles.input}
            value={f.currentPassword}
            onChange={(e) => f.setCurrentPassword(e.target.value)}
            disabled={busy}
            required
            autoComplete="current-password"
          />
        </div>
      )}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-new`}>{t('change_password.new_password')}</label>
        <PasswordField
          id={`${id}-new`}
          className={styles.input}
          value={f.newPassword}
          onChange={(e) => f.setNewPassword(e.target.value)}
          disabled={busy}
          required
          autoComplete="new-password"
          minLength={8}
        />
        <span className={styles.rowSub}>{t('change_password.min_length_hint')}</span>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-confirm`}>{t('change_password.confirm_password')}</label>
        <PasswordField
          id={`${id}-confirm`}
          className={styles.input}
          value={f.confirmPassword}
          onChange={(e) => f.setConfirmPassword(e.target.value)}
          disabled={busy}
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      {f.error && <p className={styles.error} role="alert">{f.error}</p>}
      {f.success && <p className={styles.success} role="status">{t('change_password.success')}</p>}
      <span className={styles.actions}>
        {!forced && (
          <button type="button" className={styles.btn} onClick={f.close} disabled={f.loading}>
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className={styles.btn} data-variant="primary" disabled={!f.canSubmit}>
          {f.loading ? t('change_password.changing') : t('change_password.title')}
        </button>
      </span>
    </form>
  );
}
