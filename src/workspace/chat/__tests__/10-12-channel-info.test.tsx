/**
 * @vitest-environment jsdom
 *
 * Board 10-12 (phone): the ⋯ opens Channel Information with this channel's
 * actions, and Purge All Messages asks in a plain ConfirmSheet.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/channel/0`;

async function openInfo(opts = {}) {
  renderChat(route, { phone: true, ...opts });
  await screen.findByText('Glyfada Beach checking in');
  fireEvent.click(screen.getByRole('button', { name: 'Channel options' }));
  return screen.findByRole('dialog', { name: 'Channel Information' });
}

describe('10-12-channel-info', () => {
  it('10-12-channel-info shows the board', async () => {
    const sheet = await openInfo();
    await within(sheet).findByText('Beacons');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Purge' }));
    await screen.findByRole('dialog', { name: 'Purge All Messages' });
    expectBoard('10-12-channel-info', document.body);
  });

  it("Purge All Messages opens a plain ConfirmSheet with today's words, and purges from MeshMonitor", async () => {
    const sheet = await openInfo();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Purge' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Purge All Messages' }));
    expect(
      confirm.getByText('Are you sure you want to purge ALL messages from LongFast? This action cannot be undone.'),
    ).toBeInTheDocument();
    // Plain: no typed word.
    expect(confirm.queryByRole('textbox')).toBeNull();
    fireEvent.click(confirm.getByRole('button', { name: 'Purge' }));
    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(([u, i]) => String(u).includes('/api/messages/channels/0') && i?.method === 'DELETE');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ sourceId: SOURCE_IDS.g2 });
    });
  });

  it('without channel write there is no Danger zone', async () => {
    const sheet = await openInfo({
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false }, messages: { read: true, write: false } } } },
    });
    expect(within(sheet).getByText('Mark all as Read')).toBeInTheDocument();
    expect(within(sheet).queryByText('Danger zone')).toBeNull();
  });
});
