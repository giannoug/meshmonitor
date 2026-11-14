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
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
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

beforeEach(() => {
  localStorage.removeItem('meshmonitor-sticky-dm-nodes');
  localStorage.removeItem(`nodeDisplay:${SOURCE_IDS.g2}:hideIncompleteNodes`);
});

/** The poll plus a node with no name yet (incomplete, isNodeComplete) that has sent us a DM. */
const withIncomplete = () => {
  const num = 0xa1b2c3f0;
  const id = '!a1b2c3f0';
  const base = athensFixture.poll.messages![0];
  return {
    ...athensFixture.poll,
    nodes: [...athensFixture.poll.nodes!, { ...athensFixture.poll.nodes![1], nodeNum: num, user: { id, longName: `Node ${id}`, shortName: '', hwModel: 0, role: '0' } }],
    messages: [...athensFixture.poll.messages!, { ...base, id: 'incomplete-1', from: id, fromNodeId: id, to: '!a1b2c300', toNodeId: '!a1b2c300', channel: -1, text: 'hello from nowhere' }],
  };
};

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

  it('a pinned conversation stays when the filter field does not match it, as Classic', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Pin to top of list: Kifisia Rooftop' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter nodes or messages...' }), { target: { value: 'Glyfada' } });
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Direct messages' })).getAllByRole('link').map((r) => r.getAttribute('href'))).toEqual([
        `${g2}/dm/!a1b2c301`,
        `${g2}/dm/!a1b2c303`,
      ]),
    );
  });

  it('follows Hide Incomplete Nodes (the device\'s Node Display setting), as Classic', async () => {
    renderChat(`${g2}/dms`, { phone: true, fixtures: { 'GET /api/poll': withIncomplete } });
    expect(await within(await inbox()).findByText('hello from nowhere')).toBeInTheDocument();
  });

  it('hides an incomplete node when Hide Incomplete Nodes is on', async () => {
    localStorage.setItem(`nodeDisplay:${SOURCE_IDS.g2}:hideIncompleteNodes`, 'true');
    renderChat(`${g2}/dms`, { phone: true, fixtures: { 'GET /api/poll': withIncomplete } });
    await within(await inbox()).findByText('You: Thanks!');
    expect(screen.queryByText('hello from nowhere')).toBeNull();
  });

  it('a failed Mark All Read shows an error', async () => {
    await open({ fixtures: { 'POST /api/messages/mark-read': () => new Response('{}', { status: 500 }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark All Read' }));
    expect(await screen.findByText('Failed to mark messages as read. Please try again.')).toBeInTheDocument();
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
