/**
 * useRemoteRepeaterSettings: the remote settings state of one Repeater / Room
 * Server (#6256 P10), moved as is out of MeshCoreRemoteSettingsSection so the
 * Workspace's remote target (Task 7.3) keeps it for the node across pages. A
 * group is read only when asked (`readGroup`); `save` sends the changed
 * fields. Errors come back in today's words (`message`).
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  MeshCoreActions,
  RemoteSettingsGroup,
  RepeaterSettingsPatch,
  RepeaterSettingsValues,
} from './useMeshCore';

export function useRemoteRepeaterSettings(
  publicKey: string,
  actions: Pick<MeshCoreActions, 'readRemoteSettings' | 'saveRemoteSettings'>,
) {
  const { t } = useTranslation();
  const [values, setValues] = useState<RepeaterSettingsValues>({});
  const [guestPasswordSet, setGuestPasswordSet] = useState(false);
  const [firmware, setFirmware] = useState<string | null>(null);
  const [loadedGroups, setLoadedGroups] = useState<Set<RemoteSettingsGroup>>(() => new Set());
  const [readingGroup, setReadingGroup] = useState<RemoteSettingsGroup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const describe = useCallback((code: string | undefined, error: string, retryAfterSeconds?: number) => {
    switch (code) {
      case 'ADMIN_SESSION_REQUIRED':
        return t('meshcore.repeater.remote_err_session', 'Log in as admin first. Settings never log in on their own.');
      case 'REMOTE_SETTINGS_BUSY':
        return t('meshcore.repeater.remote_err_busy', 'Another settings read or save is still running on this node.');
      case 'REMOTE_SETTINGS_BUDGET':
        return t('meshcore.repeater.remote_err_budget', {
          minutes: Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60)),
          defaultValue: 'This source has sent its 40 settings commands for these 10 minutes. Try again in about {{minutes}} min.',
        });
      case 'SOURCE_NOT_CONNECTED':
        return t('meshcore.repeater.remote_err_disconnected', 'Connect this source first.');
      default:
        return error;
    }
  }, [t]);

  const readGroup = useCallback(async (group: RemoteSettingsGroup) => {
    setReadingGroup(group);
    setMessage(null);
    try {
      const result = await actions.readRemoteSettings(publicKey, [group]);
      if (!result.ok) {
        setMessage(describe(result.code, result.error, result.retryAfterSeconds));
        return;
      }
      const data = result.data;
      setValues((v) => ({ ...v, ...data.values }));
      if (group === 'access') setGuestPasswordSet(data.guestPasswordSet);
      if (data.firmware) setFirmware(data.firmware);
      setLoadedGroups((g) => new Set(g).add(group));
      if (data.stoppedAt) {
        setMessage(t('meshcore.repeater.remote_read_stopped', {
          key: data.stoppedAt,
          defaultValue: 'The read stopped at {{key}}: no reply. The rest were not read.',
        }));
      }
    } finally {
      setReadingGroup(null);
    }
  }, [actions, publicKey, describe, t]);

  const save = useCallback(async (patch: RepeaterSettingsPatch) => {
    setMessage(null);
    const result = await actions.saveRemoteSettings(publicKey, patch);
    if (!result.ok) {
      setMessage(describe(result.code, result.error, result.retryAfterSeconds));
      return null;
    }
    if (result.data.values) setValues((v) => ({ ...v, ...result.data.values }));
    if (typeof result.data.guestPasswordSet === 'boolean') setGuestPasswordSet(result.data.guestPasswordSet);
    return result.data;
  }, [actions, publicKey, describe]);

  return { values, guestPasswordSet, firmware, loadedGroups, readingGroup, message, readGroup, save };
}
