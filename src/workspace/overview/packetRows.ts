/** How a packet row reads, shared by the packet stream and the raw packet panel (7-05, 18-01). */
import type { PacketLog } from '../../types/packet';

export const packetKey = (p: PacketLog) => `${p.sourceId ?? ''}_${p.id}`;

export const packetHops = (p: PacketLog): number | null =>
  p.hop_start !== undefined && p.hop_start !== null && p.hop_limit !== undefined && p.hop_limit !== null ? p.hop_start - p.hop_limit : null;

/** Today's Slot column: an encrypted packet's channel hash above 7 is not a slot. */
export const packetSlot = (p: PacketLog, na: string) =>
  p.encrypted && p.channel !== undefined && p.channel > 7 ? `?? (${p.channel})` : String(p.channel ?? na);
