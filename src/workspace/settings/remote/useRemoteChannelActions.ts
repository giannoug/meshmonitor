/**
 * A remote node's channel writes (Task 5.9): today's Admin Commands
 * `setChannel` for one slot, one admin packet each, from the channel page's own
 * Save, its Delete (the slot disabled, as today's remote edit does), and a
 * channel JSON import. Today's remote rules: a disabled channel goes out with
 * no name and no key, an empty key field keeps the node's key, and AEAD goes
 * back as the node reported it (set_channel replaces the whole slot). The slot
 * shows what was sent; it is not read back. Export writes the file from the
 * slot as read, with no request (Ruling 5.9 Channels).
 */
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ToastContainer';
import { MAX_NAME_LENGTH, type EditingState, type useChannelActions } from '../../../components/configuration/channelSlots';
import { ApiError } from '../../../services/api';
import { useRemoteTarget } from './useRemoteTarget';

type ChannelConfig = { name: string; psk?: string; role: number; uplinkEnabled: boolean; downlinkEnabled: boolean; positionPrecision?: number; useAead?: boolean };

/** Today's import rule for a flag that may come as a boolean, 0/1 or "true"/"1". */
const flag = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  return !!value;
};

export function useRemoteChannelActions(): ReturnType<typeof useChannelActions> | null {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const remote = useRemoteTarget();
  if (!remote) return null;

  const write = async (slotId: number, config: ChannelConfig) => {
    const loaded = remote.channels?.find((c) => c.id === slotId);
    remote.markSent('channels', 'sending');
    try {
      await remote.execute('setChannel', { channelIndex: slotId, config: { ...config, useAead: 'useAead' in config ? config.useAead : loaded?.useAead } });
      remote.markSent('channels', 'sent');
      if (loaded) remote.setChannel({ ...loaded, ...config, psk: config.psk ?? loaded.psk });
      return true;
    } catch (error) {
      remote.markSent('channels', error instanceof ApiError && error.code === 'PASSKEY_TIMEOUT' ? 'noReply' : undefined);
      return false;
    }
  };

  const save = async ({ slotId, draft }: EditingState) => {
    if (draft.name.length > MAX_NAME_LENGTH) {
      showToast(t('admin_commands.channel_name_max_length'), 'error');
      return false;
    }
    const off = draft.role === 0;
    return write(slotId, {
      name: off ? '' : draft.name,
      psk: off ? undefined : draft.psk || undefined,
      role: draft.role,
      uplinkEnabled: draft.uplinkEnabled,
      downlinkEnabled: draft.downlinkEnabled,
      positionPrecision: draft.positionPrecision,
    });
  };

  // Disabling the slot, as today's remote edit with role Disabled does.
  const remove = async (slotId: number) => {
    const ch = remote.channels?.find((c) => c.id === slotId);
    return write(slotId, { name: '', role: 0, uplinkEnabled: ch?.uplinkEnabled ?? false, downlinkEnabled: ch?.downlinkEnabled ?? false, positionPrecision: ch?.positionPrecision });
  };

  // Today's remote export file, from the slot as read (today asks the node for it again first).
  const exportJson = async (slotId: number) => {
    const ch = remote.channels?.find((c) => c.id === slotId);
    if (!ch) return;
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      channel: {
        id: slotId,
        name: ch.name || '',
        psk: ch.psk || '',
        role: ch.role,
        uplinkEnabled: flag(ch.uplinkEnabled, true),
        downlinkEnabled: flag(ch.downlinkEnabled, true),
        positionPrecision: ch.positionPrecision,
        useAead: flag(ch.useAead, false),
      },
    };
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshmonitor-channel-${(ch.name || 'unnamed').replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast(t('admin_commands.channel_exported_successfully', { channelId: slotId }), 'success');
  };

  // Today's remote import: one setChannel with the file's channel.
  const importJson = async (slotId: number, content: string) => {
    let channel: Record<string, unknown>;
    try {
      const parsed = JSON.parse(content) as { channel?: Record<string, unknown> };
      if (!parsed.channel) throw new Error(t('admin_commands.invalid_import_format'));
      channel = parsed.channel;
    } catch (error) {
      showToast((error as Error).message || 'Failed to import channel', 'error');
      return false;
    }
    if (typeof channel.name === 'string' && channel.name.length > MAX_NAME_LENGTH) {
      showToast(t('admin_commands.channel_name_max_length'), 'error');
      return false;
    }
    const ok = await write(slotId, {
      name: typeof channel.name === 'string' ? channel.name : '',
      psk: typeof channel.psk === 'string' && channel.psk ? channel.psk : undefined,
      role: typeof channel.role === 'number' ? channel.role : slotId === 0 ? 1 : 0,
      uplinkEnabled: flag(channel.uplinkEnabled, true),
      downlinkEnabled: flag(channel.downlinkEnabled, true),
      positionPrecision: typeof channel.positionPrecision === 'number' ? channel.positionPrecision : 32,
      // An older file has no flag, and a remote node has no stored row to fall back on (#5248).
      useAead: channel.useAead !== undefined ? flag(channel.useAead, false) : undefined,
    });
    if (ok) showToast(t('admin_commands.channel_imported_successfully', { importSlotId: slotId }), 'success');
    return ok;
  };

  return { save, remove, exportJson, importJson };
}
