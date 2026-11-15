/**
 * @vitest-environment jsdom
 *
 * Board 18-01-packets-popout (desktop, s18n1): `/packet-monitor` in the
 * Workspace layout is one Meshtastic device's monitor in a window of its own,
 * with today's filters, Capture (sends nothing on the mesh), Pause, Export,
 * Clear (admins, asks first), the raw packet panel, and Close window
 * (today's window.close()); no Pop out.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import PacketsPopout from '../PacketsPopout';

vi.mock('../../../pages/PacketMonitorPage', () => ({ default: () => <div data-testid="classic-popout" /> }));

const fetched = () => vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`);

afterEach(() => localStorage.clear());

async function row(text: string): Promise<HTMLElement> {
  const [cell] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return cell.closest<HTMLElement>('tr')!;
}

const renderWindow = (opts: Parameters<typeof renderWorkspace>[1] = {}) =>
  renderWorkspace(<PacketsPopout />, { route: '/packet-monitor', ...opts, fixtures: { ...captureOn, ...opts.fixtures } });

describe('18-01-packets-popout', () => {
  withRowLayout();

  it('18-01-packets-popout shows the board', async () => {
    renderWindow();
    fireEvent.click(await row('Hearing you direct from Marousi'));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    await screen.findByText('200 shown / 1,284 total');
    expectBoard('18-01-packets-popout', document.body);
  });

  it('is titled with the device, and has no Pop out', async () => {
    renderWindow();
    expect(await screen.findByRole('heading', { name: 'Mesh Traffic Monitor · Station G2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pop out/ })).toBeNull();
    expect(screen.queryByText('GRP_TXT')).toBeNull();
  });

  it('the raw packet panel keeps today\'s relay estimate', async () => {
    renderWindow();
    fireEvent.click(await row('Hearing you direct from Marousi'));
    const panel = await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    fireEvent.click(within(panel).getByRole('button', { name: 'via 0x12' }));
    expect(await screen.findByText('Message Relay Information')).toBeInTheDocument();
  });

  it('Close window closes the window, as today', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    renderWindow();
    await row('Hearing you direct from Marousi');
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });

  it('Clear all packets asks with today\'s words, then clears', async () => {
    renderWindow({ fixtures: { 'DELETE /api/packets': () => ({ message: 'ok', deletedCount: 1284 }) } });
    await row('Hearing you direct from Marousi');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all packets' }));
    const sheet = await screen.findByRole('dialog', { name: 'Clear all packets' });
    expect(sheet).toHaveTextContent('Are you sure you want to clear all packet logs?');
    expect(fetched().some((u) => u.startsWith('DELETE /api/packets'))).toBe(false);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear all packets' }));
    await waitFor(() => expect(fetched().some((u) => u.startsWith('DELETE /api/packets'))).toBe(true));
  });

  it('a non-admin gets today\'s no-permission note: the window has no device context, as today', async () => {
    renderWindow({ permissions: { global: {}, bySource: { [S.g2]: { packetmonitor: { read: true, write: true } } } } });
    expect(await screen.findByText(/You need both channels:read and messages:read/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all packets' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close window' })).toBeInTheDocument();
    expect(fetched().some((u) => u.includes('/api/packets?'))).toBe(false);
  });

  it('today\'s filters reach the server, and Hide Own Packets hides our own heard-back rows', async () => {
    renderWindow();
    await row('Hearing you direct from Marousi');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByDisplayValue('All Transports'), { target: { value: '5' } });
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/packets?') && u.includes('transport_mechanism=5'))).toBe(true));
    expect(screen.getByRole('checkbox', { name: 'Hide Own Packets' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByDisplayValue('All Transports')).toBeInTheDocument();
  });

  it('Export packets to JSONL downloads today\'s export', async () => {
    renderWindow({ fixtures: { 'GET /api/packets/export': () => new Response('', { status: 200 }) } });
    await row('Hearing you direct from Marousi');
    fireEvent.click(screen.getByRole('button', { name: 'Export packets to JSONL' }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/packets/export'))).toBe(true));
  });

  it('a MeshCore device opens today\'s MeshCore window', async () => {
    renderWorkspace(<PacketsPopout />, { route: `/packet-monitor?sourceId=${S.heltec}` });
    expect(await screen.findByTestId('classic-popout')).toBeInTheDocument();
  });
});
