/** How a packet row reads, shared by the packet stream and the raw packet panel (7-05, 18-01). */
import type { PacketLog } from '../../types/packet';
import { PORTNUM_NAMES } from '../../utils/packetFormat';

export const packetKey = (p: PacketLog) => `${p.sourceId ?? ''}_${p.id}`;

export const packetHops = (p: PacketLog): number | null =>
  p.hop_start !== undefined && p.hop_start !== null && p.hop_limit !== undefined && p.hop_limit !== null ? p.hop_start - p.hop_limit : null;

/** Today's Slot column: an encrypted packet's channel hash above 7 is not a slot. */
export const packetSlot = (p: PacketLog, na: string) =>
  p.encrypted && p.channel !== undefined && p.channel > 7 ? `?? (${p.channel})` : String(p.channel ?? na);

/** Today's client PortNum table by name (the server's `PortNum` is not browser-safe: it uses Buffer). */
const PORT = Object.fromEntries(Object.entries(PORTNUM_NAMES).map(([num, name]) => [name, Number(num)]));

/** The board's badge colour per Meshtastic type (role tokens in PacketStream.module.css); others stay muted. */
const TYPE_FAMILY: Record<number, string> = {
  [PORT.TEXT_MESSAGE]: 'text',
  [PORT.TELEMETRY]: 'telemetry',
  [PORT.TRACEROUTE]: 'traceroute',
  [PORT.NODEINFO]: 'nodeinfo',
  [PORT.POSITION]: 'position',
  [PORT.ROUTING]: 'routing',
  [PORT.ADMIN]: 'routing',
};

/** A MeshCore row's `portnum` is its payload type, not a PortNum: it stays muted, as does an encrypted packet. */
export const packetTypeFamily = (p: PacketLog, meshcore = false): string | undefined =>
  p.encrypted || meshcore ? undefined : TYPE_FAMILY[p.portnum];
