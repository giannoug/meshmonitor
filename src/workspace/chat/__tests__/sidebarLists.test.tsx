/**
 * @vitest-environment jsdom
 *
 * The device sidebar's live lists (a-chat-D-desktop): Direct messages from
 * the page's poll, gated on messages:read; Channel Database channels (100+)
 * gated as Classic's Channels tab gates them (the entry must be readable).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
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
  });
});
