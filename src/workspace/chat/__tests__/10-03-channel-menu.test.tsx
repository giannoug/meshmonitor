/**
 * @vitest-environment jsdom
 *
 * Board 10-03 (desktop): the channel header's ⋯ menu and, from it, Channel
 * Information as a side sheet. The board draws both at once; they are built
 * one at a time (D9c), so the check runs over the menu and then the sheet.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/channel/0`;

async function openMenu() {
  renderChat(route);
  await screen.findByText('Glyfada Beach checking in');
  // The Beacons row waits for the count.
  await screen.findByRole('link', { name: /Beacons/ });
  fireEvent.click(screen.getByRole('button', { name: 'Channel options' }));
  return screen.getByRole('menu', { name: 'Channel options' });
}

describe('10-03-channel-menu', () => {
  it('10-03-channel-menu shows the board', async () => {
    const menu = await openMenu();
    const menuText = menu.textContent ?? '';
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Channel Information/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Channel Information' });
    expectBoard('10-03-channel-menu', joined(menuText, sheet));
  });

  it("holds today's items: info, mute 1 hour / 1 week / indefinitely, mark all read, Show MQTT, Beacons with its count", async () => {
    const menu = await openMenu();
    const items = within(menu);
    expect(items.getByRole('menuitem', { name: /Channel Information/ })).toBeInTheDocument();
    for (const name of ['Mute indefinitely', 'Mute for 1 hour', 'Mute for 1 week']) {
      expect(items.getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(items.getByRole('button', { name: 'Mark all as Read' })).toBeInTheDocument();
    // Off by default (today's per-source preference).
    expect(items.getByRole('menuitemcheckbox', { name: /Show MQTT\/Bridge Messages/ })).toHaveAttribute('aria-checked', 'false');
    expect(items.getByRole('menuitem', { name: /Beacons/ })).toHaveTextContent('2');
  });

  it('Show MQTT toggles the filter; Beacons opens the beacons page', async () => {
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Show MQTT/ }));
    await waitFor(() =>
      expect(within(menu).getByRole('menuitemcheckbox', { name: /Show MQTT/ })).toHaveAttribute('aria-checked', 'true'),
    );
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Beacons/ }));
    expect(await screen.findByText('Beacons · mesh invitations')).toBeInTheDocument();
  });

  it('channel info shows the PSK on Show', async () => {
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Channel Information/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Channel Information' }));
    expect(sheet.queryByText('AQ==')).toBeNull();
    fireEvent.click(sheet.getByRole('button', { name: 'Show' }));
    expect(sheet.getByText('AQ==')).toBeInTheDocument();
  });
});
