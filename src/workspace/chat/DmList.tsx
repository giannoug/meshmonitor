/**
 * The open device's DM conversations in the layout D sidebar (board
 * a-chat-D-desktop): one row per peer, newest first, bold with a count while
 * unread, each linking to `/source/:id/dm/:nodeId`.
 *
 * Like ChannelList it reads the poll reply the page already holds and the
 * unread counts the shell already polls, so it adds no request. The caller
 * shows it only where Classic shows DMs (`messages:read` on the device).
 *
 * shortcut: `/dm/:nodeId` re-hosts Classic's Messages tab, which opens the
 * conversation from `focusDmNodeId` once per mount; a second row clicked while
 * it is mounted only changes the URL. Task 2.4's DM thread replaces it.
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
import styles from './ChannelList.module.css';

interface DmListProps {
  sourceId: string;
  onNavigate?: () => void;
}

export default function DmList({ sourceId, onNavigate }: DmListProps) {
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
    return [...latest].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [poll]);

  const nameOf = (id: string) => {
    const node = poll?.nodes?.find((n) => n.user?.id === id);
    return node?.user?.longName || node?.user?.shortName || id;
  };

  return (
    <ul className={styles.list}>
      {peers.map((id) => {
        const count = unread?.directMessages[id] ?? 0;
        const name = nameOf(id);
        return (
          <li key={id}>
            <NavLink
              to={`/source/${encodeURIComponent(sourceId)}/dm/${encodeURIComponent(id)}`}
              state={{ focusDmNodeId: id }}
              className={({ isActive }) => `${styles.row} ${isActive ? styles.on : ''} ${count > 0 ? styles.unread : ''}`}
              onClick={onNavigate}
              aria-label={count > 0 ? t('workspace.shell.device_unread', { name, count }) : undefined}
            >
              {/* Lines the names up with the channels' "#". */}
              <span className={styles.hash} aria-hidden="true" />
              <span className={styles.name}>{name}</span>
              {count > 0 && <span className={styles.badge} aria-hidden="true">{count}</span>}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
