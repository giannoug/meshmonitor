/**
 * Station G2's built-in automations and the Automation Engine rules that
 * include it (m1, n1, m3, n4, 14-05 … 14-16; Task 8.3). Writes are logged; a
 * read changes nothing. Spread after the defaults (`renderWorkspace`'s
 * `fixtures`): `GET /api/settings` for Station G2 adds its automation keys.
 */
import { athensFixture as A, SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';

export interface AutomationLog {
  writes: Array<{ method: string; path: string; search: string; body: unknown }>;
}

const NOW = Date.now();
const G2 = SOURCE_IDS.g2;

const responderTriggers = [
  { id: 'r1', trigger: 'weather {location}', syntax: 'pattern', responseType: 'script', response: '/data/scripts/weather.py', channels: [1], cooldownSeconds: 60, scriptArgs: '--loc {location}' },
  { id: 'r2', trigger: 'ping', syntax: 'pattern', responseType: 'text', response: 'pong {SHORT_NAME}', channels: ['dm'], verifyResponse: true },
  { id: 'r3', trigger: 'trace {node}', syntax: 'pattern', responseType: 'traceroute', response: '{node}', channels: ['dm'], cooldownSeconds: 300 },
  { id: 'r4', trigger: 'mail', syntax: 'pattern', responseType: 'mailbox', response: '', channels: ['dm'] },
];

const geofences = [
  { id: 'g1', name: 'Lycabettus hill', enabled: true, event: 'entry', cooldownMinutes: 30, responseType: 'text', response: '{LONG_NAME} reached {GEOFENCE_NAME}', channel: 2,
    nodeFilter: { type: 'selected', nodeNums: [0xa1b2c302, 0xa1b2c305, 0xa1b2c301] },
    shape: { type: 'polygon', vertices: [{ lat: 37.985, lng: 23.74 }, { lat: 37.99, lng: 23.745 }, { lat: 37.984, lng: 23.75 }, { lat: 37.979, lng: 23.746 }, { lat: 37.98, lng: 23.74 }] },
    lastRun: NOW - 3_600_000 },
  { id: 'g2', name: 'Kifisia home', enabled: true, event: 'exit', cooldownMinutes: 60, responseType: 'script', scriptPath: '/data/scripts/weather.py', channel: 'dm',
    nodeFilter: { type: 'all' }, shape: { type: 'circle', center: { lat: 38.074, lng: 23.811 }, radiusKm: 0.4 } },
];

const timers = [
  { id: 't1', name: 'Morning net', cronExpression: '0 8 * * *', responseType: 'text', response: 'Good morning from Station G2', channels: [0], enabled: true },
  { id: 't2', name: 'Evening net', cronExpression: '0 20 * * *', responseType: 'text', response: 'Evening check-in on LongFast', channels: [0], enabled: true },
];

/** Station G2's automation settings, as `/api/settings?sourceId=` returns them (strings). */
export const g2AutomationSettings: Record<string, string> = {
  autoAckEnabled: 'true',
  autoAckRegex: '^(test|ping)',
  autoAckChannels: '[1]',
  autoAckCooldownSeconds: '60',
  autoAckMaxResponses: '2',
  autoAckMaxAttempts: '3',
  autoAckTestMessages: 'test\nping 3\nTesting from Kifisia\nhello all',
  autoAckChannelZeroHopTapbackEnabled: 'true',
  autoAckChannelMultiHopTapbackEnabled: 'true',
  autoAckChannelMultiHopReplyEnabled: 'true',
  autoAckDirectZeroHopTapbackEnabled: 'true',
  autoAckDirectZeroHopReplyEnabled: 'true',
  autoAckDirectMultiHopReplyEnabled: 'true',
  autoAnnounceEnabled: 'true',
  autoAnnounceIntervalHours: '6',
  autoAnnounceMessage: 'MeshMonitor at Station G2, {ONLINENODES} nodes online.',
  autoAnnounceChannelIndexes: '[0]',
  autoAnnounceHopLimit: '3',
  autoResponderEnabled: 'true',
  autoResponderTriggers: JSON.stringify(responderTriggers),
  autoWelcomeEnabled: 'false',
  autoWelcomeTarget: 'dm',
  autoWelcomeWaitForName: 'true',
  geofenceTriggers: JSON.stringify(geofences),
  timerTriggers: JSON.stringify(timers),
  automationAirtimeCutoffThreshold: '30',
  autoFavoriteEnabled: 'true',
  autoKeyManagementEnabled: 'true',
  autoKeyManagementIntervalMinutes: '5',
  autoKeyManagementMaxExchanges: '3',
  autoHeapManagementEnabled: 'false',
  tracerouteIntervalMinutes: '0',
  remoteLocalStatsIntervalMinutes: '60',
  remoteAdminScannerIntervalMinutes: '5',
  autoDeleteByDistanceEnabled: 'true',
  autoDeleteByDistanceThresholdKm: '150',
  autoDeleteByDistanceLat: '37.98',
  autoDeleteByDistanceLon: '23.72',
};

/** The Automation Engine's rules: two include Station G2, one names another device only. */
export const g2EngineRules = [
  { id: 'e1', name: 'Welcome new nodes', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.newNode', params: { cooldownSeconds: 86400 } }, rules: [{ conditions: [], actions: [{ type: 'action.sendMessage', params: {} }] }] }) },
  { id: 'e2', name: 'Low battery alert', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.telemetry', params: { cooldownSeconds: 3600 } },
      rules: [{ conditions: [{ type: 'condition.sourceFilter', params: { sourceIds: [G2, SOURCE_IDS.heltec] } }], actions: [{ type: 'action.notify', params: {} }] }] }) },
  { id: 'e3', name: 'Weather bot', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.message', params: {} },
      rules: [{ conditions: [{ type: 'condition.sourceFilter', params: { sourceIds: [G2] } }], actions: [{ type: 'action.sendMessage', params: {} }] }] }) },
  { id: 'e4', name: 'Heltec only', description: null, enabled: true, createdAt: NOW, updatedAt: NOW,
    config: JSON.stringify({ trigger: { type: 'trigger.message', params: { cooldownSeconds: 60 } },
      rules: [{ conditions: [{ type: 'condition.sourceFilter', params: { sourceIds: [SOURCE_IDS.heltec] } }], actions: [{ type: 'action.tapback', params: {} }] }] }) },
];

export function automationFixtures(log: AutomationLog): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  const write = (reply: (b: unknown, u: URL) => unknown = () => ({ success: true })): FixtureHandler => (u, init) => {
    const b = body(init);
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, search: u.search, body: b });
    return reply(b, u);
  };
  const g2 = (u: URL) => u.searchParams.get('sourceId') === G2;
  return {
    'GET /api/settings': (u) => (g2(u) ? { ...A.settings, ...g2AutomationSettings } : A.settings),
    'POST /api/settings': write(),
    'GET /api/settings/auto-ping': () => ({
      settings: { autoPingEnabled: true, autoPingIntervalSeconds: 30, autoPingMaxPings: 20, autoPingTimeoutSeconds: 60 }, sessions: [],
    }),
    'POST /api/settings/auto-ping': write(),
    'POST /api/auto-ping/stop/:nodeNum': write(),
    'GET /api/settings/time-sync-nodes': () => ({ enabled: true, intervalMinutes: 60, expirationHours: 24, filterEnabled: false, nodeNums: [] }),
    'POST /api/settings/time-sync-nodes': write(),
    'GET /api/settings/traceroute-nodes': () => ({ enabled: false, nodeNums: [], filterChannels: [], filterRoles: [], filterHwModels: [], filterNameRegex: '.*', expirationHours: 24 }),
    'POST /api/settings/traceroute-nodes': write(),
    'POST /api/settings/traceroute-interval': write(),
    'GET /api/settings/remote-localstats-nodes': () => ({ enabled: false, nodeNums: [], filterRoles: [], filterNameRegex: '.*' }),
    'POST /api/settings/remote-localstats-nodes': write(),
    'POST /api/settings/remote-localstats-interval': write(),
    'GET /api/settings/traceroute-log': () => ({ log: [] }),
    'GET /api/settings/key-repair-log': () => ({ log: [{ id: 1, timestamp: NOW - 600_000, nodeNum: 0xa1b2c303, nodeName: 'Glyfada Beach', action: 'exchange', success: true }] }),
    'GET /api/settings/distance-delete/log': () => [{ id: 1, timestamp: NOW - 86_400_000, nodesDeleted: 2, thresholdKm: 150 }],
    'POST /api/settings/distance-delete/run-now': write(() => ({ success: true, deletedCount: 1 })),
    'POST /api/settings/mark-all-welcomed': write(() => ({ success: true, markedCount: 9 })),
    'GET /api/sources/:id/forwarding': () => ({ success: true, data: { enabled: false, rules: [
      { id: 'f1', name: 'To Heltec', enabled: true, match: { isDM: true }, forwardTo: { channel: 2 }, prefix: '{from}: ' },
    ] } }),
    'POST /api/sources/:id/forwarding': write((b) => ({ success: true, data: b })),
    'PUT /api/sources/:id/forwarding/enabled': write((b) => ({ success: true, data: b })),
    'GET /api/ignored-nodes': () => [0xa1b2c308, 0xa1b2c309, 0xa1b2c304, 0xa1b2c305].map((num, i) => ({
      nodeNum: num, nodeId: `!${num.toString(16)}`, longName: `Ignored ${i + 1}`, shortName: null, ignoredAt: NOW - i * 3_600_000, reason: i === 0 ? 'geo' : 'manual', sourceId: G2,
    })),
    'DELETE /api/ignored-nodes/:nodeId': write(),
    'GET /api/automations': () => g2EngineRules,
    'POST /api/automations/convert/preview': write(() => ({ success: true, data: {
      sourceId: G2, sourceName: 'Station G2', autoAckEnabled: true, blocking: null, existing: [],
      automations: [{ key: 'channel', name: 'Auto Acknowledge (channel)', description: '', enabled: true, config: {}, form: { rules: [] }, ruleSummaries: ['IF the message is from this source THEN react with a hop-count tapback'] }],
      report: { converted: [{ key: 'autoAckRegex', label: 'Trigger pattern', detail: '^(test|ping)' }], approximated: [], notConvertible: [], dropped: [] },
    } })),
    'POST /api/automations/convert/create': write(() => ({ success: true, data: { created: [{ id: 'n1', name: 'Auto Acknowledge (channel)' }], updated: [], deleted: [], autoAckDisabled: true, report: {} } })),
    'POST /api/automations/:aid/:verb': write(),
    'GET /api/scripts': () => ({ scripts: [{ path: '/data/scripts/weather.py', filename: 'weather.py', name: 'weather.py', language: 'Python' }] }),
    'POST /api/scripts/test': write(() => ({
      success: true, stdout: 'fetching wttr.in/marousi\n200 OK · 0.6 s', wouldSendMessages: ['Marousi 17 °C, wind 9 km/h N, clear'], executionTimeMs: 812,
    })),
    'GET /api/announce/last': () => ({ lastAnnouncementTime: NOW - 4 * 3_600_000 }),
    'GET /api/announce/preview': (u) => ({ preview: (u.searchParams.get('message') ?? '').replace('{ONLINENODES}', '12') }),
    'POST /api/announce/send': write(() => ({ success: true, message: 'Announcement sent' })),
    'GET /api/automation/airtime-status': () => ({ threshold: 30, source: 'local', channelUtilization: 12.5, sampleCount: 1, gated: false }),
    'GET /api/automation/airtime-candidates': () => ({ success: true, data: { candidates: [] } }),
    'GET /api/auto-favorite/status': () => ({
      localNodeRole: 2, firmwareVersion: '2.7.15', supportsFavorites: true,
      autoFavoriteNodes: [{ nodeNum: 0xa1b2c307, nodeId: '!a1b2c307', longName: 'Lycabettus Repeater', shortName: 'LYCR', role: 2, hopsAway: 0, lastHeard: null, favoriteLocked: false }],
    }),
    'POST /api/nodes/:nodeId/favorite-lock': write(),
    'GET /api/nodes': (u) => (g2(u) ? A.nodes : []),
  };
}
