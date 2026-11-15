/**
 * The Athens cast for Overview › Reports (boards 6-01 … 6-03, 6-08 … 6-10,
 * 6-15): Mesh Issues' last run, summary and findings, and the Coverage
 * Report's receivers, senders, receptions and a live survey. Shapes follow
 * today's `/api/analysis/mesh-issues/*` and `/api/analysis/coverage/*`
 * replies (`{ success, data }`).
 */
import type {
  MeshIssueRow,
  MeshIssuesStatus,
  MeshIssuesSummary,
  MeshIssueTypeSummary,
} from '../../components/Analysis/meshIssueTypes';
import type {
  CoverageMqttSourceStatusDto,
  CoverageReceiverDto,
  CoverageReceptionDto,
  CoverageSenderDto,
  CoverageSurveyDto,
} from '../../types/coverage';
import { SOURCE_IDS } from './athens';

const NOW_MS = Math.floor(Date.now() / 1000) * 1000;
const LAST_RUN = NOW_MS - 2 * 3_600_000;
const KIF = 0xa1b2c301;
const HAL = 0xa1b2c30a;
const MAR = 0xa1b2c305;
const PIR = 0xa1b2c304;
const ROVER = 0xa1b2c302;

export const meshIssueSourceNames: Record<string, string> = {
  [SOURCE_IDS.g2]: 'Station G2',
  [SOURCE_IDS.mqtt]: 'Athens MQTT',
  [SOURCE_IDS.rak]: 'Rooftop RAK',
};

function row(id: number, issueType: string, extra: Partial<MeshIssueRow>): MeshIssueRow {
  return {
    id, issueType, subjectKey: `node:${extra.nodeNum ?? 0}`, nodeNum: null, nodeName: null, severity: 'warning',
    confidence: 'high', evidence: {}, sourceIds: [SOURCE_IDS.g2], firstDetected: LAST_RUN - 86_400_000,
    lastDetected: LAST_RUN, status: 'open', dismissed: false, dismissedAt: null, ...extra,
  };
}

/** Findings by issue type. The cluster is new this run; Piraeus Base is dismissed. */
export const meshIssueRows: Record<string, MeshIssueRow[]> = {
  B1_router_cluster: [
    row(1, 'B1_router_cluster', {
      subjectKey: `cluster:${KIF}`, severity: 'critical', firstDetected: LAST_RUN, sourceIds: [SOURCE_IDS.g2, SOURCE_IDS.mqtt],
      evidence: {
        recommendation: 'Two ROUTERs hear each other strongly, so each rebroadcasts what the other already sent. Set one to CLIENT, or move it.',
        size: 2, bestSitedName: 'Kifisia Rooftop', bestSitedNodeNum: KIF, inferredOnly: false,
        members: [
          { nodeNum: KIF, name: 'Kifisia Rooftop', role: 2, roleName: 'ROUTER', latitude: 38.0742, longitude: 23.8113 },
          { nodeNum: HAL, name: 'Halandri Relay', role: 2, roleName: 'ROUTER', latitude: 38.0213, longitude: 23.7989 },
        ],
        edges: [{ a: KIF, b: HAL, evidenceClasses: ['neighborInfo', 'traceroute'] }],
      },
    }),
  ],
  B3_asymmetric_link: [
    row(2, 'B3_asymmetric_link', {
      subjectKey: `edge:${MAR}-${HAL}`, firstDetected: LAST_RUN,
      evidence: {
        recommendation: 'Heard one way only. Check antennas and placement at both ends.',
        nodeA: { nodeNum: MAR, name: 'Marousi Mobile' }, nodeB: { nodeNum: HAL, name: 'Halandri Relay' },
        snrToA: { count: 9, meanDb: -12.5, minDb: -15, maxDb: -9 },
        snrToB: { count: 14, meanDb: 4, minDb: 1, maxDb: 6.5 },
        deltaDb: 16.5, weakerDirection: 'toA',
      },
    }),
  ],
  C2_over_broadcasting: [
    row(3, 'C2_over_broadcasting', { subjectKey: `node:${ROVER}`, nodeNum: ROVER, nodeName: 'Athens Rover', severity: 'info' }),
    row(4, 'C2_over_broadcasting', {
      subjectKey: `node:${PIR}`, nodeNum: PIR, nodeName: 'Piraeus Base', severity: 'info', sourceIds: [SOURCE_IDS.rak],
      dismissed: true, dismissedAt: LAST_RUN - 3_600_000,
    }),
  ],
  A8_low_battery: [row(5, 'A8_low_battery', { subjectKey: `node:${ROVER}`, nodeNum: ROVER, nodeName: 'Athens Rover', firstDetected: LAST_RUN })],
};

/** A tile: `total` findings (more than the fixture serves rows for), all at the type's worst severity. */
function typeSummary(issueType: string, worst: MeshIssueTypeSummary['worstSeverity'], total: number): MeshIssueTypeSummary {
  const rows = meshIssueRows[issueType];
  const bySeverity = { critical: 0, warning: 0, info: 0, [worst]: total };
  return { issueType, total, bySeverity, worstSeverity: worst, dismissed: rows.filter((r) => r.dismissed).length, latestDetected: LAST_RUN };
}

export const meshIssuesSummary: MeshIssuesSummary = {
  byType: [
    typeSummary('B1_router_cluster', 'critical', 2),
    typeSummary('B3_asymmetric_link', 'warning', 5),
    typeSummary('C2_over_broadcasting', 'info', 3),
    typeSummary('A8_low_battery', 'warning', 3),
  ],
  byNode: [
    { nodeNum: ROVER, nodeName: 'Athens Rover', total: 2, bySeverity: { critical: 0, warning: 1, info: 1 }, worstSeverity: 'warning',
      issueTypes: ['A8_low_battery', 'C2_over_broadcasting'], latestDetected: LAST_RUN },
    { nodeNum: null, nodeName: null, total: 2, bySeverity: { critical: 1, warning: 1, info: 0 }, worstSeverity: 'critical',
      issueTypes: ['B1_router_cluster', 'B3_asymmetric_link'], latestDetected: LAST_RUN },
  ],
  counts: { critical: 2, warning: 8, info: 3, total: 13, dismissed: 1 },
  total: 13,
  sourceNames: meshIssueSourceNames,
};

export const meshIssuesStatus: MeshIssuesStatus = {
  running: false, inProgress: false, enabled: true, frequencyHours: 24, lookbackHours: 168, pairBucketHours: 6,
  lastRunTime: LAST_RUN,
  lastRunResultFromStorage: true,
  lastRunResult: {
    durationMs: 41_000, sourceCount: 3, nodeCount: 47, findingCount: 12, newCount: 3, reopenedCount: 1, updatedCount: 8, closedCount: 2,
    byType: { B1_router_cluster: 1, B3_asymmetric_link: 1, C2_over_broadcasting: 2, A8_low_battery: 1 },
    newByType: { B1_router_cluster: 1, B3_asymmetric_link: 1, A8_low_battery: 1 },
    reopenedByType: { B3_asymmetric_link: 1 },
    corpusStats: { rawCount: 418, validCount: 339, dedupedCount: 320, sampledCount: 301, distinctPairCount: 37, truncated: false },
    coverage: {
      evidence: { neighborInfo: true, traceroute: true, mqttGateway: true, packetLog: false, mqttSourceConfigured: true },
      neighborInfoRowCount: 96, neighborInfoEdgeCount: 96, tracerouteEdgeCount: 301, tracerouteSentinelHopsDropped: 0,
      gatewayCount: 1, gatewayDirectEdgeCount: 12, gatewayCoReceptionEdgeCount: 4, gatewayCellsSkipped: 0, directEdgeCount: 120,
      totalEdgeCount: 140, graphNodeCount: 47, snrDirectionsWithMinSamples: 30, hopHorizonSource: null, hopHorizonNodeCount: 0,
      skippedRules: [],
    },
  },
  thresholds: {
    tierAEnabled: true, tierBEnabled: true, tierCEnabled: true, b7Enabled: false, airUtilTxPct: 10, channelUtilPct: 40,
    mobileSpanMeters: 1000, snrAsymmetryDb: 10, overBroadcastSeconds: 900, autoCloseCleanRuns: 3, routerClusterMaxLinkKm: 5,
    staleHoursMeshtastic: 72, staleHoursMeshcore: 72, lowBatteryPct: 20, lowBatteryMv: 3500,
    disabledRules: ['C2_over_broadcasting'],
  },
};

// ── Coverage ─────────────────────────────────────────────────────────────

const ROVER_ID = '!a1b2c302';

function receiver(sourceId: string, sourceName: string, receiverId: string, longName: string, kind: CoverageReceiverDto['receiverKind'],
  lat: number, lon: number, receptionCount: number): CoverageReceiverDto {
  return { sourceId, sourceName, protocol: 'meshtastic', receiverKind: kind, receiverId, receiverNodeNum: parseInt(receiverId.slice(1), 16),
    longName, shortName: null, latitude: lat, longitude: lon, lastReceivedAt: NOW_MS - 600_000, receptionCount };
}

export const coverageReceivers: CoverageReceiverDto[] = [
  receiver(SOURCE_IDS.g2, 'Station G2', '!a1b2c300', 'Station G2', 'local', 37.9838, 23.7275, 96),
  receiver(SOURCE_IDS.mqtt, 'Athens MQTT', '!a1b2c30b', 'Athens MQTT gw', 'mqtt_gateway', 37.99, 23.74, 38),
  receiver(SOURCE_IDS.rak, 'Rooftop RAK', '!a1b2c30c', 'Rooftop RAK', 'local', 38.0742, 23.8113, 22),
  // A MeshCore Observer feed (Heltec MeshCore's MQTT side): kind "Observer", badge "MeshCore".
  { ...receiver(SOURCE_IDS.heltec, 'Heltec MeshCore', 'b3f1c2d4e5a6978812345678', 'Halandri Relay', 'mqtt_gateway', 38.0213, 23.7989, 61),
    protocol: 'meshcore', receiverNodeNum: null },
];

export const coverageMqttSources: CoverageMqttSourceStatusDto[] = [
  { sourceId: SOURCE_IDS.mqtt, sourceName: 'Athens MQTT', recordingEnabled: false, protocol: 'meshtastic' },
];

export const coverageSenders: CoverageSenderDto[] = [
  { senderId: ROVER_ID, senderNodeNum: ROVER, longName: 'Athens Rover', shortName: 'ROVR', fixCount: 212, lastReceivedAt: NOW_MS - 120_000 },
  // Station G2's own radio, heard by Rooftop RAK: offers "Cross-source only".
  { senderId: '!a1b2c300', senderNodeNum: 0xa1b2c300, longName: 'Station G2', shortName: 'G2', fixCount: 4, lastReceivedAt: NOW_MS - 900_000,
    senderIsOwnSource: true, ownSourceId: SOURCE_IDS.g2, ownSourceName: 'Station G2' },
];

/** Athens Rover's walk from Piraeus towards Kifisia: one fix a minute, heard by Station G2 (and the gateway on every third). */
export const coverageReceptions: CoverageReceptionDto[] = Array.from({ length: 18 }, (_, i) => i).flatMap((i) => {
  const at = NOW_MS - (18 - i) * 60_000;
  const lat = 37.94 + i * 0.007;
  const lon = 23.65 + i * 0.009;
  const base = {
    protocol: 'meshtastic' as const, senderId: ROVER_ID, senderNodeNum: ROVER, packetKey: `p${i}`, packetId: 1000 + i, pathKey: 'direct',
    latitude: lat, longitude: lon, altitude: 120, precisionBits: 32, hopStart: 0, hopLimit: 0, hopsAway: 0, relayNode: null,
    transportMechanism: null, channel: 0, rxTime: Math.floor(at / 1000), receivedAt: at,
  };
  const g2 = { ...base, id: i * 2 + 1, sourceId: SOURCE_IDS.g2, receiverKind: 'local' as const, receiverId: '!a1b2c300',
    receiverNodeNum: 0xa1b2c300, receiverLatitude: 37.9838, receiverLongitude: 23.7275, snr: 9 - i, rssi: -71 - i * 2 };
  if (i % 3) return [g2];
  return [g2, { ...base, id: i * 2 + 2, sourceId: SOURCE_IDS.mqtt, receiverKind: 'mqtt_gateway' as const, receiverId: '!a1b2c30b',
    receiverNodeNum: 0xa1b2c30b, receiverLatitude: 37.99, receiverLongitude: 23.74, snr: -6, rssi: -110 }];
});

export const coverageSurveys: CoverageSurveyDto[] = [
  { id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', name: 'Kifisia walk', senderId: ROVER_ID, startAt: NOW_MS - 18 * 60_000, endAt: null,
    receivers: null, intervalSec: 60, notes: null, createdAt: NOW_MS - 18 * 60_000, updatedAt: NOW_MS - 18 * 60_000,
    effectiveEndAt: NOW_MS, isLive: true, canEdit: true, createdByMe: true },
];

/** `/api/analysis/mesh-issues?issueType=…` / `?nodeNum=…`: the matching findings, dismissed ones only when asked for. */
export function meshIssuesPage(url: URL) {
  const type = url.searchParams.get('issueType');
  const nodeNum = url.searchParams.get('nodeNum');
  const all = Object.values(meshIssueRows).flat();
  const matched = type
    ? (meshIssueRows[type] ?? [])
    : all.filter((r) => (nodeNum === 'none' ? r.nodeNum === null : r.nodeNum === Number(nodeNum)));
  const issues = url.searchParams.get('includeDismissed') === 'true' ? matched : matched.filter((r) => !r.dismissed);
  const counts = { critical: 0, warning: 0, info: 0, total: issues.length, dismissed: issues.filter((r) => r.dismissed).length };
  issues.forEach((r) => { counts[r.severity] += 1; });
  return { success: true, data: { issues, counts, sourceNames: meshIssueSourceNames, total: issues.length, limit: 2000, offset: 0 } };
}
