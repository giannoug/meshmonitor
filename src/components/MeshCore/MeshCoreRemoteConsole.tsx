/**
 * MeshCoreRemoteConsole
 *
 * Interactive remote-administration console for a single MeshCore contact
 * (Repeater or Room Server). Mounted by MeshCoreContactDetailPanel when
 * the user has `remote_admin:write` on the source.
 *
 * Responsibilities owned here (vs. CliConsoleBody, the shared primitive):
 *  - Login modal (manual login + "remember password" checkbox).
 *  - Capability fetch — disables remember when SESSION_SECRET is auto-
 *    generated.
 *  - Auto-login on mount when a non-rotated stored credential exists.
 *  - KEY_ROTATED banner + "Forget stored password" action.
 *  - Stats panel mounting (only once logged in).
 *  - Remembered sessions (#5785): on mount it asks the server (DB only, no
 *    airtime) whether a login to this node is remembered. If so, "Resume
 *    session" enables the console with ZERO radio traffic. "Log out" forgets
 *    the remembered session. Still never logs in on its own.
 *
 * Wire model: see meshcoreCredentialStore + POST /admin/login-with-saved
 * for the security invariant that the saved plaintext password never
 * leaves the server process.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreActions } from './hooks/useMeshCore';
import { MeshCoreRemoteStatsPanel } from './MeshCoreRemoteStatsPanel';
import { MeshCoreAclManager } from './MeshCoreAclManager';
import { CliConsoleBody, type CliConsoleBodyHandle } from './CliConsoleBody';
import { REMOTE_ACTION_CATALOG } from './remoteActionCatalog';
import { useSource } from '../../contexts/SourceContext';
import { MeshCoreLoginProgress } from './MeshCoreLoginProgress';
import { useMeshCoreRemoteSession } from './hooks/useMeshCoreRemoteSession';
import './MeshCoreRemoteConsole.css';
import styles from './MeshCoreRemoteConsole.module.css';
import { UiIcon } from '../icons';
import { PasswordField } from '../shared/config/PasswordField';
import { MeshCoreRemoteSettingsSection } from './MeshCoreRemoteSettingsSection';
import type { LoraParams } from '../../utils/loraAirtime';


interface MeshCoreRemoteConsoleProps {
  /** Full 64-char hex public key of the target contact. */
  publicKey: string;
  /** Display name (for log lines and the danger-confirm modal). */
  contactName: string;
  actions: Pick<
    MeshCoreActions,
    | 'loginRemote'
    | 'loginRemoteWithSaved'
    | 'getLoginProgress'
    | 'cancelLogin'
    | 'sendCliCommand'
    | 'getRemoteAdminCapability'
    | 'forgetRemoteCredential'
    | 'getRemoteStatus'
    | 'getRemoteAdminSession'
    | 'logoutRemote'
  > & Partial<Pick<MeshCoreActions, 'readRemoteSettings' | 'saveRemoteSettings'>>;
  /** Hops to the node, or null when no path is known (#6256: sizes the settings cost line). */
  pathHops?: number | null;
  /** This source's radio, for the settings airtime estimate (#6256). */
  radio?: Partial<LoraParams> | null;
  /** True when this MeshCore source is in strict receive-only mode (#4547
   *  Phase 2). Threaded to MeshCoreRemoteStatsPanel; WP3 wires the actual
   *  gating of the login buttons, the console body, and the ACL form. */
  receiveOnly?: boolean;
  /** True when the node is known NOT to be in the companion's own contact
   *  list (#5349). The radio cannot send a login, status request, or CLI
   *  command to it, so those controls are disabled with an explanation. */
  notOnDevice?: boolean;
  /** True when the contact is a Repeater (advType===2). `discover.neighbors`
   *  is simple_repeater-only firmware, so the quick action is only offered
   *  for Repeaters and hidden for Room Servers (#3351). */
  isRepeater?: boolean;
}

export const MeshCoreRemoteConsole: React.FC<MeshCoreRemoteConsoleProps> = ({
  publicKey,
  contactName,
  actions,
  receiveOnly = false,
  notOnDevice = false,
  isRepeater = false,
  pathHops = null,
  radio = null,
}) => {
  const { t } = useTranslation();
  const { sourceId } = useSource();
  // Controls that make the radio address this node are unavailable when
  // receive-only is on OR the radio doesn't hold the node (#5349).
  const blocked = receiveOnly || notOnDevice;
  const blockedTitle = receiveOnly
    ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.')
    : notOnDevice
      ? t('meshcore.not_on_device.control_tooltip', "This node is not in the radio's contact list. Add it to the radio first.")
      : undefined;

  // Imperative handle into the body — used to push "Logged in" info
  // lines into the transcript without lifting transcript state.
  const bodyRef = useRef<CliConsoleBodyHandle | null>(null);
  const log = useCallback((text: string) => bodyRef.current?.appendInfo(text), []);
  // Login, saved password and remembered session (shared with the Workspace, Task 7.3).
  const {
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
  } = useMeshCoreRemoteSession({ publicKey, contactName, actions, log });

  const loginAgainButton = (
    <button
      type="button"
      className="mrc-btn-secondary"
      onClick={() => {
        setLoginError(null);
        if (hasSavedCredential) void handleLoginWithSaved();
        else setShowLogin(true);
      }}
      disabled={loginBusy || blocked}
      title={blockedTitle}
    >
      {loginBusy
        ? t('meshcore.remoteConsole.logging_in', 'Logging in…')
        : t('meshcore.remoteConsole.login_again_button', 'Log in again')}
    </button>
  );

  const runCommand = useCallback(
    (text: string, opts?: { confirm?: boolean }) => actions.sendCliCommand(publicKey, text, opts),
    [actions, publicKey],
  );

  // `discover.neighbors` is simple_repeater-only firmware, so drop it for
  // Room Servers (#3351). Everything else is shared by both device types.
  const actionCatalog = useMemo(
    () => isRepeater ? REMOTE_ACTION_CATALOG : REMOTE_ACTION_CATALOG.filter(a => a.key !== 'discover_neighbors'),
    [isRepeater],
  );

  return (
    <section className="meshcore-remote-console" aria-label={t('meshcore.remoteConsole.title', 'Remote administration')}>
      <header className="mrc-header">
        <h3 className="mrc-title">
          {t('meshcore.remoteConsole.title', 'Remote administration')}
        </h3>
        <div className="mrc-status">
          {loggedIn ? (
            <span className="mrc-status-chip mrc-status-ok">
              {t('meshcore.remoteConsole.session_active', 'Session active')}
            </span>
          ) : canResume ? (
            <span className="mrc-status-chip mrc-status-saved">
              <UiIcon name="check" size={14} /> {t('meshcore.remoteConsole.session_saved', 'Saved session')}
            </span>
          ) : hasSavedCredential ? (
            <span className="mrc-status-chip mrc-status-saved">
              <UiIcon name="check" size={14} /> {t('meshcore.remoteConsole.saved_password', 'Saved password')}
            </span>
          ) : (
            <span className="mrc-status-chip mrc-status-idle">
              {t('meshcore.remoteConsole.not_logged_in', 'Not logged in')}
            </span>
          )}
        </div>
      </header>

      {isRotatedForThisContact && (
        <div className="mrc-banner mrc-banner-warn" role="status">
          <strong>{t('meshcore.remoteConsole.rotated_banner_title', 'Saved password unreadable')}</strong>
          <p>
            {t(
              'meshcore.remoteConsole.rotated_banner_body',
              'The saved password for this node was encrypted with a previous SESSION_SECRET and can no longer be decrypted. Re-enter the password to continue, or forget the stored copy.',
            )}
          </p>
          <button type="button" className="mrc-link-btn" onClick={handleForgetCredential}>
            {t('meshcore.remoteConsole.forget_credential', 'Forget stored password')}
          </button>
        </div>
      )}

      {notOnDevice && (
        <div className="mrc-banner mrc-banner-warn" role="status">
          {t(
            'meshcore.not_on_device.console_banner',
            "The radio can't log in to this node: it is not in the radio's contact list. Add it to the radio first.",
          )}
        </div>
      )}

      {capability && !capability.canRemember && (
        <div className="mrc-banner mrc-banner-info" role="status">
          {t('meshcore.remoteConsole.persistence_disabled_hint', 'Saving passwords is disabled. ')}
          <span className="mrc-muted">{capability.reason}</span>
        </div>
      )}

      <div className="mrc-actions">
        {loggedIn ? (
          <>
            {/* On a resumed session the node may have dropped us: offer a
                fresh login without logging out first. */}
            {resumed && loginAgainButton}
            <button type="button" className="mrc-btn-secondary" onClick={() => void handleLogout()}>
              <UiIcon name="power" size={14} /> {t('meshcore.remoteConsole.logout_button', 'Log out')}
            </button>
            <button type="button" className="mrc-btn-secondary" onClick={handleForgetCredential}>
              {t('meshcore.remoteConsole.forget_credential', 'Forget stored password')}
            </button>
          </>
        ) : canResume ? (
          <>
            <button
              type="button"
              className="mrc-btn-primary"
              onClick={handleResume}
              disabled={loginBusy || blocked}
              title={blockedTitle}
            >
              <UiIcon name="play" size={14} /> {t('meshcore.remoteConsole.resume_button', 'Resume session')}
            </button>
            {loginAgainButton}
          </>
        ) : hasSavedCredential ? (
          <>
            <button
              type="button"
              className="mrc-btn-primary"
              onClick={() => void handleLoginWithSaved()}
              disabled={loginBusy || blocked}
              title={blockedTitle}
            >
              {loginBusy
                ? t('meshcore.remoteConsole.logging_in', 'Logging in…')
                : t('meshcore.remoteConsole.login_with_saved_button', 'Log in with saved password')}
            </button>
            <button
              type="button"
              className="mrc-btn-secondary"
              onClick={() => setShowLogin(true)}
              disabled={loginBusy || blocked}
              title={blockedTitle}
            >
              {t('meshcore.remoteConsole.login_different', 'Use a different password')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="mrc-btn-primary"
            onClick={() => {
              setLoginError(null);
              setShowLogin(true);
            }}
            disabled={loginBusy || blocked}
            title={blockedTitle}
          >
            {t('meshcore.remoteConsole.login_button', 'Log in to {{name}}', { name: contactName })}
          </button>
        )}
      </div>

      {canResume && (
        <p className={styles.sessionNote}>
          {sessionWhen
            ? t('meshcore.remoteConsole.session_note', 'Logged in {{when}}. Resuming sends nothing; the node keeps the login until it drops it.', { when: sessionWhen })
            : t('meshcore.remoteConsole.session_note_no_time', 'Resuming sends nothing; the node keeps the login until it drops it.')}
        </p>
      )}

      {loginProgressState && !showLogin && (
        <MeshCoreLoginProgress progress={loginProgressState} onCancel={() => void cancelLoginAttempt()} />
      )}
      {loginError && !showLogin && !loginProgressState && (
        <div className="mrc-banner mrc-banner-warn" role="alert">{loginError}</div>
      )}

      {loggedIn && (
        <MeshCoreRemoteStatsPanel
          publicKey={publicKey}
          fetchStatus={actions.getRemoteStatus}
          receiveOnly={receiveOnly}
        />
      )}

      {loggedIn && actions.readRemoteSettings && actions.saveRemoteSettings && (
        <MeshCoreRemoteSettingsSection
          publicKey={publicKey}
          deviceType={isRepeater ? 'repeater' : 'room'}
          actions={{ readRemoteSettings: actions.readRemoteSettings, saveRemoteSettings: actions.saveRemoteSettings }}
          pathHops={pathHops}
          radio={radio}
          disabled={blocked}
        />
      )}

      <CliConsoleBody
        ref={bodyRef}
        targetId={publicKey}
        targetName={contactName}
        history={sourceId ? { sourceId, target: publicKey } : undefined}
        runCommand={runCommand}
        actionCatalog={loggedIn ? actionCatalog : []}
        disabled={!loggedIn || blocked}
        disabledPlaceholder={blockedTitle}
        timeoutHint={
          resumed
            ? t('meshcore.remoteConsole.resumed_timeout_hint', 'No reply. If the node rebooted or dropped the session, log in again.')
            : undefined
        }
      />

      {loggedIn && <MeshCoreAclManager bodyRef={bodyRef} disabled={receiveOnly} />}

      {showLogin && (
        <div
          className="mrc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mrc-login-title"
          onClick={() => !loginBusy && setShowLogin(false)}
        >
          <div className="mrc-modal" onClick={(e) => e.stopPropagation()}>
            <h4 id="mrc-login-title">
              {t('meshcore.remoteConsole.login_modal_title', 'Log in to {{name}}', { name: contactName })}
            </h4>
            <label className="mrc-modal-label">
              {t('meshcore.remoteConsole.password_label', 'Password')}
              <PasswordField
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="off"
                autoFocus
                disabled={loginBusy}
                className="mrc-input"
              />
            </label>
            <p className="mrc-modal-hint">
              {t(
                'meshcore.remoteConsole.password_hint',
                'Leave blank for guest access. Admin commands require the node’s configured admin password.',
              )}
            </p>
            <label
              className={`mrc-modal-checkbox${capability && !capability.canRemember ? ' mrc-disabled' : ''}`}
              title={capability && !capability.canRemember ? capability.reason : undefined}
            >
              <input
                type="checkbox"
                checked={rememberPassword}
                disabled={!capability?.canRemember || loginBusy}
                onChange={(e) => setRememberPassword(e.target.checked)}
              />
              {t('meshcore.remoteConsole.remember_password', 'Remember this password on the server')}
            </label>
            {loginProgressState && (
              <MeshCoreLoginProgress progress={loginProgressState} onCancel={handleModalCancel} />
            )}
            {loginError && <div className="mrc-modal-error">{loginError}</div>}
            <div className="mrc-modal-actions">
              <button
                type="button"
                className="mrc-btn-secondary"
                onClick={handleModalCancel}
              >
                {t('meshcore.remoteConsole.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="mrc-btn-primary"
                onClick={() => void handleLogin()}
                disabled={loginBusy || blocked}
                title={blockedTitle}
              >
                {loginBusy
                  ? t('meshcore.remoteConsole.logging_in', 'Logging in…')
                  : t('meshcore.remoteConsole.login_confirm', 'Log in')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
