/**
 * @vitest-environment jsdom
 *
 * Board 5-08-overview-map (phone): the all-devices map full screen under the
 * tab bar, with Back to the Overview Home and the search pill. Task 4.1 builds
 * this frame; Tools, Time, the Traceroutes / Neighbours chips and the
 * inspector hint are the Analysis tools of Tasks 4.2 / 4.3 (s5n1), which own
 * the full expectBoard.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import WorkspaceApp from '../../WorkspaceApp';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('5-08-overview-map', () => {
  it.each(['/', '/overview/map'])('%s on a phone is the full-screen map: Back, the search pill, no device header', async (route) => {
    renderWorkspace(<WorkspaceApp />, { route, phone: true });
    // The map's chunk holds today's Map Analysis canvas (Task 4.2): a cold load can take over a second in jsdom.
    expect(await screen.findByRole('searchbox', { name: 'Filter nodes' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/overview');
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('aria-current', 'page');
  });
});
