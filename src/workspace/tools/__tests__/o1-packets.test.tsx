/**
 * @vitest-environment jsdom
 *
 * Boards o1-packets (desktop), q2-packets and q3-packet (phone): Station G2's
 * packet monitor (Task 8.5; note ds12) on today's hook: the table with a
 * column picker, type chips over today's filters, Pause, Export, Pop out,
 * Clear (admins, asks first), capture, and the packet's panel / sheet with
 * Copy JSON and Show sender. Opening it sends nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { expectBoard } from '../../test/boardChecks';
import { fetched, G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const ROUTE = `${G2}/packetmonitor`;

async function row(text: string): Promise<HTMLElement> {
  const [cell] = await screen.findAllByText(text);
  return (cell.closest('tr') ?? cell.closest('button')) as HTMLElement;
}

describe('o1-packets', () => {
  withRowLayout();

  it('o1-packets shows the board', async () => {
    const { container } = renderTools(ROUTE);
    fireEvent.click(await row('Nikos T-Echo'));
    await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    // The sidebar keeps More tools… open on a tool page.
    expect(screen.getByRole('button', { name: /More tools/ })).toHaveAttribute('aria-expanded', 'true');
    expectBoard('o1-packets', container);
  });

  it('q2-packets shows the board', async () => {
    const { container } = renderTools(ROUTE, { phone: true });
    await screen.findAllByText('Nikos T-Echo');
    expect(screen.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', `${G2}/tools`);
    expectBoard('q2-packets', container);
  });

  it('q3-packet shows the board: one sheet, Copy JSON and Show sender at its foot; Escape closes it', async () => {
    renderTools(ROUTE, { phone: true });
    fireEvent.click(await row('Nikos T-Echo'));
    const sheet = await screen.findByRole('dialog', { name: 'Raw packet #4821' });
    expectBoard('q3-packet', sheet);
    expect(within(sheet).getByRole('button', { name: 'Show sender' })).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Raw packet #4821' })).toBeNull());
  });

  it('opening the monitor reads today\'s packet query and sends nothing', async () => {
    renderTools(ROUTE);
    await screen.findAllByText('Nikos T-Echo');
    expect(fetched().some((r) => r.startsWith('GET /api/packets?') && r.includes('sourceId=src-g2'))).toBe(true);
    expect(nonGets()).toEqual([]);
  });

  it('the column picker shows any of today\'s columns; the choice is kept in this browser', async () => {
    renderTools(ROUTE);
    await screen.findAllByText('Nikos T-Echo');
    const table = screen.getByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'RSSI' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    for (const name of ['Dir', 'Via', 'Date', 'Time', 'From', 'To', 'Type', 'Slot', 'SNR', 'RSSI', 'Hops', 'Last Hop', 'Size', 'Content']) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('checkbox', { name: 'RSSI' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Last Hop' }));
    expect(within(table).getByRole('columnheader', { name: 'RSSI' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Last Hop' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('workspace.packetColumns')!)).toContain('rssi');
  });

  it('a type chip sets today\'s type filter; Encrypted sets the encrypted one; All clears both', async () => {
    renderTools(ROUTE);
    await screen.findAllByText('Nikos T-Echo');
    const chips = screen.getByRole('group', { name: 'Type' });
    fireEvent.click(within(chips).getByRole('button', { name: 'Text' }));
    await waitFor(() => expect(fetched().some((r) => r.startsWith('GET /api/packets?') && r.includes('portnum=1'))).toBe(true));
    expect(within(chips).getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(chips).getByRole('button', { name: 'Encrypted' }));
    await waitFor(() => expect(fetched().some((r) => r.startsWith('GET /api/packets?') && r.includes('encrypted=true'))).toBe(true));
    fireEvent.click(within(chips).getByRole('button', { name: 'All' }));
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    // Today's whole filter set stays behind Filters.
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    for (const text of ['All Types', 'All Transports', 'Hide Own Packets', 'Clear Filters']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('Clear all packets asks first with today\'s words, then sends one DELETE; a viewer who is not an admin has no Clear', async () => {
    renderTools(ROUTE);
    await screen.findAllByText('Nikos T-Echo');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all packets' }));
    const sheet = await screen.findByRole('dialog', { name: 'Clear all packets' });
    expect(sheet).toHaveTextContent('Are you sure you want to clear all packet logs?');
    expect(sheet).toHaveTextContent('Sends nothing on the mesh');
    expect(nonGets()).toEqual([]);
    const confirm = within(sheet).getByRole('button', { name: 'Clear all packets' });
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(nonGets().filter((r) => r.startsWith('DELETE /api/packets'))).toHaveLength(1));
  });

  it('Pop out opens today\'s window; Pause is client-side only', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderTools(ROUTE);
    await screen.findAllByText('Nikos T-Echo');
    fireEvent.click(screen.getByRole('button', { name: 'Pop out to new window' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/packet-monitor'), '_blank', 'width=1200,height=800');
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-scroll' }));
    expect(screen.getByText(/Paused ·/)).toBeInTheDocument();
    expect(nonGets()).toEqual([]);
  });

  it('on the phone every head control stays reachable under ⋯', async () => {
    renderTools(ROUTE, { phone: true });
    await screen.findAllByText('Nikos T-Echo');
    fireEvent.click(screen.getByRole('button', { name: 'More packet actions' }));
    for (const name of ['Filters', 'Export packets to JSONL', 'Pop out to new window', 'Stop capturing', 'Clear all packets']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('with capture off it says so above what is stored', async () => {
    renderTools(ROUTE, { fixtures: { 'GET /api/packets/stats': () => ({ total: 0, enabled: false }) } });
    expect(await screen.findByText(/Packet logging is off/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start capturing' }).length).toBeGreaterThan(0);
  });

  it('without packetmonitor:read the URL is not the monitor', async () => {
    renderTools(ROUTE, { permissions: { bySource: { 'src-g2': { nodes: { read: true, write: false } } } } });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull());
    expect(fetched().some((r) => r.startsWith('GET /api/packets?'))).toBe(false);
  });
});
