/**
 * A stateful `/api/user/preferences` for tests that write preferences: PUTs
 * land in `prefs` (and are logged in `puts`), and the next GET returns them.
 */
import type { FixtureHandler } from './fixtureApi';

export function prefsFixture(initial: Record<string, unknown> = {}) {
  const prefs: Record<string, unknown> = { ...initial };
  const puts: Array<[string, unknown]> = [];
  const fixtures: Record<string, FixtureHandler> = {
    'GET /api/user/preferences': () => ({ success: true, data: { preferences: { ...prefs } } }),
    'PUT /api/user/preferences/:key': (url, init) => {
      const key = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const { value } = JSON.parse(String(init?.body)) as { value: unknown };
      prefs[key] = value;
      puts.push([key, value]);
      return { success: true, data: { key, value } };
    },
  };
  return { prefs, puts, fixtures };
}
