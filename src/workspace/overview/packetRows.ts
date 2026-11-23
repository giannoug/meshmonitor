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

/** Today's monitor columns (PacketMonitorPanel), in its order: the device monitor's column picker shows any of them (Task 8.5). */
export const PACKET_COLUMNS = [
  { id: 'dir', label: 'packet_monitor.column.dir' },
  { id: 'via', label: 'packet_monitor.column.via' },
  { id: 'date', label: 'packet_monitor.column.date' },
  { id: 'time', label: 'packet_monitor.column.time' },
  { id: 'from', label: 'packet_monitor.column.from' },
  { id: 'to', label: 'packet_monitor.column.to' },
  { id: 'type', label: 'packet_monitor.column.type' },
  { id: 'slot', label: 'packet_monitor.column.slot' },
  { id: 'snr', label: 'packet_monitor.column.snr' },
  { id: 'rssi', label: 'packet_monitor.column.rssi' },
  { id: 'hops', label: 'packet_monitor.column.hops' },
  { id: 'last_hop', label: 'packet_monitor.column.last_hop' },
  { id: 'size', label: 'packet_monitor.column.size' },
  { id: 'content', label: 'packet_monitor.column.content' },
] as const;

export type PacketColumnId = (typeof PACKET_COLUMNS)[number]['id'];

/** The packet with its metadata JSON expanded, as today's details modal lists it. */
export function fullJson(p: PacketLog): string {
  let metadata: unknown = p.metadata;
  try {
    if (p.metadata) metadata = JSON.parse(p.metadata);
  } catch {
    // Not JSON: keep the text.
  }
  return JSON.stringify({ ...p, metadata }, null, 2);
}
