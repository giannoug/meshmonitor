/**
 * Serves the Athens fixture by method and path, for Vitest (`renderWorkspace`
 * stubs `fetch` with it) and Playwright (`tests/workspace-e2e/fixtureRoutes.ts`).
 *
 * Keys are `'<METHOD> <path-pattern>'` with `:param` segments, matched against
 * the pathname only; a handler reads the query from the URL it is given. A
 * handler returns a body (sent as 200 JSON), a `Response`, or `undefined` to
 * fall through. Overrides are tried before the defaults. No match: `undefined`.
 */
import { athensFixture as A, SOURCE_IDS } from './athens';

export type FixtureHandler = (url: URL, init?: RequestInit) => unknown | Response;

const defaults: Record<string, FixtureHandler> = {
  'GET /api/config': () => A.config,
  'GET /api/csrf-token': () => ({ csrfToken: 'fixture-csrf-token' }),
  'GET /api/auth/status': () => A.authStatus,
  'GET /api/users/:id/channel-database-permissions': () => ({ data: [] }),
  'GET /api/user/preferences': () => ({ success: true, data: { preferences: A.userPreferences } }),
  'GET /api/settings': () => A.settings,
  'GET /api/admin/layout-usage': () => ({ success: true, data: A.layoutUsage }),
  // Empty lists for the re-hosted Server › General page (r4), which toasts on a 404.
  'GET /api/embed-profiles': () => [],
  'GET /api/channel-database': () => ({ success: true, data: [] }),
  'GET /api/scripts/inventory': () => ({ success: true, data: { scripts: [] } }),
  'GET /api/sources': () => A.sources,
  'GET /api/sources/:id/status': (url) => A.statuses[url.pathname.split('/')[3]],
  'GET /api/unified/status': () => A.unifiedStatus,
  'GET /api/messages/unread-by-source': () => A.unreadBySource,
  'GET /api/messages/unread-counts': () => A.unreadCounts,
  'GET /api/messages/first-unread': () => ({ success: true, data: A.firstUnread }),
  // Older pages for a conversation's scroll-back: the poll already holds them all.
  'GET /api/messages/channel/:channel': () => ({ messages: [], hasMore: false }),
  'GET /api/messages/direct/:a/:b': () => ({ messages: [], hasMore: false }),
  // The DM's traceroute strip: the stored runs it can pick from, and the pair history for Statistical.
  'GET /api/traceroutes/participation/:nodeNum': (url) => {
    const nodeNum = Number(url.pathname.split('/')[4]);
    const entries = A.traceroutes
      .slice(1)
      .filter((r) => r.fromNodeNum === nodeNum || r.toNodeNum === nodeNum)
      .map((r) => ({ ...r, id: r.id!, channel: 0, participation: 'endpoint', hopCount: r.hopCount }));
    return { success: true, data: { entries } };
  },
  // The stored history, plus a run that got no reply (Show failed traceroutes, 15-04).
  'GET /api/traceroutes/history/:from/:to': () => [
    ...A.traceroutes,
    { ...A.traceroutes[0], id: 38, route: 'null', routeBack: 'null', snrTowards: 'null', snrBack: 'null', hopCount: 0,
      timestamp: A.traceroutes[2].timestamp - 3_600_000, createdAt: A.traceroutes[2].timestamp - 3_600_000 },
  ],
  // Share contact on the node page's Admin tab (15-03): today's QR, built on request.
  'GET /api/nodes/:nodeNum/contact-url': () => ({ success: true, data: { url: 'https://meshtastic.org/v/#CgcSBUtpZmlzaWE' } }),
  // Athens Rover's tracked-asset trail (15-02).
  'GET /api/assets/:nodeNum/track': (url) =>
    Number(url.pathname.split('/')[3]) === A.roverTrack.nodeNum ? { success: true, data: A.roverTrack } : undefined,
  'GET /api/nodes/identity-changes': () => ({ success: true, data: { detections: [] } }),
  // The MQTT mirror reads the same mesh as Station G2.
  'GET /api/poll': (url) => {
    const sourceId = url.searchParams.get('sourceId');
    return !sourceId || sourceId === SOURCE_IDS.g2 || sourceId === SOURCE_IDS.mqtt ? A.poll : undefined;
  },
  'GET /api/device/tx-status': () => A.txStatus,
  'POST /api/messages/mark-read': () => ({ success: true }),
  'GET /api/sources/:id/beacon-offers/count': () => ({
    success: true,
    data: { pending: A.beaconOffers.filter((o) => !o.dismissedAt && !o.mutedAt).length, total: A.beaconOffers.length },
  }),
  'GET /api/sources/:id/beacon-offers': () => ({ success: true, data: A.beaconOffers }),
  'GET /api/connection': (url) => {
    const status = A.statuses[url.searchParams.get('sourceId') ?? SOURCE_IDS.g2];
    return status && { ...A.poll.connection, connected: status.connected };
  },
  // Message details (10-02 / 10-10): the stored send timeline; heard-by is for channel sends only.
  'GET /api/sources/:id/messages/:messageId/events': (url) => ({
    success: true,
    data: { events: A.messageEvents.filter((e) => e.messageId === decodeURIComponent(url.pathname.split('/')[5])) },
  }),
  'GET /api/sources/:id/messages/:messageId/heard-by': () => ({ success: true, data: { heardBy: [] } }),
  'GET /api/direct-neighbors': () => ({}),
  'POST /api/translate': () => ({ success: true, data: A.translation }),
  // Message search (10-15 / 10-16): the first page of 31 results; Load more serves it again.
  'GET /api/messages/search': () => ({ success: true, count: A.searchResults.length, total: 31, data: A.searchResults }),
  // Activity (c-home-e4 / e5 / e6): one page per device; Station G2 has five items, the rest none.
  'GET /api/sources/:id/activity': (url) => ({
    success: true,
    data: { items: url.searchParams.has('before') ? [] : (A.activity[url.pathname.split('/')[3]] ?? []), nextBefore: null },
  }),
  // The device map (Main, f2-layers, 15-09): Station G2's neighbour links; no GeoJSON layers.
  'GET /api/sources/:id/neighbor-info': (url) => (url.pathname.split('/')[3] === SOURCE_IDS.g2 ? A.neighborInfo : []),
  'GET /api/geojson/layers': () => [],
  // Today's other node charts and the signal trend (the node page's Telemetry tab and Overview, f4 / f5).
  'GET /api/telemetry/:nodeId/smarthops': () => ({
    success: true,
    data: [0, 1, 2, 3].map((i) => ({ timestamp: Date.now() - i * 3_600_000, minHops: 1, maxHops: 2, avgHops: 1.5 })),
  }),
  'GET /api/telemetry/:nodeId/linkquality': () => ({
    success: true,
    data: [0, 1, 2, 3].map((i) => ({ timestamp: Date.now() - i * 3_600_000, quality: 7 + (i % 2) })),
  }),
  'GET /api/telemetry/:nodeId/signal-trend': () => ({
    success: true,
    data: {
      trend: 'degrading', basis: 'rssi', snr: null, noiseFloor: null, noiseFloorRising: false,
      rssi: { recent: -98, baseline: -92, delta: -6, recentCount: 40, baselineCount: 280, unit: 'dBm' },
    },
  }),
  'GET /api/packets/stats/distribution': () => ({
    enabled: true, total: 64, byDevice: [],
    byType: [
      { portnum: 3, portnum_name: 'POSITION_APP', count: 28 },
      { portnum: 67, portnum_name: 'TELEMETRY_APP', count: 22 },
      { portnum: 1, portnum_name: 'TEXT_MESSAGE_APP', count: 14 },
    ],
  }),
  'GET /api/telemetry/:nodeId': (url) => {
    const nodeId = decodeURIComponent(url.pathname.split('/')[3]);
    return A.telemetry.filter((row) => row.nodeId === nodeId);
  },
};

interface Route {
  method: string;
  path: RegExp;
  handler: FixtureHandler;
}

function compile(table: Partial<Record<string, FixtureHandler>>): Route[] {
  return Object.entries(table).flatMap(([key, handler]) => {
    if (!handler) return [];
    const [method, pattern] = key.split(' ');
    const source = pattern
      .split('/')
      .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/');
    return [{ method: method.toUpperCase(), path: new RegExp(`^${source}$`), handler }];
  });
}

const defaultRoutes = compile(defaults);

export function fixtureApi(
  overrides: Partial<Record<string, FixtureHandler>> = {},
): (url: string, init?: RequestInit) => Response | undefined {
  const routes = [...compile(overrides), ...defaultRoutes];
  return (rawUrl, init) => {
    const url = new URL(rawUrl, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    for (const route of routes) {
      if (route.method !== method || !route.path.test(url.pathname)) continue;
      const body = route.handler(url, init);
      if (body === undefined) continue;
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return undefined;
  };
}
