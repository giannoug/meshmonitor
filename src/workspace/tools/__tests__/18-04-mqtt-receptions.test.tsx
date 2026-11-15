/**
 * @vitest-environment jsdom
 *
 * Board 18-04-mqtt-receptions (phone, s18n2): the packet list with each
 * packet's reception count; a tap opens Packet Detail as a sheet, one card per
 * gateway with its outcome and ok_to_mqtt state.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReceptions } from './renderReceptions';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function packetRow(text: string): Promise<HTMLElement> {
  const [el] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return el.closest<HTMLElement>('[data-testid="packet-row"]')!;
}

async function openSheet() {
  fireEvent.click(await packetRow('Marousi Mobile'));
  const sheet = await screen.findByRole('dialog', { name: 'Packet Detail' });
  await within(sheet).findByText('Kifisia Rooftop');
  return sheet;
}

describe('18-04-mqtt-receptions', () => {
  it('18-04-mqtt-receptions shows the board', async () => {
    renderReceptions({ phone: true });
    await openSheet();
    expectBoard('18-04-mqtt-receptions', document.body);
  });

  it('a row reads the sender, type, preview, reception count and time', async () => {
    renderReceptions({ phone: true });
    expect(await packetRow('Marousi Mobile')).toHaveTextContent(/^Marousi MobileTEXT_MESSAGE_APP · Hearing you direct from Marousi4 rx[\d:]+/);
  });

  it('one card per gateway with outcome, ok_to_mqtt, Rx time, hops, SNR and RSSI', async () => {
    renderReceptions({ phone: true });
    const sheet = await openSheet();
    const cards = within(within(sheet).getByRole('list', { name: 'Per-gateway receptions' })).getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent(/^!0badc0deingestedviolationRx time [\d:.]+ · 2 hops · SNR -3 dB · RSSI -95$/);
    expect(cards[3]).toHaveTextContent(/unknownRx time [\d:.]+ · 3 hops · SNR — · RSSI —$/);
  });
});
