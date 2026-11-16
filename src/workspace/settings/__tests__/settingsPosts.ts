/** What the In MeshMonitor pages wrote, read from the stubbed fetch (Task 5.8 tests). */
import { vi } from 'vitest';
import type { Rows } from './meshmonitorFixtures';

/** Every `POST /api/settings` sent so far: its scope and body. */
export const posted = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([u, init]) => init?.method === 'POST' && new URL(String(u), 'http://x').pathname === '/api/settings')
    .map(([u, init]) => {
      const url = new URL(String(u), 'http://x');
      return { path: url.pathname, sourceId: url.searchParams.get('sourceId'), body: JSON.parse(String(init?.body)) as Rows };
    });
