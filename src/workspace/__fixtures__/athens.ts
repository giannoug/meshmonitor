/**
 * The Athens cast (Workspace spec §10): five sources and the Athens node names
 * the boards use. Shapes follow today's API replies, typed by the hooks that
 * read them. Vitest serves it through `fixtureApi` + `renderWorkspace`;
 * Playwright through `tests/workspace-e2e/fixtureRoutes.ts`.
 *
 * Scope: what the Phase 1 shell reads (sources, statuses, config, preferences,
 * settings, auth, unread counts, one Meshtastic poll). Later tasks extend it.
 */
import type { AuthStatus, User } from '../../contexts/AuthContext';
import type { DashboardSource, SourceStatus, UnifiedStatus } from '../../hooks/useDashboardData';
import type { PollConfig, PollData, PollTraceroute, RawMessage } from '../../hooks/usePoll';
import type { TelemetryData } from '../../hooks/useTelemetry';
import type { UnreadBySourceData } from '../../hooks/useUnreadBySource';
import type { UnreadCountsData } from '../../hooks/useUnreadCounts';
import type { Channel, DeviceInfo } from '../../types/device';

export const SOURCE_IDS = {
  g2: 'src-g2',
  heltec: 'src-heltec',
  rak: 'src-rak',
  rns: 'src-rns',
  mqtt: 'src-mqtt',
} as const;

const NOW_S = Math.floor(Date.now() / 1000);
const NOW_MS = NOW_S * 1000;
const CREATED = NOW_MS - 90 * 86_400_000;

const sources: DashboardSource[] = [
  { id: SOURCE_IDS.g2, name: 'Station G2', type: 'meshtastic_tcp', enabled: true,
    config: { host: '192.168.1.40', port: 4403 }, createdAt: CREATED, updatedAt: CREATED,
    radio: { frequencyMhz: 869.525, regionName: 'EU_868', modemPreset: 0, txEnabled: true, canTransmit: true } },
  { id: SOURCE_IDS.heltec, name: 'Heltec MeshCore', type: 'meshcore', enabled: true,
    config: { transport: 'tcp', host: '192.168.1.41', port: 5000 }, createdAt: CREATED, updatedAt: CREATED,
    radio: null },
  { id: SOURCE_IDS.rak, name: 'Rooftop RAK', type: 'meshtastic_tcp', enabled: true,
    config: { host: '192.168.1.42', port: 4403 }, createdAt: CREATED, updatedAt: CREATED,
    radio: { frequencyMhz: 869.525, regionName: 'EU_868', modemPreset: 0, txEnabled: true, canTransmit: true } },
  { id: SOURCE_IDS.rns, name: 'Reticulum node', type: 'reticulum', enabled: true,
    config: { host: '192.168.1.43', port: 37428 }, createdAt: CREATED, updatedAt: CREATED, radio: null },
  { id: SOURCE_IDS.mqtt, name: 'Athens MQTT', type: 'mqtt_broker', enabled: true,
    config: { port: 1883 }, createdAt: CREATED, updatedAt: CREATED, radio: null },
];

const statuses: Record<string, SourceStatus> = {
  [SOURCE_IDS.g2]: { sourceId: SOURCE_IDS.g2, sourceName: 'Station G2', sourceType: 'meshtastic_tcp',
    connected: true, nodeNum: 0xa1b2c300, nodeCount: 47, activeNodeCount: 12 },
  [SOURCE_IDS.heltec]: { sourceId: SOURCE_IDS.heltec, sourceName: 'Heltec MeshCore', sourceType: 'meshcore',
    connected: true, nodeCount: 22, activeNodeCount: 9 },
  [SOURCE_IDS.rak]: { sourceId: SOURCE_IDS.rak, sourceName: 'Rooftop RAK', sourceType: 'meshtastic_tcp',
    connected: false, nodeCount: 31, activeNodeCount: 0 },
  [SOURCE_IDS.rns]: { sourceId: SOURCE_IDS.rns, sourceName: 'Reticulum node', sourceType: 'reticulum',
    connected: true, nodeCount: 6, activeNodeCount: 4 },
  [SOURCE_IDS.mqtt]: { sourceId: SOURCE_IDS.mqtt, sourceName: 'Athens MQTT', sourceType: 'mqtt_broker',
    connected: true, nodeCount: 64, activeNodeCount: 28 },
};

const unifiedStatus: UnifiedStatus = { nodeCount: 118, activeNodeCount: 41, connected: true };

const adminUser: User = {
  id: 1, username: 'admin', email: null, displayName: 'Athens Ops', authProvider: 'local',
  isAdmin: true, isActive: true, passwordLocked: false, mfaEnabled: false,
  createdAt: CREATED, lastLoginAt: NOW_MS,
};

const authStatus: AuthStatus = {
  authenticated: true,
  user: adminUser,
  permissions: { global: {}, bySource: {} },
  channelDbPermissions: {},
  oidcEnabled: false,
  localAuthDisabled: false,
  anonymousDisabled: false,
  customTitle: null,
  customLogoUrl: null,
};

/** `GET /api/config`; `workspacePreview` is the D3 gate the server adds in Phase 1. */
const config: PollConfig & { workspacePreview: boolean } = {
  meshtasticNodeIp: '192.168.1.40',
  meshtasticTcpPort: 4403,
  meshtasticUseTls: false,
  meshtasticSourceType: 'meshtastic_tcp',
  baseUrl: '',
  deviceMetadata: { firmwareVersion: '2.7.15.567b8ea', rebootCount: 3 },
  localNodeInfo: { nodeId: '!a1b2c300', longName: 'Station G2', shortName: 'G2' },
  workspacePreview: true,
};

/** `GET /api/user/preferences` (spec §7.1): the user's saved preference map. */
const userPreferences: Record<string, unknown> = { layout: 'workspace' };

/** `GET /api/settings`: a flat string map. */
const settings: Record<string, string> = {
  maxNodeAgeHours: '24',
  temperatureUnit: 'C',
  distanceUnit: 'km',
  timeFormat: '24',
  dateFormat: 'DD/MM/YYYY',
  theme: 'mocha',
  preferredSortField: 'longName',
  // The composer's Translate chip (useTranslationSettings).
  translationEnabled: 'true',
  // Server › General (r4): the install default layout, the banner offer, the default Meshtastic source.
  defaultLayout: 'classic',
  offerWorkspaceBanner: 'true',
  defaultMeshtasticSourceId: SOURCE_IDS.g2,
};

/** `GET /api/admin/layout-usage` (r4 "Who uses which"). */
const layoutUsage = { windowDays: 30, classic: 9, workspace: 4 };

function node(num: number, longName: string, shortName: string, extra: Partial<DeviceInfo> = {}): DeviceInfo {
  const id = `!${num.toString(16).padStart(8, '0')}`;
  return {
    nodeNum: num,
    user: { id, longName, shortName, hwModel: 43, role: '0' },
    lastHeard: NOW_S - 120,
    snr: 6.5,
    rssi: -92,
    hopsAway: 1,
    ...extra,
  };
}

const nodes: DeviceInfo[] = [
  node(0xa1b2c300, 'Station G2', 'G2', { hopsAway: 0, position: { latitude: 37.9838, longitude: 23.7275, altitude: 110 },
    deviceMetrics: { batteryLevel: 101, voltage: 5.1, channelUtilization: 27, airUtilTx: 3.1 } }),
  // The DM boards' node (10-01, 10-07): a router that reports itself unmessageable, with a key
  // mismatch, a tracked asset, and not in Station G2's device database.
  node(0xa1b2c301, 'Kifisia Rooftop', 'KFR', { user: { id: '!a1b2c301', longName: 'Kifisia Rooftop', shortName: 'KFR',
    hwModel: 43, role: '2' }, hopsAway: 2, channel: 0, isUnmessagable: true, keyMismatchDetected: true,
    asset: { retentionDays: 365 }, position: { latitude: 38.0742, longitude: 23.8113, altitude: 290 },
    deviceMetrics: { batteryLevel: 88, voltage: 4.02, channelUtilization: 19, airUtilTx: 1.2 } }),
  node(0xa1b2c302, 'Athens Rover', 'ROVR', { lastHeard: NOW_S - 600, hopsAway: 2,
    position: { latitude: 37.9755, longitude: 23.7348 }, deviceMetrics: { batteryLevel: 14, voltage: 3.48 } }),
  node(0xa1b2c303, 'Glyfada Beach', 'GLYF', { position: { latitude: 37.8627, longitude: 23.7536 } }),
  node(0xa1b2c304, 'Piraeus Base', 'PIRB', { position: { latitude: 37.9420, longitude: 23.6465 } }),
  node(0xa1b2c305, 'Marousi Mobile', 'MARM', { lastHeard: NOW_S - 5400, hopsAway: 3 }),
  node(0xa1b2c306, 'Hymettus Relay', 'HYMR', { user: { id: '!a1b2c306', longName: 'Hymettus Relay', shortName: 'HYMR',
    hwModel: 9, role: '2' }, position: { latitude: 37.9497, longitude: 23.8037, altitude: 1026 } }),
  node(0xa1b2c307, 'Lycabettus Repeater', 'LYCR', { user: { id: '!a1b2c307', longName: 'Lycabettus Repeater',
    shortName: 'LYCR', hwModel: 9, role: '4' }, position: { latitude: 37.9819, longitude: 23.7432, altitude: 277 } }),
  node(0xa1b2c308, 'Kifisia Weather', 'KFW', { lastHeard: NOW_S - 1800 }),
];

function channel(id: number, name: string, role: number): Channel {
  return { id, name, displayName: name, pskSet: true, encryptionStatus: id === 0 ? 'default' : 'secure',
    role, roleName: role === 1 ? 'Primary' : 'Secondary', uplinkEnabled: false, downlinkEnabled: false };
}

const channels: Channel[] = [
  // The admin sees the PSK (channel info's Show); slot 0 shares location.
  { ...channel(0, 'LongFast', 1), psk: 'AQ==', positionPrecision: 13, uplinkEnabled: true },
  channel(1, 'gauntlet', 2),
  channel(2, 'Athens Ops', 2),
];

function message(
  n: number, fromNum: number, toNodeId: string, channelId: number, text: string, agoS: number, extra: Partial<RawMessage> = {},
): RawMessage {
  const fromNodeId = `!${fromNum.toString(16).padStart(8, '0')}`;
  const ts = (NOW_S - agoS) * 1000;
  return { id: `${SOURCE_IDS.g2}_${fromNum}_${n}`, from: fromNodeId, to: toNodeId, fromNodeId, toNodeId, text,
    channel: channelId, portnum: 1, timestamp: ts, receivedAt: ts, hopStart: 3, hopLimit: 2, rxSnr: 6.5, rxRssi: -92, ...extra };
}

const BROADCAST = '!ffffffff';
const KIFISIA = '!a1b2c301';
const messages: RawMessage[] = [
  message(1, 0xa1b2c301, BROADCAST, 0, 'Morning from Kifisia, Lycabettus loud and clear', 3600),
  message(2, 0xa1b2c307, BROADCAST, 0, 'Lycabettus back on solar', 1800),
  message(3, 0xa1b2c303, BROADCAST, 0, 'Glyfada Beach checking in', 900),
  message(4, 0xa1b2c300, BROADCAST, 1, 'gauntlet test 1', 300),
  message(5, 0xa1b2c302, '!a1b2c300', -1, 'Heading up Hymettus, will relay this morning', 240),
  // Ours, acknowledged by the mesh (the thread's "Delivered").
  message(6, 0xa1b2c300, BROADCAST, 0, 'Welcome back! Hearing you direct from Kifisia', 600, { deliveryState: 'delivered', isLocalMessage: true }),
  // The Kifisia Rooftop DM (10-01): theirs, then ours in each ack state.
  message(7, 0xa1b2c301, KIFISIA, -1, 'Can you run a traceroute to me?', 1500),
  ...([
    [8, 'Running one now, should be 2 hops via Hymettus', 1440, 'confirmed'],
    [9, 'Battery looks fine', 1380, 'delivered'],
    [10, 'Back on LongFast later?', 1320, undefined],
    [11, 'Ping me if the relay drops', 1260, 'failed'],
    [12, 'Thanks!', 5, undefined],
  ] as const).map(([n, text, ago, deliveryState]) =>
    message(n, 0xa1b2c300, KIFISIA, -1, text, ago, { deliveryState, isLocalMessage: true, wantAck: true })),
];

const telemetry: TelemetryData[] = [0, 1, 2, 3].map((i) => ({
  nodeId: '!a1b2c301', nodeNum: 0xa1b2c301, telemetryType: 'batteryLevel',
  timestamp: NOW_MS - i * 3_600_000, value: 88 + i, unit: '%', createdAt: NOW_MS - i * 3_600_000,
}));

/**
 * Station G2 ↔ Kifisia Rooftop via Hymettus Relay (the DM's traceroute strip), newest first. The
 * poll carries them without ids; the stored list (participation) has the older two, so the
 * strip shows the poll's newest as "Latest", with Statistical from the pair history.
 */
const traceroutes: PollTraceroute[] = [720, 7200, 14_400].map((agoS, i) => ({
  id: 41 - i, fromNodeNum: 0xa1b2c300, toNodeNum: 0xa1b2c301, fromNodeId: '!a1b2c300', toNodeId: KIFISIA,
  route: `[${0xa1b2c306}]`, routeBack: `[${0xa1b2c306}]`, snrTowards: '[18,-28]', snrBack: '[-26,20]',
  timestamp: NOW_MS - agoS * 1000, createdAt: NOW_MS - agoS * 1000, hopCount: 1,
}));

const unreadCounts: UnreadCountsData = { channels: { 0: 2, 1: 0, 2: 0 }, directMessages: { '!a1b2c302': 1 } };

/** `GET /api/messages/first-unread`: LongFast's oldest unread is Glyfada Beach's check-in (the "New" line). */
const firstUnread = { channels: { 0: (NOW_S - 900) * 1000 }, directMessages: { '!a1b2c302': (NOW_S - 240) * 1000 } };

/** `GET /api/device/tx-status?sourceId=`: the radio can send. */
const txStatus = { txEnabled: true, udpRelayEnabled: false, canTransmit: true };

function offer(nodeNum: number, channelName: string, agoS: number, hidden: 'dismissed' | 'muted' | null = null) {
  const at = NOW_MS - agoS * 1000;
  return {
    sourceId: SOURCE_IDS.g2, nodeNum, message: null, offerChannelName: channelName, hasChannelKey: true,
    offerRegion: null, offerPreset: null, hasOffer: true, firstSeenAt: at - 7_200_000, lastSeenAt: at,
    dismissedAt: hidden === 'dismissed' ? at : null, mutedAt: hidden === 'muted' ? at : null,
  };
}

/** `GET /api/sources/:id/beacon-offers?includeDismissed=true`: two pending, one dismissed, one muted. */
const beaconOffers = [
  offer(0xa1b2c303, 'Hiking-Athens', 600),
  offer(0xa1b2c304, 'Coast', 3600),
  offer(0xa1b2c305, 'West-Side', 86_400, 'dismissed'),
  offer(0xa1b2c308, 'Keratea-Ops', 172_800, 'muted'),
];

const unreadBySource: UnreadBySourceData = {
  sources: { [SOURCE_IDS.g2]: { directMessages: 1 }, [SOURCE_IDS.heltec]: { directMessages: 2 } },
};

/** `GET /api/poll?sourceId=src-g2`: a full (non-delta) reply. */
const poll: PollData = {
  connection: { connected: true, nodeResponsive: true, configuring: false, userDisconnected: false },
  nodes,
  messages,
  unreadCounts,
  channels,
  telemetryNodes: { nodes: ['!a1b2c300', '!a1b2c301'], weather: ['!a1b2c308'], estimatedPosition: [], pkc: ['!a1b2c301'] },
  config,
  deviceConfig: { basic: { nodeId: '!a1b2c300', nodeAddress: '192.168.1.40' }, lora: { modemPreset: 0, hopLimit: 3 } },
  traceroutes: traceroutes.map(({ id: _id, ...row }) => row),
  deviceNodeNums: [0xa1b2c300],
};

export const athensFixture = {
  sources,
  statuses,
  unifiedStatus,
  authStatus,
  config,
  userPreferences,
  settings,
  layoutUsage,
  nodes,
  channels,
  messages,
  telemetry,
  unreadCounts,
  unreadBySource,
  poll,
  txStatus,
  beaconOffers,
  firstUnread,
  traceroutes,
};
