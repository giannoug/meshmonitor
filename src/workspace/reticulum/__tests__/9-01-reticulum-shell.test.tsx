/**
 * @vitest-environment jsdom
 *
 * Boards 9-01 (desktop), 9-09 (phone Home) and 9-10 (phone thread): a
 * Reticulum node's shell (sidebar, status line) and an LXMF conversation,
 * native (Task 7.6). Send is today's one POST per press, with its Sends line.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RNS } from '../../__fixtures__/reticulum';
import { RNS_URL, renderReticulum, rnsRequests } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const KIFISIA = `${RNS_URL}/dm/${RNS.kifisia}`;
const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));

describe('9-01-reticulum-shell', () => {
  it('9-01-reticulum-shell shows the board', async () => {
    const { container } = renderReticulum(KIFISIA);
    await screen.findByText('Bringing water either way');
    await screen.findByText('38 destinations · 4 interfaces');
    expectBoard('9-01-reticulum-shell', container);
  });

  it('the sidebar lists Map, Destinations, Dashboard, More tools… and LXMF MESSAGES, with no New conversation', async () => {
    renderReticulum(KIFISIA);
    const sidebar = await screen.findByRole('complementary', { name: 'Reticulum node' });
    await within(sidebar).findByText('Marousi Sideband');
    expect(within(sidebar).getByRole('link', { name: 'Map' })).toHaveAttribute('href', `${RNS_URL}/map`);
    expect(within(sidebar).getByRole('link', { name: /Destinations\s*38/ })).toHaveAttribute('href', `${RNS_URL}/destinations`);
    expect(within(sidebar).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', `${RNS_URL}/dashboard`);
    expect(within(sidebar).getByText('LXMF messages')).toBeInTheDocument();
    // A peer that never announced shows its hash.
    expect(within(sidebar).getByText('<a91c…2f07>')).toBeInTheDocument();
    expect(within(sidebar).queryByText(/new conversation/i)).toBeNull();
    expect(within(sidebar).getByText('Connected · own')).toBeInTheDocument();
    fireEvent.click(within(sidebar).getByRole('button', { name: /More tools/ }));
    expect(within(sidebar).getByRole('link', { name: 'Interfaces' })).toHaveAttribute('href', `${RNS_URL}/interfaces`);
    expect(within(sidebar).getByRole('link', { name: 'Paths' })).toHaveAttribute('href', `${RNS_URL}/paths`);
    expect(within(sidebar).getByRole('link', { name: 'Info' })).toHaveAttribute('href', `${RNS_URL}/info`);
    expect(within(sidebar).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', `${RNS_URL}/settings`);
  });

  it('Send shows "Sends 1 LXMF message" and sends one message per press, with no retry', async () => {
    const { log } = renderReticulum(KIFISIA);
    await screen.findByText('Bringing water either way');
    expect(screen.getByText(/Sends 1 LXMF message to Kifisia Sideband · 2 hops via Halandri Transport/)).toBeInTheDocument();
    const box = screen.getByPlaceholderText('Type a message…');
    await waitFor(() => expect(box).toBeEnabled());
    fireEvent.change(box, { target: { value: 'See you at 3' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('See you at 3');
    await pause();
    const sends = log.writes.filter((w) => w.path.endsWith('/reticulum/messages'));
    expect(sends).toEqual([{ method: 'POST', path: `/api/sources/src-rns/reticulum/messages`, body: { to: RNS.kifisia, content: 'See you at 3' } }]);
  });

  it('a failed send shows Failed and is not retried', async () => {
    const { log } = renderReticulum(KIFISIA, {
      fixtures: { 'POST /api/sources/:id/reticulum/messages': () => new Response(JSON.stringify({ success: false, error: 'Not connected' }), { status: 409 }) },
    });
    await screen.findByText('Bringing water either way');
    const box = screen.getByPlaceholderText('Type a message…');
    await waitFor(() => expect(box).toBeEnabled());
    fireEvent.change(box, { target: { value: 'Anyone?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('Anyone?');
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(2));
    await pause();
    expect(rnsRequests('POST', '/reticulum/messages')).toBe(1);
    expect(log.writes).toHaveLength(0);
  });

  it('the status line: an error replaces it with Retry, which re-reads once per press', async () => {
    renderReticulum(`${RNS_URL}/destinations`, {
      fixtures: { 'GET /api/sources/:id/reticulum/paths': () => new Response(JSON.stringify({ error: 'Bridge offline' }), { status: 503 }) },
    });
    const retry = await screen.findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(retry).toBeEnabled());
    const before = rnsRequests('GET', '/reticulum/status');
    fireEvent.click(retry);
    await waitFor(() => expect(rnsRequests('GET', '/reticulum/status')).toBe(before + 1));
    await pause();
    expect(rnsRequests('GET', '/reticulum/status')).toBe(before + 1);
  });

  it('without nodes:read the body is today\'s permission note and nothing polls', async () => {
    renderReticulum(`${RNS_URL}/destinations`, {
      permissions: { bySource: { 'src-rns': { connection: { read: true, write: false } } } },
    });
    expect(await screen.findByText('You do not have permission to view this Reticulum source.')).toBeInTheDocument();
    await pause();
    expect(rnsRequests('GET', /./)).toBe(0);
  });

  it('9-09-reticulum-home shows the board', async () => {
    const { container } = renderReticulum(RNS_URL, { phone: true });
    await screen.findByText('Kifisia Sideband');
    expect(screen.getByText(/Connected · own · 4 interfaces/)).toBeInTheDocument();
    expectBoard('9-09-reticulum-home', container);
  });

  it('9-09: Tools opens Interfaces, Paths and Info; the gear opens Settings', async () => {
    renderReticulum(RNS_URL, { phone: true });
    await screen.findByText('Kifisia Sideband');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', `${RNS_URL}/settings`);
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(await screen.findByRole('menuitem', { name: 'Interfaces' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Paths' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Info' })).toBeInTheDocument();
  });

  it('9-10-lxmf-thread shows the board', async () => {
    const { container } = renderReticulum(KIFISIA, { phone: true });
    await screen.findByText('Bringing water either way');
    expectBoard('9-10-lxmf-thread', container);
    // The conversation opens from Home's LXMF MESSAGES: Home stays lit (9-10).
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'DMs' })).not.toHaveAttribute('aria-current');
  });

  it('LXMF has no byte budget: the composer shows no byte counter, and a long message still sends', async () => {
    const { container, log } = renderReticulum(KIFISIA);
    await screen.findByText('Bringing water either way');
    expect(container.querySelector('.byte-counter')).toBeNull();
    expect(screen.queryByText(/\/200$/)).toBeNull();
    const box = screen.getByPlaceholderText('Type a message…');
    await waitFor(() => expect(box).toBeEnabled());
    fireEvent.change(box, { target: { value: 'x'.repeat(300) } });
    expect(screen.queryByText(/\/200$/)).toBeNull();
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(log.writes).toHaveLength(1));
  });

  it('a malformed peer in the URL opens the conversations instead of failing', async () => {
    renderReticulum(`${RNS_URL}/dm/%E0%A4%A`);
    expect(await screen.findByRole('heading', { level: 1, name: 'LXMF messages' })).toBeInTheDocument();
  });
});
