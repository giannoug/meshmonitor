/**
 * @vitest-environment jsdom
 *
 * Board 10-06 (phone): a channel thread. Header, messages with their signal
 * line, the "New" line, the chips, the composer and its Sends line.
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

describe('10-06-channel-thread', () => {
  it('10-06-channel-thread shows the board', async () => {
    const { container } = renderChat(route, { phone: true });
    await screen.findByText('Glyfada Beach checking in');
    await screen.findByRole('separator', { name: 'New messages' });
    expectBoard('10-06-channel-thread', container);
    // The thread owns the screen: no re-hosted App, no device header.
    expect(screen.queryByTestId('page-app')).toBeNull();
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });

  it('the composer says what Send transmits', async () => {
    renderChat(route, { phone: true });
    expect(await screen.findByText('Sends 1 message on # LongFast · hop limit 3')).toBeInTheDocument();
  });

  it('Send posts today\'s request: the text on the channel, with the reply id', async () => {
    renderChat(route, { phone: true });
    await screen.findByText('Glyfada Beach checking in');
    // Reply to Glyfada Beach (packet 3), from the message's actions sheet (a long-press; Task 2.5).
    const row = screen.getByText('Glyfada Beach checking in').closest('[data-message-id]') as HTMLElement;
    fireEvent.contextMenu(row);
    fireEvent.click(within(await screen.findByRole('dialog', { name: /^Glyfada Beach · / })).getByRole('button', { name: /^Reply/ }));
    expect(await screen.findByText('Replying to Glyfada Beach')).toBeInTheDocument();
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'Heading out at 11' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => {
      const send = vi.mocked(fetch).mock.calls.find(([u, i]) => String(u).includes('/api/messages/send') && i?.method === 'POST');
      expect(send).toBeDefined();
      expect(JSON.parse(String(send![1]!.body))).toEqual({
        text: 'Heading out at 11',
        channel: 0,
        replyId: 3,
        sourceId: SOURCE_IDS.g2,
      });
    });
  });

  it('shows the signal line on the message: hops, SNR and where it was heard', async () => {
    renderChat(route, { phone: true });
    const row = (await screen.findByText('Glyfada Beach checking in')).closest('[data-message-id]') as HTMLElement;
    expect(row).toHaveTextContent('1 hop · SNR 6.5 dB · heard via Station G2');
    expect(row).toHaveAttribute('data-detail', 'hover');
  });

  it('ours carry the ack in words', async () => {
    renderChat(route, { phone: true });
    const row = (await screen.findByText('Welcome back! Hearing you direct from Kifisia')).closest('[data-message-id]') as HTMLElement;
    expect(within(row).getByText('Delivered')).toHaveAttribute('title', 'Transmitted to mesh');
  });

  it('follows the message style and signal detail preferences', async () => {
    renderChat(route, {
      phone: true,
      fixtures: {
        'GET /api/user/preferences': () => ({
          success: true,
          data: { preferences: { layout: 'workspace', 'workspace.messageStyle': 'bubbles', 'workspace.signalDetail': 'always' } },
        }),
      },
    });
    const row = (await screen.findByText('Glyfada Beach checking in')).closest('[data-message-id]') as HTMLElement;
    await waitFor(() => expect(row).toHaveAttribute('data-style', 'bubbles'));
    expect(row).toHaveAttribute('data-detail', 'always');
  });
});
