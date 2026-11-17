/**
 * Sign-in state and handlers shared by Classic's LoginPage, LoginModal,
 * PasskeyLoginButton and PasskeyRecoveryLink and the Workspace's SignInCard
 * (Rule X: moved out of those components unchanged). The same requests in the
 * same order (password → MFA step → session; passkey; recovery code; OIDC
 * redirect), the same rate-limit and error words, no retries.
 */
import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../services/api';
import { passkeyLoginErrorMessage } from '../../hooks/usePasskeyLogin';
import { logger } from '../../utils/logger';

/** "Wait N minutes" (#2784), or the generic rate-limit words without a Retry-After. */
function rateLimitMessage(err: ApiError, t: TFunction): string {
  const minutes = err.retryAfterSeconds ? Math.max(1, Math.ceil(err.retryAfterSeconds / 60)) : null;
  return minutes !== null ? t('auth.rate_limited', { minutes }) : t('auth.rate_limited_generic');
}

/** The message for a failed password sign-in. */
export function passwordLoginErrorMessage(err: unknown, t: TFunction): string {
  // Rate limit: surface as a distinct, non-credential-specific message so the
  // user knows to wait rather than keep trying passwords (#2784).
  if (err instanceof ApiError && err.status === 429) return rateLimitMessage(err, t);
  // CSRF token is stale (e.g. server restarted, session rotated). The
  // old "Session cookie" message pointed users at the wrong causes
  // (#2783). Direct them at the real fix: reload the page.
  if (err instanceof ApiError && err.status === 403 && err.code?.startsWith('CSRF_')) return t('auth.session_expired');
  if (err instanceof Error && err.message.includes('Session cookie')) return err.message;
  return t('auth.invalid_credentials');
}

/**
 * Username/password, then the MFA step when the server asks for it, and OIDC.
 * `onSignedIn` runs where LoginModal closed itself (the page reloads anyway).
 */
export function useSignIn(onSignedIn?: () => void) {
  const { t } = useTranslation();
  const { login, verifyMfa, loginWithOIDC } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.requireMfa) {
        // Show MFA input step
        setMfaRequired(true);
        setLoading(false);
        return;
      }
      onSignedIn?.();
      setUsername('');
      setPassword('');
    } catch (err) {
      logger.error('Login error:', err);
      setError(passwordLoginErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyMfa(mfaCode, useBackupCode);
      // On success, page will reload via AuthContext
      onSignedIn?.();
    } catch (err) {
      logger.error('MFA verification error:', err);
      setError(t('mfa.invalid_code'));
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setMfaCode('');
    setError(null);
  };

  /** Leaves the MFA step (LoginModal's reset on close). */
  const resetMfa = useCallback(() => {
    setMfaRequired(false);
    setMfaCode('');
    setUseBackupCode(false);
    setError(null);
  }, []);

  const backToLogin = () => {
    resetMfa();
    setPassword('');
  };

  const signInWithOidc = async () => {
    setError(null);
    setLoading(true);

    try {
      await loginWithOIDC();
      // User will be redirected to OIDC provider
    } catch (err) {
      logger.error('OIDC login error:', err);
      setError(t('auth.oidc_failed'));
      setLoading(false);
    }
  };

  return {
    username, setUsername, password, setPassword, error, setError, loading,
    mfaRequired, mfaCode, setMfaCode, useBackupCode,
    submitPassword, submitMfa, toggleBackupCode, resetMfa, backToLogin, signInWithOidc,
  };
}

/** "Sign in with a passkey": `onError` gets the message, or null to clear it. */
export function usePasskeySignIn(onError: (message: string | null) => void) {
  const { t } = useTranslation();
  const { loginWithPasskey } = useAuth();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    onError(null);
    setBusy(true);
    try {
      await loginWithPasskey();
      // On success the page reloads.
    } catch (err) {
      onError(passkeyLoginErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return { busy, signIn };
}

/** "Lost your passkey? Use a recovery code" (#5841, D2): username + code. */
export function useRecoveryCodeSignIn() {
  const { t } = useTranslation();
  const { recoverWithCode } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await recoverWithCode(username.trim(), code.trim());
      // On success the page reloads.
    } catch (err) {
      logger.debug('Recovery-code sign-in failed:', err);
      setError(err instanceof ApiError && err.status === 429 ? rateLimitMessage(err, t) : t('passkey_only.recover_failed'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  /** PasskeyRecoveryLink's Cancel: drop the error and the code. */
  const cancel = () => {
    setError(null);
    setCode('');
  };

  return { username, setUsername, code, setCode, busy, error, submit, cancel };
}
