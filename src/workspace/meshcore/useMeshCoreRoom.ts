/**
 * One room server's state for the Workspace room page (Task 7.1): today's
 * MeshCoreRoomsView behaviour for the open room, with the same requests.
 *
 * - Login: one request per press (`rooms/login`, or `rooms/login-with-saved`
 *   when a password is saved and the field is empty, as today), run through
 *   today's `useMeshCoreLoginProgress` (the server's attempts, its countdown
 *   and Cancel). Nothing here retries. Opening a room never logs in (M10).
 * - The password lives only in this hook's state: it goes in the request body,
 *   is cleared after a login, and is never logged, put in a URL or shown back.
 *   "Remember" uses today's server-side store (`persisted`); Forget is today's
 *   DELETE, which also turns auto-sync off on the server.
 * - Auto-sync is today's per-room setting (`rooms/sync-config`), run by today's
 *   server scheduler; saving it is one PATCH and arms nothing here.
 * - Posts: the server backlog (`messages/room/:key`, 200 then pages of 100)
 *   merged with live posts, ordered by sender time; stats from `room-stats`.
 * - Unread: the room's mark pinned on entry, then marked read as posts arrive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import type { MeshCoreMessage, RoomSyncFailureReason } from '../../components/MeshCore/hooks/useMeshCore';
import { useMeshCoreLoginProgress } from '../../components/MeshCore/hooks/useMeshCoreLoginProgress';
import { buildRoomFilter } from '../../components/MeshCore/MeshCoreRoomsView';
import { loadRoomLastRead, markRoomRead } from '../../components/MeshCore/meshcoreUnreadStore';
import { compareMeshCoreMessages } from '../../components/MeshCore/messageOrder';
import { meshcoreReceiptTimeMs } from '../../utils/meshcoreMessageTime';
import { useMeshCoreRuntime } from './runtime';
import { setRoomLoggedIn, useRoomSessions } from './roomSessions';
import { mcKeys } from './useMeshCoreLists';

/** Today's auto-sync choices (minutes); the server takes 60–1440. */
export const SYNC_INTERVALS = [60, 120, 240, 480, 720, 1440];

export function useMeshCoreRoom(roomKey: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { authStatus, hasPermission } = useAuth();
  const { sourceId, meshCore, receiveOnly } = useMeshCoreRuntime();
  const { actions, messages, contacts, status } = meshCore;
  const scope = { sourceId };
  const canSend = hasPermission('messages', 'write', scope);
  const canConfig = hasPermission('configuration', 'write', scope);
  const canReadConfig = hasPermission('configuration', 'read', scope);
  const connected = status?.connected ?? false;
  const room = contacts.find((c) => c.publicKey === roomKey) ?? null;
  const loggedIn = useRoomSessions(sourceId).has(roomKey);

  const { data: creds } = useQuery({
    queryKey: mcKeys.roomCreds(sourceId),
    enabled: authStatus?.authenticated === true,
    queryFn: async () => {
      const c = await actions.getRoomCredentials();
      return { canRemember: c?.canRemember === true, stored: new Set((c?.stored ?? []).map((s) => s.publicKey)) };
    },
  });
  const canRemember = creds?.canRemember ?? false;
  const saved = creds?.stored.has(roomKey) ?? false;
  const refreshCreds = () => void queryClient.invalidateQueries({ queryKey: mcKeys.roomCreds(sourceId) });

  // Login (today's handlers).
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noReply, setNoReply] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { progress, run, cancel } = useMeshCoreLoginProgress(actions);
  const useSaved = saved && password === '';

  const [syncFailure, setSyncFailure] = useState<{ count: number; reason: RoomSyncFailureReason } | null>(null);
  const begin = () => {
    setLoading(true);
    setError(null);
    setNoReply(false);
    setNotice(null);
  };
  const loginWithSaved = useCallback(async () => {
    if (receiveOnly) return;
    begin();
    try {
      const { value, cancelledByUser } = await run((requestId) => actions.loginRoomWithSaved(roomKey, { requestId }));
      if (cancelledByUser || value.cancelled) setNotice(t('meshcore.rooms.login_cancelled', 'Login cancelled'));
      else if (value.success) {
        setRoomLoggedIn(sourceId, roomKey, true);
        setSyncFailure(null);
      } else if (value.reason === 'no_reply' || value.code === 'ROOM_LOGIN_NO_REPLY') setNoReply(true);
      else if (value.reason === 'rejected') setError(t('meshcore.rooms.saved_password_refused_short', 'The saved password was refused by this room server.'));
      else setError(t('meshcore.rooms.login_failed', 'Login failed'));
    } catch {
      setError(t('meshcore.rooms.login_failed', 'Login failed'));
    } finally {
      setLoading(false);
    }
  }, [receiveOnly, run, actions, roomKey, sourceId, t]);
  const login = useCallback(async () => {
    if (receiveOnly) return;
    begin();
    try {
      const { value, cancelledByUser } = await run((requestId) => actions.loginRoom(roomKey, password, remember, { requestId }));
      if (cancelledByUser || value.cancelled) {
        setNotice(t('meshcore.rooms.login_cancelled', 'Login cancelled'));
        // A reply may have raced the cancel: re-read which rooms have a saved password.
        refreshCreds();
      } else if (value.success) {
        setRoomLoggedIn(sourceId, roomKey, true);
        if (value.persisted) refreshCreds();
        setPassword('');
        setSyncFailure(null);
      } else {
        setError(value.error || t('meshcore.rooms.login_failed', 'Login failed'));
        setNoReply(value.reason === 'no_reply' || value.code === 'ROOM_LOGIN_NO_REPLY');
      }
    } catch {
      setError(t('meshcore.rooms.login_failed', 'Login failed'));
    } finally {
      setLoading(false);
    }
    // refreshCreds reads only the stable query client and source.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 refreshCreds is rebuilt each render
  }, [receiveOnly, run, actions, roomKey, password, remember, sourceId, t]);
  const [forgetting, setForgetting] = useState(false);
  const forget = useCallback(async () => {
    setForgetting(true);
    try {
      if (await actions.forgetRoomCredential(roomKey)) {
        refreshCreds();
        setSyncFailure(null);
        setSyncEnabled(false);
        setError(null);
      }
    } finally {
      setForgetting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 refreshCreds is rebuilt each render
  }, [actions, roomKey]);
  /** Log out (Ruling 7.1 room-logout): forgets this browser's login; sends nothing, as leaving today's Rooms view. */
  const logout = () => setRoomLoggedIn(sourceId, roomKey, false);

  // Auto-sync: today's setting, read when the room opens.
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60);
  const [syncDirty, setSyncDirty] = useState(false);
  const { getRoomSyncConfig, setRoomSyncConfig } = actions;
  useEffect(() => {
    if (!canReadConfig) return;
    let cancelled = false;
    void getRoomSyncConfig(roomKey).then((c) => {
      if (cancelled) return;
      setSyncEnabled(c?.enabled ?? false);
      setSyncInterval(c?.intervalMinutes ?? 60);
      setSyncFailure(c && c.failureCount > 0 && c.lastError ? { count: c.failureCount, reason: c.lastError } : null);
      setSyncDirty(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canReadConfig, getRoomSyncConfig, roomKey]);
  const saveSync = useCallback(async () => {
    if (await setRoomSyncConfig(roomKey, syncEnabled, syncInterval)) setSyncDirty(false);
  }, [setRoomSyncConfig, roomKey, syncEnabled, syncInterval]);

  // Posts and stats.
  const { fetchRoomMessages, fetchRoomStats } = actions;
  const [history, setHistory] = useState<MeshCoreMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const historyRef = useRef(history);
  historyRef.current = history;
  useEffect(() => {
    let cancelled = false;
    setHasMore(false);
    void fetchRoomMessages(roomKey, { offset: 0, limit: 200 }).then(({ messages: hist, hasMore: more }) => {
      if (cancelled) return;
      setHistory(hist);
      setHasMore(more);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRoomMessages, roomKey, connected, loggedIn]);
  const loadOlder = useCallback(() => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    void fetchRoomMessages(roomKey, { offset: historyRef.current.length, limit: 100 })
      .then(({ messages: older, hasMore: more }) => {
        setHistory((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !seen.has(m.id)), ...prev];
        });
        setHasMore(more);
      })
      .finally(() => setLoadingOlder(false));
  }, [fetchRoomMessages, roomKey, hasMore, loadingOlder]);
  const filter = useMemo(() => buildRoomFilter(roomKey), [roomKey]);
  const posts = useMemo(() => {
    const byId = new Map<string, MeshCoreMessage>();
    if (ready) for (const m of history) byId.set(m.id, m);
    for (const m of messages) if (filter(m)) byId.set(m.id, m);
    return [...byId.values()].sort(compareMeshCoreMessages);
  }, [ready, history, messages, filter]);
  const livePosts = useMemo(() => messages.reduce((n, m) => (m.messageType === 'room_post' ? n + 1 : n), 0), [messages]);
  const [stats, setStats] = useState<{ count: number; latest: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchRoomStats().then((all) => {
      const s = all.find((x) => x.roomPublicKey === roomKey || x.roomPublicKey.startsWith(roomKey) || roomKey.startsWith(x.roomPublicKey));
      if (!cancelled) setStats(s ? { count: s.count, latest: s.latest } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRoomStats, roomKey, connected, livePosts]);

  // Unread: the mark as it was on entry, then read up to the newest post.
  const [entryLastRead] = useState<number>(() => loadRoomLastRead(sourceId)[roomKey] ?? 0);
  useEffect(() => {
    const latest = posts.reduce((mx, m) => Math.max(mx, meshcoreReceiptTimeMs(m)), 0);
    markRoomRead(sourceId, roomKey, latest || Date.now());
  }, [sourceId, roomKey, posts]);

  const send = useCallback(
    async (text: string) => {
      const ok = await actions.sendRoomPost(roomKey, text);
      // Our own post counts in the room's newest time; keep the room read (#6261).
      if (ok) markRoomRead(sourceId, roomKey, Date.now());
      return ok;
    },
    [actions, roomKey, sourceId],
  );

  return {
    room,
    loggedIn,
    canSend,
    canConfig,
    canRemember,
    saved,
    connected,
    login: { password, setPassword, remember, setRemember, loading, error, noReply, notice, progress, cancel, useSaved, run: useSaved ? loginWithSaved : login, login, loginWithSaved },
    forget,
    forgetting,
    logout,
    sync: {
      enabled: syncEnabled,
      interval: syncInterval,
      dirty: syncDirty,
      failure: error ? null : syncFailure,
      setEnabled: (v: boolean) => {
        setSyncEnabled(v);
        setSyncDirty(true);
      },
      setInterval: (v: number) => {
        setSyncInterval(v);
        setSyncDirty(true);
      },
      save: saveSync,
    },
    posts,
    ready,
    hasMore: ready && hasMore,
    loadingOlder,
    loadOlder,
    postCount: Math.max(posts.length, stats?.count ?? 0),
    lastPost: posts.length > 0 ? Math.max(...posts.map((m) => m.timestamp)) : stats?.latest ?? null,
    entryLastRead,
    send,
  };
}
