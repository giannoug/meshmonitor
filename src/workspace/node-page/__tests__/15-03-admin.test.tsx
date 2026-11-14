/**
 * @vitest-environment jsdom
 *
 * Board 15-03 (desktop): the Admin tab. Today's parts from the DM's node
 * details: the renumbering notice with Merge history…, the key warnings with
 * Clear, Notes, Asset tracking, Remote admin (its link into remote admin),
 * Share contact and the key, PKI, channel, Store & Forward and first-heard
 * facts. The tab shows to anyone who can read the node (Ruling BE); each part
 * keeps Classic's own gate, and only the link into remote admin needs an admin.
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
/** Signed-in non-admins on Station G2: one with nodes:write, one who can only read. */
const writer = { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: true }, messages: { read: true, write: false } } } } };
const reader = { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false }, messages: { read: true, write: false } } } } };

describe('15-03-admin', () => {
  it('15-03-admin shows the board', async () => {
    const { container } = renderChat(route, { fixtures: renumberedFixtures });
    await screen.findByRole('button', { name: /Merge history…/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Create QR code' }));
    await screen.findByRole('button', { name: /Copy URL/ });
    expectBoard('15-03-admin', container);
  });

  it('an admin sees everything: the link into remote admin, editable notes and channel, asset tracking', async () => {
    renderChat(route);
    const remote = await screen.findByRole('link', { name: 'Open remote admin for Kifisia Rooftop' }, { timeout: 5000 });
    const href = new URL(remote.getAttribute('href')!, 'http://localhost');
    expect(href.pathname).toBe(`${g2}/admin`);
    expect(href.searchParams.get('node')).toBe('!a1b2c301');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Track this node as an asset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create QR code' })).toBeInTheDocument();
  });

  it('a non-admin with nodes:write gets the Admin tab and edits notes, but no link into remote admin', async () => {
    renderChat(kifisia, writer);
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }));
    expect(await screen.findByRole('textbox', { name: 'Notes' })).not.toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByText('Remote Admin')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open remote admin/ })).toBeNull();
    // Asset tracking needs settings:write: today's read-only line.
    expect(screen.queryByRole('switch', { name: 'Track this node as an asset' })).toBeNull();
  });

  it('a read-only viewer sees the note and the channel, with no edit controls', async () => {
    renderChat(route, reader);
    const notes = within(await screen.findByRole('region', { name: 'Notes' }, { timeout: 5000 }));
    expect(notes.getByText(/Antenna swapped to the 5 dBi/)).toBeInTheDocument();
    expect(notes.queryByRole('textbox')).toBeNull();
    expect(notes.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByText('0 (LongFast)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open remote admin/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Track this node as an asset' })).toBeNull();
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
