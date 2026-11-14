/**
 * @vitest-environment jsdom
 *
 * Board 15-03 (desktop): the Admin tab. Today's parts from the DM's node
 * details: the renumbering notice with Merge history…, the key warnings with
 * Clear, Notes, Asset tracking, Remote admin (its link into remote admin),
 * Share contact and the key, PKI, channel, Store & Forward and first-heard
 * facts. It shows only to whoever may open today's remote admin (an admin,
 * RemoteAdminLink's gate); anyone else gets no Admin tab, and its URL shows
 * the Overview.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { g2, kifisia, renumberedFixtures } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `${kifisia}/admin`;
/** A signed-in operator with full rights on Station G2 but not an admin. */
const operator = {
  permissions: {
    bySource: {
      [SOURCE_IDS.g2]: {
        nodes: { read: true, write: true }, messages: { read: true, write: true },
        settings: { read: true, write: true }, security: { read: true, write: true }, traceroute: { read: true, write: true },
      },
    },
  },
};

describe('15-03-admin', () => {
  it('15-03-admin shows the board', async () => {
    const { container } = renderChat(route, { fixtures: renumberedFixtures });
    await screen.findByRole('button', { name: /Merge history…/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Create QR code' }));
    await screen.findByRole('button', { name: /Copy URL/ });
    expectBoard('15-03-admin', container);
  });

  it('an admin (today\'s remote-admin gate) gets the Admin tab and the link into remote admin', async () => {
    renderChat(kifisia);
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }));
    const remote = await screen.findByRole('link', { name: 'Open remote admin for Kifisia Rooftop' });
    const href = new URL(remote.getAttribute('href')!, 'http://localhost');
    expect(href.pathname).toBe(`${g2}/admin`);
    expect(href.searchParams.get('node')).toBe('!a1b2c301');
  });

  it('a non-admin gets no Admin tab, and the Admin URL shows the Overview', async () => {
    renderChat(route, operator);
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(await screen.findByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Notes')).toBeNull();
  });

  it('Save stores the note in MeshMonitor for this device, and sends nothing', async () => {
    renderChat(route, { fixtures: { 'POST /api/nodes/:id/notes': () => ({ success: true }) } });
    const box = await screen.findByRole('textbox', { name: 'Notes' }, { timeout: 5000 });
    expect(screen.getByText(/sends nothing/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'New antenna' } });
    fireEvent.click(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([u, i]) => String(u).includes('/api/nodes/!a1b2c301/notes') && i?.method === 'POST');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ notes: 'New antenna', sourceId: SOURCE_IDS.g2 });
    });
  });
});
