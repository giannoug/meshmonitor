/**
 * @vitest-environment jsdom
 *
 * Board 7-06-messages (phone, s7n2–s7n3): channel and source chips under the
 * page's own header, Refresh in the header row, a channel tag on each message
 * in All channels, MeshCore's sender clock offset, and a message tap opening
 * the receptions sheet.
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

describe('7-06-messages', () => {
  it('7-06-messages shows the board', async () => {
    renderMessages('/overview/messages', { phone: true, channel: '__all__' });
    fireEvent.click(await feedRow(PSY));
    await screen.findByRole('dialog', { name: 'Reception details' });
    expectBoard('7-06-messages', document.body);
  });

  it('a message tap opens the receptions sheet with one card per device', async () => {
    renderMessages('/overview/messages', { phone: true, channel: '__all__' });
    fireEvent.click(await feedRow(PSY));
    const sheet = await screen.findByRole('dialog', { name: 'Reception details' });
    const cards = within(sheet).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Station G2');
    expect(cards[0]).toHaveTextContent('Hops 2 · SNR -7.0 dB · RSSI -101 dBm');
    expect(cards[0]).toHaveTextContent(/Heard [\d:]+.* · Signed\s*Yes/);
    expect(cards[2]).toHaveTextContent('Signed No');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('All channels tags each message with its channel, and MeshCore shows its clock offset', async () => {
    renderMessages('/overview/messages', { phone: true, channel: '__all__' });
    const mc = await feedRow('Heading to the beach, back on the hour');
    expect(mc).toHaveTextContent('#Public');
    expect(mc).toHaveTextContent('clock 2 min ahead');
    expect(await feedRow(PSY)).toHaveTextContent('#LongFast');
  });

  it('the channel and source chips pick the feed', async () => {
    renderMessages('/overview/messages', { phone: true, channel: '__all__' });
    await feedRow(PSY);
    fireEvent.change(screen.getByRole('combobox', { name: 'Channel' }), { target: { value: 'Public' } });
    await feedRow('Heading to the beach, back on the hour');
    await waitFor(() => expect(screen.queryAllByText(PSY)).toHaveLength(0));
    expect(screen.getByRole('combobox', { name: 'Source filter' })).toHaveDisplayValue('All sources');
  });

  it('draws its own header: back to Overview, Export and Refresh', async () => {
    renderMessages('/overview/messages', { phone: true });
    await feedRow(PSY);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute('href', '/overview/messages/export');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Channels' })).toBeNull();
    // Read-only on the phone too: no long-press actions sheet.
    expect(screen.queryByRole('button', { name: 'Message actions' })).toBeNull();
  });
});
