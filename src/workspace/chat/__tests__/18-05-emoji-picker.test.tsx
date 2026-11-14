/**
 * @vitest-environment jsdom
 *
 * Board 18-05 (desktop): React on a message's hover bar opens the emoji
 * picker with today's default set, Custom emoji (up to 10 characters) and
 * the Sends line. Picking one sends 1 tapback.
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

const route = `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`;
const THEIRS = 'Can you run a traceroute to me?';
const sent = () =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes('/api/messages/send') && i?.method === 'POST');

async function openPicker() {
  renderChat(route);
  fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
  const row = (await screen.findByText(THEIRS)).closest('[data-message-id]') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'React' }));
  return screen.findByRole('dialog', { name: 'React with an emoji' });
}

describe('18-05-emoji-picker', () => {
  it('18-05-emoji-picker shows the board', async () => {
    const sheet = await openPicker();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Custom emoji' }));
    expectBoard('18-05-emoji-picker', sheet);
    // Today's default set (35), the custom input up to 10 characters.
    expect(within(sheet).getByTitle('Thumbs up')).toBeInTheDocument();
    expect(within(sheet).getByTitle('100')).toBeInTheDocument();
    expect(within(sheet).getByPlaceholderText('Type or paste emoji...')).toHaveAttribute('maxLength', '10');
  });

  it('picking one sends 1 tapback and closes', async () => {
    const sheet = await openPicker();
    fireEvent.click(within(sheet).getByTitle('Heart'));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(JSON.parse(String(sent()[0][1]!.body))).toMatchObject({ text: '❤️', destination: '!a1b2c301', replyId: 7, emoji: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a custom emoji is sent with Send', async () => {
    const sheet = within(await openPicker());
    fireEvent.click(sheet.getByRole('button', { name: 'Custom emoji' }));
    fireEvent.change(sheet.getByPlaceholderText('Type or paste emoji...'), { target: { value: '🛰️' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(JSON.parse(String(sent()[0][1]!.body))).toMatchObject({ text: '🛰️', emoji: 1 });
  });
});
