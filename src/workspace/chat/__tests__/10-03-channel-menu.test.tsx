/**
 * @vitest-environment jsdom
 *
 * Board 10-03 (desktop): the channel header's ⋯ menu and, from it, Channel
 * Information as a side sheet. The board draws both at once; they are built
 * one at a time (D9c), so the check runs over the menu and then the sheet.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, onTestFinished } from 'vitest';
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

async function openMenu(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(route, opts);
  await screen.findByText('Glyfada Beach checking in');
  // The Beacons row waits for the count.
  await screen.findByRole('link', { name: /Beacons/ });
  fireEvent.click(screen.getByRole('button', { name: 'Channel options' }));
  return Object.assign(screen.getByRole('menu', { name: 'Channel options' }), { queryClient: result.queryClient });
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

  it("Show MQTT with no map preferences loaded still flips the shell's unread key", async () => {
    onTestFinished(() => localStorage.clear());
    const menu = await openMenu({ fixtures: { 'GET /api/user/map-preferences': () => new Response('{}', { status: 500 }) } });
    const polled = (mqtt: boolean) =>
      menu.queryClient.getQueryCache().find({ queryKey: ['unreadCounts', '', SOURCE_IDS.g2, !mqtt], exact: true })
        ?.observers.some((o) => o.options.refetchInterval);
    expect(polled(false)).toBe(true);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Show MQTT/ }));
    await waitFor(() => expect(polled(true)).toBe(true));
    expect(polled(false)).toBeFalsy();
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

  it('Escape on a sheet opened from the menu returns focus to the ⋯ trigger', async () => {
    const menu = await openMenu();
    const trigger = screen.getByRole('button', { name: 'Channel options' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Channel Information/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Channel Information' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Channel Information' })).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('ArrowDown/ArrowUp move focus between items; Home/End jump; a repeated Enter keydown is ignored', async () => {
    const menu = await openMenu();
    const items = Array.from(menu.querySelectorAll<HTMLElement>('button:not(:disabled)'));
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'End' });
    expect(items[items.length - 1]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(items[0]).toHaveFocus();
    expect(fireEvent.keyDown(items[0], { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(items[0], { key: 'Enter', repeat: true })).toBe(false);
  });
});
