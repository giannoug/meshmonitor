/**
 * Whether the viewer may read a Meshtastic channel, as Classic's Channels tab
 * decides it (#6365 Rule X: moved out of ChannelsTab unchanged, shared with
 * the Workspace channel list and thread).
 *
 * - An MQTT-bridge mirror shows every channel it heard: its slots are not
 *   bounded to 0-7, and the standard permission set only models channel_0..7.
 * - Channel Database channels (>= CHANNEL_DB_OFFSET) are readable when their
 *   entry is in the viewer's channel-database list (the server returns only
 *   the entries the viewer may read).
 * - Device channels need `channel_N:read`.
 */
import type { ChannelDatabaseEntry } from '../services/api.js';
import type { ResourceType } from '../types/permission.js';

/** Must match CHANNEL_DB_OFFSET in src/server/constants/meshtastic.ts. */
export const CHANNEL_DB_OFFSET = 100;

export function canReadChannel(
  ch: number,
  {
    mqttReadOnly,
    channelDatabaseEntries,
    hasPermission,
  }: {
    mqttReadOnly: boolean;
    channelDatabaseEntries: ReadonlyArray<Pick<ChannelDatabaseEntry, 'id'>>;
    hasPermission: (resource: ResourceType, action: 'read') => boolean;
  },
): boolean {
  if (mqttReadOnly) return true;
  if (ch >= CHANNEL_DB_OFFSET) {
    const channelDbId = ch - CHANNEL_DB_OFFSET;
    return channelDatabaseEntries.some((entry) => entry.id === channelDbId);
  }
  return hasPermission(`channel_${ch}` as ResourceType, 'read');
}
