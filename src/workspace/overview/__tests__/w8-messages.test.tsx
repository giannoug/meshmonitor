/**
 * @vitest-environment jsdom
 *
 * Overview › Messages own-issues (W8): memoised rows (O4b), no empty state
 * while the device list loads (O4e), and the scroll pin (O4f).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { unifiedMessages, unifiedMessagesReply } from '../../__fixtures__/messages';
import { feedRow, renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// A render-count spy on the row: it counts renders by message text.
const renders = vi.hoisted(() => new Map<string, number>());
vi.mock('../../chat/MessageRowD', async (orig) => {
  const mod = await orig<typeof import('../../chat/MessageRowD')>();
  const Real = mod.default;
  const Spy = (props: React.ComponentProps<typeof Real>) => {
    renders.set(props.message.text, (renders.get(props.message.text) ?? 0) + 1);
    return <Real {...props} />;
  };
  return { ...mod, default: Spy };
});

const PSY = 'Anyone hearing the Hymettus relay this morning?';
const NEW_TEXT = 'A brand new message';

describe('Overview › Messages (W8)', () => {
  it('a poll with unchanged messages re-renders no message row', async () => {
    renders.clear();
    let extra = false;
    const newest = { ...unifiedMessages[0], dedupKey: 'new', packetId: 5555, requestId: 5555, text: NEW_TEXT, createdAt: Date.now() + 864e5, timestamp: Date.now() };
    renderMessages('/overview/messages', {
      fixtures: { 'GET /api/unified/messages': (url) => (extra ? [newest, ...unifiedMessagesReply(url)] : unifiedMessagesReply(url)) },
    });
    await feedRow(PSY);
    await new Promise((r) => setTimeout(r, 200));
    const before = renders.get(PSY);
    extra = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await feedRow(NEW_TEXT);
    expect(renders.get(PSY)).toBe(before);
  });

  it('no empty-state text while the device list is loading', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const sources = new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    sources.json = async () => { await gate; return (await import('../../__fixtures__/athens')).athensFixture.sources; };
    renderMessages('/overview/messages', { fixtures: { 'GET /api/sources': () => sources } });
    await waitFor(() => expect(vi.mocked(globalThis.fetch).mock.calls.some(([u]) => String(u).includes('/api/unified/messages'))).toBe(true));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText(/No messages|Choose a channel/i)).toBeNull();
    await act(async () => release());
    await feedRow(PSY);
  });

  it('re-pins to bottom on new message only when already at bottom', async () => {
    const extras: unknown[] = [];
    const later = (text: string, n: number) => ({ ...unifiedMessages[0], dedupKey: text, packetId: 6000 + n, requestId: 6000 + n, text, createdAt: Date.now() + 864e5 + n, timestamp: Date.now() + n });
    renderMessages('/overview/messages', {
      fixtures: { 'GET /api/unified/messages': (url) => [...extras, ...unifiedMessagesReply(url)] },
    });
    const feed = (await feedRow(PSY)).parentElement as HTMLElement;
    let top = 0;
    Object.defineProperty(feed, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(feed, 'clientHeight', { configurable: true, get: () => 400 });
    Object.defineProperty(feed, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = v; } });
    const poll = async (text: string) => {
      extras.push(later(text, extras.length + 1));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      await feedRow(text);
    };
    // At the bottom: a new message pins.
    top = 600;
    fireEvent.scroll(feed);
    await poll(NEW_TEXT);
    expect(top).toBe(1000);
    // Scrolled up: a later message leaves the reader where they are.
    top = 100;
    fireEvent.scroll(feed);
    await poll('Another one');
    expect(top).toBe(100);
  });
});
