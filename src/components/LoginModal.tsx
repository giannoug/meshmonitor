/**
 * Login Modal Component
 *
 * Provides login interface for both local and OIDC authentication
 * with two-step MFA verification support.
 */

import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSignIn } from './account/useSignIn';
import { passkeysSupported } from '../services/passkeyClient';
import { usePasskeyAutofill, passkeyLoginErrorMessage } from '../hooks/usePasskeyLogin';
import PasskeyLoginButton from './PasskeyLoginButton';
import PasskeyRecoveryLink from './PasskeyRecoveryLink';
import Modal from './common/Modal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { loginWithPasskey, authStatus } = useAuth();
  const {
    username, setUsername, password, setPassword, error, setError, loading,
    mfaRequired, mfaCode, setMfaCode, useBackupCode,
    submitPassword: handleLocalLogin, submitMfa: handleMfaSubmit, toggleBackupCode, resetMfa,
    backToLogin: handleBackToLogin, signInWithOidc: handleOIDCLogin,
  } = useSignIn(onClose);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  const localAuthDisabled = authStatus?.localAuthDisabled ?? false;
  const oidcEnabled = authStatus?.oidcEnabled ?? false;
  // Passkeys (#5841): local accounts only, and only in a secure context.
  const passkeysOn = !localAuthDisabled && passkeysSupported();

  // Offer saved passkeys in the username field's autofill list while open.
  usePasskeyAutofill(isOpen && passkeysOn && !mfaRequired, loginWithPasskey, (err) => {
    setError(passkeyLoginErrorMessage(err, t));
  });

  // Auto-focus username field when modal opens, or MFA field when MFA step shows
  useEffect(() => {
    if (isOpen && mfaRequired && mfaInputRef.current) {
      mfaInputRef.current.focus();
    } else if (isOpen && !localAuthDisabled && usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [isOpen, localAuthDisabled, mfaRequired]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetMfa();
    }
  }, [isOpen, resetMfa]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mfaRequired ? t('mfa.login_title') : t('auth.login')}
    >
      {mfaRequired ? (
        /* MFA Verification Step */
        <form onSubmit={handleMfaSubmit}>
          <div className="mfa-prompt" style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ color: 'var(--color-text-subtle)', fontSize: '14px', margin: 0 }}>
              {useBackupCode ? t('mfa.backup_code_prompt') : t('mfa.login_prompt')}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="mfa-code">
              {useBackupCode ? t('mfa.backup_code_label') : t('mfa.code_label')}
            </label>
            <input
              ref={mfaInputRef}
              id="mfa-code"
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder={useBackupCode ? t('mfa.backup_code_placeholder') : t('mfa.login_placeholder')}
              disabled={loading}
              required
              autoComplete="one-time-code"
              maxLength={useBackupCode ? 8 : 6}
              pattern={useBackupCode ? undefined : '[0-9]{6}'}
              inputMode={useBackupCode ? undefined : 'numeric'}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="button button-primary"
            disabled={loading || !mfaCode}
          >
            {loading ? t('mfa.verifying') : t('mfa.verify_button')}
          </button>

          <div className="mfa-actions" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
            <button
              type="button"
              className="button-link"
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: '4px' }}
              onClick={toggleBackupCode}
            >
              {useBackupCode ? t('mfa.use_totp_code') : t('mfa.use_backup_code')}
            </button>
            <button
              type="button"
              className="button-link"
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: '4px' }}
              onClick={handleBackToLogin}
            >
              {t('mfa.back_to_login')}
            </button>
          </div>
        </form>
      ) : (
        <>
          {passkeysOn && (
            <>
              <PasskeyLoginButton disabled={loading} onError={setError} />
              <div className="login-divider">
                <span>{t('common.or')}</span>
              </div>
            </>
          )}

          {/* Local Authentication */}
          {!localAuthDisabled && (
            <form onSubmit={handleLocalLogin}>
              <div className="form-group">
                <label htmlFor="username">{t('auth.username')}</label>
                <input
                  ref={usernameInputRef}
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
                className="button button-primary"
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
                className="button button-secondary"
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
    </Modal>
  );
};

export default LoginModal;
