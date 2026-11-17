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
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
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
  contact(MC.lycabettus, 'Lycabettus Repeater', 2, 37.9838, 23.7432),
  contact(MC.penteli, 'Penteli Repeater', 2, 38.0496, 23.8644),
  contact(MC.parnitha, 'Parnitha Repeater', 2, 38.1717, 23.7181),
  contact(MC.athensRoom, 'Athens Room', 3, 37.98, 23.73),
  contact(MC.kifisia, 'Kifisia BBS', 3, 38.074, 23.811),
  contact(MC.psychiko, 'Psychiko Board', 3, 38.0, 23.77),
  contact(MC.glyfada, 'Glyfada Beach', 1, 37.86, 23.75),
  contact(MC.nikos, 'Nikos T-Echo', 1),
  contact(MC.marousi, 'Marousi Mobile', 1),
];

export const mcStatus = {
  connected: true,
  reactionsOutboundEnabled: true,
  deviceType: 1,
  deviceTypeName: 'Companion',
  config: { connectionType: 'tcp', tcpHost: '192.168.1.41', tcpPort: 5000 },
  localNode: { publicKey: MC.self, name: 'Heltec MeshCore', advType: 1, latitude: 37.975, longitude: 23.735 },
};

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
}

const ok = (data?: unknown) => ({ success: true, ...(data === undefined ? {} : { data }) });

/** A reply that never comes (a login still waiting on the room server). */
const never = () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'application/json' } });

export function meshcoreFixtures(log: MeshCoreLog = { writes: [] }, opts: MeshCoreFixtureOptions = {}): Record<string, FixtureHandler> {
  const connected = opts.connected ?? true;
  const status = { ...mcStatus, connected };
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
      ok({ status, contacts: mcContacts, nodes: [], messages: athensMessages, seqCursor: NOW }),
    ),
    'GET /api/sources/:id/meshcore/contacts': only(() => ({ success: true, data: mcContacts, count: mcContacts.length })),
    'GET /api/sources/:id/meshcore/messages': only(() => ok(athensMessages)),
    'GET /api/channels/all': (u) => (u.searchParams.get('sourceId') === SOURCE_IDS.heltec ? mcChannels : undefined),
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
  };
}
