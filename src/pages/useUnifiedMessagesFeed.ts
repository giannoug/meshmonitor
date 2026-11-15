/**
 * The Unified Messages feed's data and scroll state, shared by Classic's
 * UnifiedMessagesPage and the Workspace's Overview › Messages (#6365, Rule X:
 * moved verbatim out of the page, so Classic's DOM and behaviour are unchanged).
 *
 *  - Channel selector driven by /api/unified/channels; the picked channel is
 *    the stored one (#5792), else Primary / LongFast, else the first.
 *  - Infinite query with a `before` createdAt cursor, polled every 10 s, folded
 *    into an append-only feed (#3719/#3720).
 *  - Channel collisions (#3644), MeshCore reaction chips (#5763), tapbacks and
 *    reply lookups by packet id, and the client-side source filter.
 *  - `useUnifiedFeedScroll`: newest at the bottom, pinned while at the bottom,
 *    and scroll-up loads older pages through a top sentinel.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { foldUnifiedMessagePages } from '../utils/unifiedMessageAccumulator';
import { ALL_CHANNELS_PARAM } from '../utils/unifiedChannelFilter';
import { groupUnifiedMeshCoreReactions } from './unifiedMeshCoreReactions';
import { readStoredUnifiedChannel, resolveInitialUnifiedChannel } from './unifiedChannelPreference';
import type { TranslateFn } from '../types/translate';
import type { PermissionSet } from '../types/permission';

// ── Types ────────────────────────────────────────────────────────────────

export interface Reception {
  sourceId: string;
  sourceName: string;
  /** Source protocol/type, e.g. 'meshtastic_tcp' | 'mqtt_bridge' | 'meshcore'. */
  sourceType?: string;
  hopStart: number | null;
  hopLimit: number | null;
  /** Decoded hop count (MeshCore only; Meshtastic derives from hopStart/hopLimit). */
  hopCount?: number | null;
  rxSnr: number | null;
  rxRssi: number | null;
  rxTime: number | null;
  timestamp: number;
  /** Broadcast carried a verified XEdDSA signature on this reception (firmware 2.8+). */
  xeddsaSigned?: boolean | null;
}

export interface UnifiedMessage {
  dedupKey: string;
  packetId: number | null;
  requestId: number | null;
  fromNodeNum: number;
  fromNodeId: string;
  fromNodeLongName?: string;
  fromNodeShortName?: string;
  toNodeNum: number;
  toNodeId: string;
  channel: number;
  channelName: string;
  text: string;
  emoji: number | null;
  replyId: number | null;
  timestamp: number; // canonical device time (earliest heard) — for display
  createdAt: number; // earliest server DB arrival time — for ordering / pagination cursor (#3122)
  receptions: Reception[];
  /** Non-reaction MeshCore entries: ids other entries' reaction refs point at. */
  meshcoreRowRefs?: string[];
  /** MeshCore reaction entries: `text` is the emoji. */
  reactionEmoji?: string;
  /** Refs of the targeted rows; empty means unmatched. */
  reactionTargetRefs?: string[];
  /** MeshCore DM / channel entry: wire sender second, for the clock offset (#5973).
   *  Its `timestamp` is then the earliest receipt time. */
  senderTimestamp?: number | null;
}

export interface UnifiedChannel {
  name: string;
  sources: Array<{ sourceId: string; sourceName: string; channelNumber: number }>;
}

/** A device channel sharing its key with a differently-named Channel Database
 *  (server-decryption) entry (#3644). */
export interface ChannelCollisionRow {
  channelId: number;
  channelName: string;
  dbId: number;
  dbName: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Channel shown on a row of the "All Channels" view (#5361). The server names
 * every row; the fallback covers a slot with no name on any source.
 */
export function channelTag(msg: { channel: number; channelName?: string }): string {
  return msg.channelName || `Channel ${msg.channel}`;
}

const PAGE_SIZE = 100;
const POLL_INTERVAL_MS = 10_000;

/**
 * A message is a "reaction" (tapback) if the firmware marked it (emoji=1) OR
 * it replies to something with a body that's just a single emoji char. This
 * matches the detection used in MessagesTab so unified and per-source feeds
 * agree.
 */
const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function isReactionMessage(msg: UnifiedMessage): boolean {
  if (msg.emoji === 1) return true;
  if (msg.replyId != null && msg.text) {
    const t = msg.text.trim();
    // Short bodies that look emoji-ish count as reactions.
    if (t.length > 0 && t.length <= 8 && EMOJI_RE.test(t)) return true;
  }
  return false;
}

export function formatDateDivider(timestampMs: number, t: TranslateFn): string {
  const d = new Date(timestampMs);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return t('unified.messages.date_today');
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t('unified.messages.date_yesterday');
  return d.toLocaleDateString();
}

// ── Feed ─────────────────────────────────────────────────────────────────

/** The channels the viewer can read, by name across sources (also the export form's sources). */
export function useUnifiedChannels() {
  return useQuery<UnifiedChannel[]>({
    queryKey: ['unified', 'channels'],
    queryFn: async () => {
      return apiService.get<UnifiedChannel[]>('/api/unified/channels');
    },
    staleTime: 60_000,
  });
}

export function useUnifiedMessagesFeed() {
  const { authStatus, hasPermission } = useAuth();
  const isAuthenticated = authStatus?.authenticated ?? false;
  // Unified Messages is cross-source: allow whenever the user (including
  // anonymous) has read on messages or any channel on ANY source.
  const canReadAnyMessages =
    isAuthenticated && authStatus?.user?.isAdmin
      ? true
      : hasPermission('messages', 'read', { anySource: true }) ||
        [0, 1, 2, 3, 4, 5, 6, 7].some((n) =>
          hasPermission(`channel_${n}` as keyof PermissionSet, 'read', { anySource: true })
        );

  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  // ── Channels query ────────────────────────────────────────────────────
  const {
    data: channels = [],
    isLoading: loadingChannels,
    isError: channelsError,
  } = useUnifiedChannels();

  // Pick a channel when the list loads if nothing is picked yet: the one the
  // user last chose in this browser (#5792), else Primary / LongFast, else the
  // first channel. Only a manual pick is remembered, not this automatic one.
  useEffect(() => {
    if (!selectedChannel && channels.length > 0) {
      setSelectedChannel(
        resolveInitialUnifiedChannel(
          channels.map((c) => c.name),
          readStoredUnifiedChannel(),
        ),
      );
    }
  }, [channels, selectedChannel]);

  // ── Channel collisions (#3644) ────────────────────────────────────────
  // A device channel can share its key with a differently-named server-side
  // decryption (Channel Database) entry; matching messages then appear under
  // that entry's tab rather than the device channel. Detect it per source
  // (channel_database is global) so we can warn when the viewed channel may be
  // overshadowed.
  const collisionSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of channels) for (const src of c.sources) ids.add(src.sourceId);
    return Array.from(ids).sort();
  }, [channels]);

  const { data: channelCollisions = [] } = useQuery<ChannelCollisionRow[]>({
    queryKey: ['unified', 'channel-collisions', collisionSourceIds],
    enabled: canReadAnyMessages && collisionSourceIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const perSource = await Promise.all(
        collisionSourceIds.map(async (sid) => {
          try {
            const json = await apiService.get<{ collisions?: ChannelCollisionRow[] }>(
              `/api/channels/collisions?sourceId=${encodeURIComponent(sid)}`,
            );
            return (json.collisions ?? []) as ChannelCollisionRow[];
          } catch {
            return [] as ChannelCollisionRow[];
          }
        }),
      );
      return perSource.flat();
    },
  });

  // Names of channels colliding with the viewed channel — the "other side" of
  // each collision (the entry messages may be landing under, or vice versa).
  const overshadowNames = useMemo(() => {
    if (!selectedChannel || selectedChannel === ALL_CHANNELS_PARAM) return [] as string[];
    const sel = selectedChannel.trim().toLowerCase();
    const names = new Set<string>();
    for (const c of channelCollisions) {
      const ch = c.channelName.trim().toLowerCase();
      const db = c.dbName.trim().toLowerCase();
      if (ch === sel && c.dbName.trim()) names.add(c.dbName);
      else if (db === sel && c.channelName.trim()) names.add(c.channelName);
    }
    return Array.from(names);
  }, [channelCollisions, selectedChannel]);

  // ── Messages infinite query ───────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingMessages,
    isError: messagesError,
    refetch,
  } = useInfiniteQuery<UnifiedMessage[], Error>({
    queryKey: ['unified', 'messages', selectedChannel],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      // "All Channels" sends its own value: with no `channel` the server
      // takes the legacy path, which includes DMs and does not page.
      if (selectedChannel) params.set('channel', selectedChannel);
      params.set('limit', String(PAGE_SIZE));
      if (pageParam !== undefined && pageParam !== null) {
        params.set('before', String(pageParam));
      }
      return apiService.get<UnifiedMessage[]>(`/api/unified/messages?${params.toString()}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      // Cursor uses createdAt (server DB arrival time) so pagination matches
      // the server's createdAt ordering and stays stable under device-clock
      // skew (#3122).
      return lastPage[lastPage.length - 1].createdAt;
    },
    enabled: !!selectedChannel && canReadAnyMessages,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    // Only poll the first page (newest messages). Don't re-fetch old pages
    // when polling; they're immutable once loaded.
    refetchOnMount: true,
  });

  // ── Accumulate pages into an append-only feed ─────────────────────────
  // The server feed is a capped newest-N window; rendering straight off the
  // latest poll evicts a message once newer traffic pushes it past the window
  // (#3719/#3720). Fold every poll's pages into a persistent map keyed by
  // dedupKey so a message that has been shown stays shown regardless of how the
  // window shifts. Upserts prefer the newest (most-complete) copy; sort is by
  // createdAt (server DB arrival) so device-clock skew can't reorder (#3122).
  const accumulatorRef = useRef<Map<string, UnifiedMessage>>(new Map());
  const accChannelRef = useRef<string>(selectedChannel);
  const allMessages = useMemo<UnifiedMessage[]>(() => {
    // Reset synchronously when the channel changes so feeds never blend.
    if (accChannelRef.current !== selectedChannel) {
      accChannelRef.current = selectedChannel;
      accumulatorRef.current = new Map();
    }
    return foldUnifiedMessagePages(accumulatorRef.current, data?.pages);
  }, [data?.pages, selectedChannel]);

  // MeshCore reactions fold into chips on their target (#5763).
  const mcReactions = useMemo(() => groupUnifiedMeshCoreReactions(allMessages), [allMessages]);

  // ── All distinct sources heard across the loaded set ──────────────────
  const sourcesInView = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of allMessages) {
      for (const r of m.receptions) {
        if (!map.has(r.sourceId)) map.set(r.sourceId, r.sourceName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allMessages]);

  // ── Apply source filter ───────────────────────────────────────────────
  const filteredMessages = useMemo(() => {
    const rows = mcReactions.rows;
    if (!sourceFilter) return rows;
    return rows.filter((m) => m.receptions.some((r) => r.sourceId === sourceFilter));
  }, [mcReactions, sourceFilter]);

  // Build a quick index by packet id for reply preview + reaction grouping.
  // Meshtastic firmware sets `reply_id` to the parent's meshpacket id, not its
  // requestId — so reactions (tapbacks) and reply previews must look up parents
  // by packet id to match.
  const byPacketId = useMemo(() => {
    const map = new Map<number, UnifiedMessage>();
    for (const m of allMessages) {
      if (m.packetId != null) map.set(m.packetId, m);
    }
    return map;
  }, [allMessages]);

  // Group reactions onto their parent: parent packetId → reactions[]
  const reactionsByParent = useMemo(() => {
    const map = new Map<number, UnifiedMessage[]>();
    for (const m of allMessages) {
      if (!isReactionMessage(m) || m.replyId == null) continue;
      const list = map.get(m.replyId) ?? [];
      list.push(m);
      map.set(m.replyId, list);
    }
    return map;
  }, [allMessages]);

  // Non-reactions only — these drive the main feed.
  const feedMessages = useMemo(
    () => filteredMessages.filter((m) => !isReactionMessage(m)),
    [filteredMessages]
  );

  return {
    canReadAnyMessages,
    selectedChannel,
    setSelectedChannel,
    sourceFilter,
    setSourceFilter,
    channels,
    loadingChannels,
    channelsError,
    channelCollisions,
    overshadowNames,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadingMessages,
    messagesError,
    refetch,
    mcReactions,
    sourcesInView,
    byPacketId,
    reactionsByParent,
    feedMessages,
  };
}

// ── Scroll ───────────────────────────────────────────────────────────────

interface FeedScrollInput {
  feedMessages: UnifiedMessage[];
  selectedChannel: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * Scroll container management (chat-style: newest at bottom). The scroll
 * wrapper is the only scroll surface on the page. We manage scrollTop
 * imperatively so that:
 *   • on first load for a channel the user lands at the bottom,
 *   • polling that appends a new tail keeps the user pinned at the bottom
 *     IFF they were already there (otherwise we don't yank them away from
 *     whatever they were reading),
 *   • fetching an older page (prepend) preserves the user's visible spot
 *     by shifting scrollTop by the exact growth in content height.
 */
export function useUnifiedFeedScroll({
  feedMessages,
  selectedChannel,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: FeedScrollInput) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef<boolean>(true);
  const prevStateRef = useRef<{ len: number; firstKey: string; scrollHeight: number }>({
    len: 0,
    firstKey: '',
    scrollHeight: 0,
  });

  // Reset bookkeeping when the channel changes so the next render pins
  // to bottom.
  useEffect(() => {
    prevStateRef.current = { len: 0, firstKey: '', scrollHeight: 0 };
    wasAtBottomRef.current = true;
  }, [selectedChannel]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = prevStateRef.current;
    const curLen = feedMessages.length;
    const curFirstKey = feedMessages[0]?.dedupKey ?? '';

    if (curLen === 0) {
      prevStateRef.current = { len: 0, firstKey: '', scrollHeight: 0 };
      return;
    }

    if (prev.len === 0) {
      // Initial load for this channel: pin to the bottom.
      el.scrollTop = el.scrollHeight;
    } else if (curFirstKey !== prev.firstKey) {
      // Prepended older messages from fetchNextPage. Keep the user's current
      // viewpoint stable by shifting scrollTop by the delta in content height.
      el.scrollTop = el.scrollTop + (el.scrollHeight - prev.scrollHeight);
    } else if (wasAtBottomRef.current) {
      // Appended new tail messages from polling. Stick to bottom iff the user
      // was already pinned there.
      el.scrollTop = el.scrollHeight;
    }

    prevStateRef.current = {
      len: curLen,
      firstKey: curFirstKey,
      scrollHeight: el.scrollHeight,
    };
  }, [feedMessages]);

  // ── Infinite scroll sentinel (at the TOP — scrolls up loads older) ────
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // `wasAtBottomRef`: for a page whose layout can change the feed's width (the Workspace's side panel).
  return { scrollRef, handleScroll, sentinelRef, wasAtBottomRef };
}
