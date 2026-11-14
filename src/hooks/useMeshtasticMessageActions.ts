/**
 * Meshtastic message actions (#6365 Task 2.2): App's channel/DM send,
 * tapback, resend, delete, channel purge, bell and position broadcast,
 * moved out of App.tsx unchanged so the Workspace chat can call the same
 * code. Classic's App wraps these with its own handler signatures.
 *
 * Confirmation prompts stay with the caller (App keeps its window.confirm;
 * the Workspace uses ConfirmSheet), so these methods act immediately.
 */
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastContainer';
import { useSource } from '../contexts/SourceContext';
import { useData } from '../contexts/DataContext';
import { useMessaging } from '../contexts/MessagingContext';
import { useUI } from '../contexts/UIContext';
import { useChannels } from './useServerData';
import type { MeshMessage } from '../types/message';
import { logger } from '../utils/logger';
import { isTxDisabledBody } from '../utils/txDisabled';
import { applyHomoglyphOptimization } from '../utils/homoglyph';

// Constants for emoji tapbacks
const EMOJI_FLAG = 1; // Protobuf flag indicating this is a tapback/reaction

/** App-local state the handlers close over (useMessagingView state, App refs). */
export interface MeshtasticMessageActionsOptions {
  /** The deployment base path (`appBasename`). */
  baseUrl: string;
  /** CSRF-aware fetch wrapper. */
  authFetch: (url: string, options?: RequestInit, retryCount?: number, timeoutMs?: number) => Promise<Response>;
  /** Refetch fn from the source's usePoll() call. */
  refetchPoll: () => unknown;
  setMessages: React.Dispatch<React.SetStateAction<MeshMessage[]>>;
  setChannelMessages: React.Dispatch<React.SetStateAction<{ [key: number]: MeshMessage[] }>>;
  pendingMessagesRef: React.MutableRefObject<Map<string, MeshMessage>>;
  channelMessagesContainerRef: React.RefObject<HTMLDivElement | null>;
  dmMessagesContainerRef: React.RefObject<HTMLDivElement | null>;
  /** The local node id, read at send time (bypasses React state delay). */
  localNodeIdRef: React.MutableRefObject<string>;
  /** The homoglyph setting, read at send time. */
  homoglyphEnabledRef: React.MutableRefObject<boolean>;
}

export interface MeshtasticMessageActions {
  sendChannelMessage(channel: number, text: string, replyId?: number): Promise<void>;
  sendDirectMessage(nodeId: string, text: string, replyId?: number): Promise<void>;
  sendTapback(target: MeshMessage, emoji: string): Promise<void>;
  resend(msg: MeshMessage): Promise<void>;
  /** `channel` is the message's channel; omitted, the message is dropped from every channel list. */
  deleteMessage(id: string, channel?: number): Promise<void>;
  purgeChannelMessages(channel: number): Promise<void>;
  /** `text` is prepended with the bell; a `nodeId` sends it as a DM. */
  sendBell(target: { channel?: number; nodeId?: string; text?: string }): Promise<void>;
  sendPosition(channel: number): Promise<void>;
}

export function useMeshtasticMessageActions(options: MeshtasticMessageActionsOptions): MeshtasticMessageActions {
  const {
    baseUrl,
    authFetch,
    refetchPoll,
    setMessages,
    setChannelMessages,
    pendingMessagesRef,
    channelMessagesContainerRef,
    dmMessagesContainerRef,
    localNodeIdRef,
    homoglyphEnabledRef,
  } = options;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId, sourceType } = useSource();
  const { connectionStatus, currentNodeId } = useData();
  const { setNewMessage, setReplyingTo, setPendingMessages, setIsChannelScrolledToBottom, setIsDMScrolledToBottom } =
    useMessaging();
  const { setError } = useUI();
  const { channels } = useChannels();
  const isMeshCoreSource = sourceType === 'meshcore';

  const sendDirectMessage = async (destinationNodeId: string, newMessage: string, replyId?: number) => {
    if (!newMessage.trim() || connectionStatus !== 'connected') {
      return;
    }

    // Create a temporary message ID for immediate display
    const tempId = `temp_dm_${Date.now()}_${Math.random()}`;
    // Use localNodeIdRef for immediate access (bypasses React state delay)
    const nodeId = localNodeIdRef.current || currentNodeId || 'me';
    // Apply homoglyph optimization to match what the backend will store,
    // so dedup text comparison works correctly (#2027)
    const displayText = homoglyphEnabledRef.current ? applyHomoglyphOptimization(newMessage) : newMessage;
    const sentMessage: MeshMessage = {
      id: tempId,
      from: nodeId,
      to: destinationNodeId,
      fromNodeId: nodeId,
      toNodeId: destinationNodeId,
      text: displayText,
      channel: -1, // -1 indicates a direct message
      timestamp: new Date(),
      isLocalMessage: true,
      acknowledged: false,
      portnum: 1, // Text message
      replyId: replyId,
    };

    // Add message to local state immediately for instant feedback
    setMessages(prev => [...prev, sentMessage]);

    // Add to pending acknowledgments
    // Update ref immediately (before React batches the state update) so processPollData
    // can always find the pending message even if a WebSocket event arrives before React commits
    pendingMessagesRef.current = new Map(pendingMessagesRef.current).set(tempId, sentMessage);
    setPendingMessages(pendingMessagesRef.current);

    // Scroll to bottom after sending message
    setTimeout(() => {
      if (dmMessagesContainerRef.current) {
        dmMessagesContainerRef.current.scrollTop = dmMessagesContainerRef.current.scrollHeight;
        setIsDMScrolledToBottom(true);
      }
    }, 50);

    // Clear the input and reply state
    const messageText = newMessage;
    setNewMessage('');
    setReplyingTo(null);

    try {
      const response = await authFetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: messageText,
          channel: 0, // Backend may expect channel 0 for DMs
          destination: destinationNodeId,
          replyId: replyId,
          sourceId: sourceId || undefined,
        }),
      });

      if (response.ok) {
        logger.debug('Direct message sent successfully');
        // The message will be updated when we receive the acknowledgment from backend
      } else {
        logger.error('Failed to send direct message');
        // Remove the message from local state if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setError('Failed to send direct message');
      }
    } catch (error) {
      logger.error('Error sending direct message:', error);
      // Remove the message from local state if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setError(`Failed to send direct message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendTapback = async (originalMessage: MeshMessage, emoji: string) => {
    if (connectionStatus !== 'connected') {
      setError('Cannot send reaction: not connected to mesh network');
      return;
    }

    // Extract replyId from original message.
    // Message ID format is `${sourceId}_${nodeNum}_${packetId}` — the packetId
    // is always the last segment, so use slice(-1) to be robust to format changes.
    const idParts = originalMessage.id.split('_');
    if (idParts.length < 2) {
      setError('Cannot send reaction: invalid message format');
      return;
    }
    const replyId = parseInt(idParts[idParts.length - 1], 10);

    // Validate replyId is a valid number
    if (isNaN(replyId) || replyId < 0) {
      setError('Cannot send reaction: invalid message ID');
      return;
    }

    // Determine if this is a direct message or channel message
    const isDirectMessage = originalMessage.channel === -1;

    try {
      let requestBody;

      if (isDirectMessage) {
        // For DMs: send to the other party in the conversation
        // If the message is from someone else, reply to them
        // If the message is from me, send to the original recipient
        // Use localNodeIdRef for immediate access (bypasses React state delay)
        const nodeId = localNodeIdRef.current || currentNodeId;
        const toNodeId = originalMessage.fromNodeId === nodeId ? originalMessage.toNodeId : originalMessage.fromNodeId;

        requestBody = {
          text: emoji,
          destination: toNodeId, // Server expects 'destination' not 'toNodeId'
          replyId: replyId,
          emoji: EMOJI_FLAG,
          sourceId: sourceId || undefined,
        };
      } else {
        // For channel messages: use channel
        requestBody = {
          text: emoji,
          channel: originalMessage.channel,
          replyId: replyId,
          emoji: EMOJI_FLAG,
          sourceId: sourceId || undefined,
        };
      }

      const response = await authFetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Refresh messages to show the new tapback
        setTimeout(() => refetchPoll(), 500);
      } else {
        const errorData = await response.json();
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError(`Failed to send reaction: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Failed to send reaction: ${err instanceof Error ? err.message : 'Network error'}`);
    }
  };

  const deleteMessage = async (id: string, channel?: number) => {
    try {
      const response = await authFetch(`${baseUrl}/api/messages/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        showToast(t('toast.message_deleted'), 'success');
        // Update local state to remove the message
        setMessages(prev => prev.filter(m => m.id !== id));
        // Classic passes the message's channel; without one, drop it from every list.
        setChannelMessages(prev =>
          channel === undefined
            ? Object.fromEntries(Object.entries(prev).map(([key, list]) => [key, list.filter(m => m.id !== id)]))
            : {
                ...prev,
                [channel]: (prev[channel] || []).filter(m => m.id !== id),
              }
        );
        void refetchPoll();
      } else {
        const errorData = await response.json();
        showToast(t('toast.failed_delete_message', { error: errorData.message || t('errors.unknown') }), 'error');
      }
    } catch (err) {
      showToast(
        t('toast.failed_delete_message', { error: err instanceof Error ? err.message : t('errors.network') }),
        'error'
      );
    }
  };

  const purgeChannelMessages = async (channelId: number) => {
    const channel = channels.find(c => c.id === channelId);
    const channelName = channel?.name || `Channel ${channelId}`;

    try {
      const response = await authFetch(`${baseUrl}/api/messages/channels/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast(t('toast.purged_messages_channel', { count: data.deletedCount, channel: channelName }), 'success');
        // Update local state
        setChannelMessages(prev => ({
          ...prev,
          [channelId]: [],
        }));
        void refetchPoll();
      } else {
        const errorData = await response.json();
        showToast(t('toast.failed_purge_messages', { error: errorData.message || t('errors.unknown') }), 'error');
      }
    } catch (err) {
      showToast(
        t('toast.failed_purge_messages', { error: err instanceof Error ? err.message : t('errors.network') }),
        'error'
      );
    }
  };

  const sendChannelMessage = async (channel: number, newMessage: string, replyId?: number) => {
    if (!newMessage.trim() || connectionStatus !== 'connected') {
      return;
    }

    // Use channel ID directly - no mapping needed
    const messageChannel = channel;

    // Create a temporary message ID for immediate display
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    // Use localNodeIdRef for immediate access (bypasses React state delay)
    const nodeId = localNodeIdRef.current || currentNodeId || 'me';
    // Apply homoglyph optimization to match what the backend will store,
    // so dedup text comparison works correctly (#2027)
    const displayText = homoglyphEnabledRef.current ? applyHomoglyphOptimization(newMessage) : newMessage;
    const sentMessage: MeshMessage = {
      id: tempId,
      from: nodeId,
      to: '!ffffffff', // Broadcast
      fromNodeId: nodeId,
      toNodeId: '!ffffffff',
      text: displayText,
      channel: messageChannel,
      timestamp: new Date(),
      isLocalMessage: true,
      acknowledged: false,
      replyId: replyId,
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, sentMessage]);
    setChannelMessages(prev => ({
      ...prev,
      [messageChannel]: [...(prev[messageChannel] || []), sentMessage],
    }));

    // Add to pending acknowledgments
    console.log(`📤 Adding message to pending acknowledgments:`, {
      tempId,
      text: sentMessage.text,
      from: sentMessage.from,
      fromNodeId: sentMessage.fromNodeId,
      channel: sentMessage.channel,
    });
    // Update ref immediately (before React batches the state update) so processPollData
    // can always find the pending message even if a WebSocket event arrives before React commits
    pendingMessagesRef.current = new Map(pendingMessagesRef.current).set(tempId, sentMessage);
    console.log(`📊 Pending messages map size after add: ${pendingMessagesRef.current.size}`);
    setPendingMessages(pendingMessagesRef.current);

    // Scroll to bottom after sending message
    setTimeout(() => {
      if (channelMessagesContainerRef.current) {
        channelMessagesContainerRef.current.scrollTop = channelMessagesContainerRef.current.scrollHeight;
        setIsChannelScrolledToBottom(true);
      }
    }, 50);

    // Clear the input and reply state
    const messageText = newMessage;
    setNewMessage('');
    setReplyingTo(null);

    try {
      const response = await authFetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: messageText,
          channel: messageChannel,
          replyId: replyId,
          sourceId: sourceId || undefined,
        }),
      });

      if (response.ok) {
        // The message was sent successfully
        // We'll wait for it to appear in the backend data to confirm acknowledgment
        setTimeout(() => refetchPoll(), 1000);
      } else {
        const errorData = await response.json();

        // Remove the message from local state if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setChannelMessages(prev => ({
          ...prev,
          [channel]: prev[channel]?.filter(msg => msg.id !== tempId) || [],
        }));
        setPendingMessages(prev => {
          const updated = new Map(prev);
          updated.delete(tempId);
          pendingMessagesRef.current = updated; // Update ref
          return updated;
        });

        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError(`Failed to send message: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`);

      // Remove the message from local state if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setChannelMessages(prev => ({
        ...prev,
        [channel]: prev[channel]?.filter(msg => msg.id !== tempId) || [],
      }));
      setPendingMessages(prev => {
        const updated = new Map(prev);
        updated.delete(tempId);
        pendingMessagesRef.current = updated; // Update ref
        return updated;
      });
    }
  };

  // Send a bell character (0x07) on a channel, optionally prepended to current text
  const sendBellOnChannel = async (channel: number, currentText: string) => {
    if (connectionStatus !== 'connected') return;

    const bellText = currentText.trim() ? `\x07${currentText}` : '\x07';
    setNewMessage('');

    try {
      const response = await authFetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bellText, channel, sourceId: sourceId || undefined }),
      });

      if (response.ok) {
        setTimeout(() => refetchPoll(), 1000);
      } else {
        const errorData = await response.json();
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError(`Failed to send bell: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Failed to send bell: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Send a bell character (0x07) as a direct message
  const sendBellDM = async (destinationNodeId: string, currentText: string) => {
    if (connectionStatus !== 'connected') return;

    const bellText = currentText.trim() ? `\x07${currentText}` : '\x07';
    setNewMessage('');

    try {
      const response = await authFetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bellText, channel: 0, destination: destinationNodeId, sourceId: sourceId || undefined }),
      });

      if (response.ok) {
        logger.debug('Bell DM sent successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError('Failed to send bell DM');
      }
    } catch (err) {
      setError(`Failed to send bell DM: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const sendBell = (target: { channel?: number; nodeId?: string; text?: string }) =>
    target.nodeId !== undefined
      ? sendBellDM(target.nodeId, target.text ?? '')
      : sendBellOnChannel(target.channel ?? 0, target.text ?? '');

  // Broadcast local node's position on a channel
  const sendPosition = async (channel: number) => {
    if (connectionStatus !== 'connected') return;

    try {
      const response = await authFetch(`${baseUrl}/api/position/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Name the source this view is on. Without it the server broadcasts
        // through the primary source's radio, whichever source is open.
        body: JSON.stringify({ destination: 4294967295, channel, sourceId: sourceId || undefined }),
      });

      if (response.ok) {
        setTimeout(() => refetchPoll(), 1000);
      } else {
        const errorData = await response.json();
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError(`Failed to send position: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Failed to send position: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Resend a message (for own messages)
  const resend = async (message: MeshMessage) => {
    if (!message.text?.trim() || connectionStatus !== 'connected') {
      return;
    }

    // Determine if this is a DM or channel message
    const isDM = message.channel === -1;
    const messageChannel = message.channel;
    const destinationNodeId = message.to || message.toNodeId;

    // Create a temporary message ID for immediate display
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const nodeId = localNodeIdRef.current || currentNodeId || 'me';
    const sentMessage: MeshMessage = {
      id: tempId,
      from: nodeId,
      to: isDM ? destinationNodeId : '!ffffffff',
      fromNodeId: nodeId,
      toNodeId: isDM ? destinationNodeId : '!ffffffff',
      text: message.text,
      channel: messageChannel,
      timestamp: new Date(),
      isLocalMessage: true,
      acknowledged: false,
      portnum: isDM ? 1 : undefined,
    };

    // Add message to local state immediately
    if (isDM) {
      setMessages(prev => [...prev, sentMessage]);
    } else {
      setMessages(prev => [...prev, sentMessage]);
      setChannelMessages(prev => ({
        ...prev,
        [messageChannel]: [...(prev[messageChannel] || []), sentMessage],
      }));
    }

    // Add to pending acknowledgments
    setPendingMessages(prev => {
      const updated = new Map(prev).set(tempId, sentMessage);
      pendingMessagesRef.current = updated;
      return updated;
    });

    // Scroll to bottom after sending
    setTimeout(() => {
      if (isDM) {
        if (dmMessagesContainerRef.current) {
          dmMessagesContainerRef.current.scrollTop = dmMessagesContainerRef.current.scrollHeight;
        }
      } else {
        if (channelMessagesContainerRef.current) {
          channelMessagesContainerRef.current.scrollTop = channelMessagesContainerRef.current.scrollHeight;
          setIsChannelScrolledToBottom(true);
        }
      }
    }, 50);

    try {
      // Use the same endpoint for both DMs and channel messages
      // DMs include a destination parameter, channel messages include a channel parameter
      const endpoint = `${baseUrl}/api/messages/send`;
      const body = isDM
        ? { text: message.text, destination: destinationNodeId, sourceId: sourceId || undefined }
        : { text: message.text, channel: messageChannel, sourceId: sourceId || undefined };

      const response = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setTimeout(() => refetchPoll(), 1000);
      } else {
        const errorData = await response.json();

        // Remove the message from local state if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        if (!isDM) {
          setChannelMessages(prev => ({
            ...prev,
            [messageChannel]: prev[messageChannel]?.filter(msg => msg.id !== tempId) || [],
          }));
        }
        setPendingMessages(prev => {
          const updated = new Map(prev);
          updated.delete(tempId);
          pendingMessagesRef.current = updated;
          return updated;
        });

        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        setError(`Failed to resend message: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Failed to resend message: ${err instanceof Error ? err.message : 'Unknown error'}`);

      // Remove the message from local state if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      if (!isDM) {
        setChannelMessages(prev => ({
          ...prev,
          [messageChannel]: prev[messageChannel]?.filter(msg => msg.id !== tempId) || [],
        }));
      }
      setPendingMessages(prev => {
        const updated = new Map(prev);
        updated.delete(tempId);
        pendingMessagesRef.current = updated;
        return updated;
      });
    }
  };

  return {
    sendChannelMessage,
    sendDirectMessage,
    sendTapback,
    resend,
    deleteMessage,
    purgeChannelMessages,
    sendBell,
    sendPosition,
  };
}
