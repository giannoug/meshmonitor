/**
 * An LXMF conversation (boards 9-01, 9-10; notes s9n0 … s9n4), native at
 * `/source/:id/dm/<peer>`, on today's reads and send (ReticulumDmsView):
 *
 * - Opening it loads the peer's latest page once (today's select), and the
 *   socket's `reticulum:message` / delivery-state events keep it live; Load
 *   older messages (above) asks for one older page per press.
 * - The header names the peer from its announce (its hash otherwise), its
 *   app and aspects, and its path ("2 hops via Halandri Transport").
 * - Today's identity note (back it up) while this source has an address.
 * - Rows are the Workspace's `MessageRowD`, read-only as today (no reply,
 *   react or delete on LXMF): Reply and Thread markers, the title, attachment
 *   placeholders (name, type, size, "not transferred"; the bridge never sends
 *   the bytes), a reaction, and on ours today's delivery state (Sending…,
 *   Sent, Delivered, Failed). The delivery method is not shown (s9n2).
 * - Send: "Sends 1 LXMF message to <peer>", one POST per press, no retry. A
 *   pressed message shows at once as Sending…, and as Failed if the send fails.
 *
 * The composer follows the device's state (composerGate) and today's
 * `messages:write`; without it a note says why.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { ComposeDraftContext, createComposeDraftStore } from '../../contexts/composeDraftStore';
import { UiIcon } from '../../components/icons';
import {
  deliveryChipFor,
  extractAttachments,
  formatAttachmentBytes,
  parseFields,
} from '../../components/Reticulum/lxmfMessageParts';
import type { ReticulumMessageRow } from '../../types/reticulum';
import type { MeshMessage } from '../../types/message';
import { getMessageDateSeparator, shouldShowDateSeparator } from '../../utils/datetime';
import { isNearBottom, DEFAULT_NEAR_BOTTOM_THRESHOLD_PX } from '../../utils/scrollNearBottom';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import MessageRowD from '../chat/MessageRowD';
import type { MessageActionContext } from '../chat/messageActions';
import Composer from '../chat/Composer';
import ReadOnlyNote from '../chat/ReadOnlyNote';
import { composerGate } from '../chat/composerGate';
import OfflineBanner from '../devices/OfflineBanner';
import Sheet from '../patterns/Sheet';
import DestinationPanel from './DestinationPanel';
import { peerMark, peerTone, peerName, routeLine, shortHash, useRnsRuntime } from './runtime';
import threadStyles from '../meshcore/MeshCoreThread.module.css';
import headStyles from '../chat/ChannelThread.module.css';
import styles from './Reticulum.module.css';

const READ_ONLY: MessageActionContext = { canSend: false, canTranslate: false, translateHint: '', sendsTapback: '', sendsResend: '' };
const MENTIONS = { resolveNodeName: () => undefined, selfNodeId: '' };
const NO_REACTIONS: MeshMessage[] = [];
const NO_MESSAGES: ReticulumMessageRow[] = [];
const noop = () => {};

/** A local bubble between the press and the POST's reply (today's optimistic send). */
interface Pending {
  localId: string;
  content: string;
  createdAt: number;
  failed: boolean;
}

export default function LxmfThread({ peer }: { peer: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission } = useAuth();
  const { prefs } = useUserPreferences({ enabled: authStatus?.authenticated === true });
  const { timeFormat, dateFormat } = useSettings();
  const { sources } = useShellDevices();
  const { sourceId, deviceName, rns } = useRnsRuntime();
  const { loadConversation, destinations, paths, identity } = rns;
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const messageStyle = prefs['workspace.messageStyle'] === 'bubbles' ? 'bubbles' : 'rows';
  const signalDetail = prefs['workspace.signalDetail'] === 'always' ? 'always' : 'hover';

  // Today's select: the peer's latest page, once per opened conversation.
  useEffect(() => {
    void loadConversation(peer);
  }, [peer, loadConversation]);

  const active = rns.activePeerHash === peer;
  const messages = active ? rns.messages : NO_MESSAGES;
  const name = peerName(peer, destinations);
  const destination = destinations.find((d) => d.destinationHash === peer) ?? null;
  const route = routeLine(t, peer, paths, destinations);
  const app = destination?.appName ? [destination.appName, destination.aspects].filter(Boolean).join('.') : null;
  const ownName = identity?.displayName || deviceName;
  const [info, setInfo] = useState(false);

  const draft = useMemo(() => createComposeDraftStore(), []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [...prev, { localId, content, createdAt: Date.now(), failed: false }]);
    draft.set('');
    setSending(true);
    try {
      const row = await rns.sendMessage({ to: peer, content });
      setPending((prev) => (row ? prev.filter((p) => p.localId !== localId) : prev.map((p) => (p.localId === localId ? { ...p, failed: true } : p))));
    } finally {
      setSending(false);
    }
  };

  const source = sources.find((s) => s.id === sourceId);
  const gate = composerGate(t, source?.status, deviceName, false);
  const signedIn = authStatus?.authenticated === true;
  const canWrite = hasPermission('messages', 'write', { sourceId });
  const sends = [t('workspace.reticulum.sends_lxmf', { name }), route].filter(Boolean).join(' · ');
  const composer = !signedIn ? (
    <ReadOnlyNote kind="guest" />
  ) : !canWrite ? (
    <ReadOnlyNote kind="reason" text={t('workspace.node_menu.needs', { permission: 'messages:write' })} />
  ) : gate.show ? (
    <ComposeDraftContext.Provider value={draft}>
      <Composer
        target={{ kind: 'dm', nodeId: peer, name }}
        disabledReason={gate.disabledReason}
        sends={sends}
        placeholder={t('reticulum.dms.compose_placeholder', 'Type a message…')}
        sending={sending}
        // Today's LXMF box: Enter sends, Shift+Enter a new line.
        allowNewlines
        onSend={(text) => void send(text)}
        canTranslate={false}
        mentionCandidates={[]}
        homoglyphEnabled={false}
      />
    </ComposeDraftContext.Provider>
  ) : null;

  // A new message (ours or theirs) scrolls to the bottom; an older page does not move it.
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | undefined>(undefined);
  // While the reader is at the bottom, it stays there as the page around the list settles (the composer arriving).
  const atBottom = useRef(true);
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const list = listRef.current;
    const last = messages[messages.length - 1]?.id ?? pending[pending.length - 1]?.localId;
    if (list && last !== lastId.current) {
      list.scrollTop = list.scrollHeight;
      // Again once the rows have laid out (attachments, the composer's height).
      requestAnimationFrame(() => (list.scrollTop = list.scrollHeight));
    }
    lastId.current = last;
  }, [messages, pending]);

  const chip = (state: ReticulumMessageRow['state'] | 'failed' | 'sending') => {
    const c = deliveryChipFor(state as ReticulumMessageRow['state']);
    return (
      <span className={styles.state} data-state={state}>
        <UiIcon name={c.icon} size={13} /> {t(c.labelKey, c.fallback)}
      </span>
    );
  };

  const header = (
    <header className={headStyles.header}>
      {isPhone && (
        <Link to={base} className={headStyles.icon}>
          <UiIcon name="back" size={22} />
          <span className={headStyles.srOnly}>{t('common.back')}</span>
        </Link>
      )}
      {!isPhone && <span className={styles.avatarLarge} data-tone={peerTone(name)} data-anon={name.startsWith('<') || undefined} aria-hidden="true">{peerMark(name)}</span>}
      <div className={headStyles.titles}>
        <h1 className={headStyles.title}>{name}</h1>
        <p className={headStyles.subtitle}>
          {[app, isPhone ? null : shortHash(peer), route].filter(Boolean).join(' · ')}
        </p>
      </div>
      {isPhone && destination && (
        <button type="button" className={headStyles.icon} aria-label={t('workspace.reticulum.destination')} onClick={() => setInfo(true)}>
          <UiIcon name="info" size={22} />
        </button>
      )}
    </header>
  );

  const rows = messages.map((m, idx) => {
    const mine = m.toHash === peer;
    const fields = parseFields(m.fields);
    const attachments = extractAttachments(fields);
    const reaction = fields && typeof fields.reaction === 'string' ? fields.reaction : null;
    const date = new Date(m.timestamp);
    const prev = idx > 0 ? new Date(messages[idx - 1].timestamp) : null;
    const separator = shouldShowDateSeparator(prev, date) ? getMessageDateSeparator(date, dateFormat) : null;
    const message: MeshMessage = {
      id: m.id,
      from: mine ? ownName : name,
      to: mine ? peer : '',
      fromNodeId: m.fromHash,
      toNodeId: m.toHash,
      text: m.content ?? '',
      channel: -1,
      timestamp: date,
      isLocalMessage: mine,
    };
    const badges = (m.replyToHash || m.threadHash) && (
      <>
        {m.threadHash && (
          <span className={styles.marker} title={m.threadHash}>
            <UiIcon name="link" size={12} /> {t('reticulum.dms.thread_badge', 'Thread')}
          </span>
        )}
        {m.replyToHash && (
          <span className={styles.marker} title={m.replyToHash}>
            <UiIcon name="reply" size={12} /> {t('reticulum.dms.reply_badge', 'Reply')}
          </span>
        )}
      </>
    );
    const footer = (
      <>
        {m.title && <p className={styles.msgTitle}>{m.title}</p>}
        {attachments.map((a, i) => (
          <span key={`${m.id}-att-${i}`} className={styles.attachment}>
            <UiIcon name="file" size={16} />
            <span className={styles.attachmentText}>
              <strong>{a.name}</strong>
              <span>
                {[a.type.toUpperCase(), a.size !== null ? formatAttachmentBytes(a.size) : null, t('workspace.reticulum.not_transferred')]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </span>
        ))}
        {reaction && (
          <p className={styles.reaction}>
            <UiIcon name="reaction" size={12} /> {reaction}
          </p>
        )}
        {mine && chip(m.state)}
      </>
    );
    return (
      <Fragment key={m.id}>
        {separator && <p className={threadStyles.date}>{separator}</p>}
        <MessageRowD
          message={message}
          style={messageStyle}
          signalDetail={signalDetail}
          mine={mine}
          senderName={mine ? ownName : name}
          senderShort={peerMark(mine ? ownName : name)}
          reactions={NO_REACTIONS}
          replied={null}
          showUnreadDivider={false}
          dateSeparator={null}
          timeFormat={timeFormat}
          dateFormat={dateFormat}
          mentionOptions={MENTIONS}
          actionContext={READ_ONLY}
          phone={isPhone}
          onAction={noop}
          readOnly
          headExtra={badges || undefined}
          footer={footer}
          ackLabel={null}
        />
      </Fragment>
    );
  });

  return (
    <div className={styles.thread}>
      {header}
      <OfflineBanner sourceId={sourceId} />
      {identity?.destinationHash && (
        <p className={styles.identityNote} role="note">
          <UiIcon name="key" size={16} />
          <span>
            {t(
              'reticulum.dms.identity_backup_note',
              "This source's LXMF identity lives on the bridge volume — back it up; a fresh bridge without it gets a new address.",
            )}
          </span>
        </p>
      )}
      <div className={threadStyles.wrap}>
        <div
          className={threadStyles.messages}
          ref={listRef}
          role="log"
          aria-label={name}
          data-phone={isPhone || undefined}
          onScroll={(e) => (atBottom.current = isNearBottom(e.currentTarget, DEFAULT_NEAR_BOTTOM_THRESHOLD_PX))}
        >
          {active && rns.hasMoreMessages && (
            <button type="button" className={threadStyles.older} disabled={rns.messagesLoading} onClick={() => void rns.loadMoreMessages()}>
              <UiIcon name="chevronUp" size={16} />
              {rns.messagesLoading ? t('reticulum.dms.loading', 'Loading…') : t('reticulum.dms.load_older', 'Load older messages')}
            </button>
          )}
          {messages.length === 0 && pending.length === 0 && (
            <p className={threadStyles.empty}>
              {!active || rns.messagesLoading
                ? t('reticulum.dms.loading', 'Loading…')
                : t('reticulum.dms.no_messages', 'No messages in this conversation yet.')}
            </p>
          )}
          {rows}
          {pending.map((p) => (
            <MessageRowD
              key={p.localId}
              message={{ id: p.localId, from: ownName, to: peer, fromNodeId: '', toNodeId: peer, text: p.content, channel: -1, timestamp: new Date(p.createdAt), isLocalMessage: true }}
              style={messageStyle}
              signalDetail={signalDetail}
              mine
              senderName={ownName}
              senderShort={peerMark(ownName)}
              reactions={NO_REACTIONS}
              replied={null}
              showUnreadDivider={false}
              dateSeparator={null}
              timeFormat={timeFormat}
              dateFormat={dateFormat}
              mentionOptions={MENTIONS}
              actionContext={READ_ONLY}
              phone={isPhone}
              onAction={noop}
              readOnly
              footer={chip(p.failed ? 'failed' : 'sending')}
              ackLabel={null}
            />
          ))}
        </div>
      </div>
      {composer}
      {isPhone && destination && (
        <Sheet open={info} onClose={() => setInfo(false)} title={name}>
          <DestinationPanel destination={destination} embedded />
        </Sheet>
      )}
    </div>
  );
}
