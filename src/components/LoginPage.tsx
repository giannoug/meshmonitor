/**
 * Login Page Component
 *
 * Full-page login screen displayed when DISABLE_ANONYMOUS is enabled
 * Shows MeshMonitor logo, login form, version, and GitHub link
 * Supports two-step login when MFA is enabled
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSignIn } from './account/useSignIn';
import { passkeysSupported } from '../services/passkeyClient';
import { usePasskeyAutofill, passkeyLoginErrorMessage } from '../hooks/usePasskeyLogin';
import PasskeyLoginButton from './PasskeyLoginButton';
import PasskeyRecoveryLink from './PasskeyRecoveryLink';
import { version } from '../../package.json';
import PrivacyLinks from './PrivacyLinks';
import MeshMonitorLogo from './MeshMonitorLogo';
import { appBasename } from '../init';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { loginWithPasskey, authStatus } = useAuth();
  const {
    username, setUsername, password, setPassword, error, setError, loading,
    mfaRequired, mfaCode, setMfaCode, useBackupCode,
    submitPassword: handleLocalLogin, submitMfa: handleMfaSubmit, toggleBackupCode,
    backToLogin: handleBackToLogin, signInWithOidc: handleOIDCLogin,
  } = useSignIn();

  const localAuthDisabled = authStatus?.localAuthDisabled ?? false;
  const oidcEnabled = authStatus?.oidcEnabled ?? false;
  // Passkeys (#5841): local accounts only, and only in a secure context.
  const passkeysOn = !localAuthDisabled && passkeysSupported();

  // Offer saved passkeys in the username field's autofill list.
  usePasskeyAutofill(passkeysOn && !mfaRequired, loginWithPasskey, (err) => {
    setError(passkeyLoginErrorMessage(err, t));
  });

  // Optional login-page branding from CUSTOM_TITLE / CUSTOM_LOGO_URL env vars.
  // The server already trims/validates these and sends null when unset, so we
  // just fall back to the default MeshMonitor title and inline SVG here.
  const customTitle = authStatus?.customTitle || 'MeshMonitor';
  const customLogoUrl = authStatus?.customLogoUrl || null;

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo — custom image when CUSTOM_LOGO_URL is set, otherwise the default SVG */}
        <div className="login-logo">
          {customLogoUrl ? (
            <img
              src={customLogoUrl}
              alt={customTitle}
              width="120"
              height="120"
              className="login-logo-image"
            />
          ) : (
            <MeshMonitorLogo size={120} />
          )}
          <h1>{customTitle}</h1>
        </div>

        {/* Login Form */}
        <div className="login-form-container">
          {mfaRequired ? (
            /* MFA Verification Step */
            <form onSubmit={handleMfaSubmit} className="login-form">
              <div className="mfa-prompt">
                <p>{useBackupCode ? t('mfa.backup_code_prompt') : t('mfa.login_prompt')}</p>
              </div>

              <div className="form-group">
                <label htmlFor="mfa-code">
                  {useBackupCode ? t('mfa.backup_code_label') : t('mfa.login_placeholder')}
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode={useBackupCode ? 'text' : 'numeric'}
                  pattern={useBackupCode ? undefined : '[0-9]*'}
                  maxLength={useBackupCode ? 8 : 6}
                  placeholder={useBackupCode ? t('mfa.backup_code_placeholder') : '000000'}
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="button button-primary login-button"
                disabled={loading || !mfaCode}
              >
                {loading ? t('auth.logging_in') : t('mfa.verify_button')}
              </button>

              <div className="mfa-actions">
                <button
                  type="button"
                  className="button-link"
                  onClick={toggleBackupCode}
                >
                  {useBackupCode ? t('mfa.use_totp_code') : t('mfa.use_backup_code')}
                </button>
                <button
                  type="button"
                  className="button-link"
                  onClick={handleBackToLogin}
                >
                  {t('common.back')}
                </button>
              </div>
            </form>
          ) : (
            /* Normal Login Step */
            <>
              {passkeysOn && (
                <>
                  <PasskeyLoginButton
                    className="login-button"
                    disabled={loading}
                    onError={setError}
                  />
                  <div className="login-divider">
                    <span>{t('common.or')}</span>
                  </div>
                </>
              )}

              {!localAuthDisabled && (
                <form onSubmit={handleLocalLogin} className="login-form">
                  <div className="form-group">
                    <label htmlFor="username">{t('auth.username')}</label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete={passkeysOn ? 'username webauthn' : 'username'}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">{t('auth.password')}</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  {error && (
                    <div className="error-message">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="button button-primary login-button"
                    disabled={loading || !username || !password}
                  >
                    {loading ? t('auth.logging_in') : t('auth.login')}
                  </button>
                </form>
              )}

              {/* Passkey-only accounts sign in with a recovery code here (#5841). */}
              {!localAuthDisabled && <PasskeyRecoveryLink disabled={loading} />}

              {/* Divider between auth methods */}
              {!localAuthDisabled && oidcEnabled && (
                <div className="login-divider">
                  <span>{t('common.or')}</span>
                </div>
              )}

              {/* OIDC Authentication */}
              {oidcEnabled && (
                <>
                  {error && localAuthDisabled && (
                    <div className="error-message">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    className="button button-secondary login-button"
                    onClick={handleOIDCLogin}
                    disabled={loading}
                  >
                    {t('auth.login_with_oidc')}
                  </button>
                </>
              )}

              {/* Show message if only OIDC is available */}
              {localAuthDisabled && !oidcEnabled && (
                <div className="error-message">
                  {t('auth.local_disabled_no_oidc')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Version and GitHub Link */}
        <div className="login-footer">
          <div className="version">{t('common.version')} {version}</div>
          <a
            href="https://github.com/yeraze/meshmonitor"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            {t('common.view_on_github')}
          </a>
          {/* Disclosure links (#5156) — the login screen is where an anonymous
              visitor to a public instance most often lands first. */}
          <PrivacyLinks basename={appBasename} />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
