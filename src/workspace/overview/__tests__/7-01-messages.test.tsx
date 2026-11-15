/**
 * @vitest-environment jsdom
 *
 * Board 7-01-messages (desktop, s7n0–s7n2): the cross-source feed with its
 * channel list, device tags with hops, "heard by N", and the receptions side
 * panel. Read-only: no composer, and reactions do not send.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { feedRow, renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const PSY = 'Anyone hearing the Hymettus relay this morning?';

async function openReceptions(text: string) {
  fireEvent.click(within(await feedRow(text)).getByRole('button', { name: /heard by/ }));
  return screen.findByRole('complementary', { name: 'Reception details' });
}

describe('7-01-messages', () => {
  it('7-01-messages shows the board', async () => {
    renderMessages();
    await openReceptions(PSY);
    await screen.findByText(/shares its key with/);
    expectBoard('7-01-messages', document.body);
  });

  it('a row shows each device with its hops, and heard by N', async () => {
    renderMessages();
    const row = await feedRow(PSY);
    expect(row).toHaveTextContent('SG2 hops');
    expect(row).toHaveTextContent('RRdirect');
    expect(row).toHaveTextContent('AM3 hops');
    expect(within(row).getByRole('button', { name: 'heard by 3' })).toBeInTheDocument();
  });

  it('the receptions panel lists each device with hops, SNR, RSSI, heard and signed', async () => {
    renderMessages();
    const panel = await openReceptions(PSY);
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/SG2-7\.0 dB-101 dBm.*Yes/);
    expect(rows[2]).toHaveTextContent(/AM3——.*No/);
    expect(panel).toHaveTextContent('Heard by 3 devices');
    expect(panel).toHaveTextContent('Station G2');
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary', { name: 'Reception details' })).toBeNull();
  });

  it('has no composer, and its reactions do not send', async () => {
    renderMessages();
    const row = await feedRow('Morning all, rover is back on LongFast');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(within(row).getAllByText('👋')).toHaveLength(3);
    expect(within(row).queryByRole('button', { name: /👋/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'React' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'More actions' })).toBeNull();
    expect(screen.getByText(/react or reply from the device chat/)).toBeInTheDocument();
  });

  it('shows a reply with what it replies to', async () => {
    renderMessages();
    const row = await feedRow('Yes, loud and clear from Marousi');
    expect(row).toHaveTextContent('Replying to PSY');
    expect(row).toHaveTextContent(PSY);
  });

  it('a channel in the list opens its feed, with its devices tagged', async () => {
    renderMessages();
    await feedRow(PSY);
    const list = screen.getByRole('navigation', { name: 'Channels' });
    const hiking = within(list).getByRole('button', { name: /Hiking/ });
    expect(hiking).toHaveTextContent('SG');
    expect(hiking).toHaveTextContent('RR');
    fireEvent.click(within(list).getByRole('button', { name: /Public/ }));
    await feedRow('Heading to the beach, back on the hour');
    expect(screen.queryAllByText(PSY)).toHaveLength(0);
    expect(within(list).getByRole('button', { name: /Public/ })).toHaveAttribute('aria-current', 'true');
  });

  it('All sources narrows the feed to one device', async () => {
    renderMessages();
    await feedRow(PSY);
    fireEvent.change(screen.getByRole('combobox', { name: 'Source filter' }), { target: { value: 'src-mqtt' } });
    expect(screen.queryAllByText('Morning all, rover is back on LongFast')).toHaveLength(0);
    expect(screen.getAllByText(PSY).length).toBeGreaterThan(0);
  });

  it('Refresh reads the feed again', async () => {
    const reply = vi.fn(() => []);
    renderMessages('/overview/messages', { fixtures: { 'GET /api/unified/messages': reply } });
    await screen.findByText('No messages on this channel yet.', {}, { timeout: 5000 });
    const calls = reply.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(reply.mock.calls.length).toBeGreaterThan(calls));
  });

  it('Export opens Export messages', async () => {
    renderMessages();
    await feedRow(PSY);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('dialog', { name: 'Export messages' })).toBeInTheDocument();
  });

  it('a viewer without read sees today’s sign-in state', async () => {
    renderMessages('/overview/messages', { permissions: { global: {}, bySource: {} } });
    expect(await screen.findByText('Sign in to view messages.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
