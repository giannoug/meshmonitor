/**
 * One MeshCore channel's state for the Workspace thread (Task 7.1): today's
 * MeshCoreChannelsView behaviour for one open channel, with the same requests
 * and the same guards.
 *
 * - The backlog: `messages/channel/:idx?limit=200`, then older pages of 100;
 *   merged with the live pool (live copy wins, heard-by merged) and ordered
 *   as today (`compareMeshCoreMessages`). A stale page never lands.
 * - Unread: the last-read mark pinned on entry (the unread line), then the
 *   channel marked read up to its newest message once the backlog is in.
 * - Required repeaters (`/api/settings`), the default scope and saved regions
 *   (both only for a viewer who can send, as today).
 * - The one-off send scope (#3701): null uses the channel's own scope, else the
 *   source default; '' is unscoped. Reset on every channel. Replying sets it to
 *   the message's scope, as today.
 * - Region discovery transmits, so it runs at most once per screen, only when
 *   the scope menu opens on a connected, non-receive-only device (#3704).
 * - Delete, resend and clear patch the backlog too (today's #3981 / #5512 fix).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
import { buildChannelFilter } from '../../components/MeshCore/MeshCoreChannelsView';
import { loadChannelLastRead, markChannelRead } from '../../components/MeshCore/meshcoreUnreadStore';
import { compareMeshCoreMessages } from '../../components/MeshCore/messageOrder';
import { mergeMeshCoreHeardBy, readRequiredRepeaters, type RequiredRepeaterMode } from '../../utils/meshcoreHeardBy';
import { meshcoreReceiptTimeMs } from '../../utils/meshcoreMessageTime';
import { useMeshCoreRuntime } from './runtime';
import { channelsQuery } from './useMeshCoreLists';

const PAGE_FIRST = 200;
const PAGE_OLDER = 100;

export function useMeshCoreChannel(idx: number) {
  const { sourceId, meshCore, receiveOnly } = useMeshCoreRuntime();
  const { hasPermission } = useAuth();
  const { messages, status, actions } = meshCore;
  const connected = status?.connected ?? false;
  const canSend = hasPermission('messages', 'write', { sourceId });
  const mc = `/api/sources/${encodeURIComponent(sourceId)}/meshcore`;

  const { data: rows, isPending: listPending } = useQuery(channelsQuery(sourceId, connected));
  const channel =
    rows?.find((c) => c.id === idx) ??
    // Today's synthetic Public before the first channel sync.
    (rows && rows.length === 0 && idx === 0 ? { id: 0, name: 'Public', scope: null, psk: null, readOnly: false, virtual: false } : null);

  // The backlog, keyed so a page for another channel or connection never lands.
  const [history, setHistory] = useState<MeshCoreMessage[]>([]);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const activeRef = useRef(idx);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    activeRef.current = idx;
    setHasMore(false);
    setLoadingOlder(false);
    void (async () => {
      try {
        const body = await apiService.get<{ success?: boolean; data?: MeshCoreMessage[]; hasMore?: boolean }>(`${mc}/messages/channel/${idx}?limit=${PAGE_FIRST}`);
        if (cancelled) return;
        setHistory(body?.success && Array.isArray(body.data) ? body.data : []);
        setHasMore(Boolean(body?.hasMore));
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryFor(`${sourceId}:${idx}`);
      }
    })();
    void (async () => {
      try {
        const body = await apiService.get<{ counts?: Record<number, number> }>(`${mc}/messages/channel-counts?channels=${idx}`);
        if (!cancelled) setCount(body?.counts?.[idx] ?? null);
      } catch {
        /* the header leaves the count out */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mc, sourceId, idx, connected]);

  const loadOlder = useCallback(() => {
    if (loadingOlder || !hasMore) return;
    const at = idx;
    setLoadingOlder(true);
    void (async () => {
      try {
        const body = await apiService.get<{ success?: boolean; data?: MeshCoreMessage[]; hasMore?: boolean }>(
          `${mc}/messages/channel/${at}?limit=${PAGE_OLDER}&offset=${historyRef.current.length}`,
        );
        if (activeRef.current !== at) return;
        const older = body?.success && Array.isArray(body.data) ? body.data : [];
        setHistory((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !seen.has(m.id)), ...prev];
        });
        setHasMore(Boolean(body?.hasMore) && older.length > 0);
      } catch {
        if (activeRef.current === at) setHasMore(false);
      } finally {
        if (activeRef.current === at) setLoadingOlder(false);
      }
    })();
  }, [mc, idx, hasMore, loadingOlder]);

  const ready = historyFor === `${sourceId}:${idx}`;
  const filter = useMemo(() => buildChannelFilter(idx), [idx]);
  const merged = useMemo(() => {
    const byId = new Map<string, MeshCoreMessage>();
    if (ready) for (const m of history) byId.set(m.id, m);
    for (const m of messages) {
      if (!filter(m)) continue;
      const heardBy = mergeMeshCoreHeardBy(byId.get(m.id)?.heardBy, m.heardBy);
      byId.set(m.id, heardBy?.length ? { ...m, heardBy } : m);
    }
    return [...byId.values()].sort(compareMeshCoreMessages);
  }, [history, ready, messages, filter]);

  // The unread line: the mark as it was on entry, pinned per channel.
  const [entryLastRead, setEntryLastRead] = useState<number | null>(null);
  useEffect(() => {
    setEntryLastRead(loadChannelLastRead(sourceId)[idx] ?? 0);
  }, [sourceId, idx]);
  const newest = merged.length > 0 ? meshcoreReceiptTimeMs(merged[merged.length - 1]) : 0;
  useEffect(() => {
    if (ready) markChannelRead(sourceId, idx, newest || Date.now());
  }, [ready, sourceId, idx, newest]);

  // Required repeaters (#6193), read per device.
  const { data: required } = useQuery({
    queryKey: ['workspace', 'meshcore', 'required-repeaters', sourceId],
    queryFn: async () => readRequiredRepeaters(await apiService.get<Record<string, unknown>>(`/api/settings?sourceId=${encodeURIComponent(sourceId)}`)),
  });
  const requiredKeys = required?.keys ?? [];
  const requiredMode: RequiredRepeaterMode = required?.mode ?? 'any';

  // The send scope: the default (channel, else source), saved regions, then any found nearby.
  const { getDefaultScope, fetchSavedRegions, discoverRegions } = actions;
  const [defaultScope, setDefaultScope] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [override, setOverride] = useState<string | null>(null);
  useEffect(() => setOverride(null), [idx]);
  useEffect(() => {
    if (!canSend || !connected) return;
    let cancelled = false;
    void getDefaultScope().then((s) => !cancelled && setDefaultScope(s ?? ''));
    return () => {
      cancelled = true;
    };
  }, [canSend, connected, getDefaultScope]);
  useEffect(() => {
    if (!canSend) return;
    let cancelled = false;
    void fetchSavedRegions().then((r) => !cancelled && r && setSaved(r.map((x) => x.name)));
    return () => {
      cancelled = true;
    };
  }, [canSend, fetchSavedRegions, sourceId]);
  const discoveredOnce = useRef(false);
  const onScopeMenuOpen = useCallback(() => {
    if (!connected || receiveOnly || discoveredOnce.current) return;
    discoveredOnce.current = true;
    void discoverRegions()
      .then((r) => r?.regions && setDiscovered(r.regions))
      .catch(() => {
        discoveredOnce.current = false;
      });
  }, [connected, receiveOnly, discoverRegions]);
  const baseScope = (channel?.scope && channel.scope.trim()) || defaultScope.trim();
  const sendScope = override ?? baseScope;

  const send = useCallback(
    (text: string) => (override !== null ? actions.sendMessage(text, undefined, idx, override) : actions.sendMessage(text, undefined, idx)),
    [actions, idx, override],
  );
  const replyScope = useCallback((m: MeshCoreMessage) => {
    if (m.scopeName?.trim()) setOverride(m.scopeName);
    else if (m.scopeCode === 0) setOverride('');
  }, []);
  const remove = useCallback(
    async (m: MeshCoreMessage) => {
      const ok = await actions.deleteMessage(m.id);
      if (ok) {
        setHistory((prev) => prev.filter((x) => x.id !== m.id));
        setCount((c) => (c === null ? c : Math.max(0, c - 1)));
      }
      return ok;
    },
    [actions],
  );
  const resend = useCallback(
    async (m: MeshCoreMessage) => {
      const state = await actions.resendMessage(m.id);
      if (state) setHistory((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...state } : x)));
      return state;
    },
    [actions],
  );
  const clear = useCallback(async () => {
    const ok = await actions.clearChannelMessages(idx);
    if (ok) {
      setHistory([]);
      setHasMore(false);
      setCount(0);
    }
    return ok;
  }, [actions, idx]);

  return {
    channel,
    listPending,
    messages: merged,
    ready,
    hasMore: ready && hasMore,
    loadingOlder,
    loadOlder,
    count: count === null ? null : Math.max(count, merged.filter((m) => !m.reactionEmoji).length),
    entryLastRead,
    requiredKeys,
    requiredMode,
    canSend,
    connected,
    scope: { base: baseScope, override, send: sendScope, saved, discovered, setOverride, onMenuOpen: onScopeMenuOpen },
    send,
    replyScope,
    remove,
    resend,
    clear,
  };
}
