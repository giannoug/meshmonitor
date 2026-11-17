/**
 * Server categories (Task 6.4, boards b-set-d7, r4, 13-05 … 13-08, 13-16,
 * 13-17, 13-22 … 13-24, 18-11, 18-12): the install as the boards draw it.
 * `serverFixtures(log)` records every request the pages send, in order.
 */
import { SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import { PREF_SETTINGS, SYSTEM_STATUS } from './preferences';

export const ATHENS_TOPO = {
  id: 'athens-topo',
  name: 'Athens topo',
  url: 'https://tiles.athensmesh.gr/topo/{z}/{x}/{y}.png',
  attribution: '© Athens Mesh',
  maxZoom: 16,
  description: '',
  createdAt: 1,
  updatedAt: 1,
};

export const SERVER_SETTINGS: Record<string, string> = {
  ...PREF_SETTINGS,
  appriseApiServerUrl: '',
  externalUrl: '',
  cartoApiKey: 'pk-example-3a1c',
  defaultMapCenterLat: '37.98',
  defaultMapCenterLon: '23.73',
  defaultMapCenterZoom: '11',
  defaultLandingPage: 'unified',
  reticulum_destinations_max: '2000',
  customTilesets: JSON.stringify([ATHENS_TOPO]),
  activeMapStyleId: 'style-athens-dark',
};

const MB = 1024 * 1024;

export const SYSTEM_BACKUPS = [
  { dirname: 'meshmonitor-2026-11-17-030000', timestamp: '2026-11-17T03:00:00Z', timestampUnix: 1, type: 'automatic', size: 182 * MB, tableCount: 64, meshmonitorVersion: '4.15.2', schemaVersion: 230 },
  { dirname: 'meshmonitor-2026-11-16-030000', timestamp: '2026-11-16T03:00:00Z', timestampUnix: 1, type: 'automatic', size: 181 * MB, tableCount: 64, meshmonitorVersion: '4.15.2', schemaVersion: 230 },
  { dirname: 'meshmonitor-2026-11-11-184200', timestamp: '2026-11-11T18:42:00Z', timestampUnix: 1, type: 'manual', size: 176 * MB, tableCount: 64, meshmonitorVersion: '4.15.1', schemaVersion: 229 },
];

export const MAINTENANCE_STATUS = {
  running: true,
  maintenanceInProgress: false,
  enabled: true,
  maintenanceTime: '04:00',
  lastRunTime: 1,
  lastRunStats: {
    messagesDeleted: 12000, traceroutesDeleted: 300, routeSegmentsDeleted: 100, neighborInfoDeleted: 80, auditLogDeleted: 0, meshcoreCliHistoryDeleted: 0,
    sizeBefore: 190 * MB, sizeAfter: 184 * MB, duration: 4200, timestamp: '2026-11-17T04:00:00Z',
  },
  nextScheduledRun: '2026-11-18T04:00:00Z',
  databaseType: 'sqlite',
  settings: {
    messageRetentionDays: 90, tracerouteRetentionDays: 30, routeSegmentRetentionDays: 30,
    neighborInfoRetentionDays: 30, auditLogRetentionDays: 180, meshcoreCliHistoryRetentionDays: 30,
  },
};

const entry = (id: number, name: string, extra: Record<string, unknown>) => ({
  id, name, protocol: 'meshtastic', pskLength: 32, pskPreview: 'AbCd…', psk: 'q8T7mN2c1Zp0xR4sVwY6bE9fH3jK5lM7nP8rS1tU2vA=', description: null,
  isEnabled: true, enforceNameValidation: false, useAead: false, sortOrder: id, decryptedPacketCount: 0, lastDecryptedAt: null,
  createdBy: 1, createdAt: 1, updatedAt: 1, ...extra,
});

export const CHANNEL_DB = [
  entry(1, 'Athens Ops', { decryptedPacketCount: 18204, lastDecryptedAt: Date.now() - 120_000, description: 'Ops team, Attica' }),
  entry(2, 'Regional Emergency', { pskLength: 16, decryptedPacketCount: 3117, lastDecryptedAt: Date.now() - 3_600_000 }),
  entry(3, '#athens', { protocol: 'meshcore', pskLength: 16, psk: '', decryptedPacketCount: 9862, lastDecryptedAt: Date.now() - 300_000 }),
  entry(4, 'Old club key', { isEnabled: false, decryptedPacketCount: 412, lastDecryptedAt: Date.parse('2026-10-03T12:00:00Z') }),
];

export const DECRYPTION_RUNNING = { channelDatabaseId: 1, channelName: 'Athens Ops', total: 66600, processed: 41300, decrypted: 1284, status: 'running' };

export const EMBED_PROFILES = [
  {
    id: 'athens-public', name: 'Athens public', enabled: true, channels: [0, 1], tileset: 'cartoDarkMatter', defaultLat: 37.98, defaultLng: 23.73, defaultZoom: 11,
    showTooltips: true, showPopups: true, showLegend: true, showPaths: false, showNeighborInfo: true, showTraceroutes: false, showMqttNodes: false,
    pollIntervalSeconds: 30, allowedOrigins: ['https://athensmesh.gr', 'https://club.example.org'], sourceId: SOURCE_IDS.g2, createdAt: 1, updatedAt: 1,
  },
  {
    id: 'club-site', name: 'Club site', enabled: true, channels: [0, 2], tileset: 'osm', defaultLat: 37.98, defaultLng: 23.73, defaultZoom: 10,
    showTooltips: true, showPopups: true, showLegend: true, showPaths: false, showNeighborInfo: false, showTraceroutes: false, showMqttNodes: true,
    pollIntervalSeconds: 60, allowedOrigins: [], sourceId: SOURCE_IDS.mqtt, createdAt: 2, updatedAt: 2,
  },
];

export const GEOJSON_LAYERS = [
  { id: 'layer-attica', name: 'Attica coverage', filename: 'attica.geojson', visible: true, publiclyVisible: true, disablePopup: false, style: { color: '#89b4fa', opacity: 0.8, fillOpacity: 0.2, weight: 2 }, createdAt: 1 },
  { id: 'layer-trails', name: 'Hiking trails', filename: 'trails.kml', visible: false, publiclyVisible: false, disablePopup: true, style: { color: '#a6e3a1', opacity: 1, fillOpacity: 0.1, weight: 3 }, createdAt: 2 },
];

export const MAP_STYLES = [{ id: 'style-athens-dark', name: 'Athens dark (vector)', filename: 'athens-dark.json', sourceType: 'url', createdAt: 1, updatedAt: 1 }];

export const VAPID_STATUS = {
  configured: true,
  publicKey: 'BKx9Qm2rT7vLw0aP4sYdN8eF3hJ6uZc1oI5gRkWq2xYzTnB8vC4mD7fG0hJ3kL6pQ9sU2wX5zA',
  subject: 'mailto:admin@example.com',
  subscriptionCount: 3,
};

export interface ServerLog {
  /** Every request but reads of settings, as `METHOD /path` with its JSON body. */
  writes: Array<{ method: string; path: string; body?: unknown }>;
  /** Paths read, in order. */
  reads: string[];
}

export const newServerLog = (): ServerLog => ({ writes: [], reads: [] });

export function serverFixtures(log: ServerLog = newServerLog(), settings: Record<string, string> = SERVER_SETTINGS): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  const read = (reply: unknown): FixtureHandler => (u) => {
    log.reads.push(u.pathname);
    return typeof reply === 'function' ? reply() : reply;
  };
  const write = (reply: unknown = { success: true }): FixtureHandler => (u, init) => {
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, body: body(init) });
    return typeof reply === 'function' ? reply(u, init) : reply;
  };
  // Writes stick, as on the server, so a re-read after a save shows it.
  const stored = { ...settings };
  let channels = [...CHANNEL_DB];
  let progress: typeof DECRYPTION_RUNNING | null = null;
  return {
    'GET /api/settings': read(() => ({ ...stored })),
    'POST /api/settings': write((_u: URL, init?: RequestInit) => {
      Object.assign(stored, body(init));
      return { success: true };
    }),
    'POST /api/settings/test-apprise': write({ ok: true, status: 200, latencyMs: 42 }),
    'GET /api/push/status': read(VAPID_STATUS),
    'PUT /api/push/vapid-subject': write(),
    'GET /api/system/status': read({ ...SYSTEM_STATUS, isDocker: true }),
    'POST /api/system/restart': write({ success: true, message: 'MeshMonitor is restarting…' }),
    'GET /api/system/backup/settings': read({ enabled: true, maxBackups: 7, backupTime: '03:00' }),
    'POST /api/system/backup/settings': write(),
    'GET /api/system/backup/list': read(SYSTEM_BACKUPS),
    'POST /api/system/backup': write({ success: true, dirname: 'meshmonitor-2026-11-17-120000' }),
    'DELETE /api/system/backup/delete/:dirname': write(),
    'GET /api/maintenance/status': read(MAINTENANCE_STATUS),
    'GET /api/maintenance/size': read({ size: 184 * MB }),
    'POST /api/maintenance/run': write({ success: true, stats: { ...MAINTENANCE_STATUS.lastRunStats, timestamp: '2026-11-17T12:00:00Z' } }),
    'GET /api/channel-database': read(() => ({ success: true, data: channels, count: channels.length })),
    'POST /api/channel-database': write(() => ({ success: true, data: channels[0] })),
    'PUT /api/channel-database/reorder': write(),
    'PUT /api/channel-database/:id': write(),
    'DELETE /api/channel-database/:id': write((u: URL) => {
      channels = channels.filter((c) => u.pathname !== `/api/channel-database/${c.id}`);
      return { success: true };
    }),
    'POST /api/channel-database/:id/retroactive-decrypt': write(() => {
      progress = DECRYPTION_RUNNING;
      return { success: true, progress };
    }),
    'GET /api/channel-database/retroactive-decrypt/progress': read(() => ({ success: true, isRunning: !!progress, progress })),
    'POST /api/channels/decode-url': write({ channels: [{ name: 'LongFast', psk: 'AQ==' }, { name: 'Coast', psk: 'b3JkZXJzLXN0cmluZy05UT0=', role: 2 }] }),
    'POST /api/channel-database/import-meshcore': write({ success: true, data: { imported: [{ id: 9, name: 'Public' }], skipped: [{ name: '#athens', reason: 'duplicate' }] } }),
    'GET /api/embed-profiles': read(EMBED_PROFILES),
    'POST /api/embed-profiles': write((_u: URL, init?: RequestInit) => ({ ...EMBED_PROFILES[0], ...body(init), id: 'new-profile' })),
    'PUT /api/embed-profiles/:id': write((_u: URL, init?: RequestInit) => ({ ...EMBED_PROFILES[0], ...body(init) })),
    'DELETE /api/embed-profiles/:id': write(),
    'GET /api/nodes/active': read([]),
    'GET /api/geojson/layers': read(GEOJSON_LAYERS),
    'PUT /api/geojson/layers/:id': write((u: URL, init?: RequestInit) => ({ ...GEOJSON_LAYERS.find((l) => u.pathname.endsWith(l.id)), ...body(init) })),
    'DELETE /api/geojson/layers/:id': write(),
    'GET /api/map-styles/styles': read(MAP_STYLES),
    'GET /api/map-styles/styles/:id/data': read({ version: 8, sources: {}, layers: [] }),
    'DELETE /api/map-styles/styles/:id': write(),
  };
}
