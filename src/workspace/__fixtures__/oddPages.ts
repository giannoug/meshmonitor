/**
 * Task 9.2's odd pages as boards 17-05 … 17-16 draw them: Station G2's
 * outlier preview, the saved broker presets, the news feed, the hosted
 * privacy document and the Athens embed map. Shared by the Vitest boards and
 * Playwright (`tests/workspace-e2e/boards.ts`).
 */
import type { FixtureHandler } from './fixtureApi';
import { SOURCE_IDS } from './athens';
import { bridgeFixtures, meshmonitorFixtures } from '../settings/__tests__/meshmonitorFixtures';
import type { OutlierPreview } from '../../utils/telemetryOutliers';

const NOW = Date.UTC(2026, 10, 11, 3, 12);
const DAY = 86_400_000;

/** 17-07 / 17-14: Temperature on Station G2, max 60. */
export const OUTLIER_PREVIEW: OutlierPreview = {
  sourceId: SOURCE_IDS.g2,
  telemetryType: 'temperature',
  nodeId: null,
  criteria: { auto: true, k: 6, min: null, max: 60 },
  cutoffId: 9001,
  fingerprint: 'f00d',
  rowsScanned: 4812,
  nodesScanned: 12,
  affectedCount: 37,
  nodesAffected: 3,
  removedMin: -40,
  removedMax: 85,
  median: null,
  mad: null,
  scaleKind: null,
  nodesTooFew: 0,
  nodesFlat: 0,
  points: [
    { id: 1, nodeId: '!penteli', value: 85, timestamp: NOW, reason: 'above_max' },
    { id: 2, nodeId: '!penteli', value: 85, timestamp: NOW + 120_000, reason: 'above_max' },
    { id: 3, nodeId: '!kifisia', value: -40, timestamp: NOW - 2 * DAY, reason: 'auto' },
    { id: 4, nodeId: '!psychiko', value: 61.3, timestamp: NOW - 3 * DAY, reason: 'above_max' },
    { id: 5, nodeId: '!kifisia', value: -39.8, timestamp: NOW - 3 * DAY - 420_000, reason: 'auto' },
  ],
  pointsTruncated: true,
  nodes: [],
};

export const outlierFixtures = (extra: Record<string, FixtureHandler> = {}): Record<string, FixtureHandler> => ({
  ...meshmonitorFixtures(),
  'GET /api/purge/telemetry/outliers/types': () => ({ success: true, data: { types: ['temperature', 'humidity'] } }),
  'POST /api/purge/telemetry/outliers/preview': () => ({ success: true, data: OUTLIER_PREVIEW }),
  'POST /api/purge/telemetry/outliers': () => ({ success: true, data: { deletedCount: 37, nodesAffected: 3 } }),
  ...extra,
});

/** 17-08 / 17-15: three saved presets; the bridge's broker is Athens community's (Station G2's MQTT page draws them too). */
export const SAVED_PRESETS = [
  { id: 1, name: 'Athens community', host: 'mqtt.athensmesh.gr', port: 8883, tls: true, rootTopic: 'msh/EU_868/GR', hasUsername: true, hasPassword: true, username: 'athens', password: 'athens-pw' },
  { id: 2, name: 'Piraeus test broker', host: '192.168.1.60', port: 1883, tls: false, rootTopic: null, hasUsername: false, hasPassword: false, username: null, password: null },
  { id: 3, name: 'Meshtastic EU mirror', host: 'mqtt.eu.example', port: 1883, tls: false, rootTopic: null, hasUsername: true, hasPassword: false, username: 'meshdev', password: null },
];

/** The saved preset routes alone. */
export const presetRoutes = (): Record<string, FixtureHandler> => ({
  'GET /api/mqtt-broker-presets': () => ({ success: true, data: { canManage: true, presets: SAVED_PRESETS } }),
  'POST /api/mqtt-broker-presets': (_u, init) => ({ success: true, data: { id: 9, ...JSON.parse(String(init?.body)) } }),
  'PUT /api/mqtt-broker-presets/:id': (u, init) => ({ success: true, data: { id: Number(u.pathname.split('/').pop()), ...JSON.parse(String(init?.body)) } }),
  'DELETE /api/mqtt-broker-presets/:id': () => ({ success: true }),
});

/** The MQTT bridge source (12-13) with the saved presets. */
export const brokerPresetFixtures = (extra: Record<string, FixtureHandler> = {}): Record<string, FixtureHandler> => ({
  ...bridgeFixtures(),
  ...presetRoutes(),
  ...extra,
});

/** 17-09 / 17-16: the three newest items; the security fix is Important. */
export const NEWS_BOARD_FEED = {
  version: '1',
  lastUpdated: '2026-11-10T00:00:00Z',
  items: [
    { id: 'n3', title: 'Server › Embed profiles', content: 'Embed profiles moved to **Server**.', date: '2026-11-10T09:00:00Z', category: 'feature', priority: 'normal' },
    {
      id: 'n2',
      title: 'Security fix in 4.15.2',
      content:
        'A session cookie could outlive its sign-out on some reverse-proxy setups. 4.15.2 fixes it; **update as soon as you can**.\n\n' +
        '- Docker: pull `meshmonitor:4.15.2` and restart\n- LXC: run `meshmonitor-update`\n- Everyone is signed out once after the update\n\n' +
        'Details are in the [release notes](/releases/4.15.2).',
      date: '2026-11-06T09:00:00Z',
      category: 'release',
      priority: 'important',
    },
    { id: 'n1', title: 'MeshCore room servers', content: 'Room servers are here.', date: '2026-10-28T09:00:00Z', category: 'feature', priority: 'normal' },
  ],
};

/** The news routes, with every non-GET logged as `METHOD path`. */
export function newsFixtures(writes: string[] = [], status = { lastSeenNewsId: null as string | null, dismissedNewsIds: [] as string[] }): Record<string, FixtureHandler> {
  const log = (u: URL, init?: RequestInit) => {
    writes.push(`${init?.method} ${u.pathname}`);
    return { success: true };
  };
  return {
    'GET /api/news': () => NEWS_BOARD_FEED,
    'GET /api/news/user/status': () => status,
    'GET /api/news/unread': () => ({ items: NEWS_BOARD_FEED.items }),
    'POST /api/news/dismiss/:id': log,
    'POST /api/news/user/status': log,
  };
}

/** 17-05 / 17-12: the hosted privacy policy; any other document is not published. */
export const PRIVACY_POLICY = {
  slug: 'privacy',
  title: 'Privacy Policy',
  content:
    '## What this instance collects\n\nThis MeshMonitor is run by volunteers of the Athens mesh. It stores what the radios it is connected to hear: node names, positions that nodes broadcast, telemetry and channel messages on public channels.\n\n' +
    '- Accounts: a username and a password hash, for people who sign in\n- Logs: IP address and browser, kept for 30 days for security\n- No advertising or tracking cookies\n\n' +
    '## How long it is kept\n\nMessages are kept for 90 days and traceroutes for 30 days, then deleted automatically.\n\n' +
    '## Contact\n\nQuestions or removal requests: [privacy@athensmesh.gr](mailto:privacy@athensmesh.gr).',
  updatedAt: Date.UTC(2026, 10, 2, 12),
};

export const privacyFixtures = (): Record<string, FixtureHandler> => ({
  'GET /api/privacy/documents/:slug': (u) =>
    u.pathname.endsWith('/privacy')
      ? { success: true, data: PRIVACY_POLICY }
      : new Response(JSON.stringify({ success: false, error: 'Not found', code: 'NOT_FOUND' }), { status: 404 }),
  'GET /api/privacy/links': () => ({
    success: true,
    data: [
      { slug: 'privacy', kind: 'hosted' },
      { slug: 'terms', kind: 'hosted' },
      { slug: 'contact', kind: 'hosted' },
    ],
  }),
});

/** 17-06 / 17-13: the Athens embed profile, 13 nodes around Athens, hop-coloured. */
export const EMBED_PROFILE = 'athens-coverage';

const nowS = Math.floor(Date.now() / 1000);
const embedNode = (nodeNum: number, longName: string, shortName: string, lat: number, lng: number, hopsAway: number | undefined, extra: Record<string, unknown> = {}) => ({
  nodeNum,
  nodeId: `!${nodeNum.toString(16).padStart(8, '0')}`,
  user: { longName, shortName, hwModel: 43 },
  position: { latitude: lat, longitude: lng },
  lastHeard: nowS - 600,
  hopsAway,
  role: 0,
  channel: 0,
  ...extra,
});

export const EMBED_NODES = [
  embedNode(0x0a1b2c3d, 'Station G2', 'G2', 37.976, 23.736, 0),
  embedNode(0x5d21b7f0, 'Hymettus Relay', 'HYM', 37.955, 23.81, 1, { user: { longName: 'Hymettus Relay', shortName: 'HYM', hwModel: 9 }, role: 2, snr: -4, position: { latitude: 37.955, longitude: 23.81, altitude: 1026 } }),
  embedNode(0x11110001, 'Lycabettus Repeater', 'LYC', 38.01, 23.74, 1, { role: 3 }),
  embedNode(0x11110002, 'Halandri Relay', 'HAL', 38.02, 23.8, 1, { role: 2 }),
  embedNode(0x11110003, 'Psychiko Base', 'PSY', 38.0, 23.77, 1),
  embedNode(0x11110004, 'Athens 7', 'ATH7', 37.985, 23.72, 1),
  embedNode(0x11110005, 'Kifisia Rooftop', 'KIF', 38.07, 23.81, 2),
  embedNode(0x11110006, 'Nea Kifisia 01', 'NK01', 38.03, 23.765, 2),
  embedNode(0x11110007, 'Peristeri', 'PER', 38.0, 23.69, 2),
  embedNode(0x11110008, 'Glyfada', 'GLY', 37.87, 23.75, 2),
  embedNode(0x11110009, 'Marousi 2', 'MAR2', 38.05, 23.76, 3),
  embedNode(0x1111000a, 'Piraeus', 'PIR', 37.94, 23.64, 4),
  embedNode(0x1111000b, 'Keratea', 'KER', 37.8, 23.98, undefined),
];

const seg = (from: (typeof EMBED_NODES)[number], to: (typeof EMBED_NODES)[number], snr: number | null) => ({
  fromNum: from.nodeNum, toNum: to.nodeNum,
  fromLat: from.position.latitude, fromLng: from.position.longitude, fromName: from.user.longName,
  toLat: to.position.latitude, toLng: to.position.longitude, toName: to.user.longName,
  snr, avgSnr: snr, leg: 'forward' as const, isMqtt: false, timestamp: nowS - 900,
});
const [G2, , , HAL, PSY, , KIF, NK01, , , MAR2] = EMBED_NODES;

export const embedFixtures = (): Record<string, FixtureHandler> => ({
  ...privacyFixtures(),
  'GET /api/embed/:id/config': () => ({
    id: EMBED_PROFILE, channels: [0], tileset: 'cartoDark', cartoApiKey: null,
    defaultLat: 37.98, defaultLng: 23.76, defaultZoom: 11,
    showTooltips: true, showPopups: true, showLegend: true, showPaths: true, showNeighborInfo: true, showMqttNodes: false,
    pollIntervalSeconds: 30,
  }),
  'GET /api/embed/:id/nodes': () => EMBED_NODES,
  'GET /api/embed/:id/traceroutes': () => [seg(G2, HAL, 6.5), seg(G2, PSY, 7.25), seg(PSY, NK01, -2), seg(NK01, MAR2, -7), seg(KIF, HAL, 3)],
  'GET /api/embed/:id/neighborinfo': () => [],
  'GET /api/embed/:id/geojson/layers': () => [],
});
