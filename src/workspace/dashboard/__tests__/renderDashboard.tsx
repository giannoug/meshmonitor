/**
 * Renders Station G2's Dashboard the way the Workspace does (shell +
 * WorkspaceSource) against `dashboardFixtures`. Each test file mocks the socket
 * and App itself:
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
 *   vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
 */
import { onTestFinished, vi } from 'vitest';
import { configure, screen, waitFor } from '@testing-library/react';
import { renderChat } from '../../chat/__tests__/renderChat';
import type { RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { dashboardFixtures, type DashboardFixtureOptions, type DashboardLog } from '../../__fixtures__/dashboard';

export const G2 = '/source/src-g2';

// The page loads lazily and runs today's hooks: give the first find more than a second.
configure({ asyncUtilTimeout: 4000 });

export function renderDashboard(route = `${G2}/dashboard`, opts: RenderWorkspaceOptions & { dashboard?: DashboardFixtureOptions } = {}) {
  const log: DashboardLog = { writes: [] };
  onTestFinished(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  Element.prototype.scrollIntoView ??= () => {};
  const fixtures = { ...dashboardFixtures(log, opts.dashboard), ...opts.fixtures };
  const view = renderChat(route, { ...opts, fixtures });
  return { ...view, log, fixtures };
}

/** Requests the page made with `method` to a path matching `path` (counted from the fetch mock). */
export function requests(method: string, path: string | RegExp, search?: string): number {
  return vi.mocked(fetch).mock.calls.filter(([u, i]) => {
    const m = (i?.method ?? 'GET').toUpperCase();
    const url = new URL(String(u), 'http://localhost');
    const p = url.pathname;
    return m === method && (typeof path === 'string' ? p === path : path.test(p)) && (search === undefined || url.search.includes(search));
  }).length;
}

/** The board has loaded: its widgets and the strip are drawn. */
export async function boardLoaded(): Promise<void> {
  await screen.findByText('Nodes online');
  await screen.findByText('Node Status');
  await waitFor(() => {
    if ((screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled) throw new Error('Edit is not enabled yet');
  });
}
