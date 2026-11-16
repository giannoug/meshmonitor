/**
 * The signed-in user's passkeys: list, add, rename, delete. Shared by Classic's
 * PasskeyManagement and the Workspace's You › Sign-in & security (Rule X:
 * moved out unchanged). Each action calls `done` where the component used to
 * close its form, and resolves true when it went through; a failure shows
 * today's toast (LAST_PASSKEY says why the last one stays).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import { ApiError } from '../../services/api';
import {
  deletePasskey,
  isPasskeyCancel,
  listPasskeys,
  registerPasskey,
  renamePasskey,
  type PasskeySummary,
} from '../../services/passkeyClient';

export const NICKNAME_MAX = 64;

export function usePasskeys() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys());
    } catch (err) {
      logger.error('Failed to load passkeys:', err);
      setPasskeys([]);
      showToast(t('passkey.load_failed'), 'error');
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (nickname: string, done?: () => void): Promise<boolean> => {
    setBusy(true);
    try {
      await registerPasskey(nickname.trim() || null);
      done?.();
      showToast(t('passkey.added'), 'success');
      await load();
      return true;
    } catch (err) {
      if (isPasskeyCancel(err)) return false;
      logger.error('Failed to add passkey:', err);
      const exists = err instanceof ApiError && err.code === 'PASSKEY_EXISTS';
      showToast(exists ? t('passkey.already_registered') : t('passkey.add_failed'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id: number, nickname: string, done?: () => void): Promise<boolean> => {
    setBusy(true);
    try {
      await renamePasskey(id, nickname.trim() || null);
      done?.();
      await load();
      return true;
    } catch (err) {
      logger.error('Failed to rename passkey:', err);
      showToast(t('passkey.rename_failed'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number, done?: () => void): Promise<boolean> => {
    setBusy(true);
    try {
      await deletePasskey(id);
      done?.();
      showToast(t('passkey.deleted'), 'success');
      await load();
      return true;
    } catch (err) {
      logger.error('Failed to delete passkey:', err);
      const last = err instanceof ApiError && err.code === 'LAST_PASSKEY';
      showToast(last ? t('passkey.last_passkey') : t('passkey.delete_failed'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { passkeys, busy, add, rename, remove };
}
