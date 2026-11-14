/**
 * One device's Activity feed (Task 2.8, notes cs1/cs2): replies to, reactions
 * on and @mentions of its own node, read from `GET /api/sources/:id/activity`
 * (Task 2.7). Read-only: nothing here sends on the mesh.
 *
 * - Paging (Ruling AT): `hasMore` is the last page's `nextBefore !== null`. A
 *   page can be empty with `nextBefore` set (the server scans at most 2,000
 *   rows), so `fetchMore` walks past empty pages, up to `EMPTY_PAGE_CAP`.
 * - Last seen: the user preference `workspace.activity.<sourceId>` (ms).
 *   `unseenCount` counts loaded items newer than it; `markSeen` writes the
 *   newest item's time. An anonymous viewer has no preferences: no count, no
 *   write.
 * - Fresh data (Ruling N), with no timer of its own: `message:new` on the
 *   source's socket where a WebSocketProvider is above; elsewhere (the shell's
 *   bell and tab bar) a change in the unread counts the shell already polls
 *   for the device (read from the cache, never fetched here).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalSocket } from '../../contexts/WebSocketContext';
import type { UnreadCountsData } from '../../hooks/useUnreadCounts';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import type { ActivityItem, ActivityPage } from '../../types/activity';
import { useUserPreferences } from '../prefs/useUserPreferences';

const PAGE_SIZE = 50;
/** Pages one `fetchMore` may fetch while they come back empty (Ruling AT). */
const EMPTY_PAGE_CAP = 5;

export const activityPrefKey = (sourceId: string) => `workspace.activity.${sourceId}`;

export interface Activity {
  items: ActivityItem[];
  fetchMore(): Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetchingMore: boolean;
  unseenCount: number;
  /** Items newer than this are unseen; null for an anonymous viewer or before the pref loads. */
  lastSeen: number | null;
  markSeen(): Promise<void>;
}

export function useActivity(sourceId: string | null | undefined, { enabled = true }: { enabled?: boolean } = {}): Activity {
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const on = enabled && !!sourceId;

  const query = useInfiniteQuery({
    queryKey: ['workspace', 'activity', sourceId],
    enabled: on,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam !== null) qs.set('before', String(pageParam));
      const res = await apiService.get<{ data: ActivityPage }>(`/api/sources/${encodeURIComponent(sourceId!)}/activity?${qs}`);
      return res.data;
    },
    getNextPageParam: (last) => last.nextBefore,
  });
  const { data, refetch, fetchNextPage } = query;
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const last = data?.pages[data.pages.length - 1];
  const hasMore = !!last && last.nextBefore !== null;

  const fetchMore = useCallback(async () => {
    if (!hasMore) return;
    for (let i = 0; i < EMPTY_PAGE_CAP; i++) {
      const r = await fetchNextPage({ cancelRefetch: false });
      const page = r.data?.pages[r.data.pages.length - 1];
      if (!page || page.items.length > 0 || page.nextBefore === null) return;
    }
  }, [hasMore, fetchNextPage]);

  // A burst of messages shares one in-flight refetch.
  const refresh = useCallback(() => void refetch({ cancelRefetch: false }), [refetch]);
  const socket = useOptionalSocket();
  useEffect(() => {
    if (!socket || !on) return;
    const onNew = (m: { sourceId?: string } | undefined) => {
      if (!m?.sourceId || m.sourceId === sourceId) refresh();
    };
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
    };
  }, [socket, on, sourceId, refresh]);

  // The key useUnreadCounts({ baseUrl: appBasename, sourceId }) polls under (the shell's open-device poll).
  const { data: unread } = useQuery<UnreadCountsData>({
    queryKey: ['unreadCounts', appBasename, sourceId ?? null, false],
    queryFn: skipToken,
  });
  const prevUnread = useRef(unread);
  useEffect(() => {
    const prev = prevUnread.current;
    prevUnread.current = unread;
    if (!socket && on && prev !== undefined && prev !== unread) refresh();
  }, [unread, socket, on, refresh]);

  const { prefs, isSuccess, setPref } = useUserPreferences({ enabled: signedIn });
  const lastSeen = signedIn && isSuccess && sourceId ? Number(prefs[activityPrefKey(sourceId)] ?? 0) : null;
  const unseenCount = lastSeen === null ? 0 : items.filter((i) => i.timestamp > lastSeen).length;

  const newest = items[0]?.timestamp;
  const markSeen = useCallback(async () => {
    if (lastSeen === null || !sourceId || newest === undefined || newest <= lastSeen) return;
    // A failed write rolls the pref back, so the badge stays; nothing else to undo.
    await setPref(activityPrefKey(sourceId), newest).catch(() => undefined);
  }, [lastSeen, sourceId, newest, setPref]);

  return {
    items,
    fetchMore,
    hasMore,
    isLoading: on && query.isPending,
    isError: query.isError,
    isFetchingMore: query.isFetchingNextPage,
    unseenCount,
    lastSeen,
    markSeen,
  };
}
