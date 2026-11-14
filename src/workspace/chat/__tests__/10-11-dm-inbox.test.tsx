/**
 * @vitest-environment jsdom
 *
 * Board 10-11-dm-inbox (phone): the DM inbox's controls, today's: the
 * DmFilterSelect filters, Mark All Read for the device, and Pin (Classic's
 * sticky list, same storage).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const inbox = () => screen.findByRole('list', { name: 'Direct messages' });

async function open(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(`${g2}/dms`, { phone: true, ...opts });
  await within(await inbox()).findByText('You: Thanks!');
  return result;
}

beforeEach(() => localStorage.removeItem('meshmonitor-sticky-dm-nodes'));

describe('10-11-dm-inbox', () => {
  it('10-11-dm-inbox shows the board', async () => {
    const { container } = await open();
    expectBoard('10-11-dm-inbox', container);
  });

  it('the filter narrows the list (Unread Only)', async () => {
    await open();
    fireEvent.change(screen.getByTitle('Filter conversations'), { target: { value: 'unread' } });
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Direct messages' })).getAllByRole('link')).toHaveLength(1));
  });

  it('Pin keeps a conversation on top, in the list Classic uses', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Pin to top of list: Kifisia Rooftop' }));
    const rows = within(await inbox()).getAllByRole('link');
    expect(rows[0]).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    expect(JSON.parse(localStorage.getItem('meshmonitor-sticky-dm-nodes') ?? '[]')).toEqual([0xa1b2c301]);
    expect(screen.getByRole('button', { name: 'Unpin from top of list: Kifisia Rooftop' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Mark All Read marks every DM on this device read', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Mark All Read' }));
    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/api/messages/mark-read'));
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ allDMs: true, sourceId: SOURCE_IDS.g2 });
    });
  });
});
