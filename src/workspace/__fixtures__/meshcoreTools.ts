/**
 * Section 8's tool boards (Task 7.5): Heltec MeshCore's Info (8-13, 8-30), its
 * packet monitor with the #athens frame decoded (8-12, 8-29), its built-in
 * automations and the rules that include it (8-14, 8-31), and the Athens
 * MeshCore feed, a `meshcore_mqtt` region feed (8-15, 8-23). Shapes follow
 * today's `/api/sources/:id/meshcore/*` replies. Writes go to the shared log.
 */
import type { DashboardSource } from '../../hooks/useDashboardData';
import { athensFixture, SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type { MeshCoreLog } from './meshcore';
import { MC } from './meshcoreKeys';

/** The region feed (8-15 adds it to the strip). */
export const REGION_FEED_ID = 'src-af';

const NOW = Date.now();
const clock = (h: number, m: number, s = 0) => {
  const d = new Date(NOW);
  d.setHours(h, m, s, 0);
  return d.getTime() - 86_400_000;
};
const ok = (data?: unknown) => ({ success: true, ...(data === undefined ? {} : { data }) });
const hex = (...parts: string[]) => parts.join('').toLowerCase();

/** #athens' GRP_TXT, transport flood, two 2-byte hops: 61 bytes, as 8-12 draws it. */
export const GRP_TXT_HEX = hex('14', 'a2410000', '42', 'a7f13fa1', '5c', '7e21', 'd3'.repeat(48));

const row = (id: number, at: number, payloadType: number, routeType: number, extra: Record<string, unknown>) => ({
  id, sourceId: SOURCE_IDS.heltec, timestamp: at, payloadType, routeType, pathLenRaw: 0, payloadSize: 20, ...extra,
});

/** The board's ten rows, newest first. */
export const mcPackets = [
  row(10, clock(10, 31, 2), 5, 0, { payloadTypeName: 'GRP_TXT', routeTypeName: 'TRANSPORT_FLOOD', hopCount: 2, snr: 6.5, rssi: -88, payloadSize: 61,
    rawHex: GRP_TXT_HEX, pathHops: 'a7f1,3fa1', srcHash: null, senderPubKey: null, advertName: null, observerCount: 3, receptionCount: 3 }),
  row(9, clock(10, 30, 58), 4, 1, { payloadTypeName: 'ADVERT', routeTypeName: 'FLOOD', hopCount: 0, snr: 7, rssi: -97, rawHex: '1100',
    senderPubKey: MC.penteli, advertName: 'Penteli Repeater', observerCount: 2, receptionCount: 2 }),
  row(8, clock(10, 30, 51), 3, 2, { payloadTypeName: 'ACK', routeTypeName: 'DIRECT', hopCount: 1, snr: 4, rssi: -95, rawHex: '0e00', srcHash: MC.nikos.slice(0, 2), observerCount: 1 }),
  row(7, clock(10, 30, 40), 2, 2, { payloadTypeName: 'TXT_MSG', routeTypeName: 'DIRECT', hopCount: 1, snr: 8, rssi: -90, rawHex: '0a00', srcHash: '0b', observerCount: 1 }),
  row(6, clock(10, 30, 33), 8, 1, { payloadTypeName: 'PATH', routeTypeName: 'FLOOD', hopCount: 1, snr: 8, rssi: -90, rawHex: '2100', srcHash: MC.marousi.slice(0, 2), observerCount: 1 }),
  row(5, clock(10, 30, 12), 9, 2, { payloadTypeName: 'TRACE', routeTypeName: 'DIRECT', hopCount: 2, snr: null, rssi: null, rawHex: '2600', srcHash: MC.self.slice(0, 2), observerCount: 1 }),
  row(4, clock(10, 29, 57), 4, 1, { payloadTypeName: 'ADVERT', routeTypeName: 'FLOOD', hopCount: 1, snr: 1.5, rssi: -101, rawHex: '1100',
    senderPubKey: MC.athensRoom, advertName: 'Athens Room', observerCount: 2 }),
  row(3, clock(10, 29, 44), 0, 2, { payloadTypeName: 'REQ', routeTypeName: 'DIRECT', hopCount: 0, snr: null, rssi: null, rawHex: '0200', srcHash: MC.self.slice(0, 2), observerCount: 1 }),
  row(2, clock(10, 29, 30), 5, 1, { payloadTypeName: 'GRP_TXT', routeTypeName: 'FLOOD', hopCount: 3, snr: -3, rssi: -109, rawHex: '1500', srcHash: null, observerCount: 2 }),
  row(1, clock(10, 29, 2), 4, 1, { payloadTypeName: 'ADVERT', routeTypeName: 'FLOOD', hopCount: 2, snr: -1, rssi: -104, rawHex: '1100',
    senderPubKey: MC.weather, advertName: 'Kifisia Weather', observerCount: 1 }),
];

/** Heltec MeshCore as its Info page reads it (8-13, 8-30). */
export const mcInfo = {
  sourceId: SOURCE_IDS.heltec,
  connected: true,
  deviceType: 1,
  deviceTypeName: 'Companion',
  identity: {
    publicKey: MC.self, name: 'Heltec MeshCore', advType: 1, txPower: 20, maxTxPower: 22, radioFreq: 869.618, radioBw: 62.5, radioSf: 8, radioCr: 8,
    latitude: 38.0012, longitude: 23.7341, firmwareVer: 14, firmwareBuild: '14 Sep 2026', model: 'Heltec V3', ver: 'v1.8.2',
  },
  latest: {
    timestamp: NOW - 120_000, batteryMv: 4020, uptimeSecs: 6 * 86_400 + 4 * 3600, errors: 7, queueLen: 0, noiseFloor: -114, lastRssi: -88, lastSnr: 6.5,
    rtcDriftSecs: 4, packetsRecv: 21_906, packetsSent: 3852,
  },
  telemetryRef: { nodeId: MC.self, nodeNum: 0, sourceId: SOURCE_IDS.heltec },
};

const series = (type: string, values: number[]) =>
  values.map((value, i) => ({ nodeId: MC.self, nodeNum: 0, telemetryType: type, timestamp: NOW - (values.length - 1 - i) * 3_600_000, value, createdAt: NOW }));

export const mcTelemetry = [
  ...series('mc_battery_volts', [3.98, 3.96, 3.95, 3.93, 3.92, 3.94, 3.99, 4.05, 4.08, 4.08, 4.07, 4.05, 4.03, 4.02]),
  ...series('mc_noise_floor', [-116, -115, -117, -114, -112, -113, -116, -118, -117, -115, -114, -115]),
  ...series('mc_pkt_flood_tx', [3108]),
  ...series('mc_pkt_direct_tx', [744]),
  ...series('mc_pkt_recv', [21_906]),
  ...series('mc_pkt_recv_errors', [7]),
];

/** Built-in automations, 10 on (8-14). */
export const mcAutomations = {
  pathfinding: { enabled: true, pathDiscoveryEnabled: true, neighborsEnabled: true, intervalMinutes: 5, repeatHours: 24, schedulerRunning: true, lastRunAt: NOW - 3_600_000 },
  filter: { enabled: false, targetKeys: [], contactsEnabled: false, regexEnabled: false, nameRegex: '.*', lastHeardEnabled: false, lastHeardHours: 168,
    hopsEnabled: false, hopsMin: 0, hopsMax: 10, signalEnabled: false, rssiMin: -200, snrMin: -100 },
  autoack: { enabled: true, regex: '^(test|ping)', message: 'Copy, {NODE_NAME}! {HOPS} hops @ {TIME}', channels: [1], directMessages: false, useDM: false,
    cooldownSeconds: 60, preSendDelaySeconds: 0, testMessages: 'test\nping', ignoredNodes: '', splitLongMessages: false, scopeMode: 'inherit', scopeName: '' },
  announce: { enabled: true, intervalHours: 6, message: 'MeshMonitor {VERSION} online', channelIndexes: [0], splitLongMessages: false, announceOnStart: false,
    useSchedule: false, schedule: '0 */6 * * *', advertEnabled: true, advertDelaySeconds: 30, advertMode: 'flood', lastRunAt: NOW - 7_200_000, scopeMode: 'inherit', scopeName: '' },
  responder: {
    enabled: true,
    triggers: [
      { id: 'r1', name: 'Weather', enabled: true, pattern: 'weather', syntax: 'pattern', responseType: 'text', response: 'Sunny, 24 C', channels: [1], listenDMs: true, replyAsDM: false, cooldownSeconds: 60 },
      { id: 'r2', name: 'Help', enabled: true, pattern: 'help', syntax: 'pattern', responseType: 'text', response: 'Try: weather, ping', channels: [], listenDMs: true, replyAsDM: true, cooldownSeconds: 60 },
      { id: 'r3', name: 'Battery', enabled: true, pattern: 'battery', syntax: 'pattern', responseType: 'script', response: '', scriptPath: '/data/scripts/battery_alert.js', channels: [], listenDMs: true, replyAsDM: true, cooldownSeconds: 300 },
    ],
  },
  autoPing: { settings: { autoPingEnabled: true, autoPingIntervalSeconds: 1800, autoPingMaxPings: 20, autoPingTimeoutSeconds: 60 }, sessions: [] },
  forwarding: { enabled: false, rules: [{ id: 'fw1', name: 'Athens to G2', enabled: true, match: { channel: 1 }, forwardTo: { channel: 0 }, prefix: '{from}: ' }] },
  timers: { triggers: [{ id: 't1', name: 'Morning', enabled: true, scheduleType: 'cron', cronExpression: '0 8 * * *', responseType: 'text', response: 'Good morning Athens', destination: 'channel', channelIndexes: [1] }] },
  distance: { settings: { enabled: true, intervalHours: 24, thresholdKm: 150, lat: null, lon: null, action: 'delete' }, running: true },
  timeSync: { nodes: [
    { publicKey: MC.lycabettus, name: 'Lycabettus Repeater', intervalMinutes: 1440, lastSyncAt: NOW - 3_600_000 },
    { publicKey: MC.penteli, name: 'Penteli Repeater', intervalMinutes: 1440, lastSyncAt: null },
    { publicKey: MC.parnitha, name: 'Parnitha Repeater', intervalMinutes: 1440, lastSyncAt: null },
  ] },
  remoteTelemetry: { nodes: [
    { publicKey: MC.lycabettus, name: 'Lycabettus Repeater', intervalMinutes: 360, lastRequestAt: NOW - 600_000, lastSuccessAt: NOW - 600_000 },
    { publicKey: MC.weather, name: 'Kifisia Weather', intervalMinutes: 360, lastRequestAt: null, lastSuccessAt: null },
  ] },
  favorite: { settings: { enabled: true, intervalHours: 6, staleHours: 72, trackedCount: 3 }, running: true },
  welcome: { settings: { enabled: false, message: 'Welcome to the Athens mesh, {NAME}!', target: 'dm', waitForName: true, maxHops: 3, delaySeconds: 30, maxPerHour: 4 } },
};

/** The Automation Engine's rules: one names Heltec MeshCore, one has no source filter (all devices), one is G2's only. */
export const engineRules = [
  { id: 'a1', name: 'Low battery alert', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.telemetry' }, rules: [{ conditions: [{ type: 'condition.sourceFilter', params: { sourceIds: [SOURCE_IDS.g2, SOURCE_IDS.heltec] } }],
      actions: [{ type: 'action.notify', params: {} }] }] }) },
  { id: 'a2', name: 'Welcome new nodes', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.newNode' }, rules: [{ conditions: [], actions: [{ type: 'action.sendMessage', params: {} }] }] }) },
  { id: 'a3', name: 'G2 only', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.message' }, rules: [{ conditions: [{ type: 'condition.sourceFilter', params: { sourceIds: [SOURCE_IDS.g2] } }],
      actions: [{ type: 'action.tapback', params: {} }] }] }) },
];

export function meshcoreToolFixtures(log: MeshCoreLog): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  const isHeltec = (u: URL) => u.pathname.split('/')[3] === SOURCE_IDS.heltec;
  const write = (reply: (b: unknown) => unknown = () => ok()): FixtureHandler => (u, init) => {
    if (!isHeltec(u)) return undefined;
    const b = body(init);
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, body: b });
    return reply(b);
  };
  const only = (reply: (u: URL) => unknown): FixtureHandler => (u) => (isHeltec(u) ? reply(u) : undefined);
  const A = mcAutomations;
  const auto = (path: string) => `/api/sources/:id/meshcore/automation/${path}`;
  return {
    'GET /api/sources/:id/meshcore/info': only(() => ok(mcInfo)),
    'GET /api/telemetry/:nodeId': (u) => (u.pathname.split('/')[3] === MC.self ? mcTelemetry : undefined),
    'GET /api/virtual-node/status': () => ({ sources: [] }),
    'GET /api/sources/:id/meshcore/packets': only(() => ({ packets: mcPackets, total: 1284, hasMore: false, nextCursor: null, enabled: true, maxCount: 1000, maxAgeHours: 24, isIngestSource: false })),
    'GET /api/sources/:id/meshcore/packets/grouped': only(() => ({ packets: mcPackets, total: 1284, hasMore: false, enabled: true, maxCount: 1000, maxAgeHours: 24, isIngestSource: false })),
    'GET /api/sources/:id/meshcore/packets/receptions': only(() => ({
      receptions: [
        { ...mcPackets[0], observerId: null, snr: 6.5, hopCount: 2 },
        { ...mcPackets[0], observerId: MC.lycabettus, snr: 7, hopCount: 1 },
        { ...mcPackets[0], observerId: MC.penteli, snr: 5.5, hopCount: 3 },
      ],
      total: 3,
    })),
    'GET /api/sources/:id/meshcore/packets/stats/distribution': only(() => ({
      byPayloadType: [{ payloadType: 4, payloadTypeName: 'ADVERT', count: 3 }, { payloadType: 5, payloadTypeName: 'GRP_TXT', count: 2 }],
      byRouteType: [{ routeType: 1, routeTypeName: 'FLOOD', count: 5 }],
      topSenders: [{ senderPubKey: MC.penteli, advertName: 'Penteli Repeater', count: 1 }],
      total: 10,
    })),
    'POST /api/sources/:id/meshcore/packets/decode': write(() => ok({
      decrypted: true, payloadType: 5, channelHash: '5c', channelName: '#athens',
      keyOrigin: { kind: 'source', sourceName: 'Athens MQTT', currentSource: false },
      text: { sender: 'Glyfada Beach', timestampSec: Math.floor(clock(10, 31) / 1000), text: 'Morning, anyone on the coast road? Testing a new antenna.' },
    })),
    'DELETE /api/sources/:id/meshcore/packets': write(),
    'POST /api/sources/:id/meshcore/config/sync-time': write(),
    // Built-in automations (8-14, 8-31) and their saves.
    [`GET ${auto('pathfinding')}`]: only(() => ok(A.pathfinding)),
    [`POST ${auto('pathfinding')}`]: write(() => ok({ schedulerRunning: true, lastRunAt: A.pathfinding.lastRunAt })),
    [`GET ${auto('pathfinding/filter')}`]: only(() => ok(A.filter)),
    [`POST ${auto('pathfinding/filter')}`]: write((b) => ok(b)),
    [`GET ${auto('autoack')}`]: only(() => ok(A.autoack)),
    [`POST ${auto('autoack')}`]: write(),
    [`GET ${auto('announce')}`]: only(() => ok(A.announce)),
    [`POST ${auto('announce')}`]: write(() => ok({ lastRunAt: A.announce.lastRunAt })),
    [`GET ${auto('announce/preview')}`]: only(() => ok({ preview: 'MeshMonitor 4.15 online' })),
    [`POST ${auto('announce/send')}`]: write(() => ok({ lastRunAt: NOW })),
    [`GET ${auto('responder')}`]: only(() => ok(A.responder)),
    [`POST ${auto('responder')}`]: write(),
    [`GET ${auto('auto-ping')}`]: only(() => ok(A.autoPing)),
    [`POST ${auto('auto-ping')}`]: write((b) => ok({ settings: { ...A.autoPing.settings, ...(b as object) } })),
    'GET /api/sources/:id/forwarding': only(() => ok(A.forwarding)),
    'POST /api/sources/:id/forwarding': write((b) => ok(b)),
    'PUT /api/sources/:id/forwarding/enabled': write((b) => ok(b)),
    [`GET ${auto('timers')}`]: only(() => ok(A.timers)),
    [`POST ${auto('timers')}`]: write(),
    [`POST ${auto('timers/:tid/run')}`]: write(() => ok({})),
    [`GET ${auto('auto-delete-distance')}`]: only(() => ok(A.distance)),
    [`POST ${auto('auto-delete-distance')}`]: write((b) => ok({ settings: { ...A.distance.settings, ...(b as object) } })),
    [`POST ${auto('auto-delete-distance/run')}`]: write(() => ok({ deletedCount: 2 })),
    [`GET ${auto('time-sync')}`]: only(() => ok(A.timeSync)),
    [`GET ${auto('remote-telemetry')}`]: only(() => ok(A.remoteTelemetry)),
    'POST /api/sources/:id/meshcore/nodes/:pk/time-sync-config': write(),
    'POST /api/sources/:id/meshcore/nodes/:pk/telemetry-config': write(),
    [`GET ${auto('auto-favorite')}`]: only(() => ok(A.favorite)),
    [`POST ${auto('auto-favorite')}`]: write((b) => ok({ settings: { ...A.favorite.settings, ...(b as object) } })),
    [`POST ${auto('auto-favorite/run')}`]: write(() => ok({ favorited: 1, unfavorited: 0 })),
    [`GET ${auto('auto-welcome')}`]: only(() => ok(A.welcome)),
    [`POST ${auto('auto-welcome')}`]: write((b) => ok({ settings: { ...A.welcome.settings, ...(b as object) } })),
    'GET /api/scripts': () => [{ path: '/data/scripts/battery_alert.js', filename: 'battery_alert.js', name: 'Battery alert', language: 'JavaScript' }],
    'GET /api/automations': () => engineRules,
    'POST /api/automations/:aid/:verb': (u, init) => {
      log.writes.push({ method: init?.method ?? 'POST', path: u.pathname, body: undefined });
      return ok();
    },
  };
}

// ── The region feed (8-15, 8-23) ─────────────────────────────────────────────

const CREATED = NOW - 30 * 86_400_000;
export const regionFeedSource: DashboardSource = {
  id: REGION_FEED_ID, name: 'Athens MeshCore feed', type: 'meshcore_mqtt', enabled: true,
  config: { brokerUrl: 'mqtts://broker.example', region: 'gr-att' }, createdAt: CREATED, updatedAt: CREATED, radio: null,
};

const observer = (publicKey: string, ago: number, batteryMv: number | null, uptimeDays: number | null, noiseFloor: number | null) => ({
  publicKey, online: ago < 3_600_000, lastSeenMs: NOW - ago, batteryMv, uptimeSecs: uptimeDays === null ? null : uptimeDays * 86_400, noiseFloor,
});

export const regionFeedOverview = {
  connected: true,
  region: 'gr-att',
  brokerUrl: null,
  nodeCount: 214,
  observers: [
    observer(MC.lycabettus, 60_000, 4110, 23, -112),
    observer(MC.penteli, 120_000, 3980, 9, -115),
    observer(MC.kifisia, 240_000, null, 41, -109),
    observer(MC.glyfada, 360_000, 3870, 2, -117),
    observer(MC.psychiko, 540_000, null, 61, -104),
    observer(MC.parnitha, 3 * 3_600_000, null, null, null),
  ],
};

export const regionFeedNodes = [
  { publicKey: MC.penteli, name: 'Penteli Repeater', advType: 2, latitude: 38.05, longitude: 23.86, lastHeard: NOW - 60_000 },
  { publicKey: MC.glyfada, name: 'Glyfada Beach', advType: 1, latitude: 37.86, longitude: 23.75, lastHeard: NOW - 120_000 },
  { publicKey: MC.athensRoom, name: 'Athens Room', advType: 3, latitude: 37.98, longitude: 23.73, lastHeard: NOW - 360_000 },
  { publicKey: MC.lycabettus, name: 'Lycabettus Repeater', advType: 2, latitude: 37.98, longitude: 23.74, lastHeard: NOW - 400_000 },
  { publicKey: MC.kifisia, name: 'Kifisia Observer', advType: 2, latitude: 38.07, longitude: 23.81, lastHeard: NOW - 500_000 },
  { publicKey: MC.psychiko, name: 'Piraeus Port', advType: 2, latitude: 37.94, longitude: 23.64, lastHeard: NOW - 540_000 },
  { publicKey: MC.parnitha, name: 'Parnitha Repeater', advType: 2, latitude: 38.17, longitude: 23.72, lastHeard: NOW - 3 * 3_600_000 },
];

export const regionFeedMessages = [
  { id: 1, channelIdx: 1, channelName: '#athens', text: 'Morning, anyone on the coast road?', fromName: 'Glyfada Beach', createdAt: clock(10, 2), senderTimestamp: Math.floor((clock(10, 2) + 120_000) / 1000) },
  { id: 2, channelIdx: 0, channelName: '#Public', text: 'Lycabettus back on solar', fromName: 'Nikos T-Echo', createdAt: clock(9, 41), senderTimestamp: Math.floor(clock(9, 41) / 1000) },
  ...Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, channelIdx: 2, legacy: true, text: '', fromName: null, createdAt: clock(8, i) })),
];

/** The feed's packets: every observer, so the grouped counts run higher. */
const feedPackets = mcPackets.slice(0, 2).map((p, i) => ({ ...p, sourceId: REGION_FEED_ID, observerCount: i === 0 ? 3 : 5 }));

export function regionFeedFixtures(log: MeshCoreLog = { writes: [] }): Record<string, FixtureHandler> {
  const only = (reply: (u: URL) => unknown): FixtureHandler => (u) => (u.pathname.split('/')[3] === REGION_FEED_ID ? reply(u) : undefined);
  const ingest = (path: string) => `GET /api/sources/:id/meshcore/ingest/${path}`;
  return {
    'GET /api/sources': () => [...athensFixture.sources, regionFeedSource],
    'GET /api/sources/:id/status': only(() => ({ sourceId: REGION_FEED_ID, sourceName: regionFeedSource.name, sourceType: 'meshcore_mqtt', connected: true, nodeCount: 214, activeNodeCount: 0 })),
    [ingest('overview')]: only(() => ok(regionFeedOverview)),
    [ingest('nodes')]: only(() => ok({ nodes: regionFeedNodes })),
    [ingest('messages')]: only(() => ok({ messages: regionFeedMessages })),
    'GET /api/sources/:id/meshcore/packets': only(() => ({ packets: feedPackets, total: 2, hasMore: false, nextCursor: null, enabled: true, maxCount: 50_000, maxAgeHours: 24, isIngestSource: true })),
    'GET /api/sources/:id/meshcore/packets/grouped': only(() => ({ packets: feedPackets, total: 2, hasMore: false, enabled: true, maxCount: 50_000, maxAgeHours: 24, isIngestSource: true })),
    'DELETE /api/sources/:id/meshcore/packets': only((u) => {
      log.writes.push({ method: 'DELETE', path: u.pathname, body: undefined });
      return ok();
    }),
  };
}
