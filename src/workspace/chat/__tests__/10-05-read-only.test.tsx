/**
 * @vitest-environment jsdom
 *
 * Boards 10-05 (desktop) and 10-14 (phone): today's three read-only states,
 * which the boards draw side by side (note s10n3), each rendered here on its
 * own and checked together:
 * - an MQTT mirror: no composer, today's reason, and a way to the radio; the
 *   board's frame is a DM there, whose header keeps Organise and Data;
 * - TX disabled: the controls stay, disabled, with today's tooltip;
 * - a guest: the channel, and Login.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const TX_TOOLTIP = "Transmit is disabled on this node's radio. Re-enable TX in the LoRa configuration to use this.";
const GUEST_NOTE = "You're viewing as a guest. Sign in to send messages, see DMs and get notifications.";
const txOff = { 'GET /api/device/tx-status': () => ({ ...athensFixture.txStatus, txEnabled: false, canTransmit: false }) };
const guest = {
  anonymous: true,
  permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false } } } },
};

async function mqttMirror(phone: boolean) {
  const { container } = renderChat(`/source/${SOURCE_IDS.mqtt}/channel/0`, { phone });
  await screen.findByText('Glyfada Beach checking in');
  await screen.findByText(/no radio of its own/);
  return container;
}

/** The board's frame: a DM on the MQTT mirror, with Organise and Data in its header (Task 2.4). */
async function mqttMirrorDm(phone: boolean) {
  const { container } = renderChat(`/source/${SOURCE_IDS.mqtt}/dm/!a1b2c301`, { phone });
  await screen.findByText(/no radio of its own/);
  await within(await screen.findByTestId('dm-header')).findByText('Kifisia Rooftop');
  return container;
}

async function txDisabled(phone: boolean) {
  const { container } = renderChat(`/source/${SOURCE_IDS.g2}/channel/0`, { phone, fixtures: txOff });
  await screen.findByText(TX_TOOLTIP);
  return container;
}

async function asGuest(phone: boolean) {
  const { container } = renderChat(`/source/${SOURCE_IDS.g2}/channel/0`, { phone, ...guest });
  await screen.findByText('Glyfada Beach checking in');
  await screen.findByText(GUEST_NOTE);
  return container;
}

describe.each([
  ['10-05-read-only', false],
  ['10-14-read-only', true],
])('%s', (board, phone) => {
  it(`${board} shows the board`, async () => {
    const parts: string[] = [];
    for (const state of [mqttMirrorDm, txDisabled, asGuest]) {
      parts.push((await state(phone)).textContent ?? '');
      cleanup();
    }
    expectBoard(board, joined(...parts));
  });
});

describe('read-only states', () => {
  it('a DM on an MQTT mirror hides the log, the composer and Ask the node; Organise and Data stay', async () => {
    await mqttMirrorDm(false);
    const head = within(screen.getByTestId('dm-header'));
    expect(head.getByRole('button', { name: 'Organise' })).toBeInTheDocument();
    expect(head.getByRole('button', { name: 'Data' })).toBeInTheDocument();
    expect(head.queryByRole('button', { name: 'Ask the node' })).toBeNull();
    expect(screen.queryByText('Can you run a traceroute to me?')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    // Not the unmessageable banner: the mirror's own note says why.
    expect(screen.queryByRole('button', { name: 'Message anyway' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open on Station G2' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`);
  });

  it("an MQTT mirror shows no composer and today's reason, with a way to a device with a radio", async () => {
    await mqttMirror(false);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/^Sends /)).toBeNull();
    expect(screen.getByText('This MQTT source has no radio of its own, so it cannot send. Open a Meshtastic source to send.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open on Station G2' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/channel/0`);
  });

  it("with TX disabled the controls are visible but disabled, with today's tooltip", async () => {
    await txDisabled(false);
    const box = screen.getByRole('combobox');
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('title', TX_TOOLTIP);
    for (const name of ['Send position', 'Bell', 'Translate']) {
      const chip = screen.getByRole('button', { name });
      expect(chip).toBeDisabled();
      expect(chip).toHaveAttribute('title', TX_TOOLTIP);
    }
  });

  it('a guest sees the channel and Login, and no composer', async () => {
    await asGuest(false);
    const note = screen.getByText(GUEST_NOTE).closest('[role="note"]') as HTMLElement;
    expect(note).toContainElement(screen.getAllByRole('button', { name: 'Login' }).find((b) => note.contains(b)) ?? null);
    expect(screen.queryByRole('combobox')).toBeNull();
    // The sidebar lists the channels the guest may read.
    expect(await screen.findByRole('link', { name: 'LongFast' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/channel/0`);
  });
});
