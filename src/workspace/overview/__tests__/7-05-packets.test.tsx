/**
 * @vitest-environment jsdom
 *
 * Board 7-05-packets (desktop, s7n0–s7n2): Overview › Packets: today's
 * cross-source stream with a device tag per row, Capture (server-side logging,
 * sends nothing on the mesh), Pause, the By source / By device / By type
 * charts, today's filters, the four columns right of Content behind the
 * "4 more columns" cue, and the raw packet panel.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import { renderMessages, type MessagesOptions } from './renderMessages';

const renderPage = (route: string, opts: MessagesOptions = {}) =>
  renderMessages(route, { ...opts, fixtures: { ...captureOn, ...opts.fixtures } });

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const fetched = () => vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`);
const bodyOf = (method: string, path: string) =>
  vi.mocked(globalThis.fetch).mock.calls
    .filter(([u, init]) => (init?.method ?? 'GET') === method && String(u).includes(path))
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')));

async function row(text: string): Promise<HTMLElement> {
  const [cell] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return cell.closest<HTMLElement>('tr')!;
}

async function openFilters() {
  await row('Hearing you direct from Marousi');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  return screen.findByRole('group', { name: 'Transport' });
}

describe('7-05-packets', () => {
  withRowLayout();

  it('7-05-packets shows the board', async () => {
    renderPage('/overview/packets');
    await openFilters();
    fireEvent.click(await row('Hearing you direct from Marousi'));
    await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    await within(screen.getByRole('region', { name: 'By Device' })).findByText('96');
    expectBoard('7-05-packets', document.body);
  });

  it('a row carries its device tag, direction, transport and type', async () => {
    renderPage('/overview/packets');
    const first = await row('Hearing you direct from Marousi');
    expect(first).toHaveTextContent(/^1SGRXLoRa.*Nikos T-Echo.*BroadcastTEXT_MESSAGE_APP/);
    expect((await row('Battery 71 %, 3.88 V'))).toHaveTextContent('RRRXUDP');
  });

  it('the raw packet panel shows the columns right of Content, the time to the millisecond, and the full JSON', async () => {
    renderPage('/overview/packets');
    fireEvent.click(await row('Hearing you direct from Marousi'));
    const panel = await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    expect(panel).toHaveTextContent('“Hearing you direct from Marousi”');
    expect(panel).toHaveTextContent('SourceSGStation G2');
    expect(panel).toHaveTextContent(/Time10:42:31\.402/);
    expect(panel).toHaveTextContent('Slot0');
    expect(panel).toHaveTextContent('RSSI-95 dBm');
    expect(panel).toHaveTextContent('Hops2/3 · via 0x12');
    expect(panel).toHaveTextContent('Size58 B');
    expect(within(panel).getByText('Packet Details (Full JSON)')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary', { name: /Raw packet/ })).toBeNull();
  });

  it('the relay link in the panel opens today\'s relay estimate, with the direct-neighbour stats', async () => {
    renderPage('/overview/packets');
    fireEvent.click(await row('Hearing you direct from Marousi'));
    const panel = await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    fireEvent.click(within(panel).getByRole('button', { name: 'via 0x12' }));
    expect(await screen.findByText('Message Relay Information')).toBeInTheDocument();
    // The packet's own device's direct neighbours, not every readable device's pooled.
    expect(fetched().some((u) => u.includes('/api/direct-neighbors?hours=24&sourceId=src-g2'))).toBe(true);
  });

  it('the panel shows today\'s packet markers: XEdDSA signed, decrypted by device or server, and the spoof warning', async () => {
    renderPage('/overview/packets');
    fireEvent.click(await row('Hearing you direct from Marousi'));
    const signed = await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    expect(signed).toHaveTextContent('Signed packet: XEdDSA signature verified by the device (firmware 2.8+)');
    expect(signed).toHaveTextContent('Decrypted by device');
    expect(signed).not.toHaveTextContent('Possible impersonation');
    fireEvent.click(await row('Hymettus Relay · RAK4631'));
    const spoofed = await screen.findByRole('complementary', { name: 'Raw packet #4815' });
    expect(spoofed).toHaveTextContent('Possible impersonation: claims your node id but arrived over RF');
    expect(spoofed).toHaveTextContent('Decrypted by server (channel database)');
  });

  it('a spoofed row keeps today\'s alert cue in Dir, with today\'s title', async () => {
    renderPage('/overview/packets');
    const spoofed = await row('Hymettus Relay · RAK4631');
    const cue = within(spoofed).getByRole('img', { name: 'Possible impersonation: claims your node id but arrived over RF' });
    expect(cue).toHaveAttribute('title', 'Possible impersonation: claims your node id but arrived over RF');
    expect(spoofed).not.toHaveTextContent(/RXLoRa/);
  });

  it('type badges take their family\'s colour; MeshCore and encrypted types stay muted', async () => {
    renderPage('/overview/packets');
    const badge = async (text: string, type: string) => within(await row(text)).getByText(type);
    expect(await badge('Hearing you direct from Marousi', 'TEXT_MESSAGE_APP')).toHaveAttribute('data-family', 'text');
    expect(await badge('Battery 87 %, 4.02 V', 'TELEMETRY_APP')).toHaveAttribute('data-family', 'telemetry');
    expect(await badge('Request', 'TRACEROUTE_APP')).toHaveAttribute('data-family', 'traceroute');
    expect(await badge('Hymettus Relay · RAK4631', 'NODEINFO_APP')).toHaveAttribute('data-family', 'nodeinfo');
    expect(await badge('38.03, 23.80', 'POSITION_APP')).toHaveAttribute('data-family', 'position');
    expect(await badge('Heading to the beach', 'GRP_TXT')).not.toHaveAttribute('data-family');
    const encrypted = (await row('Penteli Hiker')).querySelector('[data-family]');
    expect(encrypted).toBeNull();
  });

  it('Stop capturing turns server-side logging off, and the button becomes Start capturing', async () => {
    renderPage('/overview/packets', { fixtures: { 'POST /api/settings': () => ({ success: true }) } });
    await row('Hearing you direct from Marousi');
    expect(screen.getByText(/sends nothing on the mesh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop capturing' }));
    expect(await screen.findByRole('button', { name: 'Start capturing' })).toBeInTheDocument();
    expect(bodyOf('POST', '/api/settings')).toEqual([{ packet_log_enabled: '0' }]);
  });

  it('Capture needs settings:write, as today', async () => {
    renderPage('/overview/packets', {
      permissions: { global: {}, bySource: { [S.g2]: { packetmonitor: { read: true, write: false } } } },
    });
    await row('Hearing you direct from Marousi');
    expect(screen.queryByRole('button', { name: /capturing/ })).toBeNull();
  });

  it('Pause stops the stream, and reads Resume', async () => {
    renderPage('/overview/packets');
    await row('Hearing you direct from Marousi');
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-scroll' }));
    expect(screen.getByRole('button', { name: 'Resume auto-scroll' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Paused/)).toBeInTheDocument();
  });

  it('the transport and encryption filters ask the server for those packets, and Clear Filters resets them', async () => {
    renderPage('/overview/packets');
    const transport = await openFilters();
    fireEvent.click(within(transport).getByRole('button', { name: 'MQTT' }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/unified/packets') && u.includes('transport_mechanism=5'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Encrypted Only' }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/unified/packets') && u.includes('encrypted=true'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(within(transport).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a MeshCore filter and a Meshtastic type together say they match nothing', async () => {
    renderPage('/overview/packets');
    await openFilters();
    fireEvent.change(screen.getByRole('combobox', { name: 'Meshtastic type' }), { target: { value: '1' } });
    // The new query has no reply yet, and its source list drives the MeshCore filters (today's behaviour).
    fireEvent.change(await screen.findByRole('combobox', { name: 'MeshCore payload type' }), { target: { value: '5' } });
    expect(await screen.findByRole('status')).toHaveTextContent('A MeshCore filter and a Meshtastic type filter together match nothing.');
  });

  it('the charts show each device with its tag, and their range refetches', async () => {
    renderPage('/overview/packets');
    const bySource = await screen.findByRole('region', { name: 'By Source' }, { timeout: 5000 });
    await within(bySource).findByText('612');
    expect(within(bySource).getAllByRole('listitem')[0]).toHaveTextContent('SG612');
    fireEvent.click(within(screen.getByRole('group', { name: 'Time range' })).getByRole('button', { name: '1 h' }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/unified/packets/distribution?since='))).toBe(true));
  });

  it('the cue scrolls the table to the columns right of Content', async () => {
    renderPage('/overview/packets');
    await row('Hearing you direct from Marousi');
    const cue = screen.getByRole('button', { name: /4 more columns: Date, Slot, RSSI, Size/ });
    const scroller = screen.getByTestId('packet-table-scroll');
    Object.defineProperty(scroller, 'scrollWidth', { value: 1600, configurable: true });
    fireEvent.click(cue);
    expect(scroller.scrollLeft).toBe(1600);
  });

  it('without packetmonitor:read shows today\'s no-permission note and asks for nothing', async () => {
    renderPage('/overview/packets', { permissions: { global: {}, bySource: { [S.g2]: { messages: { read: true, write: false } } } } });
    expect(await screen.findByText(/You need both channels:read and messages:read/)).toBeInTheDocument();
    expect(fetched().some((u) => u.includes('/api/unified/packets'))).toBe(false);
  });
});
