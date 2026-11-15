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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import WorkspaceApp from '../../WorkspaceApp';
import { marker, nonGets, ON_24H, openPhoneSheet, renderOverview } from './renderOverview';

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

const HINT = 'Tap a node, route segment, neighbour link or trail to inspect it';

/** Task 4.3 (Ruling CA): the board's Analysis frame — Tools, Time, Layers, the chips and the inspect hint. */
describe('5-08-overview-map: Analysis on the phone', () => {
  it('5-08-overview-map shows the board', async () => {
    const { container } = renderOverview('/overview/map', { phone: true, layers: { traceroutes: ON_24H, neighbors: ON_24H } });
    await screen.findByText(HINT, {}, { timeout: 5000 });
    expectBoard('5-08-overview-map', container);
  });

  it('the bar under the map: Tools, Time, Layers with the count of analysis layers on, and Zoom to fit', async () => {
    renderOverview('/overview/map', { phone: true, layers: { traceroutes: ON_24H, neighbors: ON_24H } });
    const bar = within(await screen.findByRole('toolbar', { name: 'Map tools' }, { timeout: 5000 }));
    expect(bar.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
    expect(bar.getByRole('button', { name: 'Time' })).toBeInTheDocument();
    expect(bar.getByRole('button', { name: 'Layers, 2 on' })).toHaveTextContent('Layers2');
    await waitFor(() => expect(bar.getByRole('button', { name: 'Zoom to fit all nodes' })).toBeEnabled(), { timeout: 5000 });
    // The chips: each analysis layer that is on, with its lookback and its off switch.
    expect(screen.getByRole('button', { name: 'Turn off Traceroutes' })).toBeInTheDocument();
  });

  it('Tools and Time open the one Tools sheet; Layers opens the Layers sheet', async () => {
    renderOverview('/overview/map', { phone: true });
    fireEvent.click(within(await openPhoneSheet('Tools')).getByRole('button', { name: 'Close' }));
    fireEvent.click(within(await openPhoneSheet('Time')).getByRole('button', { name: 'Close' }));
    expect(within(await openPhoneSheet('Layers')).getByRole('heading', { name: 'Analysis' })).toBeInTheDocument();
  });

  it('the hint gives way to the inspector when a node is tapped', async () => {
    renderOverview('/overview/map', { phone: true });
    await screen.findByText(HINT, {}, { timeout: 5000 });
    fireEvent.click(await marker('KFR'));
    expect(await screen.findByTestId('analysis-inspector')).toBeInTheDocument();
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('opening the phone map and its sheets sends nothing', async () => {
    renderOverview('/overview/map', { phone: true, layers: { traceroutes: ON_24H } });
    await openPhoneSheet('Layers');
    expect(nonGets()).toEqual([]);
  });
});
