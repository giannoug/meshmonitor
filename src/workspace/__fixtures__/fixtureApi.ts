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
  'GET /api/user/preferences': () => ({ success: true, data: A.userPreferences }),
  'GET /api/settings': () => A.settings,
  'GET /api/sources': () => A.sources,
  'GET /api/sources/:id/status': (url) => A.statuses[url.pathname.split('/')[3]],
  'GET /api/unified/status': () => A.unifiedStatus,
  'GET /api/messages/unread-by-source': () => A.unreadBySource,
  'GET /api/messages/unread-counts': () => A.unreadCounts,
  'GET /api/poll': (url) => {
    const sourceId = url.searchParams.get('sourceId');
    return !sourceId || sourceId === SOURCE_IDS.g2 ? A.poll : undefined;
  },
  'GET /api/connection': (url) => {
    const status = A.statuses[url.searchParams.get('sourceId') ?? SOURCE_IDS.g2];
    return status && { ...A.poll.connection, connected: status.connected };
  },
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
