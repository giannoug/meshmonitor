/**
 * @vitest-environment jsdom
 *
 * The admin's default landing page through the real Workspace routes: `/`
 * jumps to it, the Overview's own URLs do not (Classic's "Sources" button
 * rule, Task 4.1).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture } from '../../__fixtures__/athens';
import WorkspaceApp from '../../WorkspaceApp';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function RealUrl() {
  const { pathname } = useLocation();
  return <output data-testid="real-url">{pathname}</output>;
}

const reports = { 'GET /api/settings': () => ({ ...athensFixture.settings, defaultLandingPage: 'reports' }) };
const renderAt = (route: string) =>
  renderWorkspace(
    <>
      <WorkspaceApp />
      <RealUrl />
    </>,
    { route, fixtures: reports },
  );
const realUrl = () => screen.getByTestId('real-url').textContent;

beforeEach(() => localStorage.clear());

describe('default landing page through the Workspace routes', () => {
  it('/ moves to the landing page', async () => {
    renderAt('/');
    // The lazy map chunk, the sources and the settings all load first.
    await waitFor(() => expect(realUrl()).toBe('/reports'), { timeout: 5000 });
  });

  it.each(['/overview', '/overview/map'])('%s stays once the sources and the setting have loaded', async (route) => {
    renderAt(route);
    // Sources resolved: the sidebar lists the devices.
    await within(await screen.findByRole('list', { name: 'Devices' })).findByText('Station G2');
    // The setting resolved: SettingsContext stores the server's value.
    await waitFor(() => expect(localStorage.getItem('defaultLandingPage')).toBe('reports'), { timeout: 5000 });
    // Two ticks later it is still there: the landing hook had its chance and did not move.
    await waitFor(() => expect(realUrl()).toBe(route));
    await waitFor(() => expect(realUrl()).toBe(route));
  });
});
