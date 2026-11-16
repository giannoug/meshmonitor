/**
 * Change-password form state and submit, shared by Classic's
 * ChangePasswordModal and the Workspace's You › Change password (Rule X:
 * moved out of the modal unchanged). `forced` is the recovery-code sign-in
 * (#5841): no current password, and `close` refuses until it succeeds.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { logger } from '../../utils/logger';

export function useChangePassword(forced: boolean, onClose: () => void) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if ((!forced && !currentPassword) || !newPassword || !confirmPassword) {
      setError(t('change_password.all_fields_required'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('change_password.min_length'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('change_password.passwords_no_match'));
      return;
    }

    if (!forced && currentPassword === newPassword) {
      setError(t('change_password.must_be_different'));
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/change-password', forced ? { newPassword } : {
        currentPassword,
        newPassword
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      logger.error('Password change error:', err);
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || t('change_password.failed'));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (forced && !success) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return {
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    error, success, loading,
    submit, close,
    /** Submit is off until every field the mode asks for is filled. */
    canSubmit: !(loading || success || (!forced && !currentPassword) || !newPassword || !confirmPassword),
  };
}
