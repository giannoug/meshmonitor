/**
 * @vitest-environment jsdom
 *
 * Board i6 (Task 6.7): a guest on the phone. The device Home shows what
 * anonymous read allows (today's gates), a note on what signing in adds, and
 * a tab bar of Home and today's Login, which opens the sign-in dialog (6.2).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const GUEST_NOTE = "You're viewing as a guest. Log in to send messages, see DMs and get notifications.";
const R = { read: true, write: false };
const guest = {
  anonymous: true,
  permissions: {
    bySource: {
      [SOURCE_IDS.g2]: { nodes: R, dashboard: R, channel_0: R, channel_1: R },
    },
  },
};

async function home() {
  const result = renderChat(`/source/${SOURCE_IDS.g2}`, { phone: true, ...guest });
  await screen.findByText(GUEST_NOTE);
  await screen.findByRole('link', { name: 'LongFast' });
  return result;
}

describe('i6 guest', () => {
  it('i6-guest shows the board', async () => {
    const { container } = await home();
    expectBoard('i6-guest', container);
  });

  it('the tab bar is Home and Login; Login opens the sign-in dialog', async () => {
    await home();
    const tabs = within(screen.getByRole('navigation', { name: 'Tabs' }));
    expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}`);
    expect(tabs.queryByText('DMs')).toBeNull();
    expect(tabs.queryByText('Activity')).toBeNull();
    expect(tabs.queryByText('You')).toBeNull();
    fireEvent.click(tabs.getByRole('button', { name: 'Login' }));
    // 6.2's sign-in card, as the phone draws it (s11n0).
    const dialog = await screen.findByRole('dialog', { name: 'Login' });
    expect(within(dialog).getByLabelText('Username')).toBeInTheDocument();
    expect(dialog.querySelector('[data-phone]')).not.toBeNull();
  });

  it('tiles follow today\'s gates: Map, Nodes and Dashboard with these grants; no Automation, no DMs', async () => {
    await home();
    const tiles = within(screen.getByRole('navigation', { name: 'Device tools' }));
    expect(tiles.getByRole('link', { name: 'Map' })).toBeInTheDocument();
    expect(tiles.getByRole('link', { name: /^Nodes/ })).toBeInTheDocument();
    expect(tiles.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/dashboard`);
    expect(tiles.queryByRole('link', { name: 'Automation' })).toBeNull();
    expect(screen.queryByText('Direct messages')).toBeNull();
  });

  it('a signed-in viewer keeps the four tabs and no guest note', async () => {
    renderChat(`/source/${SOURCE_IDS.g2}`, { phone: true });
    await screen.findByRole('link', { name: 'Athens Rover, 1 unread' });
    expect(screen.queryByText(GUEST_NOTE)).toBeNull();
    const tabs = within(screen.getByRole('navigation', { name: 'Tabs' }));
    for (const name of ['Home', 'DMs', 'Activity', 'You']) expect(tabs.getByText(name)).toBeInTheDocument();
  });
});
