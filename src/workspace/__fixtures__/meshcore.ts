/**
 * Heltec MeshCore as section 8's boards draw it (Task 7.1): the Companion, its
 * Athens contacts (three repeaters, three room servers, three people), the
 * channels Public, #athens, ops and the virtual "Athens Ops", #athens' messages,
 * Athens Room's posts and Kifisia BBS's saved password. Shapes follow today's
 * `/api/sources/:id/meshcore/*` replies (useMeshCore). Served as overrides
 * (`meshcoreFixtures()`), so no other board's requests change.
 *
 * Writes are logged in `log` (method, path, body) so a test can count the sends.
 */
import { SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type { MeshCoreMessage, MeshCoreNode } from '../../components/MeshCore/hooks/useMeshCore';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';

const key = (seed: string) => (seed + '0'.repeat(64)).slice(0, 64);

export const MC = {
  self: key('c0ffee11'),
  lycabettus: key('3fa1aa22'),
  penteli: key('a7f1bb33'),
  parnitha: key('9b02cc44'),
  athensRoom: key('7c22dd55'),
  kifisia: key('3c90ee66'),
  psychiko: key('51d0ff77'),
  glyfada: key('6a1b0188'),
  nikos: key('b44e0299'),
  marousi: key('d81303aa'),
  weather: key('91de0abb'),
} as const;

const NOW = Date.now();
const clock = (h: number, m: number) => {
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  // Yesterday's clock time: always in the past and always in order, whatever the time now.
  return d.getTime() - 86_400_000;
};

const contact = (publicKey: string, advName: string, advType: number, lat?: number, lon?: number, extra: Partial<MeshCoreContact> = {}): MeshCoreContact => ({
  publicKey, advName, advType, latitude: lat, longitude: lon, lastSeen: NOW - 60_000, lastAdvert: NOW - 60_000, ...extra,
});

export const mcContacts: MeshCoreContact[] = [
  { ...contact(MC.self, 'Heltec MeshCore', 1, 37.975, 23.735), isLocal: true } as MeshCoreContact,
  contact(MC.lycabettus, 'Lycabettus Repeater', 2, 37.9838, 23.7432, { pathLen: 0, outPath: '', snr: 6.5, rssi: -88, lastAdvert: NOW - 180_000 }),
  contact(MC.penteli, 'Penteli Repeater', 2, 38.0496, 23.8644, { pathLen: 0, outPath: '', snr: 7, rssi: -97 }),
  contact(MC.parnitha, 'Parnitha Repeater', 2, 38.1717, 23.7181, { pathLen: 2, snr: -3, rssi: -109 }),
  contact(MC.athensRoom, 'Athens Room', 3, 37.98, 23.73),
  contact(MC.kifisia, 'Kifisia BBS', 3, 38.074, 23.811),
  contact(MC.psychiko, 'Psychiko Board', 3, 38.0, 23.77),
  // Board 8-05: two 2-byte hops set by a path reply, not in the radio's list, its clock 2 min ahead.
  contact(MC.glyfada, 'Glyfada Beach', 1, 37.8642, 23.7471, {
    pathLen: 2, outPath: 'a7f1,3fa1', pathDiscoveredAt: NOW - 540_000, snr: 6.5, rssi: -88, lastAdvert: NOW - 360_000,
    onDevice: false, flags: 0, advertSignatureVerified: true, clockOffsetSeconds: -120,
  }),
  contact(MC.nikos, 'Nikos T-Echo', 1, undefined, undefined, { pathLen: 1, snr: 4, rssi: -95 }),
  contact(MC.marousi, 'Marousi Mobile', 1, undefined, undefined, { pathLen: 1, snr: 8, rssi: -90 }),
];

/** The durable node rows (battery, first heard, favourites, Lycabettus in the neighbours table) and a sensor heard by advert only. */
export const mcNodes: MeshCoreNode[] = [
  { publicKey: MC.lycabettus, name: 'Lycabettus Repeater', advType: 2, lastHeard: NOW - 60_000, rssi: -88, snr: 6.5, batteryMv: 4110,
    uptimeSecs: 23 * 86_400, latitude: 37.9838, longitude: 23.7432, isFavorite: true, repeaterNeighborAt: NOW - 60_000 },
  { publicKey: MC.glyfada, name: 'Glyfada Beach', advType: 1, lastHeard: NOW - 120_000, firstHeard: NOW - 40 * 86_400_000, rssi: -92, snr: 6,
    batteryMv: 3920, latitude: 37.8642, longitude: 23.7471, isFavorite: true },
  { publicKey: MC.penteli, name: 'Penteli Repeater', advType: 2, lastHeard: NOW - 240_000, rssi: -97, snr: 7, batteryMv: 3980, latitude: 38.0496, longitude: 23.8644 },
  { publicKey: MC.weather, name: 'Kifisia Weather', advType: 4, lastHeard: NOW - 1_320_000, rssi: -104, snr: -1, batteryMv: 3600, latitude: 38.07, longitude: 23.81 },
];

export const mcStatus = {
  connected: true,
  reactionsOutboundEnabled: true,
  deviceType: 1,
  deviceTypeName: 'Companion',
  config: { connectionType: 'tcp', tcpHost: '192.168.1.41', tcpPort: 5000 },
  // Board 8-08: EU/UK (Narrow) on companion protocol 14 (power-off, text CLI), Multi-ACKs off, 8 channel slots (Task 7.4).
  localNode: {
    publicKey: MC.self, name: 'Heltec MeshCore', advType: 1, latitude: 37.975, longitude: 23.735,
    radioFreq: 869.618, radioBw: 62.5, radioSf: 8, radioCr: 8, txPower: 20, maxTxPower: 22, multiAcks: 0, firmwareVer: 14,
    maxChannels: 8, advLocPolicy: 1, telemetryModeBase: 'always', telemetryModeLoc: 'device', telemetryModeEnv: 'never',
  },
};

/** A test private key (128 hex chars): never a real device's. */
export const MC_PRIVATE_KEY = 'ab'.repeat(64);

/** Public (slot 0), the hashtag #athens, the private ops, and a Channel Database key (virtual). */
export const mcChannels = [
  { id: 0, name: 'Public', psk: 'izOH6cXN6mrJ5e26oRXNcg==' },
  { id: 1, name: '#athens', psk: null },
  { id: 2, name: 'ops', psk: 'b3BzLXNlY3JldC1rZXktMDE=' },
  { id: 9, name: 'Athens Ops', psk: null, virtual: true },
];

const ch = (id: string, from: string | null, text: string, at: number, extra: Partial<MeshCoreMessage> = {}): MeshCoreMessage => ({
  id,
  fromPublicKey: from ?? 'channel-1',
  toPublicKey: from ? 'channel-1' : undefined,
  text,
  timestamp: at,
  receivedAt: at,
  ...extra,
});

/** #athens: Glyfada's 2-hop post, an ignored node's, Nikos (new since last read), and ours, sent as "GI desk". */
export const athensMessages: MeshCoreMessage[] = [
  ch('m-gly', null, 'Morning, anyone on the coast road? Testing a new antenna.', clock(10, 2), {
    fromName: 'Glyfada Beach', hopCount: 2, routePath: 'a7f1,3fa1', scopeCode: 4321, scopeName: 'gr-att',
  }),
  ch('m-ign', null, 'buy cheap antennas', clock(10, 5), { fromName: 'Spam Node', hopCount: 1, filtered: 'ignore' }),
  ch('m-nik', null, 'Hearing Lycabettus loud and clear from Marousi', clock(10, 14), {
    fromName: 'Nikos T-Echo', hopCount: 1, routePath: '3fa1',
  }),
  ch('m-own', MC.self, 'Heading to Glyfada, will report back on the coast road', NOW - 90_000, {
    senderTimestamp: Math.floor((NOW - 90_000) / 1000),
    senderNameOverride: 'GI desk',
    heardBy: [{ hash: '3f', name: 'Lycabettus Repeater', hops: 1, snr: 6.5 }],
    resendCount: 1,
    lastResendAt: NOW - 60_000,
  }),
];

/** The last-read marker for #athens: between Glyfada's and Nikos' posts (the "New" line). */
export const ATHENS_LAST_READ = clock(10, 10);

const post = (id: string, from: string, text: string, at: number): MeshCoreMessage => ({
  id, fromPublicKey: from, toPublicKey: MC.athensRoom, text, timestamp: at, receivedAt: at, messageType: 'room_post',
});

export const athensRoomPosts: MeshCoreMessage[] = [
  post('p1', MC.nikos.slice(0, 12), 'Lycabettus repeater back on solar after the storm.', clock(9, 41)),
  post('p2', MC.glyfada.slice(0, 12), 'Coast road coverage map updated, link in the wiki.', clock(9, 58)),
  post('p3', MC.marousi.slice(0, 12), 'Who has a spare 868 antenna? Need one for the rover.', clock(10, 5)),
  post('p4', MC.nikos.slice(0, 12), 'Meetup Saturday 11:00 at the Psychiko park, bring radios.', clock(10, 12)),
];
export const ATHENS_ROOM_LAST_READ = clock(10, 0);

export interface MeshCoreLog {
  writes: Array<{ method: string; path: string; body: unknown }>;
}

export interface MeshCoreFixtureOptions {
  /** Room login: `hang` keeps the request open (the progress card), else it answers. */
  login?: 'hang' | 'ok' | 'no_reply';
  connected?: boolean;
  /** Remote admin (Task 7.3): a remembered admin login on Lycabettus Repeater. */
  adminSession?: boolean;
  /** The radio's role (Task 7.4): 1 Companion (default), 2 Repeater. */
  deviceType?: number;
  /** Slot 0 holds a renamed Public channel, so Reset to Public shows (boards 8-09, 8-26; today hides it on a stock slot 0). */
  slot0Renamed?: boolean;
}

/** Lycabettus Repeater's settings as a remote read returns them, per group (boards 8-07, 8-25). */
export const lycabettusSettings = {
  identity: { name: 'Lycabettus Repeater', lat: 37.9819, lon: 23.7432, txPower: 20, radio: '869.618,62.5,8,8' },
  adverts: { advertInterval: 120, floodAdvertInterval: 24, floodMax: 8, repeat: true, af: 1, rxDelay: 0, txDelay: 0.5, directTxDelay: 0.3 },
  access: { allowReadOnly: true },
} as const;

const ok = (data?: unknown) => ({ success: true, ...(data === undefined ? {} : { data }) });

/** A reply that never comes (a login still waiting on the room server). */
const never = () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'application/json' } });

export function meshcoreFixtures(log: MeshCoreLog = { writes: [] }, opts: MeshCoreFixtureOptions = {}): Record<string, FixtureHandler> {
  const connected = opts.connected ?? true;
  const deviceType = opts.deviceType ?? 1;
  const status = {
    ...mcStatus,
    connected,
    deviceType,
    deviceTypeName: deviceType === 2 ? 'Repeater' : 'Companion',
    localNode: { ...mcStatus.localNode, advType: deviceType },
  };
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  const write = (reply: (u: URL, b: unknown) => unknown = () => ok()): FixtureHandler => (u, init) => {
    const b = body(init);
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, body: b });
    return reply(u, b);
  };
  const isHeltec = (u: URL) => u.pathname.split('/')[3] === SOURCE_IDS.heltec;
  const only = (h: FixtureHandler): FixtureHandler => (u, init) => (isHeltec(u) ? h(u, init) : undefined);
  const sessions = new Map<string, number>();
  return {
    'GET /api/sources/:id/status': (u) =>
      isHeltec(u)
        ? { sourceId: SOURCE_IDS.heltec, sourceName: 'Heltec MeshCore', sourceType: 'meshcore', connected, nodeCount: 22, activeNodeCount: 9 }
        : undefined,
    'GET /api/sources/:id/meshcore/status': only(() => ok(status)),
    'GET /api/sources/:id/meshcore/snapshot': only(() =>
      ok({ status, contacts: mcContacts, nodes: mcNodes, messages: athensMessages, seqCursor: NOW }),
    ),
    'GET /api/sources/:id/meshcore/contacts': only(() => ({ success: true, data: mcContacts, count: mcContacts.length })),
    'GET /api/sources/:id/meshcore/messages': only(() => ok(athensMessages)),
    'GET /api/channels/all': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec
        ? opts.slot0Renamed ? [{ ...mcChannels[0], name: 'Athens Public' }, ...mcChannels.slice(1)] : mcChannels
        : undefined,
    'GET /api/sources/:id/meshcore/messages/channel-counts': only(() => ({
      success: true,
      counts: { 0: 12, 1: 41, 2: 5, 9: 3 },
      latestTimestamps: { 0: clock(8, 0), 1: athensMessages[3].timestamp, 2: clock(7, 0), 9: clock(6, 0) },
    })),
    'GET /api/sources/:id/meshcore/messages/channel/:idx': only((u) =>
      ({ success: true, data: u.pathname.endsWith('/1') && !u.searchParams.get('offset') ? athensMessages : [], hasMore: u.pathname.endsWith('/1') && !u.searchParams.get('offset') }),
    ),
    'GET /api/sources/:id/meshcore/messages/room-stats': only(() =>
      ok([
        { roomPublicKey: MC.athensRoom, count: 214, latest: athensRoomPosts[3].timestamp, latestReceivedAt: athensRoomPosts[3].timestamp },
        { roomPublicKey: MC.kifisia, count: 12, latest: clock(7, 30), latestReceivedAt: clock(7, 30) },
      ]),
    ),
    'GET /api/sources/:id/meshcore/messages/room/:pk': only((u) =>
      ({ success: true, data: u.pathname.includes(MC.athensRoom) && !Number(u.searchParams.get('offset')) ? athensRoomPosts : [], hasMore: false }),
    ),
    'GET /api/sources/:id/meshcore/messages/dm-peers': only(() =>
      ok([
        { publicKey: MC.glyfada, lastMessageAt: clock(10, 9) },
        { publicKey: MC.nikos, lastMessageAt: clock(9, 0) },
        { publicKey: MC.marousi, lastMessageAt: clock(8, 0) },
      ]),
    ),
    'GET /api/read-state': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec
        ? ok({
            meshcore_channel: { 1: ATHENS_LAST_READ, 0: NOW, 2: NOW, 9: NOW },
            meshcore_room: { [MC.athensRoom]: ATHENS_ROOM_LAST_READ, [MC.kifisia]: NOW },
            meshcore_dm: { [MC.glyfada]: clock(9, 0), [MC.nikos]: NOW, [MC.marousi]: NOW },
          })
        : undefined,
    'POST /api/read-state': () => ok(),
    'POST /api/read-state/batch': () => ok(),
    'GET /api/settings': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec
        ? { meshcoreRequiredRepeaters: JSON.stringify([MC.penteli]), meshcoreRequiredRepeaterMode: 'any' }
        : undefined,
    'GET /api/push/preferences': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec ? { mutedChannels: [], mutedDMs: [] } : undefined,
    'GET /api/device/tx-status': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec ? { txEnabled: true, canTransmit: true } : undefined,
    'GET /api/sources/:id/meshcore/config/default-scope': only(() => ({ success: true, scope: 'gr-att' })),
    'GET /api/sources/:id/meshcore/saved-regions': only(() => ({
      success: true,
      regions: [{ id: 1, name: 'gr-ath', note: null, createdAt: NOW, updatedAt: NOW }],
    })),
    'POST /api/sources/:id/meshcore/regions/discover': only(write(() => ({ success: true, regions: ['gr-pir'], perRepeater: [] }))),
    'GET /api/sources/:id/meshcore/rooms/credentials': only(() => ({ success: true, canRemember: true, stored: [{ publicKey: MC.kifisia }] })),
    'GET /api/sources/:id/meshcore/rooms/sync-config': only((u) =>
      u.searchParams.get('publicKey') === MC.kifisia
        ? { success: true, enabled: true, intervalMinutes: 360, failureCount: 2, lastError: 'no_reply' }
        : { success: true, enabled: false, intervalMinutes: 60, failureCount: 0, lastError: null },
    ),
    'PATCH /api/sources/:id/meshcore/rooms/sync-config': only(write()),
    'DELETE /api/sources/:id/meshcore/rooms/credentials/:pk': only(write()),
    'POST /api/sources/:id/meshcore/rooms/login': only((u, init) => {
      const b = body(init) as { requestId?: string };
      log.writes.push({ method: 'POST', path: u.pathname, body: b });
      if (b?.requestId) sessions.set(b.requestId, 1);
      if (opts.login === 'hang') return never();
      if (opts.login === 'no_reply') return { success: false, code: 'ROOM_LOGIN_NO_REPLY', reason: 'no_reply', error: 'No reply' };
      return { success: true, persisted: false };
    }),
    'POST /api/sources/:id/meshcore/rooms/login-with-saved': only((u, init) => {
      const b = body(init) as { requestId?: string };
      log.writes.push({ method: 'POST', path: u.pathname, body: b });
      if (opts.login === 'hang') return never();
      return { success: true, usedStored: true };
    }),
    'GET /api/sources/:id/meshcore/admin/login-progress/:rid': only((u) => ok({
      requestId: u.pathname.split('/').pop(),
      phase: 'waiting', attempt: 2, maxAttempts: 3, waitMs: 30_000, waitRemainingMs: 14_000, cancelRequested: false, outcome: null,
    })),
    'POST /api/sources/:id/meshcore/admin/login-cancel': only(write()),
    'POST /api/sources/:id/meshcore/rooms/post': only(write()),
    'POST /api/sources/:id/meshcore/advert': only(write()),
    'POST /api/sources/:id/meshcore/messages/send': only(write()),
    'POST /api/sources/:id/meshcore/messages/:mid/resend': only(write(() => ok({ resendCount: 2, lastResendAt: Date.now() }))),
    'DELETE /api/sources/:id/meshcore/messages/:mid': only(write()),
    'DELETE /api/sources/:id/meshcore/messages/channel/:idx': only(write()),
    'POST /api/sources/:id/disconnect': (u, init) => (isHeltec(u) ? write()(u, init) : undefined),
    'POST /api/sources/:id/connect': (u, init) => (isHeltec(u) ? write()(u, init) : undefined),
    // The node page and Nodes (Task 7.2).
    'POST /api/sources/:id/meshcore/contacts/:pk/ping': only(write(() => ok({ hopHash: 'b2', rttMs: 412, snrToTarget: 5.5, snrFromTarget: 6 }))),
    'POST /api/sources/:id/meshcore/contacts/:pk/trace-path': only(write(() => ({ success: true, hops: [{ index: 0, snr: 7 }, { index: 1, snr: 3 }], lastSnr: -2.5, path: ['a7f1', '3fa1'] }))),
    'POST /api/sources/:id/meshcore/contacts/:pk/discover-path': only(write(() => ok({ suggestedTimeoutMs: 0, discoveryTimeoutMs: 30_000 }))),
    'POST /api/sources/:id/meshcore/contacts/:pk/reset-path': only(write()),
    'PUT /api/sources/:id/meshcore/contacts/:pk/out-path': only(write()),
    'POST /api/sources/:id/meshcore/contacts/:pk/share': only(write()),
    'GET /api/sources/:id/meshcore/contacts/:pk/export': only(() => ok({ advertBytes: [4, 163, 183] })),
    'POST /api/sources/:id/meshcore/contacts/:pk/add-to-device': only(write(() => ok({ status: 'added' }))),
    'DELETE /api/sources/:id/meshcore/contacts/:pk': only(write()),
    'POST /api/sources/:id/meshcore/contacts/import': only(write()),
    'POST /api/sources/:id/meshcore/contacts/refresh': only(write(() => ok(mcContacts))),
    'POST /api/sources/:id/meshcore/nodes/:pk/favorite': only(write()),
    'POST /api/sources/:id/meshcore/nodes/:pk/remote-cli': only(write()),
    'POST /api/sources/:id/meshcore/discover': only(write((_u, b) => ({
      success: true, returned: 4, new: 1,
      nodes: [MC.lycabettus, MC.penteli, MC.parnitha, MC.athensRoom].map((pk) => ({
        publicKey: pk, name: null, advType: 2, snr: 6, snrToNode: 5, rssi: -90, isNew: pk === MC.penteli && (b as { mode?: string })?.mode === 'repeaters',
      })),
    }))),
    'GET /api/sources/:id/meshcore/ignored-nodes': only(() => ok([])),
    'GET /api/sources/:id/meshcore/admin/session/:pk': only((u) =>
      ok(opts.adminSession && u.pathname.endsWith(MC.lycabettus) ? { active: true, loggedInAt: NOW - 3_600_000, isAdmin: true } : null),
    ),
    // Remote admin (Task 7.3): the credential store, login, CLI, status and settings of a repeater.
    'GET /api/sources/:id/meshcore/admin/credentials-capability': only(() =>
      ok({ canRemember: true, rotatedCount: 0, rotated: [], stored: [{ publicKey: MC.lycabettus, name: 'Lycabettus Repeater' }] }),
    ),
    'POST /api/sources/:id/meshcore/admin/login': only(write(() => ({ success: true, persisted: false }))),
    'POST /api/sources/:id/meshcore/admin/login-with-saved': only(write(() => ({ success: true, usedStored: true }))),
    'DELETE /api/sources/:id/meshcore/admin/session/:pk': only(write()),
    'DELETE /api/sources/:id/meshcore/admin/credentials/:pk': only(write()),
    'POST /api/sources/:id/meshcore/admin/cli': only(write((_u, b) => {
      const cmd = (b as { command?: string })?.command ?? '';
      return ok({ reply: cmd === 'ver' ? 'MeshCore v1.8.2 (Build: 14-Sep-2026)' : cmd === 'get radio' ? '869.618,62.5,8,8' : 'OK', elapsedMs: 900 });
    })),
    'GET /api/sources/:id/meshcore/admin/status/:pk': only(() =>
      ok({
        batteryMv: 4110, uptimeSecs: 23 * 86_400, queueLen: 0, noiseFloor: -112, lastRssi: -88, lastSnr: 6.5, airTimeSecs: 83_000,
        packetsRecv: 9412, packetsSent: 1584, sentFlood: 1204, sentDirect: 380, recvFlood: 8400, recvDirect: 1012, floodDups: 812, directDups: 41, recvErrors: 3,
      }),
    ),
    'GET /api/sources/:id/meshcore/cli-history': only(() =>
      ok({
        entries: [
          { id: 3, sourceId: SOURCE_IDS.heltec, timestamp: clock(10, 24), targetKind: 'remote', targetPublicKey: MC.lycabettus, targetName: 'Lycabettus Repeater',
            origin: 'user', userId: 1, username: 'GI', command: 'ver', outcome: 'ok', reply: 'MeshCore v1.8.2', error: null, elapsedMs: 900, ipAddress: null },
          { id: 2, sourceId: SOURCE_IDS.heltec, timestamp: clock(10, 23), targetKind: 'remote', targetPublicKey: MC.lycabettus, targetName: 'Lycabettus Repeater',
            origin: 'user', userId: 1, username: 'GI', command: 'password ********', outcome: 'ok', reply: 'password now: ********', error: null, elapsedMs: 900, ipAddress: null },
          { id: 1, sourceId: SOURCE_IDS.heltec, timestamp: clock(9, 12), targetKind: 'remote', targetPublicKey: MC.lycabettus, targetName: 'Lycabettus Repeater',
            origin: 'user', userId: 2, username: 'maria', command: 'get radio', outcome: 'ok', reply: '869.618,62.5,8,8', error: null, elapsedMs: 900, ipAddress: null },
        ],
        nextBefore: clock(9, 12),
        nextBeforeId: 1,
      }),
    ),
    'POST /api/sources/:id/meshcore/admin/settings/:pk/read': only(write((_u, b) => {
      const groups = ((b as { groups?: Array<keyof typeof lycabettusSettings> })?.groups ?? []);
      const values = Object.assign({}, ...groups.map((g) => lycabettusSettings[g]));
      return ok({ values, guestPasswordSet: true, errors: {}, firmware: 'v1.8.2', deviceType: 'repeater', sent: Object.keys(values).length });
    })),
    'PATCH /api/sources/:id/meshcore/admin/settings/:pk': only(write((_u, b) => {
      const patch = (b ?? {}) as Record<string, unknown>;
      const results = Object.fromEntries(Object.keys(patch).map((k) => [k, { ok: true, changed: true, verified: true }]));
      return ok({ ok: true, results, values: patch, sent: Object.keys(patch).length });
    })),
    'GET /api/sources/:id/meshcore/neighbors': only(() => ok({ items: [] })),
    // Device settings (Task 7.4, boards 8-08 … 8-10): today's config routes, each write logged.
    'POST /api/sources/:id/meshcore/config/:setting': only(write()),
    'GET /api/sources/:id/meshcore/config/ble-pin': only(() => ok({ pin: 123456 })),
    'GET /api/sources/:id/meshcore/config/discoverable': only(() => ({ success: true, enabled: false })),
    'GET /api/sources/:id/meshcore/config/private-key': only(() => ok({ privateKey: MC_PRIVATE_KEY })),
    'GET /api/sources/:id/meshcore/config/default-path-hash-size': only(() => ok({ size: 1 })),
    'GET /api/sources/:id/meshcore/config/sender-names': only(() => ok({ allowed: [], enforce: false })),
    'PATCH /api/sources/:id/meshcore/config/repeater-settings': only(write((_u, b) => {
      const patch = (b ?? {}) as Record<string, unknown>;
      return ok({ ok: true, results: Object.fromEntries(Object.keys(patch).map((k) => [k, { ok: true, changed: true, verified: true }])), values: patch });
    })),
    'GET /api/sources/:id/meshcore/message-filters': only(() =>
      ok([{ id: 'f1', mode: 'ignore', matchType: 'wildcard', pattern: 'buy *', caseSensitive: false, fields: 'body', enabled: true, hitCount: 3, lastHitAt: null }]),
    ),
    'POST /api/sources/:id/meshcore/message-filters': only(write((_u, b) => ok({ id: 'f2', hitCount: 0, lastHitAt: null, ...(b as object) }))),
    'PUT /api/sources/:id/meshcore/message-filters/:fid': only(write((_u, b) => ok({ id: 'f1', hitCount: 3, lastHitAt: null, ...(b as object) }))),
    'DELETE /api/sources/:id/meshcore/message-filters/:fid': only(write()),
    'GET /api/sources/:id/meshcore/config/repeater-settings': only(() =>
      ok({ values: lycabettusSettings.adverts, guestPasswordSet: false, firmware: { version: 'v1.8.2' }, capabilities: { reboot: true, powerOff: false, keyExport: false, keyImport: false } }),
    ),
    'GET /api/sources/:id/meshcore/config/autoadd-config': only(() =>
      ok({ supported: true, overwriteOldest: true, types: { chat: true, repeater: true, room: true, sensor: false }, maxHops: 3 }),
    ),
    'GET /api/sources/:id/meshcore/contacts/device-sync': only(() =>
      ok({ available: true, manualAddContacts: 1, autoAddEnabled: false, missingFavorites: [], deviceContactCount: 41, deviceContactsKnown: true, removableContactCount: 38, keptContactCount: 3 }),
    ),
    'POST /api/sources/:id/meshcore/contacts/push-to-device': only(write(() =>
      ok({ added: [], alreadyOnDevice: 41, skipped: [], notAddedNoRoom: 0, evicted: [], capacityKnown: true, maxContacts: 100, freeSlotsBefore: 59, freeSlotsAfter: 59 }),
    )),
    'POST /api/sources/:id/meshcore/contacts/remove-non-favorites': only(write(() => ok({ removed: 38, kept: 3, failed: 0, total: 41 }))),
    'GET /api/sources/:id/meshcore/nodes/purge-non-favourites/preview': only(() => ok({ count: 12 })),
    'POST /api/sources/:id/meshcore/nodes/purge-non-favourites': only(write(() => ok({ deleted: 12 }))),
    'PUT /api/channels/:idx': (u, init) => {
      const b = body(init) as { sourceId?: string } | undefined;
      if (b?.sourceId !== SOURCE_IDS.heltec) return undefined;
      log.writes.push({ method: 'PUT', path: u.pathname, body: b });
      return ok();
    },
    'DELETE /api/channels/:idx': (u) => {
      if (u.searchParams.get('sourceId') !== SOURCE_IDS.heltec) return undefined;
      log.writes.push({ method: 'DELETE', path: u.pathname, body: undefined });
      return ok();
    },
    'POST /api/channels/encode-url': (_u, init) => {
      const b = body(init) as { sourceId?: string } | undefined;
      return b?.sourceId === SOURCE_IDS.heltec ? { url: 'meshcore://channel/add?name=%23athens&secret=0123456789abcdef0123456789abcdef' } : undefined;
    },
    'GET /api/backup/settings': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec ? { enabled: true, maxBackups: 7, backupTime: '03:00' } : undefined,
    'GET /api/backup/list': (u) =>
      u.searchParams.get('sourceId') === SOURCE_IDS.heltec
        ? [
            { filename: 'meshcore-heltec-1.yaml', timestamp: new Date(clock(3, 0) + 86_400_000).toISOString(), size: 2048, type: 'automatic' },
            { filename: 'meshcore-heltec-0.yaml', timestamp: new Date(clock(3, 0)).toISOString(), size: 2048, type: 'automatic' },
          ]
        : undefined,
    'GET /api/sources/:id/meshcore/hop-snr': only((u) =>
      u.searchParams.get('publicKey') === MC.glyfada
        ? ok({
            hours: 168,
            links: [{
              sender: { publicKey: MC.lycabettus, hash: null, candidates: 1 },
              receiver: { publicKey: MC.glyfada, hash: null, candidates: 1 },
              count: 9, lastSnr: -2.5, avgSnr: -1.8, minSnr: -4, maxSnr: 1, lastTimestamp: NOW - 780_000, initiatedCount: 9,
              points: [[NOW - 3_600_000, -2], [NOW - 780_000, -2.5]],
            }],
          })
        : ok({ hours: 168, links: [] }),
    ),
  };
}
