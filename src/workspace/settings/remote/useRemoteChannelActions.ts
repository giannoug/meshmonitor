/**
 * A remote node's channel writes (Task 5.9): today's Admin Commands
 * `setChannel` for one slot, from the channel page's own Save (Ruling 5.5),
 * one admin packet each. Today's remote rules: a disabled channel goes out
 * with no name and no key, an empty key field keeps the node's key, and AEAD
 * goes back as the node reported it (set_channel replaces the whole slot).
 * The slot shows what was sent; it is not read back.
 */
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ToastContainer';
import { MAX_NAME_LENGTH, type EditingState, type useChannelActions } from '../../../components/configuration/channelSlots';
import { useRemoteTarget } from './useRemoteTarget';

export function useRemoteChannelActions(): ReturnType<typeof useChannelActions> | null {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const remote = useRemoteTarget();
  if (!remote) return null;
  const write = async (slotId: number, config: { name: string; psk?: string; role: number; uplinkEnabled: boolean; downlinkEnabled: boolean; positionPrecision?: number }) => {
    const loaded = remote.channels?.find((c) => c.id === slotId);
    try {
      await remote.execute('setChannel', { channelIndex: slotId, config: { ...config, useAead: loaded?.useAead } });
      if (loaded) remote.setChannel({ ...loaded, ...config, psk: config.psk ?? loaded.psk });
      return true;
    } catch {
      return false;
    }
  };
  return {
    save: async ({ slotId, draft }: EditingState) => {
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
    },
    // Today's way to drop a remote channel: disable its slot.
    remove: (slotId: number) => write(slotId, { name: '', role: 0, uplinkEnabled: false, downlinkEnabled: false }),
    exportJson: async () => {},
    importJson: async () => false,
  } as unknown as ReturnType<typeof useChannelActions>;
}
