/**
 * @vitest-environment jsdom
 *
 * Board a-chat-D-desktop: the device rail, the layout-D sidebar (Task 1.6)
 * and, from Task 2.3, its content: the channel list and the open channel.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/channel/0`;

describe('a-chat-D-desktop', () => {
  it('a-chat-D-desktop shows the board', async () => {
    const { container } = renderChat(route);
    const sidebar = await screen.findByRole('complementary', { name: 'Station G2' });
    await within(sidebar).findByText('12 online');
    await screen.findByText('Glyfada Beach checking in');
    expectBoard('a-chat-D-desktop', container);
  });

  it("the sidebar lists the device's channels, marks the open one, and counts unread", async () => {
    renderChat(`/source/${SOURCE_IDS.g2}/channel/1`);
    const sidebar = await screen.findByRole('complementary', { name: 'Station G2' });
    const open = await within(sidebar).findByRole('link', { name: 'gauntlet' });
    expect(open).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/channel/1`);
    expect(open).toHaveAttribute('aria-current', 'page');
    expect(await within(sidebar).findByRole('link', { name: 'LongFast, 2 unread' })).toHaveAttribute(
      'href',
      `/source/${SOURCE_IDS.g2}/channel/0`,
    );
    expect(within(sidebar).getByRole('link', { name: 'Athens Ops' })).toBeInTheDocument();
  });

  it('lists only the channels the viewer may read', async () => {
    renderChat(route, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: true }, messages: { read: true, write: false } } } },
    });
    const sidebar = await screen.findByRole('complementary', { name: 'Station G2' });
    await within(sidebar).findByRole('link', { name: /LongFast/ });
    expect(within(sidebar).queryByRole('link', { name: 'gauntlet' })).toBeNull();
    expect(within(sidebar).queryByRole('link', { name: 'Athens Ops' })).toBeNull();
  });
});
