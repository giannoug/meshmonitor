/**
 * The Athens cast for Overview › Messages (boards 7-01, 7-02, 7-06, 7-09):
 * today's `/api/unified/channels`, `/api/unified/messages` and
 * `/api/channels/collisions` replies. Times are fixed clock times today, so
 * the feed always opens on "Today".
 */
import { SOURCE_IDS as S } from './athens';
import type { ChannelCollisionRow, Reception, UnifiedChannel, UnifiedMessage } from '../../pages/useUnifiedMessagesFeed';

const MIDNIGHT = new Date().setHours(0, 0, 0, 0);
const at = (h: number, m: number, s = 0) => MIDNIGHT + ((h * 60 + m) * 60 + s) * 1000;

const NAMES: Record<string, [string, string]> = {
  [S.g2]: ['Station G2', 'meshtastic_tcp'],
  [S.rak]: ['Rooftop RAK', 'meshtastic_tcp'],
  [S.mqtt]: ['Athens MQTT', 'mqtt_broker'],
  [S.heltec]: ['Heltec MeshCore', 'meshcore'],
};

function rx(sourceId: string, hops: number, time: number, extra: Partial<Reception> = {}): Reception {
  const [sourceName, sourceType] = NAMES[sourceId];
  return {
    sourceId, sourceName, sourceType, hopStart: 3, hopLimit: 3 - hops, rxSnr: 6.5, rxRssi: -92, rxTime: time,
    timestamp: time, xeddsaSigned: false, ...extra,
  };
}

function msg(
  packetId: number, from: number, longName: string, shortName: string, channelName: string, text: string, time: number,
  receptions: Reception[], extra: Partial<UnifiedMessage> = {},
): UnifiedMessage {
  return {
    dedupKey: `${from}:p${packetId}`, packetId, requestId: packetId, fromNodeNum: from,
    fromNodeId: `!${from.toString(16).padStart(8, '0')}`, fromNodeLongName: longName, fromNodeShortName: shortName,
    toNodeNum: 0xffffffff, toNodeId: '!ffffffff', channel: 0, channelName, text, emoji: null, replyId: null,
    timestamp: time, createdAt: time, receptions, ...extra,
  };
}

const tapback = (packetId: number, from: number, emoji: string, parent: number, time: number) =>
  msg(packetId, from, `Node ${from.toString(16)}`, from.toString(16).slice(-4), 'LongFast', emoji, time, [rx(S.g2, 1, time)], {
    emoji: 1, replyId: parent,
  });

const ROVER = at(8, 12);
const RELAY = at(8, 58);
const PSY = at(10, 24, 31);
const NIKOS = at(10, 26);
const MAROUSI = at(10, 21);

export const unifiedMessages: UnifiedMessage[] = [
  msg(1001, 0xa1b2c302, 'Athens Rover', 'ATH7', 'LongFast', 'Morning all, rover is back on LongFast', ROVER, [
    rx(S.g2, 0, ROVER), rx(S.rak, 1, ROVER),
  ]),
  tapback(1101, 0xa1b2c304, '👋', 1001, ROVER + 60_000),
  tapback(1102, 0xa1b2c305, '👋', 1001, ROVER + 90_000),
  tapback(1103, 0xa1b2c303, '👋', 1001, ROVER + 120_000),
  msg(1002, 0xa1b2c306, 'Hymettus Relay', 'HYM', 'LongFast', 'Relay rebooted at 07:40, should be stable now', RELAY, [
    rx(S.g2, 1, RELAY), rx(S.mqtt, 2, RELAY, { rxSnr: null, rxRssi: null }),
  ]),
  msg(0x5e21a0c4, 0xa1b2c308, 'Psychiko Base', 'PSY', 'LongFast', 'Anyone hearing the Hymettus relay this morning?', PSY, [
    rx(S.g2, 2, PSY, { rxSnr: -7, rxRssi: -101, xeddsaSigned: true }),
    rx(S.rak, 0, PSY, { rxSnr: 4, rxRssi: -86, xeddsaSigned: true }),
    rx(S.mqtt, 3, PSY + 2000, { rxSnr: null, rxRssi: null, xeddsaSigned: null }),
  ]),
  msg(1004, 0xa1b2c309, 'Nikos T-Echo', 'NK01', 'LongFast', 'Yes, loud and clear from Marousi', NIKOS, [rx(S.g2, 2, NIKOS)], {
    replyId: 0x5e21a0c4,
  }),
  tapback(1104, 0xa1b2c308, '👍', 1004, NIKOS + 60_000),
  tapback(1105, 0xa1b2c302, '👍', 1004, NIKOS + 70_000),
  // MeshCore, on #Public: its sender's clock runs 2 minutes ahead (s7n2).
  msg(0, 0, 'Marousi Mobile', 'MAR2', 'Public', 'Heading to the beach, back on the hour', MAROUSI, [
    rx(S.heltec, 0, MAROUSI, { hopStart: null, hopLimit: null, hopCount: 0 }),
  ], { dedupKey: 'mc:marousi', packetId: null, requestId: null, fromNodeId: 'pk-marousi', senderTimestamp: (MAROUSI + 120_000) / 1000 }),
];

const channel = (name: string, ids: string[]): UnifiedChannel => ({
  name,
  sources: ids.map((sourceId, i) => ({ sourceId, sourceName: NAMES[sourceId][0], channelNumber: i })),
});

export const unifiedChannels: UnifiedChannel[] = [
  channel('LongFast', [S.g2, S.rak, S.mqtt]),
  channel('Local', [S.g2]),
  channel('Hiking', [S.g2, S.rak]),
  channel('Public', [S.heltec]),
  channel('Athens', [S.mqtt]),
];

/** Station G2's LongFast shares its key with the Channel Database entry "AthensNet" (#3644). */
export const channelCollisions: Record<string, ChannelCollisionRow[]> = {
  [S.g2]: [{ channelId: 0, channelName: 'LongFast', dbId: 1, dbName: 'AthensNet' }],
};

/** `GET /api/unified/messages`: one page (no older pages), filtered by `channel`. */
export function unifiedMessagesReply(url: URL): UnifiedMessage[] {
  if (url.searchParams.get('before')) return [];
  const channelName = url.searchParams.get('channel');
  const rows = channelName && channelName !== '__all__'
    ? unifiedMessages.filter((m) => m.channelName.toLowerCase() === channelName.toLowerCase())
    : unifiedMessages;
  return [...rows].sort((a, b) => b.createdAt - a.createdAt);
}
