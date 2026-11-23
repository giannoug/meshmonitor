/**
 * The Automation Engine on this MeshMonitor (14-01 … 14-13, m2, m4, n2, n3;
 * Task 8.4): seven rules as today's builder saves them, four variables, and
 * Weather bot's runs. Writes are logged; a read changes nothing. Counts, times
 * and texts are sample data.
 */
import { SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';

export interface RulesLog {
  writes: Array<{ method: string; path: string; body: unknown }>;
}

const NOW = Date.now();
const G2 = SOURCE_IDS.g2;
const HC = SOURCE_IDS.heltec;

type Node = { id: string; type: string; params: Record<string, unknown> };
/** A linear rule as compile() writes it: t → c0 … → a0 … */
function chain(trigger: Omit<Node, 'id'>, conditions: Array<Omit<Node, 'id'>>, actions: Array<Omit<Node, 'id'>>) {
  const nodes: Node[] = [{ id: 't', ...trigger }, ...conditions.map((c, i) => ({ id: `c${i}`, ...c })), ...actions.map((a, i) => ({ id: `a${i}`, ...a }))];
  return JSON.stringify({ version: 1, nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) });
}
const sourceFilter = (...ids: string[]) => ({ type: 'condition.sourceFilter', params: { sourceIds: ids } });
const row = (id: string, name: string, description: string, config: string, enabled = true) => ({ id, name, description, enabled, config, createdAt: NOW - 86_400_000, updatedAt: NOW - 3_600_000 });
const nextYear = new Date(NOW).getFullYear() + 1;

export const RULES = [
  row('e1', 'Welcome new nodes', 'DMs a welcome on first sighting · raises the welcomed flag', chain(
    { type: 'trigger.nodeDiscovered', params: { cooldownSeconds: 86400 } }, [],
    [{ type: 'action.sendMessage', params: { to: '{{ trigger.nodeNum }}', text: 'Welcome to the Athens mesh, {{ node.longName }}!' } }, { type: 'flow.setVar', params: { name: 'welcomed', op: 'raise' } }],
  )),
  row('e2', 'Low battery alert', 'Notifies you when a battery drops below 20 %', chain(
    { type: 'trigger.telemetry', params: { cooldownSeconds: 3600 } },
    [sourceFilter(G2, HC), { type: 'condition.numeric', params: { field: 'node.batteryLevel', op: '<', value: '{{ var.lowBatteryThreshold }}' } }],
    [{ type: 'action.notify', params: { title: 'Low battery', body: '{{ node.longName }} is at {{ node.batteryLevel }} %' } }],
  )),
  row('e3', 'Weather bot', 'Replies to !wx in # Local with weather.py’s output', chain(
    { type: 'trigger.message', params: { channels: [{ name: 'Local', protocol: 'meshtastic' }] } },
    [sourceFilter(G2), { type: 'condition.string', params: { field: 'text', op: 'startsWith', value: '!wx' } }],
    [{ type: 'action.runScript', params: { scriptPath: '/data/scripts/weather.py', args: '{{ trigger.text }}', outputName: 'wx' } },
      { type: 'action.sendMessage', params: { text: '{{ steps.wx.output }}', channels: [{ name: 'Local', protocol: 'meshtastic' }], sourceIds: [G2] } }],
  )),
  row('e4', 'Auto-Ack', 'Converted from Auto-acknowledge · tapback on zero-hop DMs', chain(
    { type: 'trigger.message', params: { rateLimit: { maxActions: 30, windowSeconds: 60 } } }, [sourceFilter(G2)],
    [{ type: 'action.tapback', params: { emojiMode: 'hopCount' } }],
  )),
  row('e5', 'MT_to_MC_Bridge', 'Relays # LongFast to # athens, tagged “MT@sender:”', chain(
    { type: 'trigger.message', params: { channels: [{ name: 'LongFast', protocol: 'meshtastic' }], rateLimit: { maxActions: 20, windowSeconds: 60 } } }, [sourceFilter(G2)],
    [{ type: 'action.sendMessage', params: { text: 'MT@{{ trigger.senderLabel }}: {{ trigger.text }}', channels: [{ name: 'athens', protocol: 'meshcore' }], sourceIds: [HC] } }],
  )),
  row('e6', 'MC_to_MT_Bridge', 'Relays # athens to # LongFast, tagged “MC@sender:”', chain(
    { type: 'trigger.message', params: { channels: [{ name: 'athens', protocol: 'meshcore' }], rateLimit: { maxActions: 20, windowSeconds: 60 } } }, [sourceFilter(HC)],
    [{ type: 'action.sendMessage', params: { text: 'MC@{{ trigger.senderLabel }}: {{ trigger.text }}', channels: [{ name: 'LongFast', protocol: 'meshtastic' }], sourceIds: [G2] } }],
  ), false),
  row('e7', 'Net check-in', 'Timed announcement on # LongFast and # Public', chain(
    { type: 'trigger.schedule', params: { cron: '*/30 * * * *', endAt: `${nextYear}-11-14T12:00`, timezone: 'Europe/Athens' } }, [],
    [{ type: 'action.sendMessage', params: { text: 'Net check-in is open on this channel until noon.', channels: [{ name: 'LongFast', protocol: 'meshtastic' }], sourceIds: [G2] } },
      { type: 'action.sendMessage', params: { text: 'Net check-in is open on this channel until noon.', channels: [{ name: 'Public', protocol: 'meshcore' }], sourceIds: [HC] } }],
  )),
];

/** A rule the steps view cannot draw: a condition with If / Else ports, and a key compile() never writes. */
export const BRANCHED_RULE = row('x1', 'Branched rule', 'Built as JSON', JSON.stringify({
  version: 1,
  ui: { zoom: 1.5 },
  nodes: [
    { id: 'trig', type: 'trigger.message', params: { textContains: 'ping' } },
    { id: 'cond', type: 'condition.string', params: { field: 'text', op: 'eq', value: 'ping' }, label: 'is ping' },
    { id: 'yes', type: 'action.tapback', params: { emoji: '👍' } },
    { id: 'no', type: 'action.nothing', params: {} },
  ],
  edges: [{ from: 'trig', to: 'cond' }, { from: 'cond', to: 'yes', port: 'true' }, { from: 'cond', to: 'no', port: 'false' }],
}), false);

export const VARIABLES = [
  { id: 'v1', name: 'lowBatteryThreshold', description: null, type: 'integer', scope: 'global', readonly: true, config: '{"defaultValue":20}' },
  { id: 'v2', name: 'welcomed', description: null, type: 'flag', scope: 'node', readonly: false, config: '{"flagDurationSeconds":86400}' },
  { id: 'v3', name: 'lastWeatherCall', description: null, type: 'string', scope: 'sourceNode', readonly: false, config: '{}' },
  { id: 'v4', name: 'relayCount', description: null, type: 'integer', scope: 'source', readonly: false, config: '{"defaultValue":0}' },
];

const at = (h: number, m: number) => { const d = new Date(NOW); d.setHours(h, m, 0, 0); return d.getTime(); };
const wx = (from: string, fromId: string, text: string) => JSON.stringify({ text, fromName: from, fromId, channelName: 'Local', channel: 1, packetId: 0x4f21a7 });
const ok = (reply: string) => JSON.stringify([
  { nodeId: 'c0', type: 'condition.sourceFilter', outcome: 'condition:true' },
  { nodeId: 'c1', type: 'condition.string', outcome: 'condition:true' },
  { nodeId: 'a0', type: 'action.runScript', outcome: 'action:ok', detail: { output: reply } },
  { nodeId: 'a1', type: 'action.sendMessage', outcome: 'action:ok', detail: { channel: 'Local', packetId: '0x4f21b0' } },
]);

export const WEATHER_RUNS = [
  { id: 'r1', status: 'completed', sourceId: G2, startedAt: at(10, 42), triggerEvent: wx('Nikos T-Echo', '!0e9b44c1', '!wx marousi'), log: ok('Marousi 17 °C, wind 9 km/h N') },
  { id: 'r2', status: 'completed', sourceId: G2, startedAt: at(10, 41), triggerEvent: wx('Psychiko Base', '!0e9b44c2', '!wx'), log: ok('Athens 18 °C, wind 12 km/h NW') },
  { id: 'r3', status: 'completed', sourceId: G2, startedAt: at(10, 40), triggerEvent: wx('Athens Rover', '!0e9b44c3', '!wx athens'), log: ok('Athens 18 °C, wind 12 km/h NW, clear') },
  { id: 'r4', status: 'completed', sourceId: G2, startedAt: at(10, 39), triggerEvent: wx('Kifisia Rooftop', '!0e9b44c4', 'wx?'), log: JSON.stringify([
    { nodeId: 'c0', type: 'condition.sourceFilter', outcome: 'condition:true' },
    { nodeId: 'c1', type: 'condition.string', outcome: 'condition:false' },
  ]) },
  { id: 'r5', status: 'failed', sourceId: G2, startedAt: at(9, 12), triggerEvent: wx('Glyfada Beach', '!0e9b44c5', '!wx glyfada'), log: JSON.stringify([
    { nodeId: 'c0', type: 'condition.sourceFilter', outcome: 'condition:true' },
    { nodeId: 'c1', type: 'condition.string', outcome: 'condition:true' },
    { nodeId: 'a0', type: 'action.runScript', outcome: 'action:error', error: 'script timed out' },
  ]) },
  { id: 'r6', status: 'completed', sourceId: G2, startedAt: at(8, 55), triggerEvent: wx('Nikos T-Echo', '!0e9b44c1', '!wx'), log: ok('Athens 16 °C, calm') },
];

export const TEST_RESULT = {
  matched: true,
  status: 'completed',
  triggerType: 'trigger.message',
  fields: { text: '!wx athens' },
  conditionResults: { c0: true, c1: true },
  actions: [
    { nodeId: 'a0', type: 'action.runScript', ok: true, resolvedParams: { scriptPath: '/data/scripts/weather.py' } },
    { nodeId: 'a1', type: 'action.sendMessage', ok: true, resolvedParams: { channel: 'Local', text: 'Athens 18 °C, wind 12 km/h NW, clear' } },
  ],
  variableWrites: [],
  steps: [
    { nodeId: 'c0', type: 'condition.sourceFilter', outcome: 'condition:true' },
    { nodeId: 'c1', type: 'condition.string', outcome: 'condition:true' },
    { nodeId: 'a0', type: 'action.runScript', outcome: 'action:ok' },
    { nodeId: 'a1', type: 'action.sendMessage', outcome: 'action:ok' },
  ],
};

export function rulesFixtures(log: RulesLog, rules: unknown[] = RULES): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  const write = (reply: (b: unknown, u: URL) => unknown = () => ({ success: true })): FixtureHandler => (u, init) => {
    const b = body(init);
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, body: b });
    return reply(b, u);
  };
  return {
    'GET /api/automations': () => rules,
    'GET /api/automations/variables': () => VARIABLES,
    'GET /api/automations/channels': () => [
      { name: 'LongFast', protocol: 'meshtastic', sources: [{ sourceId: G2, sourceName: 'Station G2', slot: 0 }] },
      { name: 'Local', protocol: 'meshtastic', sources: [{ sourceId: G2, sourceName: 'Station G2', slot: 1 }] },
      { name: 'athens', protocol: 'meshcore', sources: [{ sourceId: HC, sourceName: 'Heltec MeshCore', slot: 1 }] },
      { name: 'Public', protocol: 'meshcore', sources: [{ sourceId: HC, sourceName: 'Heltec MeshCore', slot: 0 }] },
    ],
    'GET /api/automations/regions': () => ({ regions: [] }),
    'GET /api/automations/:id/runs': (u) => (u.pathname.split('/')[3] === 'e3' ? WEATHER_RUNS : []),
    'GET /api/automations/:id/export': (u) => {
      const r = (rules as typeof RULES).find((x) => x.id === u.pathname.split('/')[3]);
      return r ? { name: r.name, description: r.description, config: JSON.parse(r.config) } : new Response('{}', { status: 404 });
    },
    'GET /api/scripts': () => ({ scripts: [{ path: '/data/scripts/weather.py', filename: 'weather.py', name: 'weather.py' }] }),
    'POST /api/automations': write((b) => ({ id: 'n1', enabled: false, createdAt: NOW, updatedAt: NOW, ...(b as object), config: JSON.stringify((b as { config?: unknown })?.config ?? {}) })),
    'PUT /api/automations/:id': write((b, u) => ({ ...(rules as typeof RULES).find((x) => x.id === u.pathname.split('/')[3]), ...(b as object) })),
    'DELETE /api/automations/:id': write(),
    'POST /api/automations/test': write(() => TEST_RESULT),
    'POST /api/automations/import': write((b) => ({ id: `i${log.writes.length}`, description: null, enabled: false, config: '{}', ...(b as object) })),
    'POST /api/automations/variables': write((b) => ({ id: 'v9', ...(b as object) })),
    'DELETE /api/automations/variables/:id': write(),
    'POST /api/automations/:id/duplicate': write((b, u) => ({ ...(rules as typeof RULES).find((x) => x.id === u.pathname.split('/')[3]), id: 'd1', enabled: false, name: (b as { name?: string })?.name })),
    'POST /api/automations/:id/run-now': write(() => ({ success: true, data: { ran: true, status: 'completed', actions: [{ nodeId: 'a0', ok: true }, { nodeId: 'a1', ok: true }] } })),
    'POST /api/automations/:id/reset-homes': write(() => ({ reset: 1, seeded: 1, results: [{ nodeNum: 1, seeded: true }] })),
    'POST /api/automations/:id/:verb': write(),
  };
}
