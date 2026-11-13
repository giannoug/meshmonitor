/**
 * The devices the Workspace rail and sidebar show (spec §5.3), from today's
 * polled hooks: no new socket and no new endpoint (Ruling N).
 *
 * - Only sources the viewer can read: any per-source grant for that id
 *   (Review Focus 2). The server's list is not filtered by permission.
 * - Enabled sources first, in API order (Server › Devices order); disabled ones
 *   after them, marked `disabled`, for the callers that list them.
 * - `unread`: DMs from `/unread-by-source`, plus the open device's channel
 *   unread (`/unread-counts?sourceId=`, the query its own page polls).
 *   shortcut: other devices count DMs only; Phase 2 decides whether channel
 *   unread for every device is worth one poll per source.
 */
import { useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { appBasename } from '../../init';
import { useDashboardSources, useSourceStatuses, type DashboardSource, type SourceStatus } from '../../hooks/useDashboardData';
import { useUnreadBySource } from '../../hooks/useUnreadBySource';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { SOURCEY_RESOURCES } from '../../types/permission';

export type WorkspaceSourceStatus = 'connected' | 'connecting' | 'offline' | 'disabled';

export type WorkspaceSource = DashboardSource & {
  status: WorkspaceSourceStatus;
  unread: number;
  /** DMs only (`/unread-by-source`): the phone's DMs tab badge. */
  dmUnread: number;
  abbrev: string;
  colorToken: string;
  /** The source's own status reply, when it has one (node number, counts). */
  live: SourceStatus | null;
};

/** Up to two letters: the initials of the first two words, or the first two letters of one. */
export function abbrevOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function statusOf(source: DashboardSource, live: SourceStatus | null): WorkspaceSourceStatus {
  if (!source.enabled) return 'disabled';
  if (!live) return 'connecting';
  return live.connected ? 'connected' : 'offline';
}

export function useWorkspaceSources(): { sources: WorkspaceSource[]; isLoading: boolean } {
  const { authStatus, hasPermission } = useAuth();
  const { pathname } = useLocation();
  const openId = matchPath('/source/:sourceId/*', pathname)?.params.sourceId ?? null;
  const { data, isLoading } = useDashboardSources();

  const readable = useMemo(
    () =>
      (data ?? []).filter((s) => SOURCEY_RESOURCES.some((r) => hasPermission(r, 'read', { sourceId: s.id }))),
    [data, hasPermission],
  );
  const statuses = useSourceStatuses(readable.map((s) => s.id));
  const signedIn = authStatus?.authenticated === true;
  const { data: dms } = useUnreadBySource({ baseUrl: appBasename, enabled: signedIn });
  const openReadable = readable.some((s) => s.id === openId);
  const { data: openCounts } = useUnreadCounts({ baseUrl: appBasename, sourceId: openId, enabled: signedIn && openReadable });

  const sources = useMemo(() => {
    const ordered = [...readable.filter((s) => s.enabled), ...readable.filter((s) => !s.enabled)];
    return ordered.map((s): WorkspaceSource => {
      const live = statuses.get(s.id) ?? null;
      const channelUnread =
        s.id === openId && openCounts ? Object.values(openCounts.channels).reduce((a, n) => a + n, 0) : 0;
      const dmUnread = dms?.sources[s.id]?.directMessages ?? 0;
      return {
        ...s,
        live,
        status: statusOf(s, live),
        unread: dmUnread + channelUnread,
        dmUnread,
        abbrev: abbrevOf(s.name),
        // By position in the full list, so a colour does not move when another device is hidden.
        colorToken: `var(--device-${((data ?? []).indexOf(s) % 8) + 1})`,
      };
    });
  }, [readable, statuses, dms, openId, openCounts, data]);

  return { sources, isLoading };
}
