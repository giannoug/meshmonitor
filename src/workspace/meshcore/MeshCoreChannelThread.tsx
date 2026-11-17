/**
 * A MeshCore channel in layout D (boards 8-01, 8-02, 8-19, 8-24):
 * `/source/:id/channel/:idx`.
 *
 * - Desktop: the device bar (status, Advert nearby, Flood advert, Disconnect,
 *   their Sends lines), then the header: `# name`, its kind and message count,
 *   Scope, Mute and Clear channel messages. The phone header has Back, the
 *   bell and ⋯ (Clear), with Scope under it.
 * - Messages (MeshCoreThread): received ones carry today's hops and SNR, their
 *   scope and Route details; ours carry "Sent as", the heard-by box (relayed
 *   repeaters, a required one "not relayed yet"), the required-repeater note
 *   and the resends left. Message actions are today's: Reply (mentions the
 *   sender, replies on that scope), React, Translate, Resend (asks first), Copy
 *   and Delete (asks first).
 * - The composer (today's byte budget and mentions) says what Send transmits:
 *   one flood message, scoped or not. A channel that cannot send shows one line
 *   instead: a virtual channel (its key is not on the radio), a keyed one from
 *   another source, receive-only, no write grant, or a guest.
 *
 * Every send is one request per press (or per confirm); nothing here retries
 * or arms a timer. Today's 5 s resend clock runs only while a message of ours
 * could still become resendable, as today.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import { MeshCoreClockOffset } from '../../components/MeshCore/MeshCoreClockOffset';
import { heardByModel } from '../../components/MeshCore/HeardByBubble';
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
import { isReactableRow, reactionEmojiOptions } from '../../components/MeshCore/meshcoreReactionClient';
import { RESEND_MAX, resendAvailability, type ResendAvailabilityOpts } from '../../components/MeshCore/meshcoreResend';
import { SpipImage } from '../../components/Spip/SpipImage';
import { useAuth } from '../../contexts/AuthContext';
import { ComposeDraftContext, createComposeDraftStore } from '../../contexts/composeDraftStore';
import { useOptionalChannelMuteSettings, useSettings } from '../../contexts/SettingsContext';
import { useViewTranslations } from '../../hooks/useViewTranslations';
import { STANDARD_LANGUAGES } from '../../types/translation';
import { foldReactionEmoji } from '../../utils/meshcoreReactionTarget';
import { isReactionEmoji } from '../../utils/meshcoreReactions';
import { RELAY_ADV_TYPES, requiredRepeatersHeard } from '../../utils/meshcoreHeardBy';
import { meshcoreChannelMaxBytes } from '../../utils/meshcoreMessageLimits';
import { meshcoreMessageClockOffsetMs } from '../../utils/meshcoreMessageTime';
import { parseSpip } from '../../utils/spip';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu from '../patterns/RowMenu';
import Composer from '../chat/Composer';
import EmojiPickerSheet from '../chat/EmojiPickerSheet';
import ReadOnlyNote from '../chat/ReadOnlyNote';
import type { MessageActionContext, MessageActionItem } from '../chat/messageActions';
import type { RowTranslationActions } from '../chat/MessageRowD';
import OfflineBanner from '../devices/OfflineBanner';
import { composerGate } from '../chat/composerGate';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import { MeshCoreDeviceBar } from './AdvertMenu';
import HeardBySheet from './HeardBySheet';
import MeshCoreErrorBar from './MeshCoreErrorBar';
import { useMeshCoreRuntime } from './runtime';
import MeshCoreThread, { type McRow } from './MeshCoreThread';
import RouteDetails from './RouteDetails';
import ScopeMenu from './ScopeMenu';
import { channelKind, channelName, senderKeyOf } from './meshcoreLabels';
import { mcKeys } from './useMeshCoreLists';
import { useMeshCoreChannel } from './useMeshCoreChannel';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './MeshCoreChannelThread.module.css';

/** Today's resend clock (MeshCoreMessageStream): only while something could change. */
const RESEND_TICK_MS = 5_000;

export default function MeshCoreChannelThread({ idx }: { idx: number }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const { sources } = useShellDevices();
  const { sourceId, deviceName, meshCore, receiveOnly } = useMeshCoreRuntime();
  const ch = useMeshCoreChannel(idx);
  const { tapbackEmojis } = useSettings();
  const mute = useOptionalChannelMuteSettings();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const selfKey = meshCore.status?.localNode?.publicKey;
  const contacts = meshCore.contacts;
  const channel = ch.channel;
  const name = channel ? channelName(t, channel) : t('meshcore.channels.unnamed', 'Channel {{idx}}', { idx });
  const kind = channel ? channelKind(channel) : 'private';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draft = useMemo(() => createComposeDraftStore(), []);

  // Sheets and panels, one at a time (D9c).
  const [route, setRoute] = useState<McRow | null>(null);
  const [heard, setHeard] = useState<McRow | null>(null);
  const [resendFor, setResendFor] = useState<MeshCoreMessage | null>(null);
  const [deleteFor, setDeleteFor] = useState<MeshCoreMessage | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [picker, setPicker] = useState<McRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    setRoute(null);
    setHeard(null);
  }, [idx]);

  // Repeaters the required-repeater matcher resolves path hashes against (today's set).
  const repeaters = useMemo(
    () =>
      contacts
        .filter((c) => c.publicKey && (c.advType == null || RELAY_ADV_TYPES.has(c.advType)))
        .map((c) => ({ publicKey: c.publicKey, advType: c.advType ?? null, name: c.advName || c.name || null })),
    [contacts],
  );
  const resendOpts = useMemo<ResendAvailabilityOpts | undefined>(
    () => (ch.requiredKeys.length > 0 ? { requiredRepeaterKeys: ch.requiredKeys, requiredRepeaterMode: ch.requiredMode, repeaters } : undefined),
    [ch.requiredKeys, ch.requiredMode, repeaters],
  );

  // Who may send what (today's MeshCoreChannelsView gates), and why not.
  const status = sources.find((s) => s.id === sourceId)?.status;
  const gate = composerGate(t, status, deviceName, false);
  const writeReason = ch.canSend ? undefined : t('workspace.node_menu.needs', { permission: 'messages:write' });
  const noteText = channel?.virtual
    ? t('meshcore.channels.virtual_title')
    : channel?.readOnly
      ? t('meshcore.channels.keyed_read_only')
      : receiveOnly
        ? t('meshcore.receive_only.control_tooltip')
        : null;
  const sendReason = writeReason ?? noteText ?? gate.sendReason ?? (!ch.connected ? t('meshcore.disconnected', 'Disconnected') : undefined);
  const canReact = !sendReason && meshCore.status?.reactionsOutboundEnabled === true;
  const resendLive = !sendReason;

  const [now, setNow] = useState(() => Date.now());
  const needsClock = useMemo(
    () => resendLive && ch.messages.some((m) => resendAvailability(m, selfKey, Date.now(), resendOpts).kind !== 'never'),
    [resendLive, ch.messages, selfKey, resendOpts],
  );
  useEffect(() => {
    if (!needsClock) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), RESEND_TICK_MS);
    return () => clearInterval(timer);
  }, [needsClock]);
  const resendReady = useCallback(
    (m: MeshCoreMessage) => resendLive && resendAvailability(m, selfKey, now, resendOpts).kind === 'ready',
    [resendLive, selfKey, now, resendOpts],
  );
  const left = (m: MeshCoreMessage) => Math.max(0, RESEND_MAX - (m.resendCount ?? 0));

  // Translation (today's per-row Translate and the composer's).
  const translatableIds = useMemo(
    () => ch.messages.filter((m) => m.text && !m.reactionEmoji && !m.reactionPending && parseSpip(m.text) == null).map((m) => m.id),
    [ch.messages],
  );
  const { translationSettings, viewerLang, translatedMessages, translateMessage, dismissTranslation } = useViewTranslations(sourceId, translatableIds);
  const translatable = useMemo(() => new Set(translatableIds), [translatableIds]);
  const translationActions = useMemo<RowTranslationActions>(
    () => ({ dismiss: dismissTranslation, translate: translationSettings.canTranslate ? translateMessage : undefined }),
    [dismissTranslation, translateMessage, translationSettings.canTranslate],
  );

  const byId = useMemo(() => new Map(ch.messages.map((m) => [m.id, m])), [ch.messages]);
  const actionContext = useMemo<MessageActionContext>(
    () => ({
      canSend: true,
      writeReason,
      sendReason,
      deleteReason: writeReason,
      canTranslate: translationSettings.canTranslate,
      translateHint: t('workspace.chat.translate_hint', { language: STANDARD_LANGUAGES.find((l) => l.code === viewerLang)?.name ?? viewerLang }),
      sendsTapback: t('workspace.meshcore.sends_reaction', { channel: name }),
      sendsResend: '',
      nodeDetails: true,
      filter: (item: MessageActionItem, msg, mine): MessageActionItem | null => {
        const m = byId.get(msg.id);
        if (!m) return null;
        switch (item.kind) {
          case 'node':
            return senderKeyOf(m, contacts) ? item : null;
          case 'react':
            return isReactableRow(m, selfKey) && meshCore.status?.reactionsOutboundEnabled === true ? item : null;
          case 'translate':
            return translatable.has(m.id) ? item : null;
          case 'resend':
            return mine && resendReady(m) ? { ...item, sends: t('workspace.meshcore.sends_resend', { left: left(m), max: RESEND_MAX }) } : null;
          case 'details':
            return mine ? null : item;
          default:
            return item;
        }
      },
    }),
    [writeReason, sendReason, translationSettings.canTranslate, viewerLang, t, name, byId, selfKey, meshCore.status?.reactionsOutboundEnabled, translatable, resendReady, contacts],
  );

  const react = (row: McRow, emoji: string) => {
    // Today: no second copy of a reaction we already sent here.
    if (row.chips.some((c) => c.mine && foldReactionEmoji(c.emoji) === foldReactionEmoji(emoji))) return;
    void meshCore.actions.sendReaction(row.message, emoji);
  };
  const onAction = (kind: string, row: McRow, emoji?: string) => {
    const m = row.message;
    switch (kind) {
      case 'reply': {
        // Today's MeshCore reply: an `@[Sender]:` mention, sent on the message's scope.
        const who = (m.fromName ?? row.name).trim();
        draft.set(who ? `@[${who}]: ` : '');
        ch.replyScope(m);
        requestAnimationFrame(() => inputRef.current?.focus());
        break;
      }
      case 'react':
        if (emoji) react(row, emoji);
        else setPicker(row);
        break;
      case 'translate':
        void translateMessage(m.id, m.text);
        break;
      case 'resend':
        setResendFor(m);
        break;
      case 'details':
        setRoute(row);
        break;
      case 'node':
        // Today's sender-name link: that contact's Node Details (the DM view).
        if (row.senderKey) void navigate(`${base}/node/${encodeURIComponent(row.senderKey)}`);
        break;
      case 'copy':
        void navigator.clipboard
          .writeText(m.text)
          .then(() => showToast(t('toast.copied_clipboard'), 'success'))
          .catch(() => showToast(t('errors.generic'), 'error'));
        break;
      case 'delete':
        setDeleteFor(m);
        break;
    }
  };

  const headExtra = (row: McRow) => {
    const m = row.message;
    const offset = meshcoreMessageClockOffsetMs(m);
    return (
      <>
        {offset !== null && <MeshCoreClockOffset offsetMs={offset} />}
        {m.senderNameOverride && (
          <span className={styles.sentAs} title={t('meshcore.sent_as_tooltip')}>
            <UiIcon name="user" size={12} /> {t('meshcore.sent_as', { name: m.senderNameOverride })}
          </span>
        )}
      </>
    );
  };
  const footer = (row: McRow) => {
    const m = row.message;
    const spip = parseSpip(m.text);
    const scoped = (m.scopeName != null && m.scopeName !== '') || (typeof m.scopeCode === 'number' && m.scopeCode !== 0);
    const scope = scoped ? (m.scopeName || `#${(m.scopeCode ?? 0).toString(16).padStart(4, '0')}`) : null;
    const hasRoute = !row.mine && m.hopCount !== 0 && !!m.routePath;
    const ownSend = row.mine && !!m.toPublicKey && m.messageType !== 'room_post';
    return (
      <>
        {spip && <SpipImage image={spip} code={m.text.trim()} />}
        {(scope || hasRoute) && (
          <p className={styles.meta}>
            {scope && <span title={t('meshcore.scope_tooltip', 'The region/scope this message was sent with')}>{t('workspace.meshcore.scope_of', { scope })}</span>}
            {hasRoute && (
              <button type="button" className={styles.link} data-phone={isPhone || undefined} title={t('meshcore.route_detail_tooltip')} onClick={() => setRoute(row)}>
                {t('workspace.meshcore.route_details')}
              </button>
            )}
          </p>
        )}
        {ownSend && heardBox(row)}
      </>
    );
  };

  const heardBox = (row: McRow) => {
    const m = row.message;
    const model = heardByModel(m.heardBy, ch.requiredKeys, repeaters);
    const requiredMissing = ch.requiredKeys.length > 0 && !!m.heardBy?.length && !requiredRepeatersHeard(m.heardBy, ch.requiredKeys, ch.requiredMode, repeaters);
    const missingName = model.required.find((r) => !r.entry)?.name;
    const hops = (n?: number | null) => (typeof n === 'number' ? ` · ${t('meshcore.heard_by_hops', { count: n })}` : '');
    return (
      <div className={styles.heardWrap}>
        <div className={styles.heard}>
          <button type="button" className={styles.heardButton} data-phone={isPhone || undefined} title={t('meshcore.heard_by_tooltip')} onClick={() => setHeard(row)}>
            <UiIcon name="radioSignal" size={14} /> {t('workspace.meshcore.heard_by', { count: model.greenCount })}
          </button>
          {model.required.map((r) =>
            r.entry ? (
              <span key={r.key} className={styles.chip}><UiIcon name="check" size={12} /> {(r.entry.name || r.name) + hops(r.entry.hops)}</span>
            ) : (
              <span key={r.key} className={`${styles.chip} ${styles.missing}`}>{r.name} · {t('meshcore.heard_by.not_yet', 'not relayed yet')}</span>
            ),
          )}
          {model.others.map((h, i) => (
            <span key={`${h.hash}-${i}`} className={styles.chip}><UiIcon name="check" size={12} /> {(h.name || h.hash) + hops(h.hops)}</span>
          ))}
        </div>
        {requiredMissing && (
          <p className={styles.warn}>
            {t('meshcore.heard_by_required_tooltip', { count: m.heardBy!.length, name: missingName ?? t('meshcore.required_repeater.count', { count: ch.requiredKeys.length, defaultValue: '{{count}} required repeaters' }) })}
          </p>
        )}
        {resendReady(m) && <p className={styles.left}>{t('meshcore.resend.remaining', { count: left(m), max: RESEND_MAX })}</p>}
      </div>
    );
  };

  const mentionCandidates = useMemo(
    () =>
      contacts
        .map((c) => ({ id: c.publicKey, longName: (c.advName ?? c.name ?? '').trim(), shortName: '', lastSeen: c.lastSeen ?? c.lastAdvert ?? 0 }))
        .filter((c) => c.longName)
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .map(({ id, longName, shortName }) => ({ id, longName, shortName })),
    [contacts],
  );

  const muted = mute?.isChannelMuted(idx) ?? false;
  const refreshMutes = () => void queryClient.invalidateQueries({ queryKey: mcKeys.mutes(sourceId) });
  const muteMenu = signedIn && mute && (
    <MuteMenu
      muted={muted}
      onMute={async (until) => {
        await mute.muteChannel(idx, until);
        refreshMutes();
      }}
      onUnmute={async () => {
        await mute.unmuteChannel(idx);
        refreshMutes();
      }}
      buttonClassName={isPhone ? threadStyles.icon : threadStyles.button}
      alignRight
    />
  );
  const canClear = ch.canSend && ch.messages.length > 0;
  const scopeMenu = ch.canSend && ch.connected && !channel?.virtual && (
    <ScopeMenu channelName={name} scope={ch.scope} receiveOnly={receiveOnly} phone={isPhone} />
  );
  const kindLine = channel?.virtual
    ? t('workspace.meshcore.virtual_tag')
    : t(`workspace.meshcore.kind_${kind}`);
  const subtitle = [kindLine, ch.count !== null ? t('workspace.meshcore.message_count', { count: ch.count }) : null].filter(Boolean).join(' · ');

  const header = (
    <header className={threadStyles.header}>
      {isPhone && (
        <Link className={threadStyles.icon} to={base}>
          <UiIcon name="back" size={22} />
          <span className={threadStyles.srOnly}>{t('common.back')}</span>
        </Link>
      )}
      <div className={threadStyles.titles}>
        <h1 className={threadStyles.title}>{`# ${name}`}</h1>
        <p className={threadStyles.subtitle}>{subtitle}</p>
      </div>
      <div className={threadStyles.tools}>
        {!isPhone && scopeMenu}
        {muteMenu}
        {canClear &&
          (isPhone ? (
            <RowMenu
              label={t('channels.channel_options', 'Channel options')}
              items={[{ key: 'clear', label: t('meshcore.clear_channel', 'Clear channel messages'), icon: 'delete', danger: true, onSelect: () => setClearOpen(true) }]}
            />
          ) : (
            <button type="button" className={`${threadStyles.button} ${styles.plain}`} onClick={() => setClearOpen(true)}>
              <UiIcon name="delete" size={16} /> {t('meshcore.clear_channel', 'Clear channel messages')}
            </button>
          ))}
      </div>
    </header>
  );

  const scopeSends = ch.scope.send ? t('workspace.meshcore.sends_scoped', { scope: ch.scope.send }) : t('workspace.meshcore.sends_unscoped');
  const composer =
    !channel ? null : noteText ? (
      <ReadOnlyNote kind="reason" text={noteText} />
    ) : !signedIn ? (
      <ReadOnlyNote kind="guest" />
    ) : writeReason ? (
      <ReadOnlyNote kind="reason" text={writeReason} />
    ) : gate.show ? (
      <ComposeDraftContext.Provider value={draft}>
        <Composer
          target={{ kind: 'channel', channel: idx, name }}
          disabledReason={gate.disabledReason ?? (!ch.connected ? t('meshcore.disconnected', 'Disconnected') : undefined)}
          sends={scopeSends}
          maxBytes={meshcoreChannelMaxBytes(meshCore.status?.localNode?.name)}
          sending={sending}
          allowNewlines={false}
          buildMentionInsertion={(c) => `@[${c.longName}] `}
          onSend={(text) => {
            if (!text.trim() || sending) return;
            setSending(true);
            void ch.send(text).then((ok) => {
              setSending(false);
              if (ok) draft.set('');
            });
          }}
          canTranslate={translationSettings.canTranslate}
          translateLanguages={{ target: translationSettings.defaultOutgoingLanguage, source: translationSettings.defaultLanguage }}
          mentionCandidates={mentionCandidates}
          homoglyphEnabled={false}
          inputRef={inputRef}
        />
      </ComposeDraftContext.Provider>
    ) : null;

  const thread = !ch.listPending && !channel ? (
    <p className={threadStyles.empty}>{t('workspace.chat.not_available')}</p>
  ) : (
    <div className={threadStyles.split}>
      <div className={threadStyles.column}>
        <MeshCoreThread
          conversationKey={`${sourceId}:channel-${idx}`}
          ariaLabel={`# ${name}`}
          messages={ch.messages}
          contacts={contacts}
          selfKey={selfKey}
          deviceName={deviceName}
          emptyText={t('meshcore.no_messages', 'No messages on this channel yet')}
          unreadAnchorMs={ch.entryLastRead}
          backlogLoading={!ch.ready}
          hasMore={ch.hasMore}
          loadingOlder={ch.loadingOlder}
          onLoadOlder={ch.loadOlder}
          reactionResolutions={meshCore.reactionResolutions}
          actionContext={actionContext}
          onAction={onAction}
          onChip={canReact ? react : undefined}
          headExtra={headExtra}
          footer={footer}
          ackLabel={() => null}
          translations={translatedMessages}
          translationActions={translationActions}
        />
        {composer}
      </div>
      {!isPhone && route && <RouteDetails row={route} onClose={() => setRoute(null)} />}
    </div>
  );

  return (
    <section className={threadStyles.page} data-phone={isPhone || undefined}>
      {!isPhone && <MeshCoreDeviceBar />}
      {header}
      {isPhone && scopeMenu && <div className={styles.scopeRow}>{scopeMenu}</div>}
      <OfflineBanner sourceId={sourceId} />
      <MeshCoreErrorBar />
      {thread}
      {isPhone && route && <RouteDetails row={route} onClose={() => setRoute(null)} />}
      {heard && (
        <HeardBySheet
          row={heard}
          requiredKeys={ch.requiredKeys}
          repeaters={repeaters}
          scope={heard.message.scopeName ?? ch.scope.send}
          resendLeft={resendReady(heard.message) ? left(heard.message) : null}
          onResend={() => {
            const m = heard.message;
            setHeard(null);
            setResendFor(m);
          }}
          onClose={() => setHeard(null)}
        />
      )}
      {picker && (
        <EmojiPickerSheet
          sends={actionContext.sendsTapback}
          emojis={reactionEmojiOptions(tapbackEmojis)}
          isAllowed={isReactionEmoji}
          onPick={(emoji) => react(picker, emoji)}
          onClose={() => setPicker(null)}
        />
      )}
      <ConfirmSheet
        open={!!resendFor}
        title={t('meshcore.resend.confirm_title', 'Resend message?')}
        body={
          resendFor && (
            <>
              <p>{t('meshcore.resend.confirm_body')}</p>
              <blockquote className={styles.quote}>{resendFor.text}</blockquote>
              <p>{t('meshcore.resend.remaining', { count: left(resendFor), max: RESEND_MAX })}</p>
            </>
          )
        }
        confirmLabel={t('meshcore.resend.confirm', 'Resend')}
        busy={busy}
        submitOnEnter={false}
        onConfirm={async () => {
          if (!resendFor) return;
          setBusy(true);
          try {
            await ch.resend(resendFor);
          } finally {
            setBusy(false);
            setResendFor(null);
            setNow(Date.now());
          }
        }}
        onCancel={() => setResendFor(null)}
      />
      <ConfirmSheet
        open={!!deleteFor}
        title={t('channels.delete_button_title')}
        body={t('meshcore.confirm_delete_message', 'Delete this message?')}
        confirmLabel={t('common.delete')}
        danger
        busy={busy}
        onConfirm={async () => {
          if (!deleteFor) return;
          setBusy(true);
          try {
            await ch.remove(deleteFor);
          } finally {
            setBusy(false);
            setDeleteFor(null);
          }
        }}
        onCancel={() => setDeleteFor(null)}
      />
      <ConfirmSheet
        open={clearOpen}
        title={t('meshcore.clear_channel', 'Clear channel messages')}
        body={t('meshcore.confirm_clear_channel', 'Clear all messages on this channel? This cannot be undone.')}
        confirmLabel={t('meshcore.clear_channel', 'Clear channel messages')}
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await ch.clear();
          } finally {
            setBusy(false);
            setClearOpen(false);
          }
        }}
        onCancel={() => setClearOpen(false)}
      />
    </section>
  );
}
