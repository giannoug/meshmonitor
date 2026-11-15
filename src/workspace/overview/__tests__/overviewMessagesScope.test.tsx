/**
 * @vitest-environment jsdom
 *
 * Review Focus 2 on Overview › Messages: a viewer who can read Station G2 but
 * not Rooftop RAK sees no RAK row, tag, name or filter entry, through the real
 * gate (AuthContext's `hasPermission` and the shell's readable devices), even
 * when a reply carries a RAK reception. The server side of the same rule is
 * `src/server/routes/unifiedRoutes.messagesScope.test.ts`.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { unifiedMessagesReply } from '../../__fixtures__/messages';
import { feedRow, renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const PSY = 'Anyone hearing the Hymettus relay this morning?';
const G2_ONLY = { global: {}, bySource: { [S.g2]: { messages: { read: true, write: false } } } };
const RAK_ONLY_TEXT = 'Heard by the RAK alone';

/** The fixture reply plus a row heard only by Rooftop RAK: what a leaking server would send. */
const leakyReply = (url: URL) => [
  ...unifiedMessagesReply(url),
  {
    ...unifiedMessagesReply(url)[0],
    dedupKey: 'rak-only', packetId: 999, requestId: 999, text: RAK_ONLY_TEXT,
    receptions: [{ ...unifiedMessagesReply(url)[0].receptions[0], sourceId: S.rak, sourceName: 'Rooftop RAK' }],
  },
];

describe('Overview › Messages: per-source read (Review Focus 2)', () => {
  it('shows no row, tag or name from a device the viewer cannot read', async () => {
    renderMessages('/overview/messages', { permissions: G2_ONLY, fixtures: { 'GET /api/unified/messages': leakyReply } });
    const row = await feedRow(PSY);
    expect(row).toHaveTextContent('SG2 hops');
    expect(row).not.toHaveTextContent('RR');
    expect(within(row).getByRole('button', { name: 'heard by 1' })).toBeInTheDocument();
    expect(screen.queryAllByText(RAK_ONLY_TEXT)).toHaveLength(0);
    expect(document.body).not.toHaveTextContent('Rooftop RAK');
    expect(within(screen.getByRole('combobox', { name: 'Source filter' })).queryByRole('option', { name: 'Rooftop RAK' })).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'heard by 1' }));
    const panel = await screen.findByRole('complementary', { name: 'Reception details' });
    expect(within(panel).getAllByRole('row')).toHaveLength(2);
    expect(panel).not.toHaveTextContent('Rooftop RAK');
  });

  it('the channel list and the export form name no unreadable device', async () => {
    renderMessages('/overview/messages', { permissions: G2_ONLY });
    await feedRow(PSY);
    const list = screen.getByRole('navigation', { name: 'Channels' });
    expect(within(list).getByRole('button', { name: /Hiking/ })).not.toHaveTextContent('RR');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = await screen.findByRole('dialog', { name: 'Export messages' });
    expect(within(dialog).getByRole('checkbox', { name: /Station G2/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /Rooftop RAK/ })).toBeNull();
    expect(dialog).not.toHaveTextContent('Rooftop RAK');
  });
});
