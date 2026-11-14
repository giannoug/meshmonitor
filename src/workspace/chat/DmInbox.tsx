/**
 * The DM inbox (boards c-home-e3-dms, 10-11-dm-inbox): `/source/:id/dms` on a
 * Meshtastic-family device, phone and desktop. One row per conversation with
 * its last message (ours as "You: …"), when, and its unread, each opening the
 * DM; today's DM list controls (Classic's MessagesTab) around it:
 *
 * - the filter field (names, short names, ids and message text; while it holds
 *   text it searches every node, so a new conversation can be started);
 * - today's DmFilterSelect and its sort (pinned, then unread, then hops or
 *   favourites / latest / last heard), through today's `passesDmFilter`;
 * - Mark All Read for every DM on this device;
 * - Pin, today's sticky list (same storage as Classic).
 *
 * One owner per screen (Ruling AD): App is not mounted here. The screen runs
 * the source's poll (the request App would run) and reads the shell's unread
 * counts. Nothing here sends on the mesh.
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { DmFilterSelect } from '../../components/messages/DmFilterSelect';
import { MarkAllReadButton } from '../../components/messages/MarkAllReadButton';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useStickyDmNodes } from '../../hooks/useStickyDmNodes';
import { useMarkAsRead, useUnreadCounts } from '../../hooks/useUnreadCounts';
import { appBasename } from '../../init';
import type { DeviceInfo } from '../../types/device';
import type { DmFilter } from '../../types/ui';
import { formatRelativeTime } from '../../utils/datetime';
import { passesDmFilter } from '../../utils/dmListFilter';
import { formatMessagePreview } from '../../utils/messagePreview';
import { hasValidPosition, isInfrastructureNode } from '../../utils/nodeHelpers';
import { getEffectiveHops } from '../../utils/nodeHops';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import ChatProviders from './ChatProviders';
import { isHeardRecently } from './channelLabel';
import { useChatRuntime } from './useChatRuntime';
import threadStyles from './ChannelThread.module.css';
import styles from './DmInbox.module.css';

export interface DmInboxRouteProps {
  sourceId: string;
  source: DashboardSource;
}

export default function DmInboxRoute({ sourceId, source }: DmInboxRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="messages">
      <DmInbox sourceId={sourceId} deviceName={source.name} />
    </ChatProviders>
  );
}

interface Row {
  node: DeviceInfo;
  id: string;
  name: string;
  lastTime: number;
  preview: string;
  unread: number;
  pinned: boolean;
}

function DmInbox({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission } = useAuth();
  const { pollData: poll } = useChatRuntime(-1);
  const { nodeHopsCalculation, timeFormat, dateFormat } = useSettings();
  const canRead = hasPermission('messages', 'read', { sourceId });
  const { data: unread } = useUnreadCounts({ baseUrl: appBasename, sourceId, enabled: authStatus?.authenticated === true });
  const { mutateAsync: markRead } = useMarkAsRead({ baseUrl: appBasename });
  const [sticky, toggleSticky] = useStickyDmNodes();
  const [filter, setFilter] = useState<DmFilter>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<Row[]>(() => {
    const local = (poll?.deviceConfig?.basic?.nodeId as string | undefined) || poll?.config?.localNodeInfo?.nodeId;
    const localNum = local ? parseInt(local.slice(1), 16) : null;
    // Each peer's DMs, from the poll the screen holds.
    const byPeer = new Map<string, { last: { text: string; time: number; ours: boolean }; texts: string[] }>();
    for (const m of poll?.messages ?? []) {
      if (m.channel !== -1) continue;
      const ours = m.fromNodeId === local;
      const peer = ours ? m.toNodeId : m.fromNodeId;
      if (!peer || peer === local) continue;
      // getMessageSortTime's rule (receive time, else send time) on the poll's raw rows.
      const time = new Date(m.receivedAt ?? m.timestamp).getTime();
      const entry = byPeer.get(peer) ?? { last: { text: '', time: -1, ours }, texts: [] };
      entry.texts.push((m.text ?? '').toLowerCase());
      if (time > entry.last.time) entry.last = { text: m.text ?? '', time, ours };
      byPeer.set(peer, entry);
    }
    const term = query.trim().toLowerCase();
    const hopsOf = (n: DeviceInfo) => getEffectiveHops(n, nodeHopsCalculation, poll?.traceroutes, localNum);
    return (poll?.nodes ?? [])
      .flatMap((node): Row[] => {
        const id = node.user?.id;
        if (!id || id === local) return [];
        const dms = byPeer.get(id);
        const pinned = sticky.has(node.nodeNum);
        // Without a search, the inbox is conversations (and pins); a search reaches every node.
        if (!term && !dms && !pinned) return [];
        const name = node.user?.longName || t('messages.node_fallback', { nodeNum: node.nodeNum });
        if (
          term &&
          !name.toLowerCase().includes(term) &&
          !node.user?.shortName?.toLowerCase().includes(term) &&
          !id.toLowerCase().includes(term) &&
          !dms?.texts.some((text) => text.includes(term))
        ) {
          return [];
        }
        const count = unread?.directMessages[id] ?? 0;
        const lastTime = dms ? dms.last.time : 0;
        if (
          !pinned &&
          !passesDmFilter(
            { unread: count > 0, lastMessageTime: lastTime, isFavorite: node.isFavorite === true, hasPosition: hasValidPosition(node), isInfrastructure: isInfrastructureNode(node) },
            filter,
          )
        ) {
          return [];
        }
        const text = dms ? formatMessagePreview(dms.last.text) : '';
        const preview = dms ? (dms.last.ours ? t('workspace.dms.you_prefix', { text }) : text) : t('messages.no_messages_preview');
        return [{ node, id, name, lastTime, preview, unread: count, pinned }];
      })
      .sort((a, b) => {
        // Today's order (MessagesTab): pinned, then unread (newest first), then hops for the hop-based filters,
        // else favourites, latest message, last heard, name.
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
        if (a.unread > 0 && b.lastTime !== a.lastTime) return b.lastTime - a.lastTime;
        if (['hops', 'favorites', 'withPosition', 'noInfra'].includes(filter)) return hopsOf(a.node) - hopsOf(b.node);
        if (!!a.node.isFavorite !== !!b.node.isFavorite) return a.node.isFavorite ? -1 : 1;
        return b.lastTime - a.lastTime || (b.node.lastHeard ?? 0) - (a.node.lastHeard ?? 0) || a.name.localeCompare(b.name);
      });
  }, [poll, unread, sticky, filter, query, nodeHopsCalculation, t]);

  const totalUnread = Object.values(unread?.directMessages ?? {}).reduce((sum, n) => sum + n, 0);

  return (
    <div className={threadStyles.page} data-phone={isPhone || undefined}>
      <header className={threadStyles.header}>
        <div className={threadStyles.titles}>
          <h1 className={threadStyles.title}>{t('workspace.shell.direct_messages')}</h1>
          <p className={threadStyles.subtitle}>{deviceName}</p>
        </div>
        {canRead && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => searchRef.current?.focus()}
            aria-label={t('workspace.shell.message_a_node')}
            title={t('workspace.shell.message_a_node')}
          >
            <UiIcon name="edit" size={22} />
          </button>
        )}
      </header>
      {!canRead ? (
        <StateView kind="noPermission" />
      ) : (
        <>
          <div className={styles.controls}>
            <label className={styles.search}>
              <UiIcon name="search" size={18} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('messages.filter_placeholder')}
                aria-label={t('messages.filter_placeholder')}
              />
            </label>
            <div className={styles.row2}>
              <DmFilterSelect value={filter} onChange={setFilter} />
              <MarkAllReadButton
                className={styles.markAll}
                label={t('messages.mark_all_read_button')}
                title={t('messages.mark_all_read_title')}
                unreadCount={totalUnread}
                confirmMessage={t('workspace.chat.mark_read_confirm')}
                onMarkAll={() => markRead({ allDMs: true, sourceId })}
              />
            </div>
          </div>
          <ul className={styles.list} aria-label={t('workspace.shell.direct_messages')}>
            {rows.map((r) => (
              <li key={r.id} className={styles.item}>
                <Link
                  to={`/source/${encodeURIComponent(sourceId)}/dm/${encodeURIComponent(r.id)}`}
                  className={`${styles.link} ${r.unread > 0 ? styles.unread : ''}`}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {r.node.user?.shortName || '?'}
                    <span className={styles.presence} data-presence={isHeardRecently(r.node.lastHeard) ? 'online' : 'offline'} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.line}>
                      <span className={styles.name}>{r.name}</span>
                      {r.lastTime > 0 && <span className={styles.time}>{formatRelativeTime(r.lastTime, timeFormat, dateFormat)}</span>}
                    </span>
                    <span className={styles.line}>
                      <span className={styles.preview}>{r.preview}</span>
                      {r.unread > 0 && <span className={styles.badge}>{r.unread}</span>}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={`${styles.pin} ${r.pinned ? styles.pinned : ''}`}
                  aria-pressed={r.pinned}
                  title={t(r.pinned ? 'messages.unpin_node' : 'messages.pin_node')}
                  onClick={() => toggleSticky(r.node.nodeNum)}
                >
                  <UiIcon name="pin" size={18} />
                  <span className={threadStyles.srOnly}>{`${t(r.pinned ? 'messages.unpin_node' : 'messages.pin_node')}: ${r.name}`}</span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length === 0 && <StateView kind="empty" />}
        </>
      )}
    </div>
  );
}
