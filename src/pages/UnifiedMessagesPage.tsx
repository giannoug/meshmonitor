/**
 * Unified Messages Page
 *
 * Cross-source message feed. Features:
 *  - Channel selector driven by /api/unified/channels (name-based so the same
 *    "Primary" channel collapses across sources even if they use different
 *    slot numbers for it).
 *  - Infinite scroll via TanStack `useInfiniteQuery` with a `before` timestamp
 *    cursor — correct under streaming inserts (offset pagination would skew).
 *  - Server-side dedup: the same mesh packet received by multiple sources
 *    returns as ONE entry with a `receptions[]` array. Clicking a message
 *    opens a modal that pivots that array into a per-source reception table
 *    (hops / SNR / RSSI / rxTime), which is the whole point of the unified
 *    view — you can see where the signal actually landed.
 *  - Reactions (emoji tapbacks) are hidden from the main feed and rendered as
 *    small bubbles on their parent message, matching MessagesTab behavior.
 *  - MeshCore reactions become read-only chips on their target message. Row
 *    refs from the server resolve across every loaded page; a reaction whose
 *    target is not loaded is hidden, and one with no target shows as a dim
 *    line (#5763).
 *  - Reply threading shows a quoted preview of the parent when `replyId` is
 *    set, resolved from the already-loaded page cache.
 *  - Source filter: optional dropdown that narrows to messages heard by a
 *    specific source (client-side — the server-side dedup already bundled all
 *    receptions, so this is a pure view filter).
 */

import { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShellEmbedded } from '../contexts/ShellContext';
import { useTranslation } from 'react-i18next';
import { renderMessageWithLinks } from '../utils/linkRenderer';
import { senderLabel, shortSenderLabel } from './unifiedSenderLabels';
import { formatTime, formatTimeWithSeconds } from './unifiedTimeFormat';
import LinkPreview from '../components/LinkPreview';
import '../styles/unified.css';
import { UiIcon } from '../components/icons';
import { resolveReplyPreview, type ReplyPreviewState } from '../utils/replyPreview';
import { getSourceColor } from '../utils/sourceColors';
import { MESH_PROTOCOL_LABEL, sourceTypeMeshProtocol } from '../utils/meshProtocol';
import protocolStripe from '../components/messages/ProtocolStripe.module.css';
import { ALL_CHANNELS_PARAM } from '../utils/unifiedChannelFilter';
import { hopDisplay } from './unifiedHops';
import { writeStoredUnifiedChannel } from './unifiedChannelPreference';
import {
  MeshCoreReactionChips,
  MeshCoreUnmatchedReaction,
} from '../components/MeshCore/MeshCoreReactionChips';
import HopBadge from '../components/unified/HopBadge';
import { MeshCoreClockOffset } from '../components/MeshCore/MeshCoreClockOffset';
import { meshcoreClockOffsetMs } from '../utils/meshcoreMessageTime';
import { messageRowPropsEqual } from '../components/messages/messageRowSupport';
import type { ReactionChip } from '../components/MeshCore/meshcoreReactionGroups';
import MessageExportDialog from '../components/MessageExportDialog/MessageExportDialog';
import WorkspaceBanner from '../components/WorkspaceBanner/WorkspaceBanner';
import {
  channelTag,
  formatDateDivider,
  useUnifiedFeedScroll,
  useUnifiedMessagesFeed,
  type UnifiedMessage,
} from './useUnifiedMessagesFeed';

const NO_UNIFIED_MESSAGES: UnifiedMessage[] = [];
const NO_CHIPS: ReactionChip[] = [];

interface UnifiedMessageRowProps {
  msg: UnifiedMessage;
  /** Day divider above the row, or null for none. */
  dateLabel: string | null;
  showChannelTag: boolean;
  /** Source ids in view, in order: decides each source tag's colour. */
  sourceOrder: string[];
  reactions: UnifiedMessage[];
  replyPreview: ReplyPreviewState<UnifiedMessage>;
  chips: ReactionChip[];
  onOpen: (msg: UnifiedMessage) => void;
}

/**
 * One feed row, memoized: a poll that adds one message renders one row.
 * Props compare by value (`messageRowPropsEqual`), since each poll rebuilds
 * the per-row lookups.
 */
const UnifiedMessageRow = memo(function UnifiedMessageRow({
  msg,
  dateLabel,
  showChannelTag,
  sourceOrder,
  reactions,
  replyPreview,
  chips,
  onOpen,
}: UnifiedMessageRowProps) {
  const { t } = useTranslation();
  // Left border = mesh protocol (#5744). Every reception of one packet
  // is on the same protocol, so the first one decides. Source identity
  // stays on the per-source tags below.
  const protocol = sourceTypeMeshProtocol(msg.receptions[0]?.sourceType);
  const receptionCount = msg.receptions.length;
  const divider = dateLabel !== null && (
    <div className="unified-date-divider">
      <span>{dateLabel}</span>
    </div>
  );

  if (msg.reactionEmoji) {
    return (
      <div>
        {divider}
        <MeshCoreUnmatchedReaction name={senderLabel(msg)} emoji={msg.reactionEmoji} />
      </div>
    );
  }

  return (
    <div>
      {divider}
      <div
        className={`unified-msg-card unified-msg-card--clickable ${protocolStripe.stripe}`}
        data-protocol={protocol}
        title={t('unified.messages.protocol_title', {
          defaultValue: '{{protocol}} message',
          protocol: MESH_PROTOCOL_LABEL[protocol],
        })}
        onClick={() => onOpen(msg)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(msg);
          }
        }}
      >
        <div className="unified-msg-card__meta">
          {showChannelTag && (
            <span
              className="unified-msg-card__channel-tag"
              title={t('unified.messages.channel_label', { channel: channelTag(msg) })}
            >
              #{channelTag(msg)}
            </span>
          )}
          {msg.receptions.map((r) => (
            <span
              key={r.sourceId}
              className="unified-msg-card__source-tag"
              style={{
                background: `color-mix(in srgb, ${getSourceColor(r.sourceId, sourceOrder)} 15%, transparent)`,
                color: getSourceColor(r.sourceId, sourceOrder),
                border: `1px solid color-mix(in srgb, ${getSourceColor(r.sourceId, sourceOrder)} 35%, transparent)`,
              }}
              title={t('unified.messages.heard_by_source', { name: r.sourceName })}
            >
              {r.sourceName}
              <HopBadge reception={r} sourceName={r.sourceName} />
            </span>
          ))}
          {receptionCount > 1 && (
            <span className="unified-msg-card__reception-count">
              {t('unified.messages.heard_by_count', { count: receptionCount })}
            </span>
          )}
          <span className="unified-msg-card__sender">{senderLabel(msg)}</span>
          <span className="unified-msg-card__time">
            {formatTime(msg.timestamp)}
            {msg.senderTimestamp !== undefined && (
              <MeshCoreClockOffset offsetMs={meshcoreClockOffsetMs(msg.createdAt, msg.senderTimestamp)} />
            )}
          </span>
        </div>

        {replyPreview.kind !== 'none' && (
          <div className="unified-reply-preview">
            <span className="unified-reply-preview__arrow">↳</span>
            {replyPreview.kind === 'resolved' ? (
              <>
                <span className="unified-reply-preview__from">
                  {shortSenderLabel(replyPreview.parent)}
                </span>
                <span className="unified-reply-preview__text">
                  {replyPreview.parent.text || t('unified.no_text')}
                </span>
              </>
            ) : (
              // #4245: the parent packet was never received or has since
              // been purged. Still show the reply box so the message is
              // recognizable as a reply, rather than silently dropping
              // replyId and rendering it as an ordinary message.
              <span className="unified-reply-preview__text unified-reply-preview__text--unknown">
                {t('unified.messages.unknown_parent', 'Unknown message')}
              </span>
            )}
          </div>
        )}

        <div className="unified-msg-card__text">
          {msg.text ? renderMessageWithLinks(msg.text) : <em style={{ opacity: 0.4 }}>{t('unified.no_text')}</em>}
        </div>
        {msg.text && <LinkPreview text={msg.text} />}

        {reactions.length > 0 && (
          <div className="unified-reactions">
            {reactions.map((r) => (
              <span key={r.dedupKey} className="unified-reaction" title={senderLabel(r)}>
                {r.text}
                <span className="unified-reaction__from">{shortSenderLabel(r)}</span>
              </span>
            ))}
          </div>
        )}
        <MeshCoreReactionChips chips={chips} />
      </div>
    </div>
  );
}, messageRowPropsEqual);

// ── Component ────────────────────────────────────────────────────────────

export default function UnifiedMessagesPage() {
  const navigate = useNavigate();
  // Inside the Workspace shell (#6365) the shell owns the back navigation.
  const embedded = useShellEmbedded();
  const { t } = useTranslation();
  const {
    canReadAnyMessages,
    selectedChannel,
    setSelectedChannel,
    sourceFilter,
    setSourceFilter,
    channels,
    loadingChannels,
    channelsError,
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
  } = useUnifiedMessagesFeed();
  const [statsFor, setStatsFor] = useState<UnifiedMessage | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Uses the shared lookup rather than re-deriving the index here, so the
  // "one SOURCE_COLORS" invariant holds at the implementation level and not
  // just the definition level — a private copy of the modulo/fallback logic is
  // how the three palettes drifted apart in the first place.
  const sourceColor = useCallback(
    (sourceId: string) => getSourceColor(sourceId, sourcesInView.map((s) => s.id)),
    [sourcesInView]
  );

  const { scrollRef, handleScroll, sentinelRef } = useUnifiedFeedScroll({
    feedMessages,
    selectedChannel,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // ── Render ────────────────────────────────────────────────────────────

  const openStats = useCallback((msg: UnifiedMessage) => setStatsFor(msg), []);
  const closeStats = useCallback(() => setStatsFor(null), []);

  // Date-divider bookkeeping — walk the feed top-down chronologically
  // (oldest first) so each divider appears on the first message of its day.
  let lastDateLabel = '';

  return (
    <div className="unified-page unified-page--chat">
      <WorkspaceBanner inline />
      <div className="unified-header">
        {!embedded && (
          <button className="unified-header__back" onClick={() => navigate('/', { state: { showList: true } })}>
            {t('unified.back_to_sources')}
          </button>
        )}
        <div className="unified-header__title">
          <h1>{t('unified.messages.title')}</h1>
          <p>
            {selectedChannel === ALL_CHANNELS_PARAM
              ? t('unified.messages.subtitle_all_channels')
              : selectedChannel
                ? t('unified.messages.subtitle_channel', { channel: selectedChannel })
                : t('unified.messages.subtitle_none')}
          </p>
        </div>

        <div className="unified-controls">
          <select
            className="unified-select"
            value={selectedChannel}
            onChange={(e) => {
              setSelectedChannel(e.target.value);
              writeStoredUnifiedChannel(e.target.value);
            }}
            disabled={loadingChannels || channels.length === 0}
            aria-label={t('unified.messages.channel_aria')}
          >
            {channels.length === 0 && <option value="">{t('unified.messages.no_channels')}</option>}
            {channels.length > 0 && (
              <option value={ALL_CHANNELS_PARAM}>
                {t('unified.messages.all_channels')}
              </option>
            )}
            {channels.map((c) => (
              <option key={c.name} value={c.name}>
                {t('unified.messages.channel_option', { name: c.name, count: c.sources.length })}
              </option>
            ))}
          </select>

          <select
            className="unified-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label={t('unified.messages.source_filter_aria')}
          >
            <option value="">{t('unified.messages.all_sources')}</option>
            {sourcesInView.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {canReadAnyMessages && (
            <button
              type="button"
              className="unified-header__back"
              onClick={() => setExportOpen(true)}
              disabled={channels.length === 0}
              title={t('unified.messages.export.button_title')}
            >
              <UiIcon name="download" size={16} /> {t('unified.messages.export.button')}
            </button>
          )}

          <button
            className="unified-header__back"
            onClick={() => refetch()}
            disabled={loadingMessages}
            title={t('unified.messages.refresh')}
          >
            ↻
          </button>
        </div>
      </div>

      <div className="unified-scroll" ref={scrollRef} onScroll={handleScroll}>
      <div className="unified-body">
        {!canReadAnyMessages && <div className="unified-empty">{t('unified.messages.sign_in_required')}</div>}
        {canReadAnyMessages && overshadowNames.length > 0 && (
          <div className="unified-warning" role="status">
            <UiIcon name="alert" size={16} /> {t('unified.messages.channel_collision_warning', {
              defaultValue: 'This channel shares its key with "{{names}}" (a Channel Database / device channel under a different name). Messages may be split between those tabs — reconcile the names on the Channels page.',
              names: overshadowNames.join('", "'),
            })}
          </div>
        )}
        {canReadAnyMessages && channelsError && <div className="unified-error">{t('unified.messages.failed_channels')}</div>}
        {canReadAnyMessages && messagesError && <div className="unified-error">{t('unified.messages.failed_messages')}</div>}
        {canReadAnyMessages && loadingMessages && feedMessages.length === 0 && (
          <div className="unified-empty">{t('unified.messages.loading')}</div>
        )}
        {canReadAnyMessages && !loadingMessages && feedMessages.length === 0 && !messagesError && (
          <div className="unified-empty">
            {selectedChannel === ALL_CHANNELS_PARAM
              ? t('unified.messages.empty_all_channels')
              : selectedChannel
                ? t('unified.messages.empty_channel')
                : t('unified.messages.choose_channel')}
          </div>
        )}

        {/* Infinite scroll sentinel — at the TOP of the feed. Scroll up to
            here and the intersection observer fires fetchNextPage, which
            prepends older messages while the scroll-position preserving
            useLayoutEffect keeps the user's viewpoint stable. */}
        {feedMessages.length > 0 && (
          <div ref={sentinelRef} className="unified-scroll-sentinel">
            {isFetchingNextPage
              ? t('unified.messages.loading_older')
              : hasNextPage
                ? ''
                : t('unified.messages.history_start')}
          </div>
        )}

        {(() => {
          const sourceOrder = sourcesInView.map((s) => s.id);
          return feedMessages.map((msg) => {
            const dateLabel = formatDateDivider(msg.timestamp, t);
            const showDivider = dateLabel !== lastDateLabel;
            if (showDivider) lastDateLabel = dateLabel;
            return (
              <UnifiedMessageRow
                key={msg.dedupKey}
                msg={msg}
                dateLabel={showDivider ? dateLabel : null}
                showChannelTag={selectedChannel === ALL_CHANNELS_PARAM}
                sourceOrder={sourceOrder}
                reactions={msg.packetId != null ? reactionsByParent.get(msg.packetId) ?? NO_UNIFIED_MESSAGES : NO_UNIFIED_MESSAGES}
                // Reply preview: look up parent by packet id (firmware's reply_id
                // points at the parent's meshpacket id, not its requestId).
                replyPreview={resolveReplyPreview(msg.replyId, byPacketId)}
                chips={mcReactions.chipsByTarget.get(msg.dedupKey) ?? NO_CHIPS}
                onOpen={openStats}
              />
            );
          });
        })()}
      </div>
      </div>

      {/* ── Reception stats modal ───────────────────────────────────────── */}
      {statsFor && (
        <div className="unified-modal-overlay" onClick={closeStats}>
          <div className="unified-modal" onClick={(e) => e.stopPropagation()}>
            <div className="unified-modal__header">
              <h3>{t('unified.messages.modal.title')}</h3>
              <button className="unified-modal__close" onClick={closeStats} aria-label={t('unified.close')}>
                ×
              </button>
            </div>
            <div className="unified-modal__body">
              <div className="unified-modal__summary">
                <div className="unified-modal__sender">{senderLabel(statsFor)}</div>
                <div className="unified-modal__text">{statsFor.text || t('unified.no_text')}</div>
                <div className="unified-modal__meta">
                  {t('unified.messages.modal.request_id')}: <code>{statsFor.requestId ?? '—'}</code> · {t('unified.messages.modal.channel')}:{' '}
                  <code>#{statsFor.channelName || statsFor.channel}</code>
                </div>
              </div>

              <table className="unified-modal__table">
                <thead>
                  <tr>
                    <th>{t('unified.messages.modal.col_source')}</th>
                    <th>{t('unified.messages.modal.col_hops')}</th>
                    <th>{t('unified.messages.modal.col_snr')}</th>
                    <th>{t('unified.messages.modal.col_rssi')}</th>
                    <th>{t('unified.messages.modal.col_heard')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statsFor.receptions.map((r) => (
                    <tr key={r.sourceId}>
                      <td>
                        <span
                          className="unified-modal__source-dot"
                          style={{ background: sourceColor(r.sourceId) }}
                        />
                        {r.sourceName}
                        {r.xeddsaSigned ? (
                          <span
                            style={{ marginLeft: '4px', color: 'var(--success-color, #16a34a)' }}
                            title={t('messages.xeddsa_signed', 'Cryptographically signed (XEdDSA)')}
                            aria-label={t('messages.xeddsa_signed', 'Cryptographically signed (XEdDSA)')}
                            role="img"
                          >
                            <UiIcon name="securityCheck" size={14} />
                          </span>
                        ) : null}
                      </td>
                      <td>{hopDisplay(r, t)}</td>
                      <td>{r.rxSnr != null ? `${r.rxSnr.toFixed(1)} dB` : '—'}</td>
                      <td>{r.rxRssi != null ? `${r.rxRssi} dBm` : '—'}</td>
                      <td>{formatTimeWithSeconds(r.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <MessageExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        channels={channels}
        initialChannel={selectedChannel === ALL_CHANNELS_PARAM ? undefined : (selectedChannel || undefined)}
      />
    </div>
  );
}
