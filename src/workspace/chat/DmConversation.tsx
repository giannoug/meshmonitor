/**
 * A DM in layout D (boards 10-01, 10-07; read-only states of 10-05 / 10-14):
 * `/source/:id/dm/:nodeId` on a Meshtastic-family source.
 *
 * One owner per screen (Ruling AD): the re-hosted Classic App is not mounted
 * here. The page mounts App's providers itself (ChatProviders, with Classic's
 * `/messages` location, so useMessagingView's DM effects run: mark-read,
 * scroll, paging) and runs App's poll processing (useChatRuntime).
 *
 * Read-only states, as today (s10n3): an MQTT mirror hides the DM log, the
 * composer and Ask the node, and says why; an unmessageable node hides the log
 * and composer until "Message anyway" (per node, this visit, as today); TX
 * disabled keeps the composer, off, with today's tooltip; without
 * messages:read (a guest) the DM is not shown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMessaging, useUnreadDividerAnchors } from '../../contexts/MessagingContext';
import { useNotificationMuteSettings, useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useFirstUnread } from '../../hooks/useFirstUnread';
import { useNodes } from '../../hooks/useServerData';
import { useTxStatus } from '../../hooks/useTxStatus';
import { useViewTranslations } from '../../hooks/useViewTranslations';
import { appBasename } from '../../init';
import type { MeshMessage } from '../../types/message';
import { buildResponseIndex, repliedMessageFor, tapbacksFor } from '../../components/messages/messageRowSupport';
import { getMessageDateSeparator, shouldShowDateSeparator } from '../../utils/datetime';
import { mentionCandidatesFromNodes } from '../../utils/mentionCandidates';
import { isTapbackMessage } from '../../utils/messageReplies';
import { getMessageSortTime } from '../../utils/messageSort';
import { parseNodeId } from '../../utils/nodeHelpers';
import { resolveUnreadAnchorId, shouldSuppressDivider } from '../../utils/unreadAnchor';
import StateView from '../patterns/StateView';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import ChatProviders from './ChatProviders';
import Composer from './Composer';
import DmBanners from './DmBanners';
import DmHeader from './DmHeader';
import MessageRowD, { type MessageActionKind } from './MessageRowD';
import ReadOnlyNote from './ReadOnlyNote';
import TracerouteStripD from './TracerouteStripD';
import { replyIdOf } from './channelLabel';
import { useChatRuntime } from './useChatRuntime';
import styles from './ChannelThread.module.css';
import dmStyles from './DmConversation.module.css';

export interface DmConversationRouteProps {
  sourceId: string;
  source: DashboardSource;
  nodeId: string;
}

export default function DmConversationRoute({ sourceId, source, nodeId }: DmConversationRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="messages">
      <DmConversation nodeId={nodeId} deviceName={source.name} />
    </ChatProviders>
  );
}

function DmConversation({ nodeId, deviceName }: { nodeId: string; deviceName: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission, loading: authLoading } = useAuth();
  const { sourceId, sourceType } = useSource();
  const { sources } = useShellDevices();
  const { view, actions, homoglyph, deviceConfig } = useChatRuntime(-1);
  const { nodes } = useNodes();
  const { currentNodeId, connectionStatus } = useData();
  const { setSelectedDMNode, setSelectedChannel, replyingTo, setReplyingTo } = useMessaging();
  const { dm: pinnedFirstUnread } = useUnreadDividerAnchors();
  const { timeFormat, dateFormat } = useSettings();
  const { isDMMuted, muteDM, unmuteDM } = useNotificationMuteSettings();
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId });
  const signedIn = authStatus?.authenticated === true;
  const { prefs } = useUserPreferences({ enabled: signedIn });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // "Message anyway" (#4153): per node, for this visit, as Classic keeps it.
  const [overrides, setOverrides] = useState<ReadonlySet<string>>(new Set());

  const sid = sourceId ?? '';
  const scope = { sourceId: sid };
  const isMqtt = sourceType === 'mqtt_bridge' || sourceType === 'mqtt_broker';
  const node = nodes.find((n) => n.user?.id === nodeId);
  const nodeName = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.user?.id === id);
      return n?.user?.longName || n?.user?.shortName || id;
    },
    [nodes],
  );
  const nodeShort = (id: string) => nodes.find((n) => n.user?.id === id)?.user?.shortName?.trim() || id.slice(-4);
  const name = nodeName(nodeId);
  const isMine = (m: MeshMessage) => !m.spoofSuspected && (m.from === currentNodeId || m.isLocalMessage === true);

  // Opening a DM selects it, as a click in Classic's list does; wait (latched) for the
  // first-unread read so the provider pins the "New" line. useMessagingView marks it read.
  const firstUnread = useFirstUnread({ baseUrl: appBasename, enabled: signedIn, sourceId });
  const [anchorsReady, setAnchorsReady] = useState(false);
  useEffect(() => {
    if (!authLoading && (!signedIn || !firstUnread.isPending)) setAnchorsReady(true);
  }, [authLoading, signedIn, firstUnread.isPending]);
  useEffect(() => {
    if (!anchorsReady) return;
    setSelectedChannel(-1);
    setSelectedDMNode(nodeId);
    setReplyingTo(null);
  }, [anchorsReady, nodeId, setSelectedChannel, setSelectedDMNode, setReplyingTo]);

  // MessagesTab's getDMMessages: text DMs to or from the node.
  const rows = useMemo(
    () =>
      view.messages
        .filter((m) => (m.from === nodeId || m.to === nodeId) && m.to !== '!ffffffff' && m.channel === -1 && m.portnum === 1)
        .sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b)),
    [view.messages, nodeId],
  );
  const responses = useMemo(() => buildResponseIndex(rows), [rows]);
  const translationIds = useMemo(() => rows.filter((m) => !!m.text).map((m) => m.id), [rows]);
  const { translationSettings, translatedMessages, dismissTranslation } = useViewTranslations(sourceId, translationIds);
  const mentionOptions = useMemo(
    () => ({
      resolveNodeName: (id: string) => {
        const n = nodeName(id);
        return n !== id ? n : undefined;
      },
      selfNodeId: currentNodeId,
    }),
    [nodeName, currentNodeId],
  );
  const mentionCandidates = useMemo(() => mentionCandidatesFromNodes(nodes, currentNodeId), [nodes, currentNodeId]);

  const unreadAnchorId = useMemo(() => {
    const list = rows.map((m) => ({ id: m.id, sortTime: getMessageSortTime(m) }));
    const anchor = resolveUnreadAnchorId({
      messages: list,
      watermarkMs: pinnedFirstUnread,
      mode: 'firstUnread',
      ownMessageIds: new Set(rows.filter(isMine).map((m) => m.id)),
    });
    return shouldSuppressDivider({ anchorId: anchor, messages: list, hasMoreOlder: true }) ? null : anchor;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 isMine is recreated each render; its input is currentNodeId
  }, [rows, pinnedFirstUnread, currentNodeId]);

  const onAction = useCallback(
    (kind: MessageActionKind, msg: MeshMessage) => {
      if (kind === 'reply') {
        setReplyingTo(msg);
        inputRef.current?.focus();
      }
    },
    [setReplyingTo],
  );
  const dropMessages = useCallback(
    () => view.setMessages((prev) => prev.filter((m) => !(m.fromNodeId === nodeId || m.toNodeId === nodeId))),
    [view, nodeId],
  );

  if (!hasPermission('messages', 'read', scope)) {
    return (
      <section className={styles.page} data-phone={isPhone || undefined}>
        <StateView kind="noPermission" />
      </section>
    );
  }

  const canWrite = hasPermission('messages', 'write', scope);
  const flaggedUnmessageable = !isMqtt && node?.isUnmessagable === true;
  const unmessageable = flaggedUnmessageable && !overrides.has(nodeId);
  const showLog = !isMqtt && !unmessageable;
  const localNodeNum = currentNodeId ? parseNodeId(currentNodeId) : null;
  const peerNum = node?.nodeNum ?? parseNodeId(nodeId);
  const radioDevice = sources.find((s) => s.type === 'meshtastic_tcp' && s.enabled && s.id !== sourceId);
  const hopLimit = typeof deviceConfig?.lora?.hopLimit === 'number' ? deviceConfig.lora.hopLimit : undefined;
  const messageStyle = prefs['workspace.messageStyle'] === 'bubbles' ? 'bubbles' : 'rows';
  const signalDetail = prefs['workspace.signalDetail'] === 'always' ? 'always' : 'hover';
  const openDm = (id: string) => void navigate(`/source/${encodeURIComponent(sid)}/dm/${encodeURIComponent(id)}`);

  return (
    <section className={styles.page} data-phone={isPhone || undefined}>
      <DmHeader
        sourceId={sid}
        nodeId={nodeId}
        node={node}
        name={name}
        protocol={isMqtt ? 'mqtt' : 'meshtastic'}
        isPhone={isPhone}
        signedIn={signedIn}
        muted={isDMMuted(nodeId)}
        onMute={(until) => void muteDM(nodeId, until)}
        onUnmute={() => void unmuteDM(nodeId)}
        timeFormat={timeFormat}
        dateFormat={dateFormat}
        onMessagesPurged={dropMessages}
      />
      <div className={dmStyles.top} data-fill={!showLog || undefined}>
        {node && (
          <DmBanners
            sourceId={sid}
            node={node}
            sentDirectMessageCount={rows.filter(isMine).length}
            onMessageAnyway={flaggedUnmessageable ? () => setOverrides((prev) => new Set(prev).add(nodeId)) : null}
            messageAnyway={!unmessageable}
          />
        )}
        {peerNum != null && (
          <TracerouteStripD
            sourceId={sid}
            localNodeNum={localNodeNum}
            nodeNum={peerNum}
            localName={currentNodeId ? nodeName(currentNodeId) : ''}
            nodeName={name}
            nodes={nodes}
            onOpenNode={openDm}
          />
        )}
      </div>
      {showLog && (
        <div className={styles.messages} ref={view.dmMessagesContainerRef} role="log" aria-label={name}>
          {rows.length === 0 && <p className={styles.empty}>{t('workspace.state.empty')}</p>}
          {rows.map((msg, i) => {
            if (isTapbackMessage(msg)) return null;
            const date = new Date(msg.timestamp);
            const prev = i > 0 ? new Date(rows[i - 1].timestamp) : null;
            const replied = repliedMessageFor(responses, msg);
            return (
              <MessageRowD
                key={msg.id}
                message={msg}
                style={messageStyle}
                signalDetail={signalDetail}
                mine={isMine(msg)}
                senderName={nodeName(msg.from)}
                senderShort={nodeShort(msg.from)}
                heardVia={deviceName}
                reactions={tapbacksFor(responses, msg)}
                replied={replied}
                repliedName={replied ? nodeShort(replied.from) : undefined}
                showUnreadDivider={unreadAnchorId === msg.id}
                dateSeparator={shouldShowDateSeparator(prev, date) ? getMessageDateSeparator(date, dateFormat) : null}
                translation={translatedMessages[msg.id]}
                onDismissTranslation={() => dismissTranslation(msg.id)}
                timeFormat={timeFormat}
                dateFormat={dateFormat}
                mentionOptions={mentionOptions}
                canReply={canWrite}
                onAction={onAction}
              />
            );
          })}
        </div>
      )}
      {isMqtt ? (
        <ReadOnlyNote
          kind="mqtt"
          deviceName={deviceName}
          openOn={radioDevice && { name: radioDevice.name, to: `/source/${encodeURIComponent(radioDevice.id)}/dm/${encodeURIComponent(nodeId)}` }}
        />
      ) : (
        showLog && canWrite && connectionStatus === 'connected' && (
          <Composer
            target={{ kind: 'dm', nodeId, name }}
            disabledReason={isTxDisabled ? t('tx_disabled.control_tooltip') : undefined}
            onSend={(text, replyTo) => void actions.sendDirectMessage(nodeId, text, replyIdOf(replyTo))}
            onBell={(text) => void actions.sendBell({ nodeId, text })}
            hopLimit={hopLimit}
            replyName={replyingTo ? nodeName(replyingTo.from) : undefined}
            canTranslate={translationSettings.canTranslate}
            translateLanguages={{ target: translationSettings.defaultOutgoingLanguage, source: translationSettings.defaultLanguage }}
            mentionCandidates={mentionCandidates}
            homoglyphEnabled={homoglyph}
            inputRef={inputRef}
          />
        )
      )}
    </section>
  );
}
