/** Names and short marks the MeshCore views share (Task 7.1). */
import type { TFunction } from 'i18next';
import { formatMeshCoreChannelName } from '../../utils/meshcoreHelpers';
import { meshcoreChannelKind } from '../../utils/meshcoreChannelKind';

export interface McChannelRow {
  id: number;
  name: string;
  scope: string | null;
  psk: string | null;
  readOnly: boolean;
  virtual: boolean;
}

/** Today's /api/channels/all row, as the Channels view reads it. */
export function toChannelRow(c: Record<string, unknown>): McChannelRow {
  return {
    id: c.id as number,
    name: String(c.name ?? ''),
    scope: typeof c.scope === 'string' && c.scope ? c.scope : null,
    psk: typeof c.psk === 'string' ? c.psk : null,
    readOnly: c.readOnly === true,
    virtual: c.virtual === true,
  };
}

/** "athens" for "#athens": the row and the title draw their own "#". */
export function channelName(t: TFunction, c: { id: number; name: string }): string {
  return formatMeshCoreChannelName(c.name.replace(/^#/, ''), t('meshcore.channels.unnamed', 'Channel {{idx}}', { idx: c.id }));
}

export function channelKind(c: { id: number; name: string; psk?: string | null }) {
  return meshcoreChannelKind({ id: c.id, name: c.name, psk: c.psk });
}

/** The first three letters or digits of a name, for an avatar ("GLY"). */
export function shortMark(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?';
}

/** Today's room name (MeshCoreRoomsView's `roomLabel`): advertised, stored, else a key prefix. */
export function roomLabel(room: { publicKey: string; advName?: string; name?: string }): string {
  return room.advName || room.name || `${room.publicKey.substring(0, 12)}…`;
}
