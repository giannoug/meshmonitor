/**
 * The open device's DM conversations in the layout D sidebar (board
 * a-chat-D-desktop): one row per peer, newest first, bold with a count while
 * unread, each linking to `/source/:id/dm/:nodeId`.
 *
 * Like ChannelList it reads the poll reply the page already holds and the
 * unread counts the shell already polls, so it adds no request. The caller
 * shows it only where Classic shows DMs (`messages:read` on the device).
 *
 * Each row has the board's presence dot: heard in the last 2 hours, the same
 * window as the shell's "N online" count.
 */
import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { appBasename } from '../../init';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import type { PollData } from '../../hooks/usePoll';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { isHeardRecently } from './channelLabel';
import styles from './ChannelList.module.css';

interface DmListProps {
  sourceId: string;
  onNavigate?: () => void;
  /** Phone rows (52 px, board c-home-e1) on the device Home. */
  large?: boolean;
  /** Show only the most recent conversations (the device Home). */
  limit?: number;
}

export default function DmList({ sourceId, onNavigate, large, limit }: DmListProps) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const { data: poll } = useQuery<PollData>({ queryKey: sourcePollQueryKey(sourceId), queryFn: skipToken });
  const { data: unread } = useUnreadCounts({
    baseUrl: appBasename,
    sourceId,
    enabled: authStatus?.authenticated === true,
  });

  const peers = useMemo(() => {
    const local = (poll?.deviceConfig?.basic?.nodeId as string | undefined) || poll?.config?.localNodeInfo?.nodeId;
    const latest = new Map<string, number>();
    for (const m of poll?.messages ?? []) {
      if (m.channel !== -1) continue;
      const peer = m.fromNodeId === local ? m.toNodeId : m.fromNodeId;
      if (!peer || peer === local) continue;
      latest.set(peer, Math.max(latest.get(peer) ?? 0, new Date(m.timestamp).getTime()));
    }
    return [...latest].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, limit);
  }, [poll, limit]);

  const nodeOf = (id: string) => poll?.nodes?.find((n) => n.user?.id === id);
  const nameOf = (id: string) => nodeOf(id)?.user?.longName || nodeOf(id)?.user?.shortName || id;
  const lastHeardOf = (id: string) => nodeOf(id)?.lastHeard;

  return (
    <ul className={styles.list}>
      {peers.map((id) => {
        const count = unread?.directMessages[id] ?? 0;
        const name = nameOf(id);
        return (
          <li key={id}>
            <NavLink
              to={`/source/${encodeURIComponent(sourceId)}/dm/${encodeURIComponent(id)}`}
              className={({ isActive }) => `${styles.row} ${large ? styles.large : ''} ${isActive ? styles.on : ''} ${count > 0 ? styles.unread : ''}`}
              onClick={onNavigate}
              aria-label={count > 0 ? t('workspace.shell.device_unread', { name, count }) : undefined}
            >
              {/* In the channels' "#" column, so the names line up. */}
              <span className={styles.hash} aria-hidden="true">
                <span className={styles.presence} data-presence={isHeardRecently(lastHeardOf(id)) ? 'online' : 'offline'} />
              </span>
              <span className={styles.name}>{name}</span>
              {count > 0 && <span className={styles.badge} aria-hidden="true">{count}</span>}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
