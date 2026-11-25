/**
 * The Athens cast for Overview › Reports (boards 6-01 … 6-15): Mesh Issues'
 * last run, summary and findings; the Coverage Report's receivers, senders,
 * receptions and a live survey; and the Traceroute Explorer, Solar,
 * ok_to_mqtt and NodeInfo Enrichment replies. Shapes follow
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
import type { ExplorerNodeWire, ExplorerResponse, ExplorerRunWire } from '../../components/Analysis/tracerouteExplorer/explorerModel';
import type { SolarForecastAnalysis, SolarNodesAnalysis, SolarPattern } from '../../components/Analysis/useSolarMonitoringReport';
import type { BrokerAddressClass, ViolationGatewayRow, ViolationPacketRow } from '../../components/Analysis/mqttViolationTypes';
import type { EnrichmentAnalysis } from '../../components/Analysis/useNodeInfoEnrichment';
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
    { nodeNum: PIR, nodeName: 'Piraeus Base', total: 1, bySeverity: { critical: 0, warning: 0, info: 1 }, worstSeverity: 'info',
      issueTypes: ['C2_over_broadcasting'], latestDetected: LAST_RUN - 3_600_000 },
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

// ---------------------------------------------------------------------------
// Traceroute Explorer (6-04, 6-11): `/api/traceroutes/explorer`. Station G2 →
// Kifisia Rooftop answers via Halandri Relay, changed from Psychiko Base and
// Kifisia's earlier route (Route changed); Station G2 → Marousi Mobile comes
// back a different way (Asymmetric); one run got no reply.
// ---------------------------------------------------------------------------

const G2 = 0xa1b2c300;
const GLY = 0xa1b2c303;
const HYM = 0xa1b2c306;
const LYC = 0xa1b2c307;
const PSY = 0xa1b2c30b;

function exNode(nodeNum: number, longName: string, shortName: string, latitude: number | null, longitude: number | null): ExplorerNodeWire {
  return {
    nodeNum, nodeKey: `mt:${nodeNum}`, protocol: 'meshtastic', nodeId: `!${nodeNum.toString(16)}`, shortName, longName,
    role: null, hwModel: null, latitude, longitude,
  };
}

let exId = 100;
function exRun(sourceId: string, minutesAgo: number, from: number, to: number, route: number[] | null, back: number[] | null, snr: number[] = [], snrBack: number[] = []): ExplorerRunWire {
  exId += 1;
  return {
    protocol: 'meshtastic', id: exId, sourceId, timestamp: NOW_MS - minutesAgo * 60_000, fromNodeNum: from, toNodeNum: to,
    route: route ? JSON.stringify(route) : null, routeBack: back ? JSON.stringify(back) : null,
    snrTowards: route ? JSON.stringify(snr) : null, snrBack: back ? JSON.stringify(snrBack) : null,
    channel: 0, packetId: 5000 + exId, transportMechanism: sourceId === SOURCE_IDS.mqtt ? 5 : 1,
  };
}

export const explorerResponse: ExplorerResponse = {
  sources: [
    { id: SOURCE_IDS.g2, name: 'Station G2' },
    { id: SOURCE_IDS.mqtt, name: 'Athens MQTT' },
    { id: SOURCE_IDS.rak, name: 'Rooftop RAK' },
    { id: SOURCE_IDS.heltec, name: 'Heltec MeshCore' },
  ],
  nodes: [
    exNode(G2, 'Station G2', 'G2', 37.9838, 23.7275),
    exNode(KIF, 'Kifisia Rooftop', 'KIF', 38.0742, 23.8113),
    exNode(HAL, 'Halandri Relay', 'HAL', 38.0213, 23.7989),
    exNode(MAR, 'Marousi Mobile', 'MAR2', 38.0500, 23.8050),
    exNode(PSY, 'Psychiko Base', 'PSY', 38.0090, 23.7700),
    exNode(GLY, 'Glyfada Beach', 'GLY', 37.8627, 23.7536),
    exNode(HYM, 'Hymettus Relay', 'HYM', 37.9497, 23.8037),
    exNode(LYC, 'Lycabettus Repeater', 'LYC', 37.9819, 23.7432),
    exNode(PIR, 'Piraeus Base', 'PIR', 37.9420, 23.6465),
    { ...exNode(0x7f000001, 'Heltec Base', 'HB', 37.9900, 23.7300), nodeKey: 'mc:aa11', protocol: 'meshcore' },
    { ...exNode(0x7f000002, 'Kallithea Repeater', 'KR', 37.9550, 23.7020), nodeKey: 'mc:bb22', protocol: 'meshcore' },
  ],
  runs: [
    exRun(SOURCE_IDS.g2, 30, G2, KIF, [HAL], [HAL], [16, -28], [-20, 12]),
    exRun(SOURCE_IDS.mqtt, 52, G2, GLY, [LYC, HYM], [HYM, LYC], [20, 8, 4], [6, 10, 18]),
    exRun(SOURCE_IDS.g2, 63, G2, MAR, [LYC], [HAL], [12, -8], [-6, 10]),
    exRun(SOURCE_IDS.g2, 94, G2, HYM, [], [], [24], [22]),
    exRun(SOURCE_IDS.g2, 130, G2, KIF, [PSY], [PSY], [10, 2], [4, 8]),
    exRun(SOURCE_IDS.rak, 160, PIR, GLY, [LYC], [LYC], [8, 6], [6, 8]),
    exRun(SOURCE_IDS.g2, 240, G2, KIF, [HAL], [HAL], [14, -24], [-18, 10]),
    exRun(SOURCE_IDS.g2, 300, G2, KIF, null, null),
    exRun(SOURCE_IDS.rak, 420, PIR, GLY, [HYM], [HYM], [4, 2], [2, 4]),
    // A MeshCore trace (meshcore_trace_runs joined server-side), so the Protocol filter shows.
    {
      protocol: 'meshcore', id: 900, sourceId: SOURCE_IDS.heltec, timestamp: NOW_MS - 200 * 60_000, fromNodeNum: 0x7f000001,
      toNodeNum: 0x7f000002, route: null, routeBack: null, snrTowards: JSON.stringify([40]), snrBack: null, channel: null,
      packetId: null, transportMechanism: null, fromKey: 'mc:aa11', toKey: 'mc:bb22', routeKeys: ['mc:aa11', 'mc:bb22'],
      routeBackKeys: null, reachedTarget: true, traceTag: 7, status: 'answered',
    },
  ],
  truncated: false,
  scanLimit: 5000,
  retentionPerPair: 50,
};

// ---------------------------------------------------------------------------
// Solar Monitoring (6-05, 6-12): `/api/analysis/solar-nodes` and
// `/api/analysis/solar-forecast`. Glyfada Beach charges by day and is at risk
// on a dull day; Kifisia Rooftop is marked solar, Station G2 not solar.
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TODAY = Math.floor(NOW_MS / DAY_MS) * DAY_MS;
const dayIso = (offset: number) => new Date(TODAY + offset * DAY_MS).toISOString().slice(0, 10);

/** Three days of hourly battery % that rises with the sun and falls overnight. */
const solarChart = Array.from({ length: 72 }, (_, i) => {
  const ts = TODAY - 3 * DAY_MS + i * HOUR_MS;
  const h = i % 24;
  const value = h >= 7 && h <= 13 ? 60 + (h - 7) * 6 : h > 13 && h <= 20 ? 96 - (h - 13) * 4 : 64 - ((h + 4) % 24) * 0.5;
  return { timestamp: ts, value: Math.round(value) };
});

function solarPattern(offset: number, rise: number, fall: number, charge: number, discharge: number): SolarPattern {
  return {
    date: dayIso(offset),
    sunrise: { time: '07:02', value: 58 }, peak: { time: '12:41', value: 96 }, sunset: { time: '17:20', value: 88 },
    rise, fall, charge_rate_per_hour: charge, discharge_rate_per_hour: discharge,
  };
}

export const solarNodes: SolarNodesAnalysis = {
  lookback_days: 7,
  total_nodes_analyzed: 24,
  solar_nodes_count: 2,
  solar_nodes: [
    {
      node_num: GLY, node_name: 'Glyfada Beach', solar_score: 82, days_analyzed: 7, days_with_pattern: 6,
      recent_patterns: [solarPattern(-1, 18, -11, 6.4, 1.2), solarPattern(-2, 21, -12, 6.6, 1.3), solarPattern(-3, 9, -13, 4.1, 1.4)],
      metric_type: 'batteryLevel', metrics_detected: ['batteryLevel'], chart_data: solarChart,
      avg_charge_rate_per_hour: 5.7, avg_discharge_rate_per_hour: 1.3, insufficient_solar: true,
    },
    {
      node_num: KIF, node_name: 'Kifisia Rooftop', solar_score: 64, days_analyzed: 7, days_with_pattern: 5,
      recent_patterns: [solarPattern(-1, 14, -9, 5.1, 1.0)],
      metric_type: 'batteryLevel', metrics_detected: ['batteryLevel'], chart_data: solarChart,
      avg_charge_rate_per_hour: 5.1, avg_discharge_rate_per_hour: 1.0, insufficient_solar: false, manual_override: true,
    },
  ],
  solar_production: Array.from({ length: 72 }, (_, i) => ({
    timestamp: TODAY - 3 * DAY_MS + i * HOUR_MS,
    wattHours: i % 24 >= 7 && i % 24 <= 17 ? 40 - Math.abs((i % 24) - 12) * 6 : 0,
  })),
  avg_charging_hours_per_day: 6.2,
  avg_discharge_hours_per_day: 17.8,
  analyzed_nodes: [
    { node_num: G2, node_name: 'Station G2' },
    { node_num: KIF, node_name: 'Kifisia Rooftop' },
    { node_num: GLY, node_name: 'Glyfada Beach' },
    { node_num: HYM, node_name: 'Hymettus Relay' },
  ],
  manual_overrides: [
    { node_num: KIF, node_name: 'Kifisia Rooftop', is_solar: true },
    { node_num: G2, node_name: 'Station G2', is_solar: false },
  ],
};

export const solarForecast: SolarForecastAnalysis = {
  lookback_days: 7,
  historical_days_analyzed: 7,
  avg_historical_daily_wh: 44,
  low_output_warning: true,
  forecast_days: [
    [0, 41], [1, 38], [2, 17], [3, 33], [4, 40],
  ].map(([offset, wh]) => ({ date: dayIso(offset), forecast_wh: wh, avg_historical_wh: 44, pct_of_average: (wh / 44) * 100, is_low: wh / 44 < 0.5 })),
  nodes_at_risk_count: 1,
  nodes_at_risk: [{ node_num: GLY, node_name: 'Glyfada Beach', metric_type: 'batteryLevel', current_battery: 72, min_simulated_battery: 31, simulation: [] }],
  solar_simulations: [{ node_num: GLY, node_name: 'Glyfada Beach', metric_type: 'batteryLevel', current_battery: 72, min_simulated_battery: 31, simulation: [] }],
};

// ---------------------------------------------------------------------------
// ok_to_mqtt Violations (6-06, 6-13): `/api/analysis/mqtt-violations/{gateways,packets}`.
// ---------------------------------------------------------------------------

function gw(id: string, nodeNum: number, longName: string, confirmed: number, suspected: number, originators: number, sourceIds: string[], brokerClass: BrokerAddressClass, firstDays: number, lastMin: number): ViolationGatewayRow {
  return {
    gatewayId: id, gatewayNodeNum: nodeNum, gatewayLongName: longName, gatewayShortName: null, violationCount: confirmed,
    suspectedCount: suspected, distinctOriginators: originators, sourceIds, firstSeen: NOW_MS - firstDays * DAY_MS,
    lastSeen: NOW_MS - lastMin * 60_000, brokerClass,
  };
}

export const mqttGateways: ViolationGatewayRow[] = [
  gw('!d41c2a90', 0xd41c2a90, 'Athens MQTT gw', 38, 9, 6, [SOURCE_IDS.mqtt], 'public', 7, 20),
  gw('!a3f9c2e1', 0xa3f9c2e1, 'Kifisia Rooftop', 14, 5, 3, [SOURCE_IDS.g2, SOURCE_IDS.mqtt], 'public', 5, 95),
  gw('!7c21e0b4', 0x7c21e0b4, 'Psychiko Base', 6, 3, 2, [SOURCE_IDS.mqtt], 'public', 3, 1500),
  gw('!5e90aa12', 0x5e90aa12, 'Peristeri Home', 3, 0, 1, [SOURCE_IDS.mqtt], 'private', 1, 200),
];

function pkt(kind: 'confirmed' | 'suspected', minutesAgo: number, from: number, fromName: string, port: number, portName: string, bitfield: number | null): ViolationPacketRow {
  const ts = NOW_MS - minutesAgo * 60_000;
  return {
    id: minutesAgo, kind, sourceId: SOURCE_IDS.mqtt, packetId: 7000 + minutesAgo, fromNode: from, fromNodeId: `!${from.toString(16)}`,
    fromLongName: fromName, fromShortName: null, gatewayId: '!d41c2a90', gatewayNodeNum: 0xd41c2a90, gatewayLongName: 'Athens MQTT gw',
    gatewayShortName: null, channelId: 'LongFast', portnum: port, portnumName: portName, bitfield,
    topic: 'msh/EU_868/2/e/LongFast/!d41c2a90', rxTime: ts + 1000, timestamp: ts, brokerClass: 'public',
  };
}

export const mqttPackets: ViolationPacketRow[] = [
  pkt('confirmed', 20, 0xa1b2c30c, 'Nikos T-Echo', 1, 'TEXT_MESSAGE_APP', 0),
  pkt('confirmed', 23, MAR, 'Marousi Mobile', 3, 'POSITION_APP', 0),
  pkt('suspected', 50, PSY, 'Psychiko Base', 67, 'TELEMETRY_APP', null),
];

function violationMeta(url: URL, total: number) {
  return {
    total, limit: Number(url.searchParams.get('limit') ?? 50), offset: Number(url.searchParams.get('offset') ?? 0),
    since: NOW_MS - 7 * DAY_MS, until: NOW_MS, includeUnknown: url.searchParams.get('includeUnknown') === 'true',
    suspectedAvailable: true, suspectedWindowMs: 7 * DAY_MS, sources: [SOURCE_IDS.mqtt, SOURCE_IDS.g2], capApplied: false, scanCap: 2000,
  };
}

export function mqttGatewaysReply(url: URL) {
  return { success: true, data: { ...violationMeta(url, mqttGateways.length), gateways: mqttGateways } };
}

export function mqttPacketsReply(url: URL) {
  const unknown = url.searchParams.get('includeUnknown') === 'true';
  const violations = mqttPackets.filter((p) => unknown || p.kind === 'confirmed');
  return { success: true, data: { ...violationMeta(url, violations.length), violations, gateway: url.searchParams.get('gateway') } };
}

// ---------------------------------------------------------------------------
// NodeInfo Enrichment (6-07, 6-14): `/api/nodes/enrichment/analysis`.
// ---------------------------------------------------------------------------

const names: Record<string, string> = { [SOURCE_IDS.g2]: 'Station G2', [SOURCE_IDS.mqtt]: 'Athens MQTT', [SOURCE_IDS.rak]: 'Rooftop RAK' };
function target(targetSourceId: string, donorSourceId: string, fillableFields: string[]) {
  return { targetSourceId, targetSourceName: names[targetSourceId], fillableFields, donorSourceId, donorSourceName: names[donorSourceId] };
}

export const enrichmentAnalysis: EnrichmentAnalysis = {
  nodes: [
    { nodeNum: MAR, nodeId: '!a1b2c305', displayName: 'Marousi Mobile', targets: [target(SOURCE_IDS.rak, SOURCE_IDS.g2, ['longName', 'shortName', 'hwModel'])] },
    { nodeNum: GLY, nodeId: '!a1b2c303', displayName: 'Glyfada Beach', targets: [target(SOURCE_IDS.mqtt, SOURCE_IDS.g2, ['hwModel', 'role'])] },
    { nodeNum: HYM, nodeId: '!a1b2c306', displayName: 'Hymettus Relay', targets: [target(SOURCE_IDS.rak, SOURCE_IDS.mqtt, ['longName', 'shortName'])] },
    { nodeNum: PIR, nodeId: '!a1b2c304', displayName: 'Piraeus Base', targets: [target(SOURCE_IDS.mqtt, SOURCE_IDS.rak, ['longName', 'role'])] },
  ],
  summary: { nodeCount: 4, targetCount: 4, fieldCount: 9 },
};

/** Marousi Mobile as Station G2 and Athens MQTT heard it: the copy preview's donors (6-07), the row's own donor second. */
const marousi = { nodeNum: MAR, nodeId: '!a1b2c305', longName: 'Marousi Mobile', shortName: 'MAR2', hwModel: 43, role: 0,
  macaddr: null, publicKey: null, hasPKC: false, firmwareVersion: '2.7.15', updatedAt: NOW_MS - 360_000, lastHeard: Math.floor(NOW_MS / 1000) - 360 };
export const enrichmentCopyCandidates = [
  { sourceId: SOURCE_IDS.mqtt, sourceName: 'Athens MQTT', sourceType: 'mqtt_broker', node: { ...marousi, longName: 'Marousi', shortName: 'M' }, fieldsFilled: 5, totalFields: 8 },
  { sourceId: SOURCE_IDS.g2, sourceName: 'Station G2', sourceType: 'meshtastic_tcp', node: marousi, fieldsFilled: 7, totalFields: 8 },
];
