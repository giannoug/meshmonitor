/**
 * @vitest-environment jsdom
 *
 * Board 7-08-packets (phone, s7n3): Pause and Charts in the top bar, Capture
 * above the list with its "sends nothing on the mesh" line, two-line packet
 * rows, the filter sheet (source, Meshtastic type, MeshCore payload and route,
 * encrypted/decoded, transport, cross-source), the charts sheet, and a row tap
 * opening the raw packet sheet.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { expectBoard } from '../../test/boardChecks';
import { captureOn } from '../../__fixtures__/packets';
import { renderMessages, type MessagesOptions } from './renderMessages';

const renderPage = (route: string, opts: MessagesOptions = {}) =>
  renderMessages(route, { ...opts, fixtures: { ...captureOn, ...opts.fixtures } });

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function packetRow(text: string): Promise<HTMLElement> {
  const [el] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return el.closest<HTMLElement>('[data-testid="packet-row"]')!;
}

async function openFilters() {
  await packetRow('Nikos T-Echo');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  return screen.findByRole('dialog', { name: 'Filters' });
}

describe('7-08-packets', () => {
  withRowLayout();

  it('7-08-packets shows the board', async () => {
    renderPage('/overview/packets', { phone: true });
    await openFilters();
    expectBoard('7-08-packets', document.body);
  });

  it('a row reads tag, type and sender, then direction, transport, destination, hops and SNR', async () => {
    renderPage('/overview/packets', { phone: true });
    const first = await packetRow('Nikos T-Echo');
    expect(first).toHaveTextContent(/^SGTEXT_MESSAGE_APPNikos T-EchoRX LoRa · Broadcast · 2 hops · -3 dB/);
  });

  it('a row tap opens the raw packet sheet', async () => {
    renderPage('/overview/packets', { phone: true });
    fireEvent.click(await packetRow('Nikos T-Echo'));
    const sheet = await screen.findByRole('dialog', { name: 'Raw packet #4821' });
    expect(sheet).toHaveTextContent('Size58 B');
  });

  it('the filter sheet holds every filter, and Show N packets closes it', async () => {
    renderPage('/overview/packets', { phone: true });
    const sheet = await openFilters();
    for (const name of ['Source', 'Meshtastic type', 'MeshCore payload type', 'MeshCore route type', 'Cross-source']) {
      expect(within(sheet).getByRole('combobox', { name })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole('group', { name: 'Payload' })).toBeInTheDocument();
    expect(within(sheet).getByRole('group', { name: 'Transport' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show 10 packets' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull());
  });

  it('Charts opens as a sheet with By Source, By Device and By Type', async () => {
    renderPage('/overview/packets', { phone: true });
    await packetRow('Nikos T-Echo');
    fireEvent.click(screen.getByRole('button', { name: 'Charts' }));
    const sheet = await screen.findByRole('dialog', { name: 'Charts' });
    for (const name of ['By Source', 'By Device', 'By Type']) expect(within(sheet).getByRole('region', { name })).toBeInTheDocument();
    expect(within(sheet).getByRole('group', { name: 'Time range' })).toBeInTheDocument();
  });

  it('Pause sits in the top bar', async () => {
    renderPage('/overview/packets', { phone: true });
    await packetRow('Nikos T-Echo');
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-scroll' }));
    expect(screen.getByRole('button', { name: 'Resume auto-scroll' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
  });
});
