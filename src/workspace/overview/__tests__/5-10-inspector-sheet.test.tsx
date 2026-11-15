/**
 * @vitest-environment jsdom
 *
 * Board 5-10-inspector-sheet (phone): a tap on a neighbour link (or a node,
 * route segment, trail) opens today's inspector as a sheet docked under the
 * map. It is not modal: the map above stays live, so the next tap inspects
 * the next thing. One sheet at a time: a tool's panel takes its place.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { lineIn, marker, nonGets, ON_24H, openPhoneSheet, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const HINT = 'Tap a node, route segment, neighbour link or trail to inspect it';

async function openNeighbourLink() {
  fireEvent.click(await lineIn('neighbors'));
  const inspector = within(await screen.findByTestId('analysis-inspector'));
  await inspector.findByText('Neighbor Link');
  // The endpoints' terrain, from the elevation service (fixture).
  await waitFor(() => expect(inspector.getByText('Node Elevation').nextElementSibling?.textContent).toMatch(/^\d+ m$/), { timeout: 5000 });
  return inspector;
}

describe('5-10-inspector-sheet', () => {
  it('5-10-inspector-sheet shows the board', async () => {
    const { container } = renderOverview('/overview/map', { phone: true, layers: { neighbors: ON_24H } });
    await openNeighbourLink();
    expectBoard('5-10-inspector-sheet', container);
  });

  it('is docked, not modal: the next tap on the map inspects the next thing', async () => {
    renderOverview('/overview/map', { phone: true, layers: { neighbors: ON_24H } });
    await openNeighbourLink();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(await marker('KFR'));
    const inspector = within(screen.getByTestId('analysis-inspector'));
    expect(await inspector.findByRole('heading', { name: 'Kifisia Rooftop' })).toBeInTheDocument();
    // A node's sheet leads to its Workspace node page.
    expect(inspector.getByRole('link', { name: /Open node page/ })).toHaveAttribute('href', '/source/src-g2/node/!a1b2c301');
  });

  it('Close clears the selection and the hint comes back', async () => {
    renderOverview('/overview/map', { phone: true, layers: { neighbors: ON_24H } });
    const inspector = await openNeighbourLink();
    fireEvent.click(inspector.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByTestId('analysis-inspector')).toBeNull();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('View terrain profile opens the Link Profile in its place (one sheet at a time)', async () => {
    renderOverview('/overview/map', { phone: true, layers: { neighbors: ON_24H } });
    const inspector = await openNeighbourLink();
    fireEvent.click(inspector.getByRole('button', { name: 'View terrain profile' }));
    expect(await screen.findByTestId('link-profile-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('analysis-inspector')).toBeNull();
    // The terrain is a server read (elevation service); nothing goes on the mesh.
    expect(nonGets().every((u) => u.includes('/api/elevation/profile'))).toBe(true);
  });

  it('while GNSS DOP holds the bottom, a tap shows why nothing opens', async () => {
    renderOverview('/overview/map', { phone: true });
    const layers = within(await openPhoneSheet('Layers'));
    fireEvent.click(layers.getByRole('switch', { name: 'GNSS DOP' }));
    fireEvent.click(layers.getByRole('button', { name: 'Close' }));
    fireEvent.click(await marker('KFR'));
    expect(screen.getByText('Close GNSS DOP to inspect a node, route segment, neighbour link or trail')).toBeInTheDocument();
    expect(screen.queryByTestId('analysis-inspector')).toBeNull();
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
