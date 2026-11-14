/** Small pure helpers the chat files share. */
import type { TFunction } from 'i18next';
import type { ChannelDatabaseEntry } from '../../services/api';
import type { Channel } from '../../types/device';
import { CHANNEL_DB_OFFSET } from '../../utils/channelReadAccess';
import type { MeshMessage } from '../../types/message';
import { pskEncryptionStatus } from '../../utils/publicChannel';

/**
 * A channel's name as Classic's Channels tab shows it: displayName, then name,
 * then a Channel Database entry's name for 100+, then "Primary" / "Channel N".
 */
export function channelLabel(
  t: TFunction,
  channel: Channel | undefined,
  id: number,
  dbEntries: ReadonlyArray<Pick<ChannelDatabaseEntry, 'id' | 'name'>> = [],
): string {
  if (channel?.displayName?.trim()) return channel.displayName;
  if (channel?.name?.trim()) return channel.name;
  const entry = id >= CHANNEL_DB_OFFSET ? dbEntries.find((e) => e.id === id - CHANNEL_DB_OFFSET) : undefined;
  if (entry) return entry.name;
  return id === 0 ? t('channels.primary') : t('channels.channel_fallback', { channelNum: id });
}

/** Classic's channel encryption status: the server's field, else derived from the PSK (#2951). */
export function encryptionOf(channel: Channel | undefined): 'none' | 'default' | 'secure' {
  if (!channel) return 'none';
  return channel.encryptionStatus ?? pskEncryptionStatus(channel.psk);
}

/** The packet id a reply refers to: the last segment of `${sourceId}_${nodeNum}_${packetId}` (App's replyingToPacketId). */
export function replyIdOf(message: MeshMessage | null): number | undefined {
  if (!message) return undefined;
  const parts = message.id.split('_');
  return parts.length >= 2 ? parseInt(parts[parts.length - 1], 10) : undefined;
}

/** Nodes heard since local midnight. */
export function heardToday(nodes: ReadonlyArray<{ lastHeard?: number }>, now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  return nodes.filter((n) => (n.lastHeard ?? 0) >= midnight).length;
}
