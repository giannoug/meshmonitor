/**
 * The login card of a MeshCore remote target (boards 8-06, 8-21): today's
 * console login (MeshCoreRemoteConsole) laid out as a card. Guest or Admin
 * (a guest logs in with an empty password, as today's "Leave blank for guest
 * access"), Remember this password on the server (today's encrypted store,
 * off when the server cannot remember), Log in with saved password, Resume
 * session (sends nothing) and, once logged in, Log out (sends nothing) and
 * Forget stored password. Each login runs today's attempts (up to 3) with the
 * progress line and Cancel; nothing logs in on its own.
 *
 * The password lives only in the session hook's state while typed, as today;
 * it never reaches the URL, a toast, the page text or browser storage.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { MeshCoreLoginProgress } from '../../../components/MeshCore/MeshCoreLoginProgress';
import SendsLine from '../../patterns/SendsLine';
import { useIsPhone } from '../../shell/useIsPhone';
import type { MeshCoreTarget } from './remoteTarget';
import styles from './McRemote.module.css';

/** The server's MESHCORE_LOGIN_MAX_ATTEMPTS (server/constants/meshcoreLogin.ts); the progress line reports the live count. */
const LOGIN_ATTEMPTS = 3;

export default function RemoteLogin({ target, headerActions = false }: { target: MeshCoreTarget; headerActions?: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const id = useId();
  const { session: s, name, blocked } = target;
  const [mode, setMode] = useState<'guest' | 'admin'>('admin');
  const off = s.loginBusy || !!blocked;
  const busyLabel = t('meshcore.remoteConsole.logging_in', 'Logging in…');
  const setGuest = (guest: boolean) => {
    setMode(guest ? 'guest' : 'admin');
    // A guest login is today's blank password.
    s.setLoginPassword('');
  };

  const status = s.loggedIn ? (
    <span className={styles.ok}>
      <UiIcon name="check" size={16} />
      <span>{t('workspace.meshcore.remote.logged_in')}</span>
      {s.session?.isAdmin && <span>{` · ${t('workspace.meshcore.remote.as_admin')}`}</span>}
      {s.hasSavedCredential && <span>{` · ${t('workspace.meshcore.remote.password_saved')}`}</span>}
    </span>
  ) : (
    <span className={styles.muted}>
      {s.canResume
        ? t('meshcore.remoteConsole.session_saved')
        : s.hasSavedCredential
          ? t('meshcore.remoteConsole.saved_password', 'Saved password')
          : t('meshcore.remoteConsole.not_logged_in', 'Not logged in')}
    </span>
  );

  return (
    <section className={styles.card} data-phone={isPhone || undefined} aria-label={t('workspace.meshcore.remote.login')}>
      <div className={styles.loginRow}>
        {!s.loggedIn && (
          <>
            <h2 className={styles.cardTitle}>{t('workspace.meshcore.remote.login')}</h2>
            <div className={styles.segments} role="group" aria-label={t('workspace.meshcore.remote.login')}>
              <button type="button" className={styles.segment} aria-pressed={mode === 'guest'} disabled={off} onClick={() => setGuest(true)}>
                {t('workspace.meshcore.remote.guest')}
              </button>
              <button type="button" className={styles.segment} aria-pressed={mode === 'admin'} disabled={off} onClick={() => setGuest(false)}>
                {t('workspace.meshcore.remote.admin')}
              </button>
            </div>
            <label
              className={styles.check}
              title={s.capability && !s.capability.canRemember ? s.capability.reason : undefined}
            >
              <input
                type="checkbox"
                checked={s.rememberPassword}
                disabled={!s.capability?.canRemember || off}
                onChange={(e) => s.setRememberPassword(e.target.checked)}
              />
              {t('meshcore.remoteConsole.remember_password', 'Remember this password on the server')}
            </label>
          </>
        )}
        <span className={styles.status}>{status}</span>
        {s.loggedIn && (
          <span className={styles.buttons}>
            {s.resumed && (
              <button
                type="button"
                className={styles.button}
                disabled={off}
                title={blocked ?? undefined}
                onClick={() => {
                  s.setLoginError(null);
                  if (s.hasSavedCredential) void s.handleLoginWithSaved();
                  else s.setShowLogin(true);
                }}
              >
                {s.loginBusy ? busyLabel : t('meshcore.remoteConsole.login_again_button')}
              </button>
            )}
            {/* On the desktop Console they sit in the page header (8-06). */}
            {!headerActions && <SessionButtons target={target} />}
          </span>
        )}
      </div>

      {!s.loggedIn && (
        <div className={styles.loginRow}>
          {mode === 'admin' && (
            <span className={styles.field}>
              <label htmlFor={`${id}-password`} className={styles.label}>
                {t('meshcore.remoteConsole.password_label', 'Password')}
              </label>
              <PasswordField
                id={`${id}-password`}
                autoComplete="off"
                className={styles.input}
                value={s.loginPassword}
                onChange={(e) => s.setLoginPassword(e.target.value)}
                disabled={off}
              />
            </span>
          )}
          <span className={styles.buttons}>
            <button type="button" className={styles.primary} disabled={off} title={blocked ?? undefined} onClick={() => void s.handleLogin()}>
              {s.loginBusy ? busyLabel : t('meshcore.remoteConsole.login_confirm', 'Log in')}
            </button>
            {s.hasSavedCredential && (
              <button type="button" className={styles.button} disabled={off} title={blocked ?? undefined} onClick={() => void s.handleLoginWithSaved()}>
                {t('meshcore.remoteConsole.login_with_saved_button', 'Log in with saved password')}
              </button>
            )}
            {s.canResume && (
              <button type="button" className={styles.button} disabled={off} title={blocked ?? undefined} onClick={s.handleResume}>
                <UiIcon name="play" size={16} /> {t('meshcore.remoteConsole.resume_button')}
              </button>
            )}
          </span>
        </div>
      )}
      {s.loggedIn && s.showLogin && s.resumed && (
        // "Log in again" without a saved password: today's login form, here inline.
        <div className={styles.loginRow}>
          <span className={styles.field}>
            <label htmlFor={`${id}-again`} className={styles.label}>
              {t('meshcore.remoteConsole.password_label', 'Password')}
            </label>
            <PasswordField id={`${id}-again`} autoComplete="off" className={styles.input} value={s.loginPassword}
              onChange={(e) => s.setLoginPassword(e.target.value)} disabled={off} />
          </span>
          <button type="button" className={styles.primary} disabled={off} onClick={() => void s.handleLogin()}>
            {s.loginBusy ? busyLabel : t('meshcore.remoteConsole.login_confirm', 'Log in')}
          </button>
        </div>
      )}

      {s.canResume && (
        <p className={styles.note}>
          {s.sessionWhen ? t('meshcore.remoteConsole.session_note', { when: s.sessionWhen }) : t('meshcore.remoteConsole.session_note_no_time')}
        </p>
      )}
      {s.isRotatedForThisContact && (
        <div className={styles.warn} role="status">
          <strong>{t('meshcore.remoteConsole.rotated_banner_title', 'Saved password unreadable')}</strong>
          <span>
            {t(
              'meshcore.remoteConsole.rotated_banner_body',
              'The saved password for this node was encrypted with a previous SESSION_SECRET and can no longer be decrypted. Re-enter the password to continue, or forget the stored copy.',
            )}
          </span>
          {!s.loggedIn && (
            <button type="button" className={styles.button} onClick={() => void s.handleForgetCredential()}>
              {t('meshcore.remoteConsole.forget_credential', 'Forget stored password')}
            </button>
          )}
        </div>
      )}
      {s.capability && !s.capability.canRemember && (
        <p className={styles.note} role="status">
          {t('meshcore.remoteConsole.persistence_disabled_hint', 'Saving passwords is disabled. ')} {s.capability.reason}
        </p>
      )}
      {blocked && <p className={styles.note} role="note">{blocked}</p>}
      {s.loginProgressState && <MeshCoreLoginProgress progress={s.loginProgressState} onCancel={() => void s.cancelLoginAttempt()} />}
      {s.loginError && !s.loginProgressState && <p className={styles.error} role="alert">{s.loginError}</p>}
      {!s.loggedIn && <SendsLine>{t('workspace.meshcore.sends_login', { room: name, max: s.loginProgressState?.maxAttempts || LOGIN_ATTEMPTS })}</SendsLine>}
    </section>
  );
}

/** Log out (sends nothing) and Forget stored password: today's two session actions. */
export function SessionButtons({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const s = target.session;
  return (
    <>
      <button type="button" className={styles.button} onClick={() => void s.handleLogout()}>
        <UiIcon name="power" size={16} /> {t('meshcore.remoteConsole.logout_button')}
      </button>
      <button type="button" className={styles.button} onClick={() => void s.handleForgetCredential()}>
        {t('meshcore.remoteConsole.forget_credential', 'Forget stored password')}
      </button>
    </>
  );
}
