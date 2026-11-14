/**
 * @vitest-environment jsdom
 *
 * Board 10-09 (phone): the composer's Translate opens the translate sheet:
 * from / to with swap, the original, the translated preview, the LoRa payload
 * warning, Translate and Replace in Draft. It changes the draft only; the
 * translation is a server call (POST /api/translate), nothing on the mesh.
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
const DRAFT = 'Running one now, should be 2 hops via Halandri, then I will try the Hymettus relay at noon';
// 236 bytes of Greek: over one LoRa packet.
const GREEK = 'Τρέχω ένα τώρα, θα πρέπει να είναι 2 βήματα μέσω Χαλανδρίου, μετά θα δοκιμάσω τον αναμεταδότη του Υμηττού το μεσημέρι';

async function openSheet() {
  const result = renderChat(route, {
    phone: true,
    fixtures: { 'POST /api/translate': () => ({ success: true, data: { translatedText: GREEK, targetLanguage: 'el', provider: 'fixture' } }) },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
  await screen.findByText('Thanks!');
  const box = document.querySelector('textarea')!;
  fireEvent.change(box, { target: { value: DRAFT } });
  fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
  const sheet = await screen.findByRole('dialog', { name: 'Translate Outgoing Message' });
  return { ...result, sheet, box };
}

describe('10-09-translate', () => {
  it('10-09-translate shows the board', async () => {
    const { sheet } = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Translate$/ }));
    await within(sheet).findByText(GREEK);
    expectBoard('10-09-translate', sheet);
  });

  it('shows the LoRa payload warning and Replace in Draft, which only replaces the draft', async () => {
    const { sheet, box } = await openSheet();
    const s = within(sheet);
    expect(s.getByRole('button', { name: 'Replace in Draft' })).toBeDisabled();
    fireEvent.click(s.getByRole('button', { name: /^Translate$/ }));
    expect(await s.findByText(/LoRa Packet Payload Warning/)).toBeInTheDocument();
    expect(sheet).toHaveTextContent(`Translated message is ${new TextEncoder().encode(GREEK).length} bytes`);
    expect(s.getByText('Replaces the draft only; nothing is sent until you tap Send.')).toBeInTheDocument();
    fireEvent.click(s.getByRole('button', { name: 'Replace in Draft' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(box).toHaveValue(GREEK);
    const posts = vi.mocked(fetch).mock.calls.filter(([, i]) => i?.method === 'POST').map(([u]) => String(u));
    expect(posts.some((u) => u.includes('/api/messages/send'))).toBe(false);
    expect(posts.some((u) => u.includes('/api/translate'))).toBe(true);
  });
});
