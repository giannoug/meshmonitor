/**
 * Station G2's Dashboard as boards j1 … k3 draw it (Task 8.1): today's
 * install-wide board for the device (`dashboardWidgets`, `telemetryCustomOrder`,
 * `telemetryFavorites` in `GET /api/settings?sourceId=`), its nodes
 * (`GET /api/nodes?sourceId=`: two on low battery, three first heard today), the
 * Live Mesh Activity read and the solar estimates. Served as overrides
 * (`dashboardFixtures()`), so no other board's requests change.
 *
 * Stateful: `PUT /api/user/preferences/:key` and `POST /api/settings` change
 * what the next read returns, and every write lands in `log.writes`
 * (method, path, body) so a test can count them.
 */
import { athensFixture, SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type { DeviceInfo } from '../../types/device';

const NOW_S = Math.floor(Date.now() / 1000);
const MIDNIGHT_S = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
// Just after midnight, so "first heard today" holds whatever the hour.
const TODAY_S = Math.min(NOW_S - 60, MIDNIGHT_S + 60);

export const DASH = {
  status: 'w-status',
  hops: 'w-hops',
  live: 'w-live',
  chart: '!a1b2c301-batteryLevel',
} as const;

/** Today's install-wide board for Station G2: three widgets, one starred chart. */
export const dashboardSettings = {
  telemetryFavorites: JSON.stringify([{ nodeId: '!a1b2c301', telemetryType: 'batteryLevel' }]),
  dashboardWidgets: JSON.stringify([
    { id: DASH.status, type: 'nodeStatus', nodeIds: ['!a1b2c301', '!a1b2c306', '!a1b2c304'] },
    { id: DASH.hops, type: 'hopDistribution' },
    { id: DASH.live, type: 'liveMeshActivity', windowMinutes: 10 },
  ]),
  telemetryCustomOrder: JSON.stringify([DASH.chart]),
};

/** j1's order, saved to the user's account: the chart first. */
export const savedBoard = {
  widgets: JSON.parse(dashboardSettings.dashboardWidgets) as unknown[],
  order: [DASH.chart, DASH.status, DASH.hops, DASH.live],
};

/** k1/k2's order: the chart, Hops, Node Status, Live Mesh Activity. */
export const phoneBoard = { ...savedBoard, order: [DASH.chart, DASH.hops, DASH.status, DASH.live] };

const lowBattery: Record<string, number> = { '!a1b2c303': 12, '!a1b2c307': 9 };
const newToday = new Set(['!a1b2c305', '!a1b2c308', '!a1b2c309']);

/** Station G2's nodes as `/api/nodes` returns them, with the board's battery and first-heard states. */
export const dashboardNodes: DeviceInfo[] = athensFixture.nodes.map((n) => {
  const id = n.user?.id ?? '';
  return {
    ...n,
    ...(lowBattery[id] !== undefined ? { deviceMetrics: { ...n.deviceMetrics, batteryLevel: lowBattery[id] } } : {}),
    firstHeard: newToday.has(id) ? TODAY_S : n.firstHeard ?? NOW_S - 30 * 86_400,
  };
});

export interface DashboardLog {
  writes: Array<{ method: string; path: string; search: string; body: Record<string, unknown> | undefined }>;
}

export interface DashboardFixtureOptions {
  /** The user's saved board for Station G2 (`dashboard.src-g2`); none: seeded from today's. */
  saved?: unknown;
}

export function dashboardFixtures(log: DashboardLog = { writes: [] }, opts: DashboardFixtureOptions = {}): Record<string, FixtureHandler> {
  const prefs: Record<string, unknown> = { ...athensFixture.userPreferences };
  if (opts.saved !== undefined) prefs[`dashboard.${SOURCE_IDS.g2}`] = opts.saved;
  const perSource: Record<string, Record<string, string>> = { [SOURCE_IDS.g2]: { ...dashboardSettings } };
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined);
  const logWrite = (u: URL, init?: RequestInit) =>
    log.writes.push({ method: (init?.method ?? 'POST').toUpperCase(), path: u.pathname, search: u.search, body: body(init) });

  return {
    'GET /api/user/preferences': () => ({ success: true, data: { preferences: prefs } }),
    'PUT /api/user/preferences/:key': (u, init) => {
      logWrite(u, init);
      prefs[decodeURIComponent(u.pathname.split('/').pop() ?? '')] = body(init)?.value;
      return { success: true };
    },
    'GET /api/settings': (u) => ({ ...athensFixture.settings, ...perSource[u.searchParams.get('sourceId') ?? ''] }),
    'POST /api/settings': (u, init) => {
      logWrite(u, init);
      const id = u.searchParams.get('sourceId') ?? '';
      perSource[id] = { ...perSource[id], ...(body(init) as Record<string, string>) };
      return { success: true };
    },
    'GET /api/nodes': (u) => (u.searchParams.get('sourceId') === SOURCE_IDS.g2 ? dashboardNodes : []),
    'GET /api/solar/estimates': () => ({ estimates: [] }),
    'GET /api/packets/stats/node-activity': () => ({
      success: true,
      data: {
        enabled: true,
        windowStart: Date.now() - 10 * 60_000,
        coverageStart: Date.now() - 86_400_000,
        truncated: false,
        nodes: [
          { nodeNum: 0xa1b2c301, nodeId: '!a1b2c301', shortName: 'KFR', longName: 'Kifisia Rooftop', packets: 42, extraReceptions: 3, lastSnr: 6.5, avgSnr: 6, lastHops: 2, minHops: 1, lastHeard: Date.now() - 60_000 },
          { nodeNum: 0xa1b2c306, nodeId: '!a1b2c306', shortName: 'HYMR', longName: 'Hymettus Relay', packets: 17, extraReceptions: 0, lastSnr: 9, avgSnr: 8.5, lastHops: 1, minHops: 1, lastHeard: Date.now() - 180_000 },
        ],
      },
    }),
  };
}
