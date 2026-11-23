/**
 * Pure helpers for the automation Test panel (kept out of the component file so
 * the `.tsx` exports only a component — react-refresh/only-export-components).
 */
import { stepOutputNameOf, type AutomationNode } from '../../types/automation';

export type EventState = Record<string, string>;
export type FactState = Record<string, string>;

export function numOrUndef(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Read thresholdMeters from the compiled leftHome trigger (default 300). */
export function leftHomeThresholdFromConfig(config: unknown): number {
  const nodes = (config as { nodes?: Array<{ type?: string; params?: Record<string, unknown> }> } | null)?.nodes;
  const trigger = nodes?.find((n) => n.type === 'trigger.leftHome');
  const thr = Number(trigger?.params?.thresholdMeters ?? 300);
  return Number.isFinite(thr) && thr > 0 ? thr : 300;
}

/** Which leftHome dry-run input path is active given the Test panel fields. */
export function leftHomeInputMode(ev: EventState, facts: FactState): 'coordinates' | 'distance' | 'none' {
  const hasCoords =
    numOrUndef(facts.latitude) != null &&
    numOrUndef(facts.longitude) != null &&
    numOrUndef(ev.homeLat) != null &&
    numOrUndef(ev.homeLon) != null;
  if (hasCoords) return 'coordinates';
  if (numOrUndef(ev.distanceMeters) != null) return 'distance';
  return 'none';
}

export function leftHomeModeHint(ev: EventState, facts: FactState, automationThreshold: number): string {
  const mode = leftHomeInputMode(ev, facts);
  const thr = `Threshold: ${automationThreshold} m (from the automation — not editable here).`;
  if (mode === 'coordinates') {
    return `${thr} Using home + current coordinates to compute distance. The distance field is ignored while all four coords are set.`;
  }
  if (mode === 'distance') {
    return `${thr} Using the distance field (${ev.distanceMeters} m). Fill home lat/lon and current lat/lon to compute distance from coordinates instead (coordinates take precedence).`;
  }
  return `${thr} Set either (1) home lat/lon + current lat/lon, or (2) a distance in metres. Dry-run fires only when the node is on the watch list and distance > threshold.`;
}

/** Run-output names (#5636) stored by "Run a script" steps in a compiled config. */
export function namedStepOutputs(config: unknown): string[] {
  const nodes = (config as { nodes?: unknown } | null | undefined)?.nodes;
  if (!Array.isArray(nodes)) return [];
  const names = new Set<string>();
  for (const n of nodes) {
    const name = n && typeof n === 'object' ? stepOutputNameOf(n as AutomationNode) : undefined;
    if (name) names.add(name);
  }
  return [...names];
}

export interface SimResult {
  matched: boolean;
  status: 'completed' | 'failed' | 'skipped';
  triggerType: string;
  fields: Record<string, unknown>;
  conditionResults: Record<string, boolean>;
  actions: Array<{ nodeId: string; type: string; ok: boolean; resolvedParams?: unknown; error?: string }>;
  variableWrites: Array<{ name: string; op: string; value?: unknown }>;
  steps: Array<{ nodeId: string; type: string; outcome: string; error?: string; detail?: Record<string, unknown> }>;
}

/** The synthetic event kind the Test panel builds for each trigger (moved from AutomationTester, #6365 Rule X). */
export const KIND_BY_TRIGGER: Record<string, string> = {
  'trigger.message': 'message',
  'trigger.telemetry': 'telemetry',
  'trigger.nodeUpdated': 'nodeUpdated',
  'trigger.nodeDiscovered': 'nodeDiscovered',
  'trigger.system': 'system',
  'trigger.geofence': 'geofence',
  'trigger.becameMobile': 'becameMobile',
  'trigger.leftHome': 'leftHome',
  'trigger.schedule': 'schedule',
  'trigger.meshBeacon': 'meshBeacon',
};

/** The `event` of POST /api/automations/test for a kind (moved from AutomationTester, #6365 Rule X). */
export function buildTestEvent(kind: string, ev: EventState, facts: FactState): Record<string, unknown> {
  const base: Record<string, unknown> = { kind, sourceId: ev.sourceId || undefined };
  switch (kind) {
    case 'message':
      return { ...base, text: ev.text ?? '', from: numOrUndef(ev.from), channel: numOrUndef(ev.channel),
        channelName: ev.channelName || undefined,
        hopStart: numOrUndef(ev.hopStart), hopLimit: numOrUndef(ev.hopLimit), packetId: numOrUndef(ev.packetId) ?? 1,
        snr: numOrUndef(ev.snr), rssi: numOrUndef(ev.rssi), viaMqtt: ev.viaMqtt === 'true' ? true : undefined };
    case 'telemetry':
      return { ...base, nodeNum: numOrUndef(ev.nodeNum), telemetryType: ev.telemetryType || 'batteryLevel', value: numOrUndef(ev.value) };
    case 'meshBeacon':
      return { ...base, nodeNum: numOrUndef(ev.nodeNum), message: ev.message ?? '',
        offerChannelName: ev.offerChannelName || undefined,
        offerRegion: numOrUndef(ev.offerRegion), offerPreset: numOrUndef(ev.offerPreset) };
    case 'nodeUpdated':
    case 'nodeDiscovered':
      return { ...base, nodeNum: numOrUndef(ev.nodeNum), changed: (ev.changed ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        // #5595: a public key makes the dry run a MeshCore event.
        ...(ev.publicKey ? {
          publicKey: ev.publicKey, name: ev.name || undefined, advType: numOrUndef(ev.advType),
          hops: numOrUndef(ev.hops), routeHops: numOrUndef(ev.routeHops), lastHeard: numOrUndef(ev.lastHeard),
        } : {}) };
    case 'system':
      return { ...base, event: ev.event || undefined, latestVersion: ev.latestVersion || undefined, currentVersion: ev.currentVersion || undefined, reason: ev.reason || undefined };
    case 'geofence':
      return { ...base, nodeNum: numOrUndef(ev.nodeNum) };
    case 'becameMobile':
      return { ...base, nodeNum: numOrUndef(ev.nodeNum), previousMobile: 0, mobile: 1 };
    case 'leftHome': {
      // Never send thresholdMeters — the simulator always uses the automation's value.
      // Distance is omitted when coordinates are complete (coords take precedence).
      const out: Record<string, unknown> = { ...base, nodeNum: numOrUndef(ev.nodeNum) };
      const homeLat = numOrUndef(ev.homeLat);
      const homeLon = numOrUndef(ev.homeLon);
      if (homeLat != null) out.homeLat = homeLat;
      if (homeLon != null) out.homeLon = homeLon;
      if (leftHomeInputMode(ev, facts) === 'distance') {
        const dist = numOrUndef(ev.distanceMeters);
        if (dist != null) out.distanceMeters = dist;
      }
      return out;
    }
    default:
      return base; // schedule
  }
}

/** The `node` facts of POST /api/automations/test (moved from AutomationTester, #6365 Rule X). */
export function buildTestNode(facts: FactState): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const numFact = (k: string) => { if (facts[k] !== undefined && facts[k] !== '') out[k] = Number(facts[k]); };
  numFact('batteryLevel'); numFact('voltage'); numFact('role'); numFact('hopsAway');
  numFact('channelUtilization'); numFact('airUtilTx'); numFact('snr'); numFact('altitude');
  // #4340 Phase 3: isNodeComplete() (src/utils/nodeHelpers.ts) requires an
  // hwModel, so a synthetic node.completeness dry-run reads 'incomplete'
  // without this — a confusing false negative for an otherwise-complete node.
  numFact('hwModel');
  if (facts.longName) out.longName = facts.longName;
  if (facts.shortName) out.shortName = facts.shortName;
  if (facts.latitude) out.latitude = Number(facts.latitude);
  if (facts.longitude) out.longitude = Number(facts.longitude);
  return Object.keys(out).length ? out : undefined;
}

/** The `variables` overrides of POST /api/automations/test (moved from AutomationTester, #6365 Rule X). */
export function buildTestVars(varOverrides: Record<string, string>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(varOverrides)) {
    if (v === '') continue;
    const n = Number(v);
    out[k] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(n) && v.trim() !== '' ? n : v;
  }
  return Object.keys(out).length ? out : undefined;
}

// The Test panel's option lists (moved from AutomationTester, #6365 Rule X).
export const SYSTEM_EVENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'bootup', label: 'System start' },
  { value: 'source-connected', label: 'Source came online' },
  { value: 'source-disconnected', label: 'Source went offline' },
  { value: 'upgrade-available', label: 'Upgrade available' },
];
// Mirrors the trigger.telemetry metric options — the trigger filters on one of these.
export const TELEMETRY_METRIC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'batteryLevel', label: 'Battery level (%)' },
  { value: 'voltage', label: 'Voltage' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'channelUtilization', label: 'Channel utilization' },
  { value: 'airUtilTx', label: 'Air util TX' },
];

// #5595: MeshCore advert types for the node-trigger dry run.
export const MESHCORE_ROLE_OPTIONS = [
  { value: '', label: 'Unknown' },
  { value: '1', label: 'Companion' },
  { value: '2', label: 'Repeater' },
  { value: '3', label: 'Room Server' },
  { value: '4', label: 'Sensor' },
];
