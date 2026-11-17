/**
 * A room server's posts (boards 8-04, 8-18): today's posts, oldest first by
 * the sender's time, with the "Unread posts" line, and once logged in the
 * composer: "Post to <room>", today's byte budget and mentions, and its Sends
 * line (one post, which the room stores for its members). Our posts carry
 * today's delivery words. Rooms offer what today's Rooms view does per post:
 * Translate and Copy, and Details for ours. Read-only (`readOnly`) shows the
 * saved posts under the login card, as today.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import MessageDetailsModal from '../../components/diagnostics/MessageDetailsModal';
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
import { directSendLabel } from '../../components/MeshCore/meshcoreSendLabel';
import { useAuth } from '../../contexts/AuthContext';
import { ComposeDraftContext, createComposeDraftStore } from '../../contexts/composeDraftStore';
import { useViewTranslations } from '../../hooks/useViewTranslations';
import { STANDARD_LANGUAGES } from '../../types/translation';
import { getMeshCoreDirectSendState } from '../../utils/deliveryDiagnostics/status';
import { MESHCORE_MAX_MESSAGE_BYTES_DM } from '../../utils/meshcoreMessageLimits';
import { parseSpip } from '../../utils/spip';
import Composer from '../chat/Composer';
import ReadOnlyNote from '../chat/ReadOnlyNote';
import { composerGate } from '../chat/composerGate';
import type { MessageActionContext, MessageActionItem } from '../chat/messageActions';
import type { RowTranslationActions } from '../chat/MessageRowD';
import { useShellDevices } from '../shell/shellDevices';
import { useMeshCoreRuntime } from './runtime';
import MeshCoreThread, { type McRow } from './MeshCoreThread';
import type { useMeshCoreRoom } from './useMeshCoreRoom';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './Room.module.css';

type Room = ReturnType<typeof useMeshCoreRoom>;

export default function RoomPosts({ room, name, roomKey, readOnly = false }: { room: Room; name: string; roomKey: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { authStatus } = useAuth();
  const { sources } = useShellDevices();
  const { sourceId, deviceName, meshCore, receiveOnly } = useMeshCoreRuntime();
  const selfKey = meshCore.status?.localNode?.publicKey;
  const draft = useMemo(() => createComposeDraftStore(), []);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const [details, setDetails] = useState<MeshCoreMessage | null>(null);

  const translatableIds = useMemo(
    () => room.posts.filter((m) => m.text && parseSpip(m.text) == null).map((m) => m.id),
    [room.posts],
  );
  const { translationSettings, viewerLang, translatedMessages, translateMessage, dismissTranslation } = useViewTranslations(sourceId, translatableIds);
  const translationActions = useMemo<RowTranslationActions>(
    () => ({ dismiss: dismissTranslation, translate: translationSettings.canTranslate ? translateMessage : undefined }),
    [dismissTranslation, translateMessage, translationSettings.canTranslate],
  );
  const gate = composerGate(t, sources.find((s) => s.id === sourceId)?.status, deviceName, false);
  const actionContext = useMemo<MessageActionContext>(
    () => ({
      canSend: false,
      canTranslate: translationSettings.canTranslate,
      translateHint: t('workspace.chat.translate_hint', { language: STANDARD_LANGUAGES.find((l) => l.code === viewerLang)?.name ?? viewerLang }),
      sendsTapback: '',
      sendsResend: '',
      // Today's room posts: Translate, Copy, and Details on ours; no reply, react, resend or delete.
      filter: (item: MessageActionItem, msg, mine): MessageActionItem | null => {
        if (item.kind === 'translate') return translatableIds.includes(msg.id) ? item : null;
        if (item.kind === 'copy') return item;
        if (item.kind === 'details') return mine ? item : null;
        return null;
      },
    }),
    [translationSettings.canTranslate, viewerLang, t, translatableIds],
  );
  const onAction = (kind: string, row: McRow) => {
    if (kind === 'translate') void translateMessage(row.message.id, row.message.text);
    else if (kind === 'details') setDetails(row.message);
    else if (kind === 'copy')
      void navigator.clipboard
        .writeText(row.message.text)
        .then(() => showToast(t('toast.copied_clipboard'), 'success'))
        .catch(() => showToast(t('errors.generic'), 'error'));
  };
  const ackLabel = (row: McRow) => {
    const direct = getMeshCoreDirectSendState(row.message, selfKey);
    return direct ? <span className={styles.ack}>{directSendLabel(t, direct, row.message.roundTripMs)}</span> : null;
  };
  const mentionCandidates = useMemo(
    () =>
      meshCore.contacts
        .map((c) => ({ id: c.publicKey, longName: (c.advName ?? c.name ?? '').trim(), shortName: '' }))
        .filter((c) => c.longName),
    [meshCore.contacts],
  );

  const composer = readOnly ? null : receiveOnly ? (
    <ReadOnlyNote kind="reason" text={t('meshcore.receive_only.control_tooltip')} />
  ) : authStatus?.authenticated !== true ? (
    <ReadOnlyNote kind="guest" />
  ) : !room.canSend ? (
    <ReadOnlyNote kind="reason" text={t('workspace.node_menu.needs', { permission: 'messages:write' })} />
  ) : gate.show ? (
    <ComposeDraftContext.Provider value={draft}>
      <Composer
        target={{ kind: 'dm', nodeId: roomKey, name }}
        disabledReason={gate.disabledReason ?? (!room.connected ? t('meshcore.disconnected', 'Disconnected') : undefined)}
        sends={t('workspace.meshcore.sends_post', { room: name })}
        placeholder={t('workspace.meshcore.post_to', { room: name })}
        maxBytes={MESHCORE_MAX_MESSAGE_BYTES_DM}
        sending={sending}
        allowNewlines={false}
        buildMentionInsertion={(c) => `@[${c.longName}] `}
        onSend={(text) => {
          if (!text.trim() || sending) return;
          setSending(true);
          void room.send(text).then((ok) => {
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

  return (
    <div className={threadStyles.column}>
      <MeshCoreThread
        conversationKey={`${sourceId}:room-${roomKey}`}
        ariaLabel={name}
        messages={room.posts}
        contacts={meshCore.contacts}
        selfKey={selfKey}
        deviceName={deviceName}
        emptyText={t('meshcore.rooms.no_messages', 'No posts in this room yet')}
        unreadAnchorMs={room.entryLastRead}
        unreadLabel={t('meshcore.rooms.unread', 'Unread posts')}
        backlogLoading={!room.ready}
        hasMore={room.hasMore}
        loadingOlder={room.loadingOlder}
        onLoadOlder={room.loadOlder}
        actionContext={actionContext}
        onAction={onAction}
        ackLabel={ackLabel}
        translations={translatedMessages}
        translationActions={translationActions}
      />
      {composer}
      {details && (
        <MessageDetailsModal protocol="meshcore" direction="sent" sourceId={sourceId} message={details} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}
