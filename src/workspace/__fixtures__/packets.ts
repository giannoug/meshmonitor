/**
 * The Athens cast for the packet monitors: Overview › Packets (7-05, 7-08,
 * `/api/unified/packets` and its distribution), the pop-out window (18-01,
 * 18-02, the primary device's `/api/packets`) and an MQTT source's receptions
 * (18-03, 18-04, `/api/sources/:id/mqtt/packets*`). Times are fixed clock
 * times today.
 */
import { SOURCE_IDS as S } from './athens';
import type { PacketLog, UnifiedPacketDistribution } from '../../types/packet';
import type { FixtureHandler } from './fixtureApi';
import type { MqttGateway, MqttGroupedPacket, MqttReception } from '../../components/MQTT/mqttPacketTypes';

const MIDNIGHT = new Date().setHours(0, 0, 0, 0);
const at = (h: number, m: number, s = 0, ms = 0) => MIDNIGHT + ((h * 60 + m) * 60 + s) * 1000 + ms;
const BROADCAST = '!ffffffff';
const hex = (n: number) => `!${n.toString(16).padStart(8, '0')}`;

const SOURCE_NAMES: Record<string, string> = {
  [S.g2]: 'Station G2', [S.mqtt]: 'Athens MQTT', [S.heltec]: 'Heltec MeshCore', [S.rak]: 'Rooftop RAK',
};

interface Row {
  id: number; sourceId?: string; dir?: 'rx' | 'tx'; via: number; time: number; from: [number, string];
  to?: [number, string]; type: [number, string]; snr?: number; rssi?: number; hops?: [number, number];
  content?: string; size: number; encrypted?: boolean; relay?: number;
}

function packet(r: Row): PacketLog {
  return {
    id: r.id, packet_id: 0x5a000000 + r.id, timestamp: r.time, from_node: r.from[0], from_node_id: hex(r.from[0]),
    from_node_longName: r.from[1], to_node: r.to?.[0] ?? 0xffffffff, to_node_id: r.to ? hex(r.to[0]) : BROADCAST,
    to_node_longName: r.to?.[1], channel: 0, portnum: r.type[0], portnum_name: r.type[1], encrypted: r.encrypted ?? false,
    snr: r.snr, rssi: r.rssi, hop_start: r.hops?.[1], hop_limit: r.hops ? r.hops[1] - r.hops[0] : undefined,
    relay_node: r.relay, payload_size: r.size, payload_preview: r.content, direction: r.dir ?? 'rx',
    transport_mechanism: r.via, ...(r.sourceId ? { sourceId: r.sourceId, sourceName: SOURCE_NAMES[r.sourceId] } : {}),
  };
}

const NIKOS: [number, string] = [0xb3c4d5e6, 'Nikos T-Echo'];
const MAROUSI: [number, string] = [0xa1b2c305, 'Marousi Mobile'];
const KIFISIA: [number, string] = [0xa1b2c301, 'Kifisia Rooftop'];
const GLYFADA: [number, string] = [0xa1b2c303, 'Glyfada Beach'];
const HYMETTUS: [number, string] = [0xa1b2c306, 'Hymettus Relay'];
const G2: [number, string] = [0xa1b2c300, 'Station G2'];
const TEXT: [number, string] = [1, 'TEXT_MESSAGE_APP'];
const TELEMETRY: [number, string] = [67, 'TELEMETRY_APP'];

/** `/api/unified/packets`: one row per receiving device, newest first (7-05, 7-08). */
export const unifiedPackets: PacketLog[] = [
  packet({ id: 4821, sourceId: S.g2, via: 1, time: at(10, 42, 31, 402), from: NIKOS, type: TEXT, snr: -3, rssi: -95, hops: [2, 3], relay: 0x12, content: 'Hearing you direct from Marousi', size: 58 }),
  packet({ id: 4820, sourceId: S.mqtt, via: 5, time: at(10, 42, 31, 120), from: NIKOS, type: TEXT, hops: [3, 3], content: 'Hearing you direct from Marousi', size: 58 }),
  packet({ id: 4819, sourceId: S.heltec, via: 1, time: at(10, 42, 24), from: MAROUSI, type: [5, 'GRP_TXT'], snr: 6, content: 'Heading to the beach', size: 44 }),
  packet({ id: 4818, sourceId: S.rak, via: 1, time: at(10, 42, 29), from: KIFISIA, type: TELEMETRY, snr: -7, rssi: -98, hops: [2, 3], content: 'Battery 87 %, 4.02 V', size: 41 }),
  packet({ id: 4817, sourceId: S.g2, dir: 'tx', via: 7, time: at(10, 42, 17), from: G2, to: KIFISIA, type: [70, 'TRACEROUTE_APP'], hops: [0, 3], content: 'Request', size: 22 }),
  packet({ id: 4816, sourceId: S.heltec, via: 1, time: at(10, 42, 12), from: GLYFADA, type: [4, 'ADVERT'], snr: -2, content: 'Advert · Glyfada Beach', size: 101 }),
  packet({ id: 4815, sourceId: S.g2, via: 1, time: at(10, 42, 11), from: HYMETTUS, type: [4, 'NODEINFO_APP'], snr: 2, rssi: -90, hops: [0, 3], content: 'Hymettus Relay · RAK4631', size: 67 }),
  packet({ id: 4814, sourceId: S.mqtt, via: 5, time: at(10, 41, 58), from: MAROUSI, type: [3, 'POSITION_APP'], hops: [2, 3], content: '38.03, 23.80', size: 36 }),
  packet({ id: 4813, sourceId: S.g2, via: 1, time: at(10, 41, 56), from: [0xc41e09aa, '!c41e09aa'], to: [0xa1b2c309, 'Penteli Hiker'], type: [1, 'TEXT_MESSAGE_APP'], snr: -4, rssi: -97, hops: [1, 3], size: 74, encrypted: true }),
  packet({ id: 4812, sourceId: S.rak, via: 6, time: at(10, 41, 50), from: GLYFADA, type: TELEMETRY, snr: -11, rssi: -110, hops: [2, 3], content: 'Battery 71 %, 3.88 V', size: 41 }),
];

export const unifiedPacketSources = [
  { id: S.g2, name: 'Station G2', type: 'meshtastic_tcp' },
  { id: S.mqtt, name: 'Athens MQTT', type: 'mqtt_broker' },
  { id: S.heltec, name: 'Heltec MeshCore', type: 'meshcore' },
  { id: S.rak, name: 'Rooftop RAK', type: 'meshtastic_tcp' },
];

export const unifiedDistribution: UnifiedPacketDistribution = {
  total: 1284,
  enabled: true,
  bySource: [
    { sourceId: S.g2, sourceName: 'Station G2', count: 612 },
    { sourceId: S.mqtt, sourceName: 'Athens MQTT', count: 401 },
    { sourceId: S.heltec, sourceName: 'Heltec MeshCore', count: 188 },
    { sourceId: S.rak, sourceName: 'Rooftop RAK', count: 83 },
  ],
  byDevice: [
    { from_node: KIFISIA[0], from_node_id: hex(KIFISIA[0]), from_node_longName: 'Kifisia Rooftop', count: 96 },
    { from_node: HYMETTUS[0], from_node_id: hex(HYMETTUS[0]), from_node_longName: 'Hymettus Relay', count: 81 },
    { from_node: 0xa1b2c302, from_node_id: hex(0xa1b2c302), from_node_longName: 'Athens Rover', count: 64 },
    { from_node: MAROUSI[0], from_node_id: hex(MAROUSI[0]), from_node_longName: 'Marousi Mobile', count: 52 },
  ],
  byType: [
    { portnum: 67, portnum_name: 'TELEMETRY_APP', count: 402 },
    { portnum: 3, portnum_name: 'POSITION_APP', count: 311 },
    { portnum: 4, portnum_name: 'NODEINFO_APP', count: 188 },
    { portnum: 5, portnum_name: 'GRP_TXT', count: 97, protocol: 'meshcore' },
  ],
};

/** The pop-out window: the primary device's monitor (18-01, 18-02), Meshtastic rows only. */
const popoutRows: PacketLog[] = [
  packet({ id: 4821, via: 1, time: at(10, 42, 31, 402), from: NIKOS, type: TEXT, snr: -3, rssi: -95, hops: [2, 3], relay: 0x12, content: 'Hearing you direct from Marousi', size: 58 }),
  packet({ id: 4818, via: 1, time: at(10, 42, 29), from: KIFISIA, type: TELEMETRY, snr: -7, rssi: -98, hops: [2, 3], content: 'Battery 87 %, 4.02 V', size: 41 }),
  packet({ id: 4817, dir: 'tx', via: 7, time: at(10, 42, 17), from: G2, to: KIFISIA, type: [70, 'TRACEROUTE_APP'], hops: [0, 3], content: 'Request', size: 22 }),
  packet({ id: 4815, via: 1, time: at(10, 42, 11), from: HYMETTUS, type: [4, 'NODEINFO_APP'], snr: 2, rssi: -90, hops: [0, 3], content: 'Hymettus Relay · RAK4631', size: 67 }),
  packet({ id: 4814, via: 5, time: at(10, 41, 58), from: MAROUSI, type: [3, 'POSITION_APP'], hops: [2, 3], content: '38.03, 23.80', size: 36 }),
  packet({ id: 4813, via: 1, time: at(10, 41, 56), from: [0xc41e09aa, '!c41e09aa'], to: [0xa1b2c309, 'Penteli Hiker'], type: TEXT, snr: -4, rssi: -97, hops: [1, 3], size: 74, encrypted: true }),
  packet({ id: 4812, via: 6, time: at(10, 41, 50), from: GLYFADA, type: TELEMETRY, snr: -11, rssi: -110, hops: [2, 3], content: 'Battery 71 %, 3.88 V', size: 41 }),
  packet({ id: 4811, via: 1, time: at(10, 41, 44), from: [0xa1b2c308, 'Kifisia Weather'], type: TEXT, snr: 1, rssi: -88, hops: [1, 3], content: 'Any rain up north?', size: 33 }),
];

/** `/api/packets`: 200 of the 1,284 stored rows in one page, the board's eight first. */
export const popoutPackets = {
  packets: [
    ...popoutRows,
    ...Array.from({ length: 192 }, (_, i) =>
      packet({ id: 4810 - i, via: 1, time: at(10, 41, 40) - i * 11_000, from: KIFISIA, type: TELEMETRY, snr: -6, rssi: -96, hops: [2, 3], content: 'Battery 87 %, 4.02 V', size: 41 })),
  ],
  total: 1284, offset: 0, limit: 100, maxCount: 5000, maxAgeHours: 24,
};

export const packetStats = { total: 1284, encrypted: 112, decoded: 1172, maxCount: 5000, maxAgeHours: 24, enabled: true };

/**
 * Capture on (`/api/packets/stats`), for the packet boards. An override, not a default: Classic's
 * chrome snapshot (contexts/__tests__/classicChrome.snapshot.test.tsx) was taken without it.
 */
export const captureOn: Record<string, FixtureHandler> = { 'GET /api/packets/stats': () => packetStats };

/** An MQTT source's grouped packets (18-03, 18-04): one row per packet with its gateway count. */
function grouped(
  packetId: number, from: [number, string], portnum: number, portnumName: string | null, time: number, gateways: number,
  extra: Partial<MqttGroupedPacket> = {},
): MqttGroupedPacket {
  return {
    packetId, fromNode: from[0], fromNodeId: hex(from[0]), toNode: 0xffffffff, toNodeId: BROADCAST, channel: 8,
    channelId: 'LongFast', portnum, portnumName, encrypted: 0, ingestOutcome: 'ingested', payloadSize: 58,
    payloadPreview: null, bitfield: 1, okToMqttViolation: 0, gatewayCount: gateways, receptionCount: gateways,
    firstHeard: time - 1000, lastHeard: time, ...extra,
  };
}

export const mqttPackets: MqttGroupedPacket[] = [
  grouped(0x6a01, MAROUSI, 1, 'TEXT_MESSAGE_APP', at(10, 42, 32, 100), 4, {
    payloadPreview: 'Hearing you direct from Marousi', bitfield: 0, okToMqttViolation: 1, firstHeard: at(10, 42, 31, 400),
  }),
  grouped(0x6a02, [0xa1b2c302, 'Athens Rover'], 3, 'POSITION_APP', at(10, 42, 18), 3, { payloadPreview: '38.03, 23.80' }),
  grouped(0x6a03, KIFISIA, 67, 'TELEMETRY_APP', at(10, 42, 2), 5, { payloadPreview: 'Battery 87 %, 4.02 V' }),
  grouped(0x6a04, [0xc41e09aa, '!c41e09aa'], 0, null, at(10, 41, 47), 1, { encrypted: 1, ingestOutcome: 'encrypted', bitfield: null }),
  grouped(0x6a05, HYMETTUS, 4, 'NODEINFO_APP', at(10, 41, 30), 6),
  grouped(0x6a06, GLYFADA, 67, 'TELEMETRY_APP', at(10, 41, 12), 2),
];

export const mqttGateways: MqttGateway[] = [
  { gatewayId: '!0badc0de', gatewayNodeNum: 0x0badc0de, receptionCount: 812, lastHeard: at(10, 42, 32) },
  { gatewayId: hex(0xa1b2c307), gatewayNodeNum: 0xa1b2c307, receptionCount: 640, lastHeard: at(10, 42, 31) },
  { gatewayId: hex(KIFISIA[0]), gatewayNodeNum: KIFISIA[0], receptionCount: 588, lastHeard: at(10, 42, 31) },
  { gatewayId: hex(0xa1b2c304), gatewayNodeNum: 0xa1b2c304, receptionCount: 402, lastHeard: at(10, 42, 32) },
  { gatewayId: hex(GLYFADA[0]), gatewayNodeNum: GLYFADA[0], receptionCount: 210, lastHeard: at(10, 40, 2) },
  { gatewayId: hex(HYMETTUS[0]), gatewayNodeNum: HYMETTUS[0], receptionCount: 97, lastHeard: at(10, 41, 30) },
];

/** The first packet's four receptions: two violations, one opted out, one unreadable. */
export const mqttReceptions: MqttReception[] = [
  { gatewayId: '!0badc0de', gatewayNodeNum: 0x0badc0de, timestamp: at(10, 42, 31, 400), rxTime: at(10, 42, 31, 400), rxSnr: -3, rxRssi: -95, hopStart: 3, hopLimit: 1, bitfield: 0, okToMqttViolation: 1, ingestOutcome: 'ingested' },
  { gatewayId: hex(0xa1b2c307), gatewayNodeNum: 0xa1b2c307, timestamp: at(10, 42, 31, 600), rxTime: at(10, 42, 31, 600), rxSnr: -9, rxRssi: -108, hopStart: 3, hopLimit: 0, bitfield: 0, okToMqttViolation: 1, ingestOutcome: 'ingested' },
  { gatewayId: hex(KIFISIA[0]), gatewayNodeNum: KIFISIA[0], timestamp: at(10, 42, 31, 900), rxTime: at(10, 42, 31, 900), rxSnr: -6, rxRssi: -101, hopStart: 3, hopLimit: 1, bitfield: 0, okToMqttViolation: 0, ingestOutcome: 'ingested' },
  { gatewayId: hex(0xa1b2c304), gatewayNodeNum: 0xa1b2c304, timestamp: at(10, 42, 32, 100), rxTime: at(10, 42, 32, 100), rxSnr: null, rxRssi: null, hopStart: 3, hopLimit: 0, bitfield: null, okToMqttViolation: 0, ingestOutcome: 'ingested' },
];
