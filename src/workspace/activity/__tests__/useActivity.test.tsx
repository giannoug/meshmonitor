/**
 * @vitest-environment jsdom
 *
 * useActivity (Task 2.8): paging by `nextBefore` (Ruling AT), the last-seen
 * preference, and refetching on `message:new` or, with no socket, on the
 * unread counts the shell already polls (Ruling N). No timer of its own.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { renderWorkspace } from '../../test/renderWorkspace';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import type { ActivityItem, ActivityPage } from '../../../types/activity';
import { appBasename } from '../../../init';
import { useActivity, activityPrefKey } from '../useActivity';

type Listener = (payload: unknown) => void;
const socket = vi.hoisted(() => ({ current: null as null | { on: (e: string, f: Listener) => void; off: (e: string, f: Listener) => void; emit: (e: string, p: unknown) => void } }));
vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  useOptionalSocket: () => socket.current,
}));

function fakeSocket() {
  const handlers = new Map<string, Set<Listener>>();
  return {
    on: (e: string, f: Listener) => void (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(f),
    off: (e: string, f: Listener) => void handlers.get(e)?.delete(f),
    emit: (e: string, p: unknown) => handlers.get(e)?.forEach((f) => f(p)),
  };
}

const G2 = SOURCE_IDS.g2;
const item = (id: string, timestamp: number): ActivityItem => ({
  kind: 'mention', id, targetMessageId: null, conversation: { type: 'channel', channel: 0 },
  fromId: '!a1b2c302', fromName: 'Athens Rover', text: `@!a1b2c300 ${id}`, timestamp,
});

let api: ReturnType<typeof useActivity>;
let qc: QueryClient;
function Probe({ sourceId = G2 }: { sourceId?: string }) {
  api = useActivity(sourceId);
  qc = useQueryClient();
  return null;
}

/** Serves pages keyed by `before` ('' for the first). */
function pages(byBefore: Record<string, ActivityPage>) {
  return {
    'GET /api/sources/:id/activity': (url: URL) => ({ success: true, data: byBefore[url.searchParams.get('before') ?? ''] }),
  };
}
const activityCalls = () =>
  vi.mocked(fetch).mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/activity'));

beforeEach(() => {
  socket.current = null;
});

describe('useActivity', () => {
  it('hasMore follows nextBefore, and an empty first page with nextBefore set still fetches more (Ruling AT)', async () => {
    renderWorkspace(<Probe />, {
      route: `/source/${G2}/activity`,
      fixtures: pages({
        '': { items: [], nextBefore: 1000 },
        '1000': { items: [], nextBefore: 500 },
        '500': { items: [item('old', 400)], nextBefore: null },
      }),
    });
    await waitFor(() => expect(api.isLoading).toBe(false));
    expect(api.items).toEqual([]);
    expect(api.hasMore).toBe(true);

    await act(() => api.fetchMore());
    // One fetchMore walked past the empty page to the one with an item.
    await waitFor(() => expect(api.items.map((i) => i.id)).toEqual(['old']));
    expect(api.hasMore).toBe(false);
    expect(activityCalls()).toHaveLength(3);
    expect(activityCalls()[1]).toContain('before=1000');
  });

  it('fetchMore stops after a few empty pages', async () => {
    renderWorkspace(<Probe />, {
      route: `/source/${G2}/activity`,
      fixtures: {
        'GET /api/sources/:id/activity': (url: URL) => ({
          success: true,
          data: { items: [], nextBefore: Number(url.searchParams.get('before') ?? 100_000) - 1 },
        }),
      },
    });
    await waitFor(() => expect(api.isLoading).toBe(false));
    await act(() => api.fetchMore());
    expect(activityCalls()).toHaveLength(6);
    expect(api.hasMore).toBe(true);
  });

  it('counts items newer than the last-seen pref, and markSeen writes the newest timestamp', async () => {
    const prefs = prefsFixture({ [activityPrefKey(G2)]: 250 });
    renderWorkspace(<Probe />, {
      route: `/source/${G2}/activity`,
      fixtures: { ...prefs.fixtures, ...pages({ '': { items: [item('a', 300), item('b', 200)], nextBefore: null } }) },
    });
    await waitFor(() => expect(api.unseenCount).toBe(1));
    await act(() => api.markSeen());
    expect(prefs.puts).toEqual([[`workspace.activity.${G2}`, 300]]);
    await waitFor(() => expect(api.unseenCount).toBe(0));
  });

  it('an anonymous viewer has no unseen count and markSeen writes nothing', async () => {
    const prefs = prefsFixture();
    renderWorkspace(<Probe />, {
      route: `/source/${G2}/activity`,
      anonymous: true,
      fixtures: { ...prefs.fixtures, ...pages({ '': { items: [item('a', 300)], nextBefore: null } }) },
    });
    await waitFor(() => expect(api.items).toHaveLength(1));
    expect(api.unseenCount).toBe(0);
    await act(() => api.markSeen());
    expect(prefs.puts).toEqual([]);
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/user/preferences'))).toBe(false);
  });

  it('refetches on message:new for this source', async () => {
    socket.current = fakeSocket();
    renderWorkspace(<Probe />, { route: `/source/${G2}/activity`, fixtures: pages({ '': { items: [], nextBefore: null } }) });
    await waitFor(() => expect(activityCalls()).toHaveLength(1));
    act(() => socket.current!.emit('message:new', { sourceId: 'src-other' }));
    act(() => socket.current!.emit('message:new', { sourceId: G2 }));
    await waitFor(() => expect(activityCalls()).toHaveLength(2));
  });

  it('with no socket, refetches when the shell’s polled unread counts change, without polling them itself', async () => {
    renderWorkspace(<Probe />, { route: `/source/${G2}/activity`, fixtures: pages({ '': { items: [], nextBefore: null } }) });
    await waitFor(() => expect(activityCalls()).toHaveLength(1));
    const key = ['unreadCounts', appBasename, G2, false];
    // The shell's poll lands, then changes (TanStack notifies observers on a 0 ms timeout).
    const tick = () => new Promise((r) => setTimeout(r, 20));
    await act(async () => {
      qc.setQueryData(key, { channels: { 0: 1 }, directMessages: {} });
      await tick();
    });
    expect(activityCalls()).toHaveLength(1);
    await act(async () => void qc.setQueryData(key, { channels: { 0: 2 }, directMessages: {} }));
    await waitFor(() => expect(activityCalls()).toHaveLength(2));
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/unread-counts'))).toBe(false);
  });
});
