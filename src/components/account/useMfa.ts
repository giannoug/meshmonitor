/**
 * TOTP two-factor state and actions, shared by Classic's MFAManagement and
 * the Workspace's You › Sign-in & security (Rule X: moved out unchanged).
 * The setup secret, QR and backup codes live only in `setupData`: verifying,
 * cancelling or unmounting drops them.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export type MfaState = 'loading' | 'disabled' | 'setup' | 'enabled';

export interface SetupData {
  qrCodeDataUrl: string;
  secret: string;
  backupCodes: string[];
}

export function useMfa() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { refreshAuth } = useAuth();
  const [state, setState] = useState<MfaState>('loading');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [useBackupCodeForDisable, setUseBackupCodeForDisable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get<{ enabled: boolean }>('/api/mfa/status');
      setState(data.enabled ? 'enabled' : 'disabled');
    } catch (error) {
      logger.error('Failed to load MFA status:', error);
      setState('disabled');
    }
  };

  const startSetup = async () => {
    try {
      setLoading(true);
      const data = await api.post<SetupData>('/api/mfa/setup');
      setSetupData(data);
      setState('setup');
      setBackupCodesCopied(false);
    } catch (error) {
      logger.error('Failed to start MFA setup:', error);
      showToast(t('mfa.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/api/mfa/verify-setup', { token: verifyCode });
      setState('enabled');
      setSetupData(null);
      setVerifyCode('');
      showToast(t('mfa.enabled_success'), 'success');
      void refreshAuth();
    } catch (error) {
      logger.error('Failed to verify MFA setup:', error);
      showToast(t('mfa.invalid_code'), 'error');
      setVerifyCode('');
    } finally {
      setLoading(false);
    }
  };

  const disable = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      setLoading(true);
      const body = useBackupCodeForDisable
        ? { backupCode: disableCode }
        : { token: disableCode };
      await api.post('/api/mfa/disable', body);
      setState('disabled');
      setDisableCode('');
      setShowDisableConfirm(false);
      showToast(t('mfa.disabled_success'), 'success');
      void refreshAuth();
    } catch (error) {
      logger.error('Failed to disable MFA:', error);
      showToast(t('mfa.invalid_code'), 'error');
      setDisableCode('');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (setupData) {
      void navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      showToast(t('mfa.backup_codes_copied'), 'success');
      setBackupCodesCopied(true);
    }
  };

  return {
    state, setupData, verifyCode, setVerifyCode, disableCode, setDisableCode,
    useBackupCodeForDisable, setUseBackupCodeForDisable, loading,
    showDisableConfirm, setShowDisableConfirm, backupCodesCopied,
    startSetup, verifySetup, disable, copyBackupCodes,
    cancelSetup: () => { setState('disabled'); setSetupData(null); },
  };
}
