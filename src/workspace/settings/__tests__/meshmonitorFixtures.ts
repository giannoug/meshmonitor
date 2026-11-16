/**
 * Station G2's MeshMonitor settings for the In MeshMonitor boards (Task 5.8):
 * a server that keeps what `POST /api/settings[?sourceId]` sends (global and
 * per-source rows apart, as the routes store them) and answers the PKI DM,
 * Reliable PKI, purge and notification-preference routes.
 */
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { defaultNotificationPreferences } from '../../../utils/notificationDefaults';

export type Rows = Record<string, string>;

export function meshmonitorServer(overrides: Partial<Record<string, FixtureHandler>> = {}) {
  const global: Rows = {
    packet_log_enabled: '1',
    packet_log_max_count: '5000',
    packet_log_max_age_hours: '168',
    telemetryVisualizationHours: '24',
    favoriteTelemetryStorageDays: '30',
    reliablePkiMode: 'off',
    homoglyphEnabled: 'false',
  };
  const bySource: Record<string, Rows> = {
    [SOURCE_IDS.g2]: {
      maxNodeAgeHours: '24',
      inactiveNodeThresholdHours: '2',
      inactiveNodeCheckIntervalMinutes: '5',
      inactiveNodeCooldownHours: '1',
      hideIncompleteNodes: '0',
      aircraftDetectionEnabled: 'true',
      aircraftAgeOutEnabled: 'false',
      aircraftAgeOutLastRunAt: '1700000000000',
      reliablePkiSourceMode: 'asNeeded',
    },
  };
  const prefs = { ...defaultNotificationPreferences(), enabledChannels: [0, 2], appriseUrls: ['discord://a/b', 'mailto://c'], enableApprise: true };
  const handlers: Record<string, FixtureHandler> = {
    'GET /api/settings': (url) => {
      const id = url.searchParams.get('sourceId');
      return { ...global, ...(id ? bySource[id] : {}) };
    },
    'POST /api/settings': (url, init) => {
      const id = url.searchParams.get('sourceId');
      const body = JSON.parse(String(init?.body)) as Rows;
      Object.assign(id ? (bySource[id] ??= {}) : global, body);
      return { success: true };
    },
    'DELETE /api/settings': () => ({ success: true }),
    'GET /api/sources/:id/pki-dm/status': () => ({ enabled: true, globallyEnabled: true, keyStored: true, canStore: true }),
    'POST /api/sources/:id/pki-dm': () => ({ success: true, enabled: false, keyStored: false }),
    'POST /api/purge/nodes': () => ({ success: true }),
    'POST /api/purge/telemetry': () => ({ success: true }),
    'POST /api/purge/messages': () => ({ success: true }),
    'POST /api/purge/traceroutes': () => ({ success: true }),
    'GET /api/push/preferences': () => ({ ...prefs }),
    'POST /api/push/preferences': (_url, init) => {
      const { sourceId: _s, ...body } = JSON.parse(String(init?.body)) as Record<string, unknown>;
      Object.assign(prefs, body);
      return { success: true };
    },
    'GET /api/push/status': () => ({ configured: true, publicKey: 'BPub', subject: 'mailto:ops@example.org', subscriptionCount: 2 }),
    'GET /api/channels': () => [
      { id: 0, name: 'LongFast' },
      { id: 1, name: 'gauntlet' },
      { id: 2, name: 'Local' },
    ],
    ...overrides,
  };
  return { fixtures: handlers, stored: (sourceId?: string): Rows => ({ ...global, ...(sourceId ? bySource[sourceId] : {}) }) };
}

export const meshmonitorFixtures = (overrides: Partial<Record<string, FixtureHandler>> = {}) => meshmonitorServer(overrides).fixtures;

/** An mqtt_bridge source (12-13 / 12-24), attached to Athens MQTT, with its geo filter's last sweep. */
export const BRIDGE = 'src-bridge';
const bridgeConfig = {
  brokerSourceId: SOURCE_IDS.mqtt,
  upstream: { url: 'mqtts://mqtt.athensmesh.gr:8883', username: 'athens', clientId: '!a1b2c3d4' },
  mode: 'bidirectional',
  forwardingMode: 'single',
  subscriptions: ['msh/EU_868/GR/#'],
  skipRaise: true,
  dropAutomationUplinks: true,
  downlinkFilters: { topics: { block: ['msh/EU_868/GR/2/json/#'] }, geo: { minLat: 37.8, maxLat: 38.2, minLng: 23.5, maxLng: 24.05 } },
  uplinkFilters: { channels: { allow: ['LongFast', 'Athens'] }, topics: { block: ['msh/EU_868/GR/2/e/#'] } },
  downlinkTopicRewrite: { from: 'msh/EU_868/GR/', to: 'msh/EU_868/' },
  uplinkTopicRewrite: { from: 'msh/EU_868/', to: 'msh/EU_868/GR/' },
};
const bridge = { id: BRIDGE, name: 'Athens MQTT bridge', type: 'mqtt_bridge', enabled: true, config: bridgeConfig, createdAt: 0, updatedAt: 0, radio: null };

export const bridgeFixtures = (): Record<string, FixtureHandler> => ({
  ...meshmonitorFixtures(),
  'GET /api/sources': () => [...athensFixture.sources, bridge],
  'GET /api/sources/:id': (url: URL) => (url.pathname.endsWith(`/${BRIDGE}`) ? bridge : undefined),
  'GET /api/sources/:id/status': (url: URL) =>
    url.pathname.includes(`/${BRIDGE}/`)
      ? {
          sourceId: BRIDGE, sourceName: bridge.name, sourceType: 'mqtt_bridge', connected: true,
          downlinkDrops: { geo: 41 }, uplinkDrops: { geo: 2 },
          lastGeoSweep: { timestamp: Date.now() - 60_000, scanned: 412, ignored: 9, purged: 3, lifted: 0, durationMs: 120 },
        }
      : athensFixture.statuses[url.pathname.split('/')[3]],
  'PUT /api/sources/:id': () => bridge,
});
