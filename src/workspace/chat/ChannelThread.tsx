/**
 * A channel in layout D (boards a-chat-D-desktop, 10-06, 10-03, 10-12, 10-04,
 * 10-13, 10-05, 10-14): `/source/:id/channel/:channel` and its `/beacons`.
 *
 * One owner per screen (Ruling AD): on these URLs the re-hosted Classic App is
 * not mounted. This page runs the source's message state itself, with the same
 * hooks App uses (useMessagingView, useMeshtasticMessageActions), inside the
 * same providers App mounts for itself (Settings, Data, UI, Messaging) under
 * the source's own SourceProvider and socket, so the pending-ack map and
 * spinners have one home. UIProvider and useMessagingView read the tab from
 * the location, so they are handed Classic's `/channels` location, as
 * WorkspaceSource does for App.
 *
 * What App's poll processing does for messages is repeated here: the poll
 * runs while the device is connected (the shell's status), its messages go
 * through `applyPollMessages`, and its config sets the local node.
 *
 * Read-only states (note s10n3): an MQTT mirror shows its reason instead of
 * the composer; TX disabled keeps the composer, off, with today's tooltip; a
 * guest sees the channel and Login. Nothing here sends without a click.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import { useBeaconOffers } from '../../components/beacons/useBeaconOffers';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMessaging, useUnreadDividerAnchors } from '../../contexts/MessagingContext';
import { useNotificationMuteSettings, useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import { useUI } from '../../contexts/UIContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useFirstUnread } from '../../hooks/useFirstUnread';
import { useChannels, useNodes } from '../../hooks/useServerData';
import { useTxStatus } from '../../hooks/useTxStatus';
import { useViewTranslations } from '../../hooks/useViewTranslations';
import { appBasename } from '../../init';
import type { MeshMessage } from '../../types/message';
import type { ResourceType } from '../../types/permission';
import { STANDARD_LANGUAGES } from '../../types/translation';
import { CHANNEL_DB_OFFSET, canReadChannel } from '../../utils/channelReadAccess';
import { buildResponseIndex, repliedMessageFor, tapbacksFor } from '../../components/messages/messageRowSupport';
import { getMessageDateSeparator, shouldShowDateSeparator } from '../../utils/datetime';
import { mentionCandidatesFromNodes } from '../../utils/mentionCandidates';
import { isMqttBridgeMessage } from '../../utils/messageFilters';
import { isTapbackMessage } from '../../utils/messageReplies';
import { getMessageSortTime } from '../../utils/messageSort';
import { resolveUnreadAnchorId, shouldSuppressDivider } from '../../utils/unreadAnchor';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import BeaconsPage from './BeaconsPage';
import ChatProviders from './ChatProviders';
import ChannelHeaderMenu from './ChannelHeaderMenu';
import ChannelInfoSheet from './ChannelInfoSheet';
import Composer from './Composer';
import MessageRowD, { type RowTranslationActions } from './MessageRowD';
import type { MessageActionContext } from './messageActions';
import { useMessageActions } from './useMessageActions';
import ReadOnlyNote from './ReadOnlyNote';
import { channelLabel, heardToday, replyIdOf } from './channelLabel';
import { useChannelDatabaseEntries } from './useChannelDatabaseEntries';
import { useChatRuntime } from './useChatRuntime';
import styles from './ChannelThread.module.css';

export interface ChannelThreadRouteProps {
  sourceId: string;
  source: DashboardSource;
  channel: number;
  view: 'thread' | 'beacons';
}

/** The providers App mounts for itself, with Classic's `/channels` location. */
export default function ChannelThreadRoute({ sourceId, source, channel, view }: ChannelThreadRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="channels">
      <ChannelThread channel={channel} view={view} deviceName={source.name} />
    </ChatProviders>
  );
}

interface ChannelThreadProps {
  channel: number;
  view: 'thread' | 'beacons';
  deviceName: string;
}

function ChannelThread({ channel, view: page, deviceName }: ChannelThreadProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission, loading: authLoading } = useAuth();
  const { sourceId, sourceType } = useSource();
  const { sources } = useShellDevices();
  const { view, actions, homoglyph, deviceConfig } = useChatRuntime(channel);
  const { channels } = useChannels();
  const { nodes } = useNodes();
  const { currentNodeId, connectionStatus } = useData();
  const { setSelectedChannel, replyingTo, setReplyingTo, markMessagesAsRead, setUnreadCounts, unreadCounts } = useMessaging();
  const { channel: pinnedFirstUnread } = useUnreadDividerAnchors();
  const { showMqttMessages, setShowMqttMessages } = useUI();
  const { timeFormat, dateFormat, distanceUnit } = useSettings();
  const { isChannelMuted, muteChannel, unmuteChannel } = useNotificationMuteSettings();
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId });
  const signedIn = authStatus?.authenticated === true;
  const { prefs } = useUserPreferences({ enabled: signedIn });
  const beacons = useBeaconOffers(sourceId);
  const [infoOpen, setInfoOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const base = `/source/${encodeURIComponent(sourceId ?? '')}`;
  const isBridge = sourceType === 'mqtt_bridge';
  const isMqtt = isBridge || sourceType === 'mqtt_broker';
  const scope = { sourceId: sourceId ?? undefined };
  // Classic's gate: a Channel Database channel (100+) needs its entry in the viewer's list.
  const dbChannel = channel >= CHANNEL_DB_OFFSET;
  const { entries: dbEntries, isPending: dbPending } = useChannelDatabaseEntries(dbChannel && !isBridge);
  const canRead = canReadChannel(channel, {
    mqttReadOnly: isBridge,
    channelDatabaseEntries: dbEntries,
    hasPermission: (resource, action) => hasPermission(resource, action, scope),
  });
  const canWrite = hasPermission(`channel_${channel}` as ResourceType, 'write', scope);
  const config = channels.find((c) => c.id === channel);
  const name = channelLabel(t, config, channel, dbEntries);
  const messageStyle = prefs['workspace.messageStyle'] === 'bubbles' ? 'bubbles' : 'rows';
  const signalDetail = prefs['workspace.signalDetail'] === 'always' ? 'always' : 'hover';
  const hopLimit = typeof deviceConfig?.lora?.hopLimit === 'number' ? deviceConfig.lora.hopLimit : undefined;

  // Opening a channel selects it and marks it read, as a click in Classic's channel list does. The
  // provider pins the "New" line when the selection changes, so wait for its first-unread read (same query).
  const firstUnread = useFirstUnread({
    baseUrl: appBasename,
    enabled: signedIn,
    sourceId,
    excludeMqtt: !showMqttMessages,
  });
  // Latched: a later refetch (Show MQTT changes the query) must not re-open the channel and drop a reply.
  const [anchorsReady, setAnchorsReady] = useState(false);
  useEffect(() => {
    if (!authLoading && (!signedIn || !firstUnread.isPending)) setAnchorsReady(true);
  }, [authLoading, signedIn, firstUnread.isPending]);
  useEffect(() => {
    if (!anchorsReady) return;
    setSelectedChannel(channel);
    setReplyingTo(null);
    void markMessagesAsRead(undefined, channel);
    setUnreadCounts((prev) => ({ ...prev, [channel]: 0 }));
  }, [anchorsReady, channel, setSelectedChannel, setReplyingTo, markMessagesAsRead, setUnreadCounts]);

  const nodeName = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.user?.id === nodeId);
      return node?.user?.longName || node?.user?.shortName || nodeId;
    },
    [nodes],
  );
  const nodeShort = (nodeId: string) =>
    nodes.find((n) => n.user?.id === nodeId)?.user?.shortName?.trim() || nodeId.slice(-4);
  const isMine = (m: MeshMessage) => !m.spoofSuspected && (m.from === currentNodeId || m.isLocalMessage === true);

  const all = useMemo(() => view.channelMessages[channel] ?? [], [view.channelMessages, channel]);
  const rows = useMemo(() => {
    let list = all;
    if (!isBridge && !showMqttMessages) list = list.filter((m) => !isMqttBridgeMessage(m));
    if (channel === 0) list = list.filter((m) => m.portnum !== 70);
    return [...list].sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b));
  }, [all, isBridge, showMqttMessages, channel]);
  const responses = useMemo(() => buildResponseIndex(all), [all]);
  const translationIds = useMemo(() => rows.filter((m) => !!m.text).map((m) => m.id), [rows]);
  const { translationSettings, viewerLang, translatedMessages, translateMessage, dismissTranslation } = useViewTranslations(
    sourceId,
    translationIds,
  );
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
  const autoPositionChannelId = useMemo(() => {
    const sharing = channels.filter((c) => c.id < CHANNEL_DB_OFFSET && (c.positionPrecision ?? 0) > 0).sort((a, b) => a.id - b.id);
    return sharing[0]?.id ?? null;
  }, [channels]);

  // The red "New" line (#4607), resolved against the rows shown.
  const unreadAnchorId = useMemo(() => {
    const list = rows.map((m) => ({ id: m.id, sortTime: getMessageSortTime(m) }));
    const anchor = resolveUnreadAnchorId({
      messages: list,
      watermarkMs: pinnedFirstUnread,
      mode: 'firstUnread',
      ownMessageIds: new Set(rows.filter(isMine).map((m) => m.id)),
    });
    return shouldSuppressDivider({ anchorId: anchor, messages: list, hasMoreOlder: true }) ? null : anchor;
    // isMine reads currentNodeId, listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 isMine is recreated each render; its input is currentNodeId
  }, [rows, pinnedFirstUnread, currentNodeId]);

  // Today's gates (ChannelsTab): channel_N:write for reply, react, resend and delete; sends on a device
  // channel only, never on an MQTT mirror; off while TX is disabled or the device is disconnected.
  const actionContext = useMemo<MessageActionContext>(() => {
    const writeReason = canWrite ? undefined : t('workspace.node_menu.needs', { permission: `channel_${channel}:write` });
    return {
      canSend: channel < CHANNEL_DB_OFFSET && !isMqtt,
      writeReason,
      sendReason:
        writeReason ??
        (isTxDisabled ? t('tx_disabled.control_tooltip') : connectionStatus !== 'connected' ? t('source.status_disconnected') : undefined),
      deleteReason: writeReason,
      canTranslate: translationSettings.canTranslate,
      translateHint: t('workspace.chat.translate_hint', {
        language: STANDARD_LANGUAGES.find((l) => l.code === viewerLang)?.name ?? viewerLang,
      }),
      sendsTapback: t('workspace.chat.sends_tapback_channel', { channel: name }),
      sendsResend: t('workspace.chat.sends_resend_channel', { channel: name }),
    };
  }, [t, canWrite, channel, isMqtt, isTxDisabled, connectionStatus, translationSettings.canTranslate, viewerLang, name]);
  const translationActions = useMemo<RowTranslationActions>(
    () => ({ dismiss: dismissTranslation, translate: translationSettings.canTranslate ? translateMessage : undefined }),
    [dismissTranslation, translateMessage, translationSettings.canTranslate],
  );
  const messageActions = useMessageActions({
    actions,
    translate: (id, text) => void translateMessage(id, text),
    onReply: (msg) => {
      setReplyingTo(msg);
      inputRef.current?.focus();
    },
    isMine,
    sourceId: sourceId ?? '',
    nodes,
    phone: isPhone,
    sendsTapback: actionContext.sendsTapback,
    timeFormat,
    dateFormat,
  });

  const beaconsPending = beacons.totalCount > 0 || beacons.countUnknown ? beacons.pendingCount : null;
  const muted = isChannelMuted(channel);
  const menuActions = {
    muted,
    onMute: (until: number | null) => void muteChannel(channel, until),
    onUnmute: () => void unmuteChannel(channel),
    unreadCount: unreadCounts[channel] ?? 0,
    onMarkAll: () => void markMessagesAsRead(undefined, channel),
    showMqtt: isBridge ? null : showMqttMessages,
    onToggleMqtt: () => setShowMqttMessages(!showMqttMessages),
    beaconsPending,
    onBeacons: () => void navigate(`${base}/channel/${channel}/beacons`),
  };
  const radioDevice = sources.find((s) => s.type === 'meshtastic_tcp' && s.enabled && s.id !== sourceId);

  const header = (
    <header className={styles.header}>
      {isPhone && (
        <Link className={styles.icon} to={page === 'beacons' ? `${base}/channel/${channel}` : base}>
          <UiIcon name="back" size={22} />
          <span className={styles.srOnly}>{t('common.back')}</span>
        </Link>
      )}
      <div className={styles.titles}>
        <h1 className={styles.title}>
          {isPhone && page === 'beacons' ? t('beacons.button') : `# ${name}`}
        </h1>
        {!(isPhone && page === 'beacons') && (
          <p className={styles.subtitle}>
            {[config?.roleName, t('workspace.chat.heard_today', { count: heardToday(nodes) })].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className={styles.tools}>
        {!isPhone && beaconsPending !== null && (
          <Link
            className={`${styles.button} ${page === 'beacons' ? styles.buttonOn : ''}`}
            to={page === 'beacons' ? `${base}/channel/${channel}` : `${base}/channel/${channel}/beacons`}
            title={t('beacons.button_title')}
            aria-current={page === 'beacons' ? 'page' : undefined}
          >
            <UiIcon name="announcement" size={16} /> {t('beacons.button')}
            {beaconsPending > 0 && <span className={styles.badge}>{beaconsPending}</span>}
          </Link>
        )}
        {signedIn && (
          <MuteMenu
            muted={muted}
            onMute={menuActions.onMute}
            onUnmute={menuActions.onUnmute}
            buttonClassName={styles.button}
            alignRight
          />
        )}
        {isPhone ? (
          <button
            type="button"
            className={styles.icon}
            onClick={() => setInfoOpen(true)}
            aria-label={t('channels.channel_options', 'Channel options')}
          >
            <UiIcon name="more" size={22} />
          </button>
        ) : (
          <ChannelHeaderMenu channelName={name} onInfo={() => setInfoOpen(true)} {...menuActions} />
        )}
      </div>
    </header>
  );

  const thread = dbPending ? null : !canRead ? (
    <p className={styles.empty}>{t('workspace.chat.not_available')}</p>
  ) : (
    <div className={styles.split}>
      <div className={styles.column}>
        <div className={styles.messages} ref={view.channelMessagesContainerRef} role="log" aria-label={`# ${name}`}>
          {rows.length === 0 && <p className={styles.empty}>{t('channels.no_messages_yet')}</p>}
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
                translationActions={translationActions}
                timeFormat={timeFormat}
                dateFormat={dateFormat}
                mentionOptions={mentionOptions}
                actionContext={actionContext}
                phone={isPhone}
                onAction={messageActions.onAction}
              />
            );
          })}
        </div>
        {isMqtt ? (
          <ReadOnlyNote
            kind="mqtt"
            deviceName={deviceName}
            openOn={radioDevice && { name: radioDevice.name, to: `/source/${encodeURIComponent(radioDevice.id)}/channel/0` }}
          />
        ) : canWrite && channel < CHANNEL_DB_OFFSET && connectionStatus === 'connected' ? (
          <Composer
            target={{ kind: 'channel', channel, name }}
            disabledReason={isTxDisabled ? t('tx_disabled.control_tooltip') : undefined}
            onSend={(text, replyTo) => void actions.sendChannelMessage(channel, text, replyIdOf(replyTo))}
            onBell={(text) => void actions.sendBell({ channel, text })}
            onSendPosition={() => void actions.sendPosition(channel)}
            hopLimit={hopLimit}
            replyName={replyingTo ? nodeName(replyingTo.from) : undefined}
            canTranslate={translationSettings.canTranslate}
            translateLanguages={{
              target: translationSettings.defaultOutgoingLanguage,
              source: translationSettings.defaultLanguage,
            }}
            mentionCandidates={mentionCandidates}
            homoglyphEnabled={homoglyph}
            inputRef={inputRef}
          />
        ) : (
          !signedIn && <ReadOnlyNote kind="guest" />
        )}
      </div>
      {messageActions.panel}
    </div>
  );

  return (
    <section className={styles.page} data-phone={isPhone || undefined}>
      {header}
      {page === 'beacons' ? (
        <BeaconsPage
          beacons={beacons}
          deviceName={deviceName}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
          canWrite={hasPermission('nodes', 'write', scope)}
          nodeName={(num) => nodes.find((n) => n.nodeNum === num)?.user?.longName}
        />
      ) : (
        thread
      )}
      <ChannelInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        channel={config}
        channelId={channel}
        channelName={name}
        deviceName={deviceName}
        autoPositionChannelId={autoPositionChannelId}
        distanceUnit={distanceUnit}
        canPurge={canWrite && channel !== -1}
        onPurge={() => actions.purgeChannelMessages(channel)}
        actions={isPhone ? menuActions : undefined}
      />
      {messageActions.sheets}
    </section>
  );
}
