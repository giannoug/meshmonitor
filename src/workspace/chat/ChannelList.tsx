/**
 * The open device's channels in the layout D sidebar (boards a-chat-D-desktop,
 * 10-06): `# name`, bold with a count while unread, each a link to its thread
 * (`/source/:id/channel/:n`).
 *
 * It reads the poll reply the page already holds (no fetch of its own, so a
 * sidebar never adds a poll) and the unread counts the shell already polls
 * for the open device. Which channels show follows Classic's Channels tab:
 * configured slots that are not Disabled, plus any channel a message arrived
 * on, minus the DM pseudo-channel, each gated by `canReadChannel` (channel_N:read;
 * a Channel Database channel needs its entry; an MQTT bridge lists all).
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
import { CHANNEL_DB_OFFSET, canReadChannel } from '../../utils/channelReadAccess';
import { channelLabel } from './channelLabel';
import { useChannelDatabaseEntries } from './useChannelDatabaseEntries';
import styles from './ChannelList.module.css';

interface ChannelListProps {
  sourceId: string;
  sourceType: string;
  onNavigate?: () => void;
}

export default function ChannelList({ sourceId, sourceType, onNavigate }: ChannelListProps) {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  // The page's poll cache, read without fetching.
  const { data: poll } = useQuery<PollData>({ queryKey: sourcePollQueryKey(sourceId), queryFn: skipToken });
  const { data: unread } = useUnreadCounts({
    baseUrl: appBasename,
    sourceId,
    enabled: authStatus?.authenticated === true,
  });

  const heard = useMemo(() => {
    const configs = poll?.channels ?? [];
    const set = new Set<number>(configs.map((c) => c.id));
    for (const m of poll?.messages ?? []) set.add(m.channel);
    return [...set].filter((id) => id !== -1 && configs.find((c) => c.id === id)?.role !== 0).sort((a, b) => a - b);
  }, [poll]);
  // Channel Database entries are read only when a server-decrypted channel was heard.
  const { entries } = useChannelDatabaseEntries(heard.some((id) => id >= CHANNEL_DB_OFFSET));
  const ids = useMemo(
    () =>
      heard.filter((id) =>
        canReadChannel(id, {
          mqttReadOnly: sourceType === 'mqtt_bridge',
          channelDatabaseEntries: entries,
          hasPermission: (resource, action) => hasPermission(resource, action, { sourceId }),
        }),
      ),
    [heard, sourceType, entries, hasPermission, sourceId],
  );

  return (
    <ul className={styles.list}>
      {ids.map((id) => {
        const count = unread?.channels[id] ?? 0;
        const name = channelLabel(t, poll?.channels?.find((c) => c.id === id), id, entries);
        return (
          <li key={id}>
            <NavLink
              to={`/source/${encodeURIComponent(sourceId)}/channel/${id}`}
              className={({ isActive }) => `${styles.row} ${isActive ? styles.on : ''} ${count > 0 ? styles.unread : ''}`}
              onClick={onNavigate}
              aria-label={count > 0 ? t('workspace.shell.device_unread', { name, count }) : undefined}
            >
              <span className={styles.hash} aria-hidden="true">#</span>
              <span className={styles.name}>{name}</span>
              {count > 0 && <span className={styles.badge} aria-hidden="true">{count}</span>}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
