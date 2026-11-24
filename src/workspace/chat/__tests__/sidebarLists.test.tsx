/**
 * @vitest-environment jsdom
 *
 * The device sidebar's live lists (a-chat-D-desktop): Direct messages from
 * the page's poll, gated on messages:read; Channel Database channels (100+)
 * gated as Classic's Channels tab gates them (the entry must be readable).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const sidebar = () => screen.findByRole('complementary', { name: 'Station G2' });

describe('Direct messages in the sidebar', () => {
  it('lists conversations from the poll, with unread, each linking to its DM', async () => {
    renderChat(`${g2}/channel/0`);
    const side = within(await sidebar());
    const rover = await side.findByRole('link', { name: 'Athens Rover, 1 unread' });
    expect(rover).toHaveAttribute('href', `${g2}/dm/!a1b2c302`);
    expect(side.getByRole('link', { name: 'Message a node' })).toBeInTheDocument();
  });

  it('is not shown without messages:read', async () => {
    renderChat(`${g2}/channel/0`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: true } } } },
    });
    const side = within(await sidebar());
    await side.findByRole('link', { name: /LongFast/ });
    expect(side.queryByRole('link', { name: /Athens Rover/ })).toBeNull();
    expect(side.queryByText('Direct messages')).toBeNull();
  });
});

describe('Channel Database channels (100+)', () => {
  // A server-decrypted message on Channel Database entry 4 (channel 104).
  const poll = () => ({
    ...athensFixture.poll,
    messages: [
      ...athensFixture.poll.messages!,
      { ...athensFixture.poll.messages![0], id: `${SOURCE_IDS.g2}_${0xa1b2c303}_9`, channel: 104, text: 'Decrypted by the server' },
    ],
  });
  const entry = { id: 4, name: 'Athens Secret', pskLength: 32, pskPreview: 'ab…', description: null, isEnabled: true, enforceNameValidation: false };
  const nonAdmin = {
    permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: true }, messages: { read: true, write: false } } } },
  };

  it('a non-admin whose readable entries include it sees it in the sidebar and can open the thread', async () => {
    renderChat(`${g2}/channel/104`, {
      ...nonAdmin,
      fixtures: { 'GET /api/poll': poll, 'GET /api/channel-database': () => ({ success: true, count: 1, data: [entry] }) },
    });
    const side = within(await sidebar());
    expect(await side.findByRole('link', { name: 'Athens Secret' })).toHaveAttribute('href', `${g2}/channel/104`);
    expect(await screen.findByText('Decrypted by the server')).toBeInTheDocument();
  });

  it('without the entry it is not listed and the thread is not available', async () => {
    renderChat(`${g2}/channel/104`, {
      ...nonAdmin,
      fixtures: { 'GET /api/poll': poll, 'GET /api/channel-database': () => ({ success: true, count: 0, data: [] }) },
    });
    const side = within(await sidebar());
    await side.findByRole('link', { name: /LongFast/ });
    expect(await screen.findByText('This channel is not available to you.')).toBeInTheDocument();
    expect(side.queryByRole('link', { name: /Athens Secret|Channel 104/ })).toBeNull();
    expect(screen.queryByText('Decrypted by the server')).toBeNull();
    // F.2 B-M2: only the not-available state; no channel header, Mute, info, Beacons or subtitle.
    const page = screen.getByText('This channel is not available to you.').closest('section')!;
    expect(page.querySelector('header')).toBeNull();
    expect(within(page).queryAllByRole('button')).toHaveLength(0);
    expect(within(page).queryAllByRole('link')).toHaveLength(0);
  });
});

// F.2 B-I3: one polling observer per polled query. The shell polls the open
// device's unread counts and the conversation's MessagingProvider polls its
// first-unread anchors; the lists and conversations only read those caches.
describe('no second polling observer', () => {
  it.each([
    ['a channel (sidebar channel and DM lists)', `${g2}/channel/0`, {}],
    ['the DM inbox', `${g2}/dms`, {}],
    ['the phone device Home lists', g2, { phone: true }],
  ])('%s: unread counts are polled once', async (_what, route, opts) => {
    const { queryClient } = renderChat(route, opts);
    await waitFor(() => expect(queryClient.getQueryData(['unreadCounts', '', SOURCE_IDS.g2, false])).toBeDefined());
    await screen.findAllByText(/Athens Rover/);
    // At most one polling observer per key (the MessagingProvider's own poll is another key: it excludes MQTT, Ruling AD).
    for (const q of queryClient.getQueryCache().findAll({ queryKey: ['unreadCounts'] })) {
      expect(q.observers.filter((o) => o.options.refetchInterval).length).toBeLessThanOrEqual(1);
    }
    const shell = queryClient.getQueryCache().find({ queryKey: ['unreadCounts', '', SOURCE_IDS.g2, false], exact: true })!;
    expect(shell.observers.filter((o) => o.options.refetchInterval)).toHaveLength(1);
  });

  it.each([
    ['a channel thread', `${g2}/channel/0`, false],
    ['a channel thread with Show MQTT on', `${g2}/channel/0`, true],
    ['a DM', `${g2}/dm/!a1b2c302`, false],
    ['a DM with Show MQTT on', `${g2}/dm/!a1b2c302`, true],
  ])('%s: first-unread anchors are polled once', async (_what, route, mqtt) => {
    localStorage.setItem(`showMqttMessages:${SOURCE_IDS.g2}`, String(mqtt));
    onTestFinished(() => localStorage.removeItem(`showMqttMessages:${SOURCE_IDS.g2}`));
    const { queryClient } = renderChat(route);
    await screen.findAllByText(/Athens Rover/);
    await waitFor(() => expect(queryClient.getQueryCache().findAll({ queryKey: ['firstUnread'] }).length).toBeGreaterThan(0));
    for (const q of queryClient.getQueryCache().findAll({ queryKey: ['firstUnread'] })) {
      expect(q.observers.filter((o) => o.options.refetchInterval).length).toBeLessThanOrEqual(1);
    }
  });
});
