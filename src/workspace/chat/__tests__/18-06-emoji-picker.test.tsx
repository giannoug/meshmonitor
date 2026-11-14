/**
 * @vitest-environment jsdom
 *
 * Board 18-06 (phone): React › Custom opens the picker as a bottom sheet with
 * the set saved in Appearance, which replaces the defaults (as today).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`;
const SAVED = [
  { emoji: '👍', title: 'Thumbs up' },
  { emoji: '❤️', title: 'Heart' },
  { emoji: '😂', title: 'Laugh' },
  { emoji: '😮', title: 'Wow' },
  { emoji: '👋', title: 'Wave' },
];

describe('18-06-emoji-picker', () => {
  it('18-06-emoji-picker shows the board', async () => {
    renderChat(route, {
      phone: true,
      fixtures: { 'GET /api/settings': () => ({ ...athensFixture.settings, customTapbackEmojis: JSON.stringify(SAVED) }) },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
    fireEvent.contextMenu((await screen.findByText('Can you run a traceroute to me?')).closest('[data-message-id]')!);
    const actions = await screen.findByRole('dialog', { name: /^Kifisia Rooftop · / });
    fireEvent.click(within(actions).getByRole('button', { name: /Custom/ }));
    const sheet = await screen.findByRole('dialog', { name: 'React with an emoji' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Custom emoji' }));
    expectBoard('18-06-emoji-picker', sheet);
    // The saved set replaces the defaults.
    expect(within(sheet).getByTitle('Wave')).toBeInTheDocument();
    expect(within(sheet).queryByTitle('Thumbs down')).toBeNull();
  });
});
