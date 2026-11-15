/**
 * Overview › Messages (boards 7-01, 7-06; s7n0–s7n3): one read-only feed of
 * every device the viewer can read, built on today's Unified Messages data
 * (`useUnifiedMessagesFeed`, its 10 s poll and paging). Each message is a
 * layout D row with each device's tag and hops, "heard by N", and today's
 * reactions; no composer, and reactions do not send (s7n1).
 *
 * - Desktop: today's channel list on the left, the feed, and the receptions
 *   side panel; Export opens today's export form over the page (7-02).
 * - Phone: the page's own header (back to Overview, Export), channel and
 *   source chips with Refresh, and a tap opens the receptions sheet; Export
 *   is a full-screen page (7-09).
 *
 * Every row, tag, channel source and filter entry keeps to the devices the
 * viewer can read (Review Focus 2, `readableSources`).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MeshCoreReactionChips, MeshCoreUnmatchedReaction } from '../../components/MeshCore/MeshCoreReactionChips';
import { useSettings } from '../../contexts/SettingsContext';
import type { MeshMessage } from '../../types/message';
import type { TranslateFn } from '../../types/translate';
import { ALL_CHANNELS_PARAM } from '../../utils/unifiedChannelFilter';
import { meshcoreClockOffsetMs } from '../../utils/meshcoreMessageTime';
import { resolveReplyPreview } from '../../utils/replyPreview';
import { hopDisplay } from '../../pages/unifiedHops';
import { senderLabel, shortSenderLabel } from '../../pages/unifiedSenderLabels';
import { writeStoredUnifiedChannel } from '../../pages/unifiedChannelPreference';
import {
  channelTag,
  formatDateDivider,
  useUnifiedFeedScroll,
  useUnifiedMessagesFeed,
  type UnifiedMessage,
} from '../../pages/useUnifiedMessagesFeed';
import MessageRowD from '../chat/MessageRowD';
import type { MessageActionContext } from '../chat/messageActions';
import DeviceTag from '../patterns/DeviceTag';
import { useIsPhone } from '../shell/useIsPhone';
import { ExportMessagesDialog } from './ExportMessagesPage';
import ReceptionsPanel from './ReceptionsPanel';
import { readableChannels, readableMessage, useReadableSourceIds } from './readableSources';
import styles from './OverviewMessages.module.css';

/** The feed is read-only: rows offer no actions. */
const READ_ONLY: MessageActionContext = { canSend: false, canTranslate: false, translateHint: '', sendsTapback: '', sendsResend: '' };
const NO_MENTIONS = {};
const noop = () => {};
const NO_REACTIONS: MeshMessage[] = [];

function toMeshMessage(m: UnifiedMessage): MeshMessage {
  return {
    id: m.dedupKey, from: m.fromNodeId, to: m.toNodeId, fromNodeId: m.fromNodeId, toNodeId: m.toNodeId,
    text: m.text, channel: m.channel, timestamp: new Date(m.timestamp), replyId: m.replyId ?? undefined,
  };
}

/** "clock 2 min ahead": MeshCore's sender clock against receipt (s7n2); null under today's 5 s threshold. */
function clockOffset(m: UnifiedMessage, t: TranslateFn): string | null {
  if (m.senderTimestamp === undefined) return null;
  const ms = meshcoreClockOffsetMs(m.createdAt, m.senderTimestamp);
  if (ms === null) return null;
  const s = Math.round(Math.abs(ms) / 1000);
  const span = s < 60
    ? t('workspace.overview.messages.span_s', { count: s })
    : s < 3600
      ? t('workspace.overview.messages.span_min', { count: Math.round(s / 60) })
      : t('workspace.overview.messages.span_h', { count: Math.round(s / 3600) });
  // Receipt minus sender: negative means the sender's clock is ahead.
  return t(ms < 0 ? 'workspace.overview.messages.clock_ahead' : 'workspace.overview.messages.clock_behind', { span });
}

export default function OverviewMessages() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { timeFormat, dateFormat } = useSettings();
  const feed = useUnifiedMessagesFeed();
  const readable = useReadableSourceIds();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const { selectedChannel, setSelectedChannel, canReadAnyMessages } = feed;

  const channels = useMemo(() => readableChannels(feed.channels, readable), [feed.channels, readable]);
  const rows = useMemo(
    () => feed.feedMessages.flatMap((m) => readableMessage(m, readable) ?? []),
    [feed.feedMessages, readable],
  );
  const { scrollRef, handleScroll, sentinelRef } = useUnifiedFeedScroll({
    feedMessages: rows,
    selectedChannel,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: feed.fetchNextPage,
  });
  const opened = rows.find((m) => m.dedupKey === openKey) ?? null;
  const allChannels = selectedChannel === ALL_CHANNELS_PARAM;
  const collided = useMemo(() => {
    const names = new Set<string>();
    for (const c of feed.channelCollisions) names.add(c.channelName.trim().toLowerCase()).add(c.dbName.trim().toLowerCase());
    return names;
  }, [feed.channelCollisions]);

  const choose = useCallback(
    (name: string) => {
      setSelectedChannel(name);
      writeStoredUnifiedChannel(name);
      setOpenKey(null);
    },
    [setSelectedChannel],
  );

  const title = t('unified.messages.title');
  const subtitle = allChannels
    ? t('unified.messages.subtitle_all_channels')
    : selectedChannel
      ? t('unified.messages.subtitle_channel', { channel: selectedChannel })
      : t('unified.messages.subtitle_none');
  const sourceSelect = (
    <select
      className={styles.select}
      value={feed.sourceFilter}
      onChange={(e) => feed.setSourceFilter(e.target.value)}
      aria-label={t('unified.messages.source_filter_aria')}
    >
      <option value="">{t('unified.messages.all_sources')}</option>
      {feed.sourcesInView.filter((s) => readable.has(s.id)).map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
  const refresh = (
    <button type="button" className={styles.button} onClick={() => void feed.refetch()} disabled={feed.loadingMessages}>
      <UiIcon name="refresh" size={16} />
      {t('unified.messages.refresh')}
    </button>
  );

  let lastDate = '';
  const feedBody: ReactNode[] = rows.map((m) => {
    const date = formatDateDivider(m.timestamp, t);
    const divider = date !== lastDate && (
      <p key={`d-${m.dedupKey}`} className={styles.date}><span>{date}</span></p>
    );
    lastDate = date;
    if (m.reactionEmoji) {
      return [divider, <MeshCoreUnmatchedReaction key={m.dedupKey} name={senderLabel(m)} emoji={m.reactionEmoji} />];
    }
    const reply = resolveReplyPreview(m.replyId, feed.byPacketId);
    const parent = reply.kind === 'resolved' ? readableMessage(reply.parent, readable) : null;
    const reactions = m.packetId != null
      ? (feed.reactionsByParent.get(m.packetId) ?? []).flatMap((r) => (readableMessage(r, readable) ? [toMeshMessage(r)] : []))
      : NO_REACTIONS;
    const clock = clockOffset(m, t);
    const open = () => setOpenKey(m.dedupKey);
    return [
      divider,
      <div key={m.dedupKey} className={styles.row} data-testid="feed-row" data-open={openKey === m.dedupKey || undefined} onClick={open}>
        <MessageRowD
          message={toMeshMessage(m)}
          style="rows"
          signalDetail="always"
          mine={false}
          senderName={senderLabel(m)}
          senderShort={shortSenderLabel(m)}
          reactions={reactions}
          replied={parent && toMeshMessage(parent)}
          repliedName={parent ? t('messages.replying_to', { name: shortSenderLabel(parent) }) : undefined}
          showUnreadDivider={false}
          dateSeparator={null}
          timeFormat={timeFormat}
          dateFormat={dateFormat}
          mentionOptions={NO_MENTIONS}
          actionContext={READ_ONLY}
          phone={isPhone}
          onAction={noop}
          readOnly
          headExtra={
            (allChannels || clock) && (
              <>
                {allChannels && <span className={styles.channelTag}>#{channelTag(m)}</span>}
                {clock && <span className={styles.clock}>{clock}</span>}
              </>
            )
          }
          footer={
            <>
              <p className={styles.heard}>
                {m.receptions.map((r) => (
                  <span key={r.sourceId} className={styles.reception}>
                    <DeviceTag sourceId={r.sourceId} />
                    {hopDisplay(r, t)}
                  </span>
                ))}
                <button
                  type="button"
                  className={styles.heardBy}
                  onClick={(e) => {
                    e.stopPropagation();
                    open();
                  }}
                >
                  {t('unified.messages.heard_by_count', { count: m.receptions.length })}
                </button>
              </p>
              <MeshCoreReactionChips chips={feed.mcReactions.chipsByTarget.get(m.dedupKey) ?? []} />
            </>
          }
        />
      </div>,
    ];
  });

  const states = !canReadAnyMessages ? (
    <p className={styles.state}>{t('unified.messages.sign_in_required')}</p>
  ) : (
    <>
      {feed.overshadowNames.length > 0 && (
        <p className={styles.warning} role="status">
          <UiIcon name="alert" size={16} />
          {t('unified.messages.channel_collision_warning', {
            defaultValue:
              'This channel shares its key with "{{names}}" (a Channel Database / device channel under a different name). Messages may be split between those tabs — reconcile the names on the Channels page.',
            names: feed.overshadowNames.join('", "'),
          })}
        </p>
      )}
      {feed.channelsError && <p className={styles.error}>{t('unified.messages.failed_channels')}</p>}
      {feed.messagesError && <p className={styles.error}>{t('unified.messages.failed_messages')}</p>}
      {feed.loadingMessages && rows.length === 0 && <p className={styles.state}>{t('unified.messages.loading')}</p>}
      {!feed.loadingMessages && rows.length === 0 && !feed.messagesError && (
        <p className={styles.state}>
          {allChannels
            ? t('unified.messages.empty_all_channels')
            : selectedChannel
              ? t('unified.messages.empty_channel')
              : t('unified.messages.choose_channel')}
        </p>
      )}
      {rows.length > 0 && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {feed.isFetchingNextPage
            ? t('unified.messages.loading_older')
            : feed.hasNextPage
              ? ''
              : t('unified.messages.history_start')}
        </div>
      )}
    </>
  );
  const feedPane = (
    <div className={styles.feed} ref={scrollRef} onScroll={handleScroll}>
      {states}
      {feedBody}
    </div>
  );

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <header className={styles.phoneHead}>
          <Link to="/overview" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.shell.overview')}
          </Link>
          <h1 className={styles.phoneTitle}>{title}</h1>
          {canReadAnyMessages && (
            <Link
              to="/overview/messages/export"
              state={allChannels || !selectedChannel ? undefined : { channel: selectedChannel }}
              className={styles.iconLink}
              aria-label={t('unified.messages.export.button')}
              title={t('unified.messages.export.button_title')}
            >
              <UiIcon name="download" size={22} />
            </Link>
          )}
        </header>
        <div className={styles.chips}>
          <select
            className={styles.select}
            value={selectedChannel}
            onChange={(e) => choose(e.target.value)}
            disabled={feed.loadingChannels || channels.length === 0}
            aria-label={t('unified.messages.channel_aria')}
          >
            {channels.length === 0 && <option value="">{t('unified.messages.no_channels')}</option>}
            {channels.length > 0 && <option value={ALL_CHANNELS_PARAM}>{t('unified.messages.all_channels')}</option>}
            {channels.map((c) => (
              <option key={c.name} value={c.name}>
                {t('unified.messages.channel_option', { name: c.name, count: c.sources.length })}
              </option>
            ))}
          </select>
          {sourceSelect}
          {refresh}
        </div>
        {feedPane}
        {opened && <ReceptionsPanel message={opened} onClose={() => setOpenKey(null)} />}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <label className={styles.filter}>
          <UiIcon name="filter" size={16} />
          {sourceSelect}
        </label>
        {canReadAnyMessages && (
          <button
            type="button"
            className={styles.button}
            onClick={() => setExportOpen(true)}
            disabled={channels.length === 0}
            title={t('unified.messages.export.button_title')}
          >
            <UiIcon name="download" size={16} />
            {t('unified.messages.export.button')}
          </button>
        )}
        {refresh}
      </header>
      <div className={styles.body} data-panel={opened ? '' : undefined}>
        <nav className={styles.channels} aria-label={t('nav.channels')}>
          <h2 className={styles.channelsTitle}>{t('nav.channels')}</h2>
          {channels.length > 0 && (
            <button
              type="button"
              className={styles.channel}
              aria-current={allChannels || undefined}
              onClick={() => choose(ALL_CHANNELS_PARAM)}
            >
              <span className={styles.channelName}>{t('unified.messages.all_channels')}</span>
            </button>
          )}
          {channels.map((c) => (
            <button
              key={c.name}
              type="button"
              className={styles.channel}
              aria-current={selectedChannel === c.name || undefined}
              onClick={() => choose(c.name)}
            >
              <span className={styles.channelName}>
                #{c.name}
                {collided.has(c.name.trim().toLowerCase()) && <UiIcon name="alert" size={14} />}
              </span>
              <span className={styles.channelTags}>
                {c.sources.map((s) => (
                  <DeviceTag key={s.sourceId} sourceId={s.sourceId} />
                ))}
              </span>
            </button>
          ))}
        </nav>
        {feedPane}
        {opened && <ReceptionsPanel message={opened} onClose={() => setOpenKey(null)} />}
      </div>
      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        {t('workspace.overview.messages.read_only_note')}
      </p>
      <ExportMessagesDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        channels={channels}
        initialChannel={allChannels ? undefined : selectedChannel || undefined}
      />
    </div>
  );
}
