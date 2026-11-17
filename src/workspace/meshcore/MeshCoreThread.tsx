/**
 * The messages of a MeshCore channel or room in layout D (boards 8-01, 8-04,
 * 8-18, 8-19), drawn with the Workspace's `MessageRowD`. What today's
 * MeshCoreMessageStream does around the rows stays: date separators,
 * reactions folded into chips under their message (an unmatched one is a dim
 * line), runs of ignored messages collapsed to one "N ignored messages" row
 * that opens them, the unread line at the first message past the last-read
 * mark pinned on entry, the entry scroll (to that line, else the bottom),
 * following new messages while at the bottom, Jump to Bottom, and older
 * history (a "Load older" button where today loads on scrolling up). The
 * screen supplies the per-row parts (MeshCore's head, footer and ack) and the
 * actions; nothing here sends.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { UiIcon } from '../../components/icons';
import UnreadDivider from '../../components/messages/UnreadDivider';
import type { TranslatedMessageState } from '../../components/translation/TranslatedMessage';
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
import { MeshCoreIgnoredRunRow } from '../../components/MeshCore/MeshCoreIgnoredRunRow';
import { MeshCoreReactionChips, MeshCoreUnmatchedReaction } from '../../components/MeshCore/MeshCoreReactionChips';
import { findIgnoredRuns } from '../../components/MeshCore/meshcoreIgnoredRuns';
import { groupMeshCoreReactions, type ReactionChip } from '../../components/MeshCore/meshcoreReactionGroups';
import type { MeshMessage } from '../../types/message';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import { getMessageDateSeparator, shouldShowDateSeparator } from '../../utils/datetime';
import { resolveAuthorContact } from '../../utils/meshcoreKeyMatch';
import { meshcoreDisplayTimeMs } from '../../utils/meshcoreMessageTime';
import { isNearBottom, DEFAULT_NEAR_BOTTOM_THRESHOLD_PX } from '../../utils/scrollNearBottom';
import { resolveUnreadAnchorId, shouldSuppressDivider } from '../../utils/unreadAnchor';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { useIsPhone } from '../shell/useIsPhone';
import MessageRowD, { type MessageActionKind, type RowTranslationActions } from '../chat/MessageRowD';
import type { MessageActionContext } from '../chat/messageActions';
import { shortMark } from './meshcoreLabels';
import styles from './MeshCoreThread.module.css';

const NO_REACTIONS: MeshMessage[] = [];
const MENTIONS = { resolveNodeName: () => undefined, selfNodeId: '' };

export interface McRow {
  message: MeshCoreMessage;
  mine: boolean;
  name: string;
  /** Today's sender key for a node page link, when the sender resolves to a contact. */
  senderKey: string | null;
  chips: ReactionChip[];
}

export interface MeshCoreThreadProps {
  /** Changes per conversation: re-arms the entry scroll. */
  conversationKey: string;
  ariaLabel: string;
  messages: MeshCoreMessage[];
  contacts: MeshCoreContact[];
  selfKey?: string;
  deviceName: string;
  emptyText: string;
  unreadAnchorMs: number | null;
  unreadLabel?: string;
  backlogLoading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder(): void;
  reactionResolutions?: Record<string, string>;
  actionContext: MessageActionContext;
  onAction(kind: MessageActionKind, row: McRow, emoji?: string): void;
  /** A chip's tap sends that reaction; absent when reacting is off. */
  onChip?(row: McRow, emoji: string): void;
  headExtra?(row: McRow): ReactNode;
  footer?(row: McRow): ReactNode;
  ackLabel?(row: McRow): ReactNode;
  translations: Record<string, TranslatedMessageState | undefined>;
  translationActions: RowTranslationActions;
}

/** A MeshCore message in MessageRowD's shape: hops and SNR as today shows them (SNR only on a direct one). */
function toMeshMessage(m: MeshCoreMessage, mine: boolean, from: string): MeshMessage {
  const hops = typeof m.hopCount === 'number' ? m.hopCount : undefined;
  return {
    id: m.id,
    from,
    to: m.toPublicKey ?? '',
    fromNodeId: m.fromPublicKey,
    toNodeId: m.toPublicKey ?? '',
    text: m.text,
    channel: -1,
    timestamp: new Date(meshcoreDisplayTimeMs(m)),
    isLocalMessage: mine,
    hopStart: hops,
    hopLimit: hops === undefined ? undefined : 0,
    rxSnr: hops === 0 ? m.snr : undefined,
  };
}

export default function MeshCoreThread(props: MeshCoreThreadProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus } = useAuth();
  const { prefs } = useUserPreferences({ enabled: authStatus?.authenticated === true });
  const { timeFormat, dateFormat } = useSettings();
  const { messages: all, contacts, selfKey, onAction, conversationKey, backlogLoading, hasMore, loadingOlder } = props;
  const messageStyle = prefs['workspace.messageStyle'] === 'bubbles' ? 'bubbles' : 'rows';
  const signalDetail = prefs['workspace.signalDetail'] === 'always' ? 'always' : 'hover';
  const youLabel = t('meshcore.you', 'You');

  // Today's sender naming: a unique key-prefix match, else the stored name, else a short key.
  const nameForKey = useCallback(
    (key: string): string | null => {
      if (!key) return null;
      const hit = contacts.find((c) => c.publicKey === key) ?? resolveAuthorContact(contacts, key);
      return hit ? hit.advName || hit.name || null : null;
    },
    [contacts],
  );
  const { rows: messages, chipsByTarget } = useMemo(
    () => groupMeshCoreReactions(all, { resolutions: props.reactionResolutions, selfPublicKey: selfKey, youLabel, nameForKey }),
    [all, props.reactionResolutions, selfKey, youLabel, nameForKey],
  );
  const ignoredRuns = useMemo(() => findIgnoredRuns(messages), [messages]);
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(() => new Set());

  const rows = useMemo(
    () =>
      messages.map((m): McRow => {
        const mine = !!selfKey && m.fromPublicKey === selfKey;
        const channel = m.fromPublicKey.startsWith('channel-');
        const contact = !channel ? contacts.find((c) => c.publicKey === m.fromPublicKey) ?? resolveAuthorContact(contacts, m.fromPublicKey) : null;
        const name = mine
          ? youLabel
          : m.fromName ?? nameForKey(m.fromPublicKey) ?? (channel ? t('meshcore.unknown_sender', 'Unknown sender') : `${m.fromPublicKey.slice(0, 8)}…`);
        return { message: m, mine, name, senderKey: contact?.publicKey ?? null, chips: chipsByTarget.get(m.id) ?? [] };
      }),
    [messages, selfKey, contacts, chipsByTarget, nameForKey, youLabel, t],
  );
  const byId = useMemo(() => new Map(rows.map((r) => [r.message.id, r])), [rows]);
  const rowAction = useCallback(
    (kind: MessageActionKind, msg: MeshMessage, emoji?: string) => {
      const row = byId.get(msg.id);
      if (row) onAction(kind, row, emoji);
    },
    [byId, onAction],
  );

  // The unread line (#4607): never on our own message or an unmatched reaction.
  const unreadAnchorId = useMemo(() => {
    const list = messages.map((m) => ({ id: m.id, sortTime: meshcoreDisplayTimeMs(m) }));
    const own = new Set(messages.filter((m) => (selfKey && m.fromPublicKey === selfKey) || m.reactionEmoji).map((m) => m.id));
    const anchor = resolveUnreadAnchorId({ messages: list, watermarkMs: props.unreadAnchorMs, mode: 'lastRead', ownMessageIds: own });
    return shouldSuppressDivider({ anchorId: anchor, messages: list, hasMoreOlder: hasMore }) ? null : anchor;
  }, [messages, selfKey, props.unreadAnchorMs, hasMore]);

  // Scrolling: the entry scroll once per conversation, following new messages at the bottom, Jump to Bottom.
  const listRef = useRef<HTMLDivElement>(null);
  const entry = useRef<{ key: string; done: boolean }>({ key: conversationKey, done: false });
  const nearBottom = useRef(true);
  const lastId = useRef<string | undefined>(undefined);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const [jump, setJump] = useState(false);
  useEffect(() => {
    if (entry.current.key !== conversationKey) entry.current = { key: conversationKey, done: false };
    const list = listRef.current;
    if (!list || entry.current.done || backlogLoading || messages.length === 0) return;
    entry.current.done = true;
    requestAnimationFrame(() => {
      const divider = list.querySelector('[data-unread-divider]');
      if (divider) divider.scrollIntoView({ block: 'start' });
      else list.scrollTop = list.scrollHeight;
    });
  }, [conversationKey, backlogLoading, messages.length]);
  useLayoutEffect(() => {
    const list = listRef.current;
    const last = messages[messages.length - 1]?.id;
    const appended = last !== lastId.current;
    lastId.current = last;
    if (!list) return;
    if (restore.current && !loadingOlder) {
      list.scrollTop = list.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (appended && nearBottom.current && entry.current.done) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, loadingOlder]);
  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    nearBottom.current = isNearBottom(list, DEFAULT_NEAR_BOTTOM_THRESHOLD_PX);
    setJump(!nearBottom.current);
  };
  const loadOlder = () => {
    const list = listRef.current;
    if (list) restore.current = { height: list.scrollHeight, top: list.scrollTop };
    props.onLoadOlder();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.messages} ref={listRef} onScroll={onScroll} role="log" aria-label={props.ariaLabel} data-phone={isPhone || undefined}>
        {hasMore && !backlogLoading && (
          <button type="button" className={styles.older} onClick={loadOlder} disabled={loadingOlder}>
            <UiIcon name="chevronUp" size={16} />
            {loadingOlder ? t('workspace.state.loading') : t('workspace.meshcore.load_older')}
          </button>
        )}
        {rows.length === 0 && !backlogLoading && <p className={styles.empty}>{props.emptyText}</p>}
        {rows.map((row, idx) => {
          const m = row.message;
          const date = new Date(meshcoreDisplayTimeMs(m));
          const prev = idx > 0 ? new Date(meshcoreDisplayTimeMs(rows[idx - 1].message)) : null;
          const separator = shouldShowDateSeparator(prev, date) ? getMessageDateSeparator(date, dateFormat) : null;
          const run = ignoredRuns.get(idx);
          const open = !!run && openRuns.has(run.key);
          const toggle = () =>
            run &&
            setOpenRuns((s) => {
              const next = new Set(s);
              if (next.has(run.key)) next.delete(run.key);
              else next.add(run.key);
              return next;
            });
          if (run && !open) {
            if (idx !== run.startIndex) return null;
            return (
              <Fragment key={`ignored-${run.key}`}>
                {separator && <p className={styles.date}>{separator}</p>}
                <MeshCoreIgnoredRunRow count={run.count} expanded={false} onToggle={toggle} />
              </Fragment>
            );
          }
          if (m.reactionEmoji) {
            return (
              <Fragment key={m.id}>
                {separator && <p className={styles.date}>{separator}</p>}
                <MeshCoreUnmatchedReaction name={row.name} emoji={m.reactionEmoji} rawText={m.reactionRawText} />
              </Fragment>
            );
          }
          const chips = row.chips.length > 0 && (
            <MeshCoreReactionChips chips={row.chips} onAdd={props.onChip ? (emoji) => props.onChip!(row, emoji) : undefined} />
          );
          const footer = props.footer?.(row);
          return (
            <Fragment key={m.id}>
              {/* The date heads its day; the unread line sits right above the first unseen message (#4607). */}
              {separator && <p className={styles.date}>{separator}</p>}
              {unreadAnchorId === m.id && <UnreadDivider label={props.unreadLabel} />}
              {run && idx === run.startIndex && <MeshCoreIgnoredRunRow count={run.count} expanded onToggle={toggle} />}
              <MessageRowD
                message={toMeshMessage(m, row.mine, m.fromName ?? m.fromPublicKey)}
                style={messageStyle}
                signalDetail={signalDetail}
                mine={row.mine}
                senderName={row.name}
                senderShort={row.mine ? shortMark(props.deviceName) : shortMark(row.name)}
                heardVia={props.deviceName}
                reactions={NO_REACTIONS}
                replied={null}
                showUnreadDivider={false}
                dateSeparator={null}
                translation={props.translations[m.id]}
                translationActions={props.translationActions}
                timeFormat={timeFormat}
                dateFormat={dateFormat}
                mentionOptions={MENTIONS}
                actionContext={props.actionContext}
                phone={isPhone}
                onAction={rowAction}
                headExtra={props.headExtra?.(row)}
                footer={(footer || chips) ? <>{footer}{chips}</> : undefined}
                ackLabel={props.ackLabel ? props.ackLabel(row) : undefined}
              />
            </Fragment>
          );
        })}
      </div>
      {jump && (
        <button
          type="button"
          className={styles.jump}
          onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
        >
          <UiIcon name="chevronDown" size={16} /> {t('channels.jump_to_bottom', 'Jump to Bottom')}
        </button>
      )}
    </div>
  );
}
