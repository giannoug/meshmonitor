/**
 * Station G2's More tools (Task 8.5): Info's reads (o2, 16-01), Security's
 * (o3, 16-02, 16-05) and Quiet nodes (16-06, 16-07), with a log of every
 * write. Times are relative to now.
 */
import { athensFixture as A, SOURCE_IDS as S } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type { DeadNode, SecurityIssueView } from '../../components/security/securityTypes';

const NOW_S = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const TEN_AM = Math.floor(new Date().setHours(10, 0, 0, 0) / 1000);

export interface ToolsLog {
  writes: Array<{ method: string; path: string; body: unknown }>;
}

const SHARED_KEY = 'q9Zc0lYxQ7pVb2Ff1mNn8sTt4uWw6yAa3hJj5kLl0oE=';

function issue(num: number, longName: string, shortName: string, extra: Partial<SecurityIssueView>): SecurityIssueView {
  return {
    nodeKey: `mt:${num}`, protocol: 'meshtastic', nodeNum: num, longName, shortName, lastHeard: NOW_S - 1800, keyIsLowEntropy: false,
    duplicateKeyDetected: false, hwModel: 43, ...extra,
  };
}

export const securityIssues = {
  protocol: 'meshtastic',
  total: 6,
  lowEntropyCount: 1,
  duplicateKeyCount: 2,
  excessivePacketsCount: 1,
  timeOffsetCount: 2,
  thresholds: { packetsPerHour: 60, timeOffsetMinutes: 5 },
  nodes: [
    issue(0xa1b2c303, 'Glyfada Beach', 'GLY', { duplicateKeyDetected: true, publicKey: SHARED_KEY }),
    issue(0xa1b2c30a, 'Lycabettus Hiker', 'LYC', { duplicateKeyDetected: true, publicKey: SHARED_KEY }),
    issue(0xa1b2c30b, 'Peristeri Home', 'PER', { keyIsLowEntropy: true, publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', keySecurityIssueDetails: 'Known low-entropy key' }),
    issue(0xa1b2c305, 'Marousi Mobile', 'MAR2', { isExcessivePackets: true, packetRatePerHour: 74, packetRateLastChecked: NOW_S - 600 }),
    issue(0xa1b2c30c, 'Halandri Relay', 'HAL', { isTimeOffsetIssue: true, timeOffsetSeconds: 420 }),
    issue(0xa1b2c308, 'Kifisia Weather', 'KWX', { isTimeOffsetIssue: true, timeOffsetSeconds: -900 }),
  ],
  topBroadcasters: [
    { nodeNum: 0xa1b2c305, nodeKey: `mt:${0xa1b2c305}`, longName: 'Marousi Mobile', shortName: 'MAR2', packetCount: 74 },
    { nodeNum: 0xa1b2c301, nodeKey: `mt:${0xa1b2c301}`, longName: 'Kifisia Rooftop', shortName: 'KFR', packetCount: 31 },
  ],
};

export const scannerStatus = { running: true, scanningNow: false, intervalHours: 6, lastScanTime: TEN_AM };

function dead(num: number, longName: string, shortName: string, daysAgo: number | null, inDeviceDb: boolean): DeadNode {
  return {
    nodeKey: `mt:${num}`, protocol: 'meshtastic', nodeNum: num, nodeId: `!${num.toString(16).padStart(8, '0')}`, longName, shortName,
    hwModel: 9, lastHeard: daysAgo === null ? null : NOW_S - daysAgo * DAY - 3600, inDeviceDb,
  };
}

/** Oldest first, as the route sorts them; one never heard (Select all skips it). */
export const deadNodes: DeadNode[] = [
  dead(0xa1b2c320, 'Kallithea Spare', 'KAL', null, false),
  dead(0xa1b2c321, 'Penteli Hut', 'PEN', 95, false),
  dead(0xa1b2c322, 'Test bench T-Beam', 'TB', 62, false),
  dead(0xa1b2c323, 'Aegina Harbour', 'AEG', 33, true),
  dead(0xa1b2c30a, 'Lycabettus Hiker', 'LYC', 12, true),
  dead(0xa1b2c324, 'Vouliagmeni Kayak', 'VOU', 9, true),
  dead(0xa1b2c325, 'Salamina Ferry', 'SAL', 8, true),
  dead(0xa1b2c326, 'Elefsina Yard', 'ELF', 7, true),
  dead(0xa1b2c327, 'Spata Mast', 'SPA', 7, false),
];

const mismatches = [
  { id: 1, nodeNum: 0xa1b2c301, nodeName: 'Kifisia Rooftop', timestamp: Date.now() - 3_600_000, oldKeyFragment: 'Kx4pZb0v', newKeyFragment: 'Qq7rTt2w', action: 'mismatch' },
  { id: 2, nodeNum: 0xa1b2c30a, nodeName: 'Lycabettus Hiker', timestamp: Date.now() - 7_200_000, oldKeyFragment: 'q9Zc0lYx', newKeyFragment: 'Zz1yXx0w', action: 'fixed' },
];

/** Station G2's device config as the poll carries it (radio, MQTT, identity). */
const deviceConfig = {
  basic: { nodeId: '!a1b2c300', nodeName: 'Station G2', firmwareVersion: '2.7.15', nodeAddress: '192.168.1.40' },
  radio: { region: 'EU_868', modemPreset: 'LongFast', channelNum: 0, frequency: '869.525', hopLimit: 3, txPower: 27, txEnabled: true, sx126xRxBoostedGain: true },
  mqtt: { enabled: true, server: 'mqtt.meshtastic.org', username: 'meshdev', encryption: true, json: false, tls: true, rootTopic: 'msh/EU_868' },
};

const segment = (id: number, from: string, to: string, km: number, record: boolean) => ({
  id, fromNodeNum: 0xa1b2c300, toNodeNum: 0xa1b2c330 + id, fromNodeId: '!a1b2c300', toNodeId: `!a1b2c3${30 + id}`, fromNodeName: from,
  toNodeName: to, distanceKm: km, timestamp: Date.now() - 3_600_000, isRecordHolder: record, transportMechanism: 0, transport: 'rf' as const,
});

const localStats = ['uptimeSeconds:533040', 'channelUtilization:27', 'airUtilTx:3.1', 'numPacketsTx:1204', 'numPacketsRx:5040', 'numPacketsRxBad:12', 'numRxDupe:903', 'numTxRelay:310', 'numTxDropped:4']
  .map((pair, i) => {
    const [type, value] = pair.split(':');
    return { nodeId: '!a1b2c300', nodeNum: 0xa1b2c300, telemetryType: type, timestamp: Date.now() - 60_000 - i, value: Number(value) };
  });

export function toolsFixtures(log: ToolsLog = { writes: [] }): Record<string, FixtureHandler> {
  const write = (method: string) => (url: URL, init?: RequestInit) => {
    log.writes.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return undefined;
  };
  return {
    // Security (SecurityTab's reads).
    'GET /api/security/issues': () => securityIssues,
    'GET /api/security/scanner/status': () => scannerStatus,
    'GET /api/security/dead-nodes': () => ({ nodes: deadNodes, count: deadNodes.length, thresholdDays: 7 }),
    'GET /api/security/key-mismatches': () => ({ events: mismatches }),
    'GET /api/security/export': (url) => new Response(`node,issue\n${url.searchParams.get('format')}`, { status: 200, headers: { 'content-type': 'text/csv' } }),
    'POST /api/security/scanner/scan': (url, init) => (write('POST')(url, init), { success: true }),
    'POST /api/security/dead-nodes/bulk-delete': (url, init) => {
      write('POST')(url, init);
      const keys = (JSON.parse(String(init?.body)) as { nodeKeys: string[] }).nodeKeys;
      return { success: true, deletedCount: keys.length, results: keys.map((nodeKey) => ({ nodeKey, deleted: true, removedFromDevice: false })) };
    },
    'POST /api/security/digest/send': (url, init) => (write('POST')(url, init), { success: true, message: 'Digest sent' }),
    'POST /api/settings': (url, init) => (write('POST')(url, init), { success: true }),
    'GET /api/settings': () => ({ ...A.settings, securityDigestEnabled: 'true', securityDigestAppriseUrl: 'discord://1187/Xk9f', securityDigestTime: '08:00', securityDigestFormat: 'markdown', securityDigestSuppressEmpty: 'false' }),
    // Info (InfoTab's reads), and the poll with the radio's config.
    'GET /api/poll': (url) => {
      const sourceId = url.searchParams.get('sourceId');
      return !sourceId || sourceId === S.g2 ? { ...A.poll, deviceConfig } : undefined;
    },
    'GET /api/virtual-node/status': () => ({
      sources: [{ sourceId: S.g2, enabled: true, isRunning: true, allowAdminCommands: false, clientCount: 2, clients: [
        { id: 'c1', ip: '192.168.1.71', connectedAt: Date.now() - 7_200_000, lastActivity: Date.now() - 30_000 },
        { id: 'c2', ip: '192.168.1.72', connectedAt: Date.now() - 3_600_000, lastActivity: Date.now() - 60_000 },
      ] }],
    }),
    'GET /api/server-info': () => ({ timezone: 'Europe/Athens', timezoneProvided: true }),
    'GET /api/route-segments/longest-active': () => ({ ...segment(1, 'Station G2', 'Keratea Hill', 24.2, false), byTransport: { rf: segment(1, 'Station G2', 'Keratea Hill', 24.2, false), udp: null, mqtt: null } }),
    'GET /api/route-segments/record-holder': () => ({ ...segment(2, 'Station G2', 'Sounio Light', 51.7, true), byTransport: { rf: segment(2, 'Station G2', 'Sounio Light', 51.7, true), udp: null, mqtt: null } }),
    'GET /api/device/security-keys': () => ({ publicKey: 'Pub0Key1Station2G3Fixture4Value5abcdefghij=', privateKey: 'Priv0SecretStation2G3Fixture4Value5abcdef=' }),
    'GET /api/messages/counts': () => ({ success: true, data: { sourceId: S.g2, total: 812, byTransport: { rf: 700, udp: 12, mqtt: 100 } } }),
    'GET /api/sources/:id/survey': () => ({ success: true, data: null }),
    'GET /api/telemetry/:nodeId': (url) => {
      const nodeId = decodeURIComponent(url.pathname.split('/')[3]);
      return nodeId === '!a1b2c300' ? [...localStats, ...A.telemetry.filter((r) => r.nodeId === nodeId)] : A.telemetry.filter((r) => r.nodeId === nodeId);
    },
  };
}
