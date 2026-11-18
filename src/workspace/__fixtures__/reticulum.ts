/**
 * Reticulum node as section 9's boards draw it (Task 7.6): own mode, 38
 * destinations (eight listed), four interfaces (Athens LoRa an RNode), the
 * path table, five LXMF conversations and Kifisia Sideband's thread, the LXMF
 * identity, and the RNode's radio and device info. Shapes follow today's
 * `/api/sources/:id/reticulum/*` replies (useReticulum, the identity and
 * radio hooks). Served as overrides (`reticulumFixtures()`), so no other
 * board's requests change.
 *
 * Every request to the Reticulum routes is logged in `log.reads` / `log.writes`
 * (method, path, body), so a test can count the polls and the sends.
 */
import { athensFixture, SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type {
  ReticulumConversation,
  ReticulumDestinationRow,
  ReticulumInterfaceRow,
  ReticulumMessageRow,
  ReticulumPathRow,
} from '../../types/reticulum';

const NOW = Date.now();
const MIN = 60_000;
const ID = SOURCE_IDS.rns;
/** A 16-byte hash (32 hex) from a readable seed: its first and last four characters are the seed's. */
const hash = (seed: string) => seed.padEnd(28, '0').slice(0, 28) + seed.slice(-4);

export const RNS = {
  self: hash('e41d07c29b335a88f1c2'),
  kifisia: hash('e7a19b420c554c09'),
  halandriT: hash('a3f1c1d207c2'),
  marousi: hash('5b0d33e211'),
  psychiko: hash('9c3e4407fa'),
  glyfada: hash('31c8559d5e'),
  rover: hash('d40b666a13'),
  desk: hash('b62e7711d4'),
  anon: hash('a91c882f07'),
  hymettus: hash('77aa99bb01'),
} as const;

const dest = (
  destinationHash: string,
  displayName: string | null,
  appName: string,
  aspects: string,
  extra: Partial<ReticulumDestinationRow> = {},
): ReticulumDestinationRow => ({
  sourceId: ID, destinationHash, identityHash: null, appName, aspects, displayName, appDataB64: null,
  hops: 1, nextHopInterface: 'Athens LoRa', rssi: null, snr: null, quality: null, announceCount: 10,
  firstSeen: NOW - 86_400_000, lastSeen: NOW - 2 * MIN, lastAnnounceAt: NOW - 2 * MIN, isFavorite: false,
  createdAt: NOW - 86_400_000, updatedAt: NOW, latitude: null, longitude: null, altitude: null, speed: null,
  bearing: null, accuracy: null, positionUpdatedAt: null, ...extra,
});

export const rnsDestinations: ReticulumDestinationRow[] = [
  dest(RNS.kifisia, 'Kifisia Sideband', 'lxmf', 'delivery', { hops: 2, rssi: -97, snr: 6.25, quality: 88, announceCount: 31, isFavorite: true,
    firstSeen: NOW - 16 * 3_600_000, latitude: 38.074, longitude: 23.811, positionUpdatedAt: NOW - 5 * MIN }),
  dest(RNS.halandriT, 'Halandri Transport', 'rnstransport', 'remote.management', { rssi: -79, snr: 11, quality: 99, announceCount: 64, lastSeen: NOW - MIN, isFavorite: true }),
  dest(RNS.marousi, 'Marousi Sideband', 'lxmf', 'delivery', { rssi: -84, snr: 9.5, quality: 96, lastSeen: NOW - 6 * MIN }),
  dest(RNS.psychiko, 'Psychiko NomadNet', 'nomadnetwork', 'node', { hops: 3, lastSeen: NOW - 12 * MIN }),
  dest(RNS.glyfada, 'Glyfada Propagation', 'lxmf', 'propagation', { hops: 2, rssi: -101, snr: 3.75, quality: 71, lastSeen: NOW - 18 * MIN, isFavorite: true }),
  dest(RNS.rover, 'Athens Rover', 'lxmf', 'delivery', { rssi: -92, snr: 7, quality: 90, lastSeen: NOW - 24 * MIN, latitude: 37.97, longitude: 23.72, positionUpdatedAt: NOW - 30 * MIN }),
  dest(RNS.desk, 'Halandri Desk', 'lxmf', 'delivery', { hops: 2, lastSeen: NOW - 31 * MIN, isFavorite: true }),
  dest(RNS.anon, null, 'lxmf', 'delivery', { hops: 4, lastSeen: NOW - 3 * 3_600_000, announceCount: 1, firstSeen: NOW - 3 * 3_600_000 }),
];

const iface = (interfaceName: string, interfaceType: string, extra: Partial<ReticulumInterfaceRow> = {}): ReticulumInterfaceRow => ({
  sourceId: ID, interfaceName, interfaceType, interfaceHash: null, mode: null, status: 'Up', online: true, bitrate: 10_000_000,
  txBytes: 3_000_000, rxBytes: 5_600_000, lastSeenAt: NOW, createdAt: NOW - 86_400_000, updatedAt: NOW,
  frequency: null, bandwidth: null, spreadingFactor: null, codingRate: null, txPower: null, stAlock: null, ltAlock: null, radioState: null,
  deviceInfoJson: null, airtimeShort: null, airtimeLong: null, channelLoadShort: null, channelLoadLong: null, noiseFloor: null,
  interference: null, interferenceLastTs: null, interferenceLastDbm: null, cpuLoad: null, batteryState: null, batteryPercent: null,
  ...extra,
});

export const rnsInterfaces: ReticulumInterfaceRow[] = [
  iface('Athens LoRa', 'RNodeInterface', {
    bitrate: 3125, txBytes: 1_250_000, rxBytes: 8_800_000, frequency: 869_525_000, bandwidth: 250_000, spreadingFactor: 8, codingRate: 5,
    txPower: 14, airtimeShort: 3.2, airtimeLong: 3.2, channelLoadShort: 11, channelLoadLong: 11, noiseFloor: -112, interference: -98,
    interferenceLastTs: Math.floor(NOW / 1000) - 14 * 60, interferenceLastDbm: -98, cpuLoad: 7, batteryPercent: 81,
  }),
  iface('Athens Hub', 'TCPClientInterface', { txBytes: 23_000_000, rxBytes: 147_000_000 }),
  iface('Default Interface', 'AutoInterface'),
  iface('Backup Hub', 'TCPClientInterface', { status: 'Reconnecting', online: false, txBytes: 400_000, rxBytes: 2_300_000 }),
];

const path = (destinationHash: string, viaHash: string | null, hops: number, interfaceName: string, ageMin: number): ReticulumPathRow => ({
  sourceId: ID, destinationHash, viaHash, hops, interfaceName, expiresAt: null, updatedAt: NOW - ageMin * MIN,
});

export const rnsPaths: ReticulumPathRow[] = [
  path(RNS.kifisia, RNS.halandriT, 2, 'Athens LoRa', 4),
  path(RNS.halandriT, null, 1, 'Athens LoRa', 1),
  path(RNS.glyfada, RNS.halandriT, 2, 'Athens LoRa', 9),
  path(RNS.psychiko, RNS.halandriT, 3, 'Athens Hub', 12),
  path(RNS.desk, RNS.hymettus, 2, 'Athens Hub', 31),
  path(RNS.marousi, null, 1, 'Athens LoRa', 6),
  path(RNS.rover, null, 1, 'Default Interface', 24),
  path(RNS.anon, RNS.hymettus, 4, 'Athens Hub', 180),
];

/** Today, at a clock time (yesterday's when that is still ahead). */
const at = (h: number, m: number) => {
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  return d.getTime() > NOW ? d.getTime() - 86_400_000 : d.getTime();
};

const msg = (id: string, fromHash: string, toHash: string, content: string, timestamp: number, extra: Partial<ReticulumMessageRow> = {}): ReticulumMessageRow => ({
  id, sourceId: ID, fromHash, toHash, title: null, content, timestamp, receivedAt: timestamp, createdAt: timestamp, state: 'delivered',
  method: 'direct', signatureValidated: true, ratcheted: false, fields: null, replyToHash: null, threadHash: null, rssi: null, snr: null, quality: null,
  ...extra,
});

/** Kifisia Sideband's thread (9-01, 9-10): ours in every delivery state, a thread marker with a GPX attachment, a reply. */
export const kifisiaThread: ReticulumMessageRow[] = [
  msg('m1', RNS.kifisia, RNS.self, 'Heading up Parnitha this afternoon, anyone around?', at(10, 12)),
  msg('m2', RNS.self, RNS.kifisia, 'I’m at the hut from 2. Can you send the route?', at(10, 14), { state: 'delivered' }),
  msg('m3', RNS.kifisia, RNS.self, 'Trail attached, see you at the top', at(10, 31), {
    threadHash: hash('7d01'),
    fields: JSON.stringify({ fileAttachments: [['parnitha-loop.gpx', { bytesLength: 14_540 }]] }),
  }),
  msg('m4', RNS.self, RNS.kifisia, 'Got it, thanks', at(10, 33), { state: 'sent', replyToHash: hash('m3') }),
  msg('m5', RNS.self, RNS.kifisia, 'Is the spring at the hut running?', at(10, 35), { state: 'failed' }),
  msg('m6', RNS.self, RNS.kifisia, 'Bringing water either way', at(10, 36), { state: 'sending' }),
];

/** The latest page (50, today's page size): older chat ahead of the thread, so Load older messages shows. */
const kifisiaPage: ReticulumMessageRow[] = [
  ...Array.from({ length: 44 }, (_, i) =>
    msg(`old${i}`, i % 2 ? RNS.self : RNS.kifisia, i % 2 ? RNS.kifisia : RNS.self, `Earlier note ${i + 1}`, NOW - 3 * 86_400_000 + i * 60_000),
  ),
  ...kifisiaThread,
];

const convo = (peerHash: string, lastMessage: ReticulumMessageRow, messageCount: number): ReticulumConversation => ({ peerHash, lastMessage, messageCount });

export const rnsConversations: ReticulumConversation[] = [
  convo(RNS.kifisia, kifisiaThread[2], 6),
  convo(RNS.marousi, msg('x2', RNS.marousi, RNS.self, 'Delivered, thanks', at(9, 58)), 4),
  convo(RNS.desk, msg('x3', RNS.desk, RNS.self, 'Can you resend the map?', NOW - 86_400_000), 2),
  convo(RNS.rover, msg('x4', RNS.rover, RNS.self, 'On the ridge road now', NOW - 3 * 86_400_000), 9),
  convo(RNS.anon, msg('x5', RNS.anon, RNS.self, 'Hello from Piraeus', NOW - 4 * 86_400_000), 1),
];

export const rnsStatus = { connected: true, mode: 'own', interfaceCount: 4, destinationCount: 38, rnsVersion: '0.9.6', bridgeVersion: '1.4.0' };

/** The rate history of each interface (`/api/telemetry/rns:iface:<name>`), one point an hour. */
function rateHistory(nodeId: string): unknown[] {
  const name = decodeURIComponent(nodeId).replace('rns:iface:', '');
  const idx = rnsInterfaces.findIndex((i) => i.interfaceName === name);
  if (idx < 0 || !rnsInterfaces[idx].online) return [];
  const scale = [60, 900, 300][idx] ?? 100;
  return Array.from({ length: 24 }, (_, h) => [
    { nodeId, nodeNum: 0, telemetryType: 'reticulum_iface_rx_rate', timestamp: NOW - (23 - h) * 3_600_000, value: Math.round(scale * (1 + Math.sin(h / 3) * 0.4)) },
    { nodeId, nodeNum: 0, telemetryType: 'reticulum_iface_tx_rate', timestamp: NOW - (23 - h) * 3_600_000, value: Math.round(scale * 0.2 * (1 + Math.cos(h / 4) * 0.3)) },
  ]).flat();
}

export interface ReticulumLog {
  reads: Array<{ method: string; path: string }>;
  writes: Array<{ method: string; path: string; body: unknown }>;
}

export interface ReticulumFixtureOptions {
  /** The identity's cooldown, as the server reports it after a recent announce (9-06). */
  cooldownRemainingSeconds?: number;
  /** The source's configured mode (its source row's config). */
  mode?: 'own' | 'attach' | 'tcp_peer';
  /** The Remote Fleet query's answer. */
  remoteOk?: boolean;
}

export function reticulumFixtures(log: ReticulumLog = { reads: [], writes: [] }, opts: ReticulumFixtureOptions = {}): Record<string, FixtureHandler> {
  const ok = (data?: unknown) => ({ success: true, ...(data === undefined ? {} : { data }) });
  const mine = (u: URL) => u.pathname.split('/')[3] === ID;
  const read = (h: FixtureHandler): FixtureHandler => (u, init) => {
    if (!mine(u)) return undefined;
    log.reads.push({ method: 'GET', path: u.pathname });
    return h(u, init);
  };
  const write = (h: FixtureHandler): FixtureHandler => (u, init) => {
    if (!mine(u)) return undefined;
    log.writes.push({ method: init?.method ?? 'POST', path: u.pathname, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    return h(u, init);
  };
  const mode = opts.mode ?? 'own';
  let destinations = rnsDestinations;
  const announce = {
    connected: true, destinationHash: RNS.self, displayName: 'GI desk', maxDisplayNameLength: 64, announceIntervalHours: 6, cooldownSeconds: 60,
    lastAnnounceAt: NOW - 18_000, cooldownRemainingSeconds: opts.cooldownRemainingSeconds ?? 0, nextPeriodicAnnounceAt: NOW + 6 * 3_600_000 - 18_000,
  };
  return {
    // The board's source row, in its mode (own by default).
    'GET /api/sources': () => athensFixture.sources.map((s) => (s.id === ID ? { ...s, config: { ...s.config, mode } } : s)),
    'GET /api/sources/:id/reticulum/status': read(() => ok({ ...rnsStatus, mode })),
    'GET /api/sources/:id/reticulum/destinations': read(() => ok(destinations)),
    'GET /api/sources/:id/reticulum/interfaces': read(() => ok(rnsInterfaces)),
    'GET /api/sources/:id/reticulum/messages': read(() => ok(rnsConversations)),
    'GET /api/sources/:id/reticulum/messages/:peer': read((u) => ok(u.pathname.endsWith(RNS.kifisia) && !u.searchParams.has('before') ? kifisiaPage : [])),
    'GET /api/sources/:id/reticulum/paths': read(() => ok(rnsPaths)),
    'GET /api/sources/:id/reticulum/identity': read(() => ok({ destinationHash: RNS.self, displayName: 'GI desk' })),
    'GET /api/sources/:id/reticulum/announce-settings': read(() => ok(announce)),
    'GET /api/sources/:id/reticulum/radio-config': read(() =>
      ok({ frequency: 869_525_000, bandwidth: 250_000, spreadingFactor: 8, codingRate: 5, txPower: 14, stAlock: 15, ltAlock: 5, radioState: true }),
    ),
    'GET /api/sources/:id/reticulum/device-info': read(() => ok({ firmwareVersion: '1.82', platform: 'ESP32', mcu: 'ESP32-S3', chipTemp: 41 })),
    'GET /api/sources/:id/reticulum/remote-status/:hash': read((u) =>
      ok(
        opts.remoteOk === false
          ? { destinationHash: u.pathname.split('/').pop(), ok: false, status: null, path: null, error: 'No response from remote node' }
          : {
              destinationHash: u.pathname.split('/').pop(),
              ok: true,
              status: { interfaces: [{}, {}, {}], linkCount: 5 },
              path: Array.from({ length: 112 }, () => ({})),
              error: null,
            },
      ),
    ),
    'POST /api/sources/:id/reticulum/messages': write((_u, init) => {
      const b = JSON.parse(String(init?.body)) as { to: string; content: string };
      return ok(msg(`sent-${log.writes.length}`, RNS.self, b.to, b.content, Date.now(), { state: 'sending' }));
    }),
    'POST /api/sources/:id/reticulum/paths/probe': write((_u, init) => {
      const b = JSON.parse(String(init?.body)) as { destinationHash: string };
      return ok(
        b.destinationHash === RNS.glyfada
          ? { destinationHash: b.destinationHash, ok: false, rttMs: null, hops: null, error: null }
          : { destinationHash: b.destinationHash, ok: true, rttMs: b.destinationHash === RNS.kifisia ? 1840 : 412, hops: b.destinationHash === RNS.kifisia ? 2 : 1, error: null },
      );
    }),
    'POST /api/sources/:id/reticulum/destinations/:hash/favorite': write((u, init) => {
      const h = u.pathname.split('/')[6];
      const favorite = (JSON.parse(String(init?.body)) as { favorite: boolean }).favorite;
      destinations = destinations.map((d) => (d.destinationHash === h ? { ...d, isFavorite: favorite } : d));
      return ok({ destinationHash: h, isFavorite: favorite });
    }),
    'POST /api/sources/:id/reticulum/announce': write(() => ok({ announced: true })),
    'PUT /api/sources/:id/reticulum/display-name': write(() => ok({ applied: true })),
    'PUT /api/sources/:id/reticulum/announce-interval': write(() => ok()),
    'PUT /api/sources/:id/reticulum/radio-config': write(() => ok()),
    // The device's settings: the Dashboard's charts of three interfaces' rates (9-03).
    'GET /api/settings': (u) =>
      u.searchParams.get('sourceId') === ID
        ? {
            ...athensFixture.settings,
            telemetryFavorites: JSON.stringify(
              ['Athens LoRa', 'Athens Hub', 'Default Interface'].flatMap((n) => [
                { nodeId: `rns:iface:${n}`, telemetryType: 'reticulum_iface_rx_rate' },
                { nodeId: `rns:iface:${n}`, telemetryType: 'reticulum_iface_tx_rate' },
              ]),
            ),
          }
        : undefined,
    'GET /api/telemetry/:nodeId': (u) => (u.searchParams.get('sourceId') === ID ? rateHistory(u.pathname.split('/')[3]) : undefined),
  };
}
