/**
 * @vitest-environment jsdom
 *
 * Board 15-04 (desktop): the Links tab. Today's traceroute strip (the last
 * route from this device, with its copy links), today's traceroute history
 * (Show failed traceroutes, forward and return with SNR and distance), and the
 * node's own neighbour report with today's Purge: no new gate (s15n4), today's
 * confirm words, the same request.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `${kifisia}/links`;
const history = () => screen.findByRole('region', { name: 'Traceroute History' }, { timeout: 5000 });

describe('15-04-traceroute-history', () => {
  it('15-04-traceroute-history shows the board', async () => {
    const { container } = renderChat(route);
    await within(await history()).findByText(/Showing 4 traceroute/);
    await screen.findByText(/Last traced/);
    expectBoard('15-04-traceroute-history', container);
  });

  it('Show failed traceroutes hides the run that got no reply', async () => {
    renderChat(route);
    const card = within(await history());
    await card.findByText(/Showing 4 traceroute/);
    fireEvent.click(card.getByRole('checkbox', { name: 'Show failed traceroutes' }));
    expect(await card.findByText(/Showing 3 traceroute/)).toBeInTheDocument();
  });

  it('Purge asks with today\'s words, then deletes the neighbour report (no gate in the UI, as today)', async () => {
    renderChat(route, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false }, messages: { read: true, write: false } } } },
      fixtures: { 'DELETE /api/nodes/:id/neighbors': () => ({ success: true }) },
    });
    const section = await screen.findByRole('region', { name: 'Neighbor Info' }, { timeout: 5000 });
    fireEvent.click(within(section).getByRole('button', { name: /Purge/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Purge' });
    expect(sheet).toHaveTextContent('Are you sure you want to delete all neighbor info for this node?');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Purge' }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([u, i]) => String(u).includes('/api/nodes/!a1b2c301/neighbors') && i?.method === 'DELETE')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Neighbor Info' })).toBeNull());
  });
});
