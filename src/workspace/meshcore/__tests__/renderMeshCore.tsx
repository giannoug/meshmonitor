/**
 * Renders a Heltec MeshCore URL the way the Workspace does (shell +
 * WorkspaceSource) against the section 8 fixture (`meshcoreFixtures`). Each test
 * file mocks the socket itself (useMeshCore reads the socket from its context):
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
 *     ...(await orig<object>()),
 *     WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
 *     useWebSocketContext: () => ({ state: { socket: null } }),
 *   }));
 */
import { onTestFinished, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { renderChat } from '../../chat/__tests__/renderChat';
import type { RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { resetReadStateCache } from '../../../components/MeshCore/meshcoreUnreadStore';
import { meshcoreFixtures, type MeshCoreFixtureOptions, type MeshCoreLog } from '../../__fixtures__/meshcore';

export const HELTEC = '/source/src-heltec';

// The screens load lazily and run today's hooks: give the first find more than a second.
configure({ asyncUtilTimeout: 4000 });

export function renderMeshCore(route: string, opts: RenderWorkspaceOptions & { meshcore?: MeshCoreFixtureOptions } = {}) {
  const log: MeshCoreLog = { writes: [] };
  // Read marks are per browser: each test starts from the fixture's (and a console's transcript, sessionStorage, empty).
  onTestFinished(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetReadStateCache();
  });
  // jsdom: no scrolling.
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderChat(route, { ...opts, fixtures: { ...meshcoreFixtures(log, opts.meshcore), ...opts.fixtures } });
  return { ...view, log };
}

/** Requests the page made to `path` with `method` (counted from the fetch mock). */
export function requests(method: string, path: string | RegExp): number {
  return vi.mocked(fetch).mock.calls.filter(([u, i]) => {
    const m = (i?.method ?? 'GET').toUpperCase();
    const p = new URL(String(u), 'http://localhost').pathname;
    return m === method && (typeof path === 'string' ? p === path : path.test(p));
  }).length;
}
