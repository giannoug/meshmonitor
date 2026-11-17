/**
 * useMeshCoreRemoteSession: the login state of one remote Repeater / Room
 * Server, moved as is out of MeshCoreRemoteConsole so the Workspace's remote
 * target (Task 7.3) runs the same flow:
 *
 *  - the credential capability (can remember, saved, key rotated);
 *  - login with a password (empty = guest) and "remember", or with the saved
 *    password, each through useMeshCoreLoginProgress (attempt n of 3, Cancel);
 *  - the remembered session (#5785): Resume sends nothing, Log out forgets it;
 *  - Forget stored password.
 *
 * It never logs in on its own. `log` receives the info lines the console
 * writes to its transcript ("Logged in", "Login cancelled", …).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreActions, MeshCoreRemoteAdminSession } from './useMeshCore';
import { useMeshCoreLoginProgress } from './useMeshCoreLoginProgress';

export interface CapabilitySnapshot {
  canRemember: boolean;
  reason?: string;
  rotatedCount: number;
  rotated: Array<{ publicKey: string; name: string | null }>;
  stored: Array<{ publicKey: string; name: string | null }>;
}

export type RemoteSessionActions = Pick<
  MeshCoreActions,
  | 'loginRemote'
  | 'loginRemoteWithSaved'
  | 'getLoginProgress'
  | 'cancelLogin'
  | 'getRemoteAdminCapability'
  | 'forgetRemoteCredential'
  | 'getRemoteAdminSession'
  | 'logoutRemote'
>;

export function useMeshCoreRemoteSession({
  publicKey,
  contactName,
  actions,
  log,
}: {
  publicKey: string;
  contactName: string;
  actions: RemoteSessionActions;
  log: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [capability, setCapability] = useState<CapabilitySnapshot | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // Remembered login on the server (#5785), and whether the console is
  // running on it (resumed, not freshly logged in).
  const [session, setSession] = useState<MeshCoreRemoteAdminSession | null>(null);
  const [resumed, setResumed] = useState(false);
  // Live "attempt n of 3" progress + cancel for the login in flight (#5400).
  const { progress: loginProgressState, run: runLogin, cancel: cancelLoginAttempt } = useMeshCoreLoginProgress(actions);

  // Reset auth state when the targeted contact changes — a stale "logged
  // in" badge against the wrong contact would be actively misleading.
  useEffect(() => {
    setLoggedIn(false);
    setShowLogin(false);
    setLoginPassword('');
    setRememberPassword(false);
    setLoginError(null);
    setSession(null);
    setResumed(false);
  }, [publicKey]);

  const refreshCapability = useCallback(async () => {
    const cap = await actions.getRemoteAdminCapability();
    setCapability(cap);
    return cap;
  }, [actions]);

  // On mount (and on contact change): fetch the credential capability so the
  // UI can show whether a saved password exists. This is a local server/DB
  // lookup — NO radio airtime. We intentionally do NOT auto-login: logging in
  // costs airtime, so it's an explicit user action (the "Log in with saved
  // password" button below).
  useEffect(() => {
    void refreshCapability();
  }, [publicKey, refreshCapability]);

  // Remembered session (#5785): a server/DB lookup, NO radio airtime. A
  // failure just means "nothing to resume".
  const refreshSession = useCallback(async () => {
    try {
      setSession(await actions.getRemoteAdminSession(publicKey));
    } catch {
      setSession(null);
    }
  }, [actions, publicKey]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Human text for a failed login. `no_reply` and `rejected` get their own
  // wording: "Login failed" hid whether to check the password or the link.
  const loginFailureText = useCallback(
    (result: { error?: string; reason?: string; attempts?: number }) => {
      if (result.reason === 'no_reply') {
        return t('meshcore.remoteConsole.login_no_reply', 'No reply from {{name}} after {{count}} attempts', {
          name: contactName,
          count: result.attempts ?? 3,
        });
      }
      if (result.reason === 'rejected') {
        return t('meshcore.remoteConsole.login_rejected', '{{name}} refused the password', { name: contactName });
      }
      return result.error || t('meshcore.remoteConsole.login_failed', 'Login failed');
    },
    [contactName, t],
  );

  const handleLoginCancelled = useCallback(() => {
    setShowLogin(false);
    setLoginPassword('');
    setLoginError(null);
    log(t('meshcore.remoteConsole.login_cancelled', 'Login cancelled'));
    // A reply may have raced the cancel on the server; re-read the saved
    // password state rather than assume.
    void refreshCapability();
  }, [log, refreshCapability, t]);

  // Cancel in the modal: before sending it just closes; while a login is in
  // flight it also stops further attempts (the progress line takes over
  // until the server confirms).
  const handleModalCancel = useCallback(() => {
    if (loginBusy) {
      void cancelLoginAttempt();
    }
    setShowLogin(false);
  }, [cancelLoginAttempt, loginBusy]);

  const handleLogin = useCallback(async () => {
    setLoginBusy(true);
    setLoginError(null);
    const { value: result, cancelledByUser } = await runLogin((requestId) =>
      actions.loginRemote(publicKey, loginPassword, rememberPassword, { requestId }),
    );
    setLoginBusy(false);
    if (cancelledByUser || result.cancelled) {
      handleLoginCancelled();
      return;
    }
    if (!result.success) {
      setLoginError(
        result.code === 'CREDENTIAL_PERSISTENCE_DISABLED'
          ? result.reason || result.error || t('meshcore.remoteConsole.persistence_disabled', 'Saving credentials is disabled')
          : loginFailureText(result),
      );
      return;
    }
    setLoggedIn(true);
    setResumed(false);
    setShowLogin(false);
    setLoginPassword('');
    void refreshSession();
    log(
      result.persisted
        ? t('meshcore.remoteConsole.login_success_persisted', 'Logged in — password saved on this server')
        : t('meshcore.remoteConsole.login_success', 'Logged in'),
    );
    void refreshCapability();
  }, [actions, handleLoginCancelled, log, loginFailureText, loginPassword, publicKey, runLogin, refreshCapability, refreshSession, rememberPassword, t]);

  // On-demand login using the saved password (one click, no re-typing). This
  // is the only place the saved credential is used from the console, and only
  // when the user explicitly asks — never automatically.
  const handleLoginWithSaved = useCallback(async () => {
    setLoginBusy(true);
    setLoginError(null);
    const { value: result, cancelledByUser } = await runLogin((requestId) =>
      actions.loginRemoteWithSaved(publicKey, { requestId }),
    );
    setLoginBusy(false);
    if (cancelledByUser || result.cancelled) {
      handleLoginCancelled();
      return;
    }
    if (result.success) {
      setLoggedIn(true);
      setResumed(false);
      log(t('meshcore.remoteConsole.login_success_saved', 'Logged in with saved password'));
      void refreshCapability();
      void refreshSession();
      return;
    }
    if (result.code === 'CREDENTIAL_KEY_ROTATED') {
      void refreshCapability();
    }
    // A refused password also drops the remembered session server-side.
    if (result.reason === 'rejected') void refreshSession();
    setLoginError(loginFailureText(result));
  }, [actions, handleLoginCancelled, log, loginFailureText, publicKey, refreshCapability, refreshSession, runLogin, t]);

  // Resume the remembered session (#5785): no packet is sent. The node keeps
  // us in its ACL until it is evicted or wiped; if it has dropped us, the
  // first command times out and the transcript says to log in again.
  const handleResume = useCallback(() => {
    setLoggedIn(true);
    setResumed(true);
    setLoginError(null);
    log(t('meshcore.remoteConsole.session_resumed', 'Resumed the saved session. Nothing was sent to the node.'));
  }, [log, t]);

  // Log out (#5785): forget the remembered session on the server. Sends
  // nothing to the node; the next use logs in again.
  const handleLogout = useCallback(async () => {
    const ok = await actions.logoutRemote(publicKey);
    if (ok) {
      setLoggedIn(false);
      setResumed(false);
    }
    log(
      ok
        ? t('meshcore.remoteConsole.logged_out', 'Logged out. The next use will log in again.')
        : t('meshcore.remoteConsole.logout_failed', 'Failed to log out'),
    );
    void refreshSession();
  }, [actions, log, publicKey, refreshSession, t]);

  const handleForgetCredential = useCallback(async () => {
    const ok = await actions.forgetRemoteCredential(publicKey);
    log(
      ok
        ? t('meshcore.remoteConsole.credential_forgotten', 'Stored password forgotten')
        : t('meshcore.remoteConsole.credential_forget_failed', 'Failed to forget stored password'),
    );
    void refreshCapability();
    // Forgetting the password also forgets the remembered session.
    void refreshSession();
  }, [actions, log, publicKey, refreshCapability, refreshSession, t]);

  const isRotatedForThisContact =
    capability?.rotated.some((r) => r.publicKey.toLowerCase() === publicKey.toLowerCase()) ?? false;

  // A usable saved password exists for this contact (stored and decryptable —
  // i.e. not key-rotated). Drives the "✓ Saved password" indicator and the
  // one-click login button.
  const hasSavedCredential =
    (capability?.stored.some((s) => s.publicKey.toLowerCase() === publicKey.toLowerCase()) ?? false) &&
    !isRotatedForThisContact;

  const canResume = !loggedIn && session?.active === true;
  const sessionWhen = session?.loggedInAt ? new Date(session.loggedInAt).toLocaleString() : null;

  return {
    capability,
    loggedIn,
    showLogin,
    setShowLogin,
    loginPassword,
    setLoginPassword,
    rememberPassword,
    setRememberPassword,
    loginBusy,
    loginError,
    setLoginError,
    session,
    resumed,
    loginProgressState,
    cancelLoginAttempt,
    handleModalCancel,
    handleLogin,
    handleLoginWithSaved,
    handleResume,
    handleLogout,
    handleForgetCredential,
    isRotatedForThisContact,
    hasSavedCredential,
    canResume,
    sessionWhen,
  };
}

export type MeshCoreRemoteSession = ReturnType<typeof useMeshCoreRemoteSession>;
