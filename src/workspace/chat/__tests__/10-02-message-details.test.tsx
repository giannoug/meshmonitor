/**
 * @vitest-environment jsdom
 *
 * Board 10-02 (desktop): Message details as a side panel beside the DM, for
 * one of ours: today's Delivery Details content (status, what this means,
 * identity, transport, timeline) with the message quoted. The panel sends
 * nothing on the mesh: it reads the stored timeline.
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
const OURS = 'Running one now, should be 2 hops via Hymettus';
const rowOf = (text: string) => screen.getByText(text).closest('[data-message-id]') as HTMLElement;

async function openDetails(text = OURS) {
  const result = renderChat(route);
  fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
  await screen.findByText(text);
  const row = within(rowOf(text));
  fireEvent.click(row.getByRole('button', { name: 'More actions' }));
  fireEvent.click(row.getByRole('button', { name: /^Details/ }));
  return { ...result, panel: await screen.findByRole('complementary', { name: /Details$/ }) };
}

describe('10-02-message-details', () => {
  it('10-02-message-details shows the board', async () => {
    const { container, panel } = await openDetails();
    await within(panel).findByText('Attempt 2');
    await screen.findByText('Statistical (3 routes)', { exact: false });
    expectBoard('10-02-message-details', container);
  });

  it('is a side panel beside the conversation, not a modal, and closes', async () => {
    const { panel } = await openDetails();
    expect(panel).toHaveTextContent('Delivery Details');
    expect(panel).toHaveTextContent(OURS);
    expect(screen.queryByRole('dialog')).toBeNull();
    // The conversation stays usable beside it.
    expect(document.querySelector('textarea')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: /Details$/ })).toBeNull());
  });

  it('reads the stored timeline only: no packet goes out', async () => {
    const { panel } = await openDetails();
    await within(panel).findByText('Attempt 2');
    const calls = vi.mocked(fetch).mock.calls.map(([u, i]) => `${i?.method ?? 'GET'} ${String(u)}`);
    expect(calls.some((c) => c.includes(`/messages/${SOURCE_IDS.g2}_${0xa1b2c300}_8/events`))).toBe(true);
    expect(calls.filter((c) => !c.startsWith('GET')).every((c) => c.includes('/api/messages/mark-read'))).toBe(true);
  });

  it('for theirs, the received sections: route, signal, transport, packet', async () => {
    const { panel } = await openDetails('Can you run a traceroute to me?');
    expect(panel).toHaveTextContent('Message Details');
    for (const s of ['Route', 'Signal', 'Transport', 'Packet']) expect(panel).toHaveTextContent(s);
  });
});
