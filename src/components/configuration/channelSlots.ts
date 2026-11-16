/**
 * Meshtastic channel slots: the drafts, checks and writes behind today's
 * ChannelsConfigSection (#5829), shared with the Workspace Channels pages
 * (#6365) so both write exactly the same packets in the same order.
 *
 * - Drafts: what a card opens with, and what a save sends (`pskForSave`,
 *   `aeadForSave`, #5826 / #5248).
 * - `useChannelCollisions`: device channels sharing a key with a differently
 *   named Channel Database entry (#3644).
 * - `useChannelReorder`: the local drag order and Apply Order (the device reboots).
 * - `useChannelActions`: one set_channel write per save, the two-step delete,
 *   JSON export and import, each with today's toasts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useToast } from '../ToastContainer';
import type { Channel } from '../../types/device';
import { logger } from '../../utils/logger';
import { NO_ENCRYPTION_PSK, pskEncryptionStatus, type PskEncryptionStatus } from '../../utils/publicChannel';
import { generateChannelKey } from '../shared/config/channelKey';

/** A device channel sharing its key with a differently-named Channel Database
 *  (server-decryption) entry (#3644). */
export interface ChannelCollision {
  channelId: number;
  channelName: string;
  dbId: number;
  dbName: string;
}

export const SLOT_COUNT = 8;
export const ALL_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];
export const MAX_NAME_LENGTH = 11;
/** Key lengths the firmware accepts: none, the 1-byte default index, AES-128, AES-256. */
export const PSK_ALLOWED_BYTES = [0, 1, 16, 32] as const;
export const PSK_GENERATE_BYTES = 32;
export const ROLE_LABEL_KEYS: Record<number, string> = {
  0: 'channels_config.role_disabled',
  1: 'channels_config.role_primary',
  2: 'channels_config.role_secondary',
};

// Resolve encryption status for a Channel: prefer the server-derived
// `encryptionStatus` field (always present on API responses) and fall back
// to deriving from `psk`. The API only sends `psk` to authorized writers
// (issue #2951), so unauthorized callers MUST rely on `encryptionStatus`.
export const channelEncryptionStatus = (channel: Pick<Channel, 'encryptionStatus' | 'psk'>): PskEncryptionStatus =>
  channel.encryptionStatus ?? pskEncryptionStatus(channel.psk);

/** A slot holds a channel unless it is missing or DISABLED (role 0). */
export const isConfigured = (channel: Channel | undefined): channel is Channel =>
  !!channel && channel.role !== 0;

export interface ChannelDraft {
  name: string;
  psk: string;
  role: number;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  positionPrecision: number;
  /** ChannelSettings.use_aead (#5248). */
  useAead: boolean;
}

export interface EditingState {
  slotId: number;
  /** A slot opened by "Add channel" rather than an existing channel. */
  isNew: boolean;
  draft: ChannelDraft;
  /** The draft the card opened with, for Cancel and the unsaved check. */
  original: ChannelDraft;
}

/** What a slot's card opens with: a new channel on a free slot, else the channel as the device holds it. */
export function openDraft(slotId: number, isNew: boolean, ch: Channel | undefined): EditingState {
  const draft: ChannelDraft = isNew
    ? {
        name: `Channel ${slotId}`,
        // A new channel starts with its own random key rather than whatever
        // the disabled slot last held.
        psk: generateChannelKey(PSK_GENERATE_BYTES, 'base64'),
        role: slotId === 0 ? 1 : 2,
        uplinkEnabled: false,
        downlinkEnabled: false,
        positionPrecision: 0,
        useAead: false,
      }
    : {
        name: ch?.name ?? '',
        // The "encryption off" key shows as an empty field, which is how the
        // user asked for it (#5826).
        psk: ch?.psk === NO_ENCRYPTION_PSK ? '' : (ch?.psk ?? ''),
        role: ch?.role ?? (slotId === 0 ? 1 : 2),
        uplinkEnabled: ch?.uplinkEnabled ?? true,
        downlinkEnabled: ch?.downlinkEnabled ?? true,
        positionPrecision: ch?.positionPrecision ?? 32,
        useAead: !!ch?.useAead,
      };
  return { slotId, isNew, draft, original: draft };
}

/**
 * The `psk` to send on save (#5826). The server keeps the stored key when
 * `psk` is absent and turns encryption off for an explicit ''. So send '' only
 * when the user emptied a field that held a key (or a new channel); a field
 * that opened empty (no key, or a reader who never got one) keeps whatever
 * the device has.
 */
export const pskForSave = (edit: EditingState): string | undefined => {
  if (edit.draft.psk !== '') return edit.draft.psk;
  return edit.isNew || edit.original.psk !== '' ? '' : undefined;
};

/**
 * The `useAead` to send on save (#5248). Absent keeps the device's setting
 * (the server sends the stored flag back), so send it only when the user
 * changed it, or when the key was cleared: firmware clears use_aead on a
 * keyless channel, so the stored flag should follow.
 */
export const aeadForSave = (edit: EditingState): { useAead?: boolean } => {
  const keyless = edit.draft.psk === '';
  if (edit.draft.useAead && keyless) return { useAead: false };
  return edit.draft.useAead !== edit.original.useAead ? { useAead: edit.draft.useAead } : {};
};

export const draftsEqual = (a: ChannelDraft, b: ChannelDraft): boolean =>
  a.name === b.name &&
  a.psk === b.psk &&
  a.role === b.role &&
  a.uplinkEnabled === b.uplinkEnabled &&
  a.downlinkEnabled === b.downlinkEnabled &&
  a.positionPrecision === b.positionPrecision &&
  a.useAead === b.useAead;

/**
 * Roles the select offers. A new card is Primary on slot 0 and Secondary
 * elsewhere; Delete stands in for Disabled. An existing card offers Primary
 * only on slot 0, when it already is primary, or when no other channel is,
 * so the UI never sets up two primaries (the server does not check).
 */
export function roleOptions(channels: Channel[], edit: EditingState): number[] {
  if (edit.isNew) return edit.slotId === 0 ? [1] : [2];
  const otherPrimary = channels.some(c => c.id !== edit.slotId && c.id >= 0 && c.id < SLOT_COUNT && c.role === 1);
  const allowPrimary = edit.slotId === 0 || edit.original.role === 1 || !otherPrimary;
  return allowPrimary ? [0, 1, 2] : [0, 2];
}

/** Channels by slot (0–7). */
export function useChannelBySlot(channels: Channel[]): Map<number, Channel> {
  return useMemo(() => {
    const m = new Map<number, Channel>();
    for (const ch of channels) if (ch.id >= 0 && ch.id < SLOT_COUNT) m.set(ch.id, ch);
    return m;
  }, [channels]);
}

/** The lowest slot without a channel; null when all eight are in use. */
export function nextFreeSlot(channelBySlot: Map<number, Channel>): number | null {
  for (const slot of ALL_SLOTS) if (!isConfigured(channelBySlot.get(slot))) return slot;
  return null;
}

/** Auto-position channel: lowest-index channel with positionPrecision > 0. */
export function autoPositionChannelId(channels: Channel[]): number | null {
  const sorted = channels
    .filter(ch => (ch.positionPrecision ?? 0) > 0)
    .sort((a, b) => a.id - b.id);
  return sorted.length > 0 ? sorted[0].id : null;
}

/**
 * #3644: device channels whose PSK matches a server-side decryption (Channel
 * Database) entry under a DIFFERENT name, by channel id. Detected server-side
 * because readers don't receive raw PSKs.
 */
export function useChannelCollisions(sourceId: string | undefined, channels: Channel[]): Map<number, string[]> {
  const [channelCollisions, setChannelCollisions] = useState<ChannelCollision[]>([]);
  useEffect(() => {
    let cancelled = false;
    const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
    apiService.get<{ collisions: ChannelCollision[] }>(`/api/channels/collisions${qs}`)
      .then(res => { if (!cancelled) setChannelCollisions(res.collisions ?? []); })
      .catch(() => { if (!cancelled) setChannelCollisions([]); });
    return () => { cancelled = true; };
  }, [sourceId, channels]);
  return useMemo(() => {
    const m = new Map<number, string[]>();
    for (const c of channelCollisions) {
      const list = m.get(c.channelId) ?? [];
      list.push(c.dbName);
      m.set(c.channelId, list);
    }
    return m;
  }, [channelCollisions]);
}

/**
 * The drag order (an array of original slot indices) and Apply Order. A drag
 * only reorders the local list; nothing is written until `apply`, after which
 * the device reboots. A refreshed channel list resets the order.
 */
export function useChannelReorder(channels: Channel[], sourceId: string | undefined, onChannelsUpdated?: () => void) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isReordering, setIsReordering] = useState(false);
  const [slotOrder, setSlotOrder] = useState<number[]>(ALL_SLOTS);
  const originalOrder = useRef<number[]>(ALL_SLOTS);

  // Reset slot order when channels are refreshed from server (e.g., after successful reorder)
  useEffect(() => {
    setSlotOrder(ALL_SLOTS);
    originalOrder.current = ALL_SLOTS;
  }, [channels]);

  const hasReorderChanges = useMemo(() => slotOrder.some((v, i) => v !== originalOrder.current[i]), [slotOrder]);

  /** Moves the slot `from` to where `to` is. */
  const move = (from: number, to: number) => {
    if (from === to) return;
    setSlotOrder(prev => arrayMove(prev, prev.indexOf(from), prev.indexOf(to)));
  };

  const apply = async () => {
    if (!hasReorderChanges) return;
    setIsReordering(true);
    try {
      await apiService.reorderDeviceChannels(slotOrder, sourceId);
      showToast(t('channels_config.reorder_success', 'Channels reordered successfully. Device will reboot.'), 'success');
      originalOrder.current = [...slotOrder];
      onChannelsUpdated?.();
    } catch (error) {
      logger.error('Error reordering channels:', error);
      const errorMsg = error instanceof Error ? error.message : t('channels_config.reorder_failed', 'Failed to reorder channels');
      showToast(errorMsg, 'error');
      setSlotOrder([...originalOrder.current]);
    } finally {
      setIsReordering(false);
    }
  };

  const cancel = () => setSlotOrder([...originalOrder.current]);

  return { slotOrder, hasReorderChanges, isReordering, move, apply, cancel };
}

/** Normalize boolean values - handle both boolean (true/false) and numeric (1/0) formats. */
const normalizeBoolean = (value: unknown, defaultValue: boolean = true): boolean => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  return !!value;
};

/**
 * The channel writes, each with today's toasts. Each resolves true when the
 * device took the write; the caller then refreshes the list.
 */
export function useChannelActions(sourceId: string | undefined) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  /** One set_channel write for this card, and only on an explicit click. */
  const save = async (edit: EditingState): Promise<boolean> => {
    const { slotId, draft } = edit;
    if (draft.name.length > MAX_NAME_LENGTH) {
      showToast(t('channels_config.toast_name_too_long'), 'error');
      return false;
    }
    try {
      await apiService.updateChannel(slotId, {
        name: draft.name,
        psk: pskForSave(edit),
        role: draft.role,
        uplinkEnabled: draft.uplinkEnabled,
        downlinkEnabled: draft.downlinkEnabled,
        positionPrecision: draft.positionPrecision,
        ...aeadForSave(edit),
      }, sourceId);
      showToast(t('channels_config.toast_channel_updated', { slot: slotId }), 'success');
      return true;
    } catch (error) {
      logger.error('Error updating channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channels_config.toast_update_failed');
      showToast(errorMsg, 'error');
      return false;
    }
  };

  /** Disables the slot on the device, then deletes its record and messages in MeshMonitor. */
  const remove = async (slotId: number): Promise<boolean> => {
    // Channel 0 (Primary) cannot be deleted
    if (slotId === 0) {
      showToast(t('channels_config.toast_cannot_delete_primary', 'Cannot delete the primary channel'), 'error');
      return false;
    }
    try {
      // 1. Disable channel on the device
      await apiService.updateChannel(slotId, {
        name: '',
        psk: '',
        role: 0, // DISABLED
        uplinkEnabled: false,
        downlinkEnabled: false,
      }, sourceId);
      // 2. Delete channel record and messages from database. The route
      // requires sourceId (#5324). The device write already went through, so
      // a failure here is reported as a partial result, not as a delete.
      let purged = false;
      if (sourceId) {
        try {
          await apiService.delete(`/api/channels/${slotId}?sourceId=${encodeURIComponent(sourceId)}`);
          purged = true;
        } catch (error) {
          logger.error('Error deleting channel message history:', error);
        }
      }
      if (purged) {
        showToast(t('channels_config.toast_channel_deleted', { slot: slotId }), 'success');
      } else {
        showToast(t(
          'channels_config.toast_channel_disabled_purge_failed',
          'Channel {{slot}} was disabled on the device, but its message history could not be deleted.',
          { slot: slotId },
        ), 'warning');
      }
      return true;
    } catch (error) {
      logger.error('Error deleting channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channels_config.toast_delete_failed', 'Failed to delete channel');
      showToast(errorMsg, 'error');
      return false;
    }
  };

  const exportJson = async (channelId: number) => {
    try {
      await apiService.exportChannel(channelId, sourceId);
      showToast(t('channels_config.toast_channel_exported', { slot: channelId }), 'success');
    } catch (error) {
      logger.error('Error exporting channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channels_config.toast_export_failed');
      showToast(errorMsg, 'error');
    }
  };

  /** Writes an exported channel file's channel to `slotId`. */
  const importJson = async (slotId: number, fileContent: string): Promise<boolean> => {
    if (!fileContent) {
      showToast(t('channels_config.toast_select_file'), 'error');
      return false;
    }
    try {
      const importData = JSON.parse(fileContent);
      if (!importData.channel) {
        throw new Error(t('channels_config.toast_invalid_format'));
      }
      const normalizedChannelData = {
        ...importData.channel,
        uplinkEnabled: normalizeBoolean(importData.channel.uplinkEnabled, true),
        downlinkEnabled: normalizeBoolean(importData.channel.downlinkEnabled, true)
      };
      await apiService.importChannel(slotId, normalizedChannelData, sourceId);
      showToast(t('channels_config.toast_channel_imported', { slot: slotId }), 'success');
      return true;
    } catch (error) {
      logger.error('Error importing channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channels_config.toast_import_failed');
      showToast(errorMsg, 'error');
      return false;
    }
  };

  return { save, remove, exportJson, importJson };
}
