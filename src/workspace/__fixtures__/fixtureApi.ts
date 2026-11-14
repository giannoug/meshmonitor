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
  'GET /api/traceroutes/history/:from/:to': () => A.traceroutes,
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
