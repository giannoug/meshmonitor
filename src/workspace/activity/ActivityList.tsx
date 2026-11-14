/**
 * The Activity feed itself (boards c-home-e4 / e5 / e6), shared by the page
 * (ActivityFeed) and the desktop bell's ActivityPanel: rows grouped by day,
 * newest first, a dot on each unseen one, the e5 empty state through
 * StateView, and Load More while `hasMore` (Ruling AT). A row opens its
 * conversation at that message (a reaction at our message it reacted to), as
 * message search does (`state.focusMessageId`). Names come from the poll the
 * open screen already holds, read without fetching.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { skipToken, useQuery } from '@tanstack/react-query';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useSettingsOptional } from '../../contexts/SettingsContext';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import type { PollData } from '../../hooks/usePoll';
import type { ActivityItem } from '../../types/activity';
import { formatDate, formatTime } from '../../utils/datetime';
import { mentionTokenRegex } from '../../utils/mentions';
import { avatarToken, channelLabel } from '../chat/channelLabel';
import StateView from '../patterns/StateView';
import TwoLineRow from '../patterns/TwoLineRow';
import { abbrevOf } from '../shell/useWorkspaceSources';
import type { Activity } from './useActivity';
import rowStyles from '../chat/MessageRowD.module.css';
import styles from './ActivityFeed.module.css';

/** "Push for replies, reactions and mentions: Settings › Notifications" (e6's footer). */
export function PushLine({ sourceId, onNavigate }: { sourceId: string; onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <p className={styles.push}>
      {t('workspace.activity.push_line')}{' '}
      <Link to={`/source/${encodeURIComponent(sourceId)}/settings/notifications`} onClick={onNavigate}>
        {t('workspace.activity.push_settings')}
      </Link>
    </p>
  );
}

const KIND_ICON: Record<ActivityItem['kind'], UiIconName> = { reply: 'reply', reaction: 'reaction', mention: 'mention' };

interface ActivityListProps {
  sourceId: string;
  deviceName: string;
  activity: Activity;
  phone: boolean;
  /** Called after a row (or the empty state's link) is followed: the panel closes. */
  onNavigate?: () => void;
}

export function ActivityList({ sourceId, deviceName, activity, phone, onNavigate }: ActivityListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useSettingsOptional();
  const timeFormat = settings?.timeFormat ?? '24';
  const dateFormat = settings?.dateFormat ?? 'MM/DD/YYYY';
  // The poll the open screen already holds (names), read without fetching.
  const { data: poll } = useQuery<PollData>({ queryKey: sourcePollQueryKey(sourceId), queryFn: skipToken });
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const { items, lastSeen } = activity;

  if (activity.isLoading) return <StateView kind="loading" />;
  if (activity.isError) return <StateView kind="error" />;

  const loadMore = activity.hasMore && (
    <button type="button" className={styles.loadMore} disabled={activity.isFetchingMore} onClick={() => void activity.fetchMore()}>
      {t('search.load_more')}
    </button>
  );

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <UiIcon name="notifications" size={28} />
        </span>
        <StateView
          kind="empty"
          title={t('workspace.activity.empty_title', { name: deviceName })}
          detail={t('workspace.activity.empty_detail')}
        />
        {phone && (
          <Link className={styles.emptyLink} to={`${base}/settings/notifications`} onClick={onNavigate}>
            {t('workspace.activity.push_phone')}
          </Link>
        )}
        {loadMore}
      </div>
    );
  }

  const nodeName = (id: string) => poll?.nodes?.find((n) => n.user?.id?.toLowerCase() === id.toLowerCase())?.user?.longName;
  // `@!<id>` reads as `@<name>`, as the thread renders it.
  const readable = (text: string) => text.replace(mentionTokenRegex(), (_token, id: string) => `@${nodeName(id) ?? id}`);
  const where = ({ kind, conversation: c }: ActivityItem) =>
    c.type === 'dm'
      ? t(`workspace.activity.${kind}_dm`)
      : t(`workspace.activity.${kind}_channel`, { channel: channelLabel(t, poll?.channels?.find((ch) => ch.id === c.channel), c.channel) });
  const open = (item: ActivityItem) => {
    const c = item.conversation;
    const to = c.type === 'dm' ? `${base}/dm/${encodeURIComponent(c.peerId)}` : `${base}/channel/${c.channel}`;
    onNavigate?.();
    void navigate(to, { state: { focusMessageId: item.kind === 'reaction' ? item.targetMessageId : item.id } });
  };

  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const dayOf = (ts: number) => {
    const d = new Date(ts);
    if (d.toDateString() === today.toDateString()) return t('unified.messages.date_today');
    if (d.toDateString() === yesterday.toDateString()) return t('unified.messages.date_yesterday');
    return formatDate(d, dateFormat);
  };
  const groups: Array<{ day: string; items: ActivityItem[] }> = [];
  for (const item of items) {
    const day = dayOf(item.timestamp);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(item);
  }

  return (
    <>
      <ul className={styles.list} aria-label={t('workspace.tabs.activity')} data-phone={phone || undefined}>
        {groups.map((g) => (
          <li key={g.day}>
            <h2 className={styles.day}>{g.day}</h2>
            <ul className={styles.group}>
              {g.items.map((item) => {
                const others = new Set((item.reactions ?? []).flatMap((r) => r.fromNames));
                others.delete(item.fromName);
                const unseen = lastSeen !== null && item.timestamp > lastSeen;
                const quote = item.kind === 'reply' ? item.targetText : item.kind === 'reaction' ? item.text : undefined;
                return (
                  <li key={item.id} className={styles.item} data-unseen={unseen || undefined}>
                    <TwoLineRow
                      onClick={() => open(item)}
                      leading={
                        <>
                          <span className={styles.dot} aria-hidden="true" />
                          <span className={styles.avatar}>
                            <span className={rowStyles.avatar} style={{ background: avatarToken(item.fromId) }} aria-hidden="true">
                              {abbrevOf(item.fromName)}
                            </span>
                            <span className={styles.kind} data-kind={item.kind} aria-hidden="true">
                              <UiIcon name={KIND_ICON[item.kind]} size={12} />
                            </span>
                          </span>
                        </>
                      }
                      title={
                        <span className={styles.headline}>
                          <strong>
                            {others.size > 0
                              ? t('workspace.activity.name_and_others', { name: item.fromName, count: others.size })
                              : item.fromName}
                          </strong>{' '}
                          {where(item)}
                        </span>
                      }
                      subtitle={
                        <span className={styles.body}>
                          {item.kind !== 'reaction' && item.kind !== 'mention' && <span className={styles.text}>{readable(item.text)}</span>}
                          {item.reactions && (
                            <span className={rowStyles.reactions}>
                              {item.reactions.map((r) => (
                                <span key={r.emoji} className={rowStyles.chip} title={r.fromNames.join(', ')}>
                                  {r.emoji} {r.count}
                                </span>
                              ))}
                            </span>
                          )}
                          {item.kind === 'mention' ? (
                            <span className={styles.quote}>{readable(item.text)}</span>
                          ) : (
                            quote !== undefined && <span className={styles.quote}>{t('workspace.activity.to_you', { text: readable(quote) })}</span>
                          )}
                        </span>
                      }
                      trailing={<time dateTime={new Date(item.timestamp).toISOString()}>{formatTime(new Date(item.timestamp), timeFormat)}</time>}
                    />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {loadMore}
    </>
  );
}
