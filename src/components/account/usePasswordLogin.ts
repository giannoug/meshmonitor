/**
 * The passkey-only switch (#5841, spec §8), shared by Classic's
 * PasswordLoginControl and the Workspace's You › Sign-in & security (Rule X:
 * moved out unchanged). Turning password sign-in off runs a fresh passkey
 * prompt (D6), asks the only admin to type DISABLE (D3), then shows the
 * recovery codes once (D2). Turning it back on needs only the session. The
 * codes live only in `codes`: `codesClosed` or unmounting drops them.
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import { ApiError } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import {
  LAST_ADMIN_CONFIRM,
  getPasswordLoginState,
  isPasskeyCancel,
  runStepUp,
  turnOffPasswordLogin,
  turnOnPasswordLogin,
  type PasswordLoginState,
} from '../../services/passkeyClient';

export type PasswordLoginStep = 'idle' | 'explain' | 'confirm';

export function usePasswordLogin() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  // Optional: lets the user menu drop "Change Password" once the switch flips.
  const auth = useContext(AuthContext);

  const [state, setState] = useState<PasswordLoginState | null>(null);
  const [step, setStep] = useState<PasswordLoginStep>('idle');
  const [busy, setBusy] = useState(false);
  const [assertion, setAssertion] = useState<AuthenticationResponseJSON | null>(null);
  const [typed, setTyped] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getPasswordLoginState());
    } catch (err) {
      logger.error('Failed to load password sign-in state:', err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setStep('idle');
    setAssertion(null);
    setTyped('');
  };

  const showError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : undefined;
    const key =
      code === 'STEP_UP_FAILED' ? 'passkey_only.step_up_failed'
      : code === 'PASSKEY_CHALLENGE_EXPIRED' ? 'passkey_only.expired'
      : code === 'NO_PASSKEYS' ? 'passkey_only.need_passkey'
      : 'passkey_only.turn_off_failed';
    showToast(t(key), 'error');
  };

  const finishOff = async (signed: AuthenticationResponseJSON, confirm?: string) => {
    const result = await turnOffPasswordLogin(signed, confirm);
    if ('requireConfirm' in result) {
      setAssertion(signed);
      setStep('confirm');
      return;
    }
    if (result.disabled) {
      reset();
      setCodes(result.recoveryCodes);
    }
  };

  /** The explain step's Continue: the step-up prompt, then the request. */
  const continueOff = async () => {
    setBusy(true);
    try {
      const signed = await runStepUp();
      await finishOff(signed);
    } catch (err) {
      if (!isPasskeyCancel(err)) {
        logger.error('Turning off password sign-in failed:', err);
        showError(err);
        reset();
      }
    } finally {
      setBusy(false);
    }
  };

  /** The only admin's DISABLE confirm: resends the same assertion with `word`. */
  const confirmOff = async (word: string) => {
    if (!assertion || word !== LAST_ADMIN_CONFIRM) return;
    setBusy(true);
    try {
      await finishOff(assertion, LAST_ADMIN_CONFIRM);
    } catch (err) {
      logger.error('Turning off password sign-in failed:', err);
      showError(err);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      await turnOnPasswordLogin();
      showToast(t('passkey_only.turned_on'), 'success');
      await load();
      void auth?.refreshAuth();
    } catch (err) {
      logger.error('Turning on password sign-in failed:', err);
      showToast(t('passkey_only.turn_on_failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const codesClosed = () => {
    setCodes(null);
    showToast(t('passkey_only.turned_off'), 'success');
    void load();
    void auth?.refreshAuth();
  };

  return {
    state, step, setStep, busy, typed, setTyped, codes,
    username: auth?.authStatus?.user?.username ?? '',
    reset, continueOff, confirmOff, turnOn, codesClosed,
  };
}
