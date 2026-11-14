/**
 * Replies and Meshtastic mentions push (#6365 Task 2.9, Workspace D13).
 *
 * - reply: `replyId` points at one of this source's own messages (the Activity
 *   feed's rule, `isReplyToOwnMeshtasticMessageAsync`) → users with
 *   `notifyOnReply` on for the source.
 * - mention: the text carries `@!<own id>` → users with `notifyOnMention` on.
 *
 * One push per message at most: a reply that also mentions us is the reply. A
 * tapback is neither. Our own messages (any MeshMonitor radio) never push.
 * Recipients must be able to read the venue (the message-list rule) and must
 * not have muted it. Both toggles default off.
 *
 * Mesh impact: sends nothing over the air and arms no timer. The cost is one
 * push per qualifying incoming message per opted-in user, so no cooldown (D13).
 */
import databaseService from '../../services/database.js';
import { notificationService } from './notificationService.js';
import { sourceManagerRegistry } from '../sourceManagerRegistry.js';
import { isMeshtasticManager } from '../sourceManagerTypes.js';
import { isOwnNodeNum } from '../utils/ownNodes.js';
import { isTapbackMessage } from '../../utils/messageReplies.js';
import { nodeIdFromNum, textMentionsNode } from '../../utils/mentions.js';
import { packetDedupKey } from './notificationDedup.js';
import { extractPacketIdFromRowId } from '../utils/messageRowId.js';
import { resolveChannelName } from './messagePushNotifier.js';
import { logger } from '../../utils/logger.js';

/** Longest notification body. */
const BODY_MAX = 240;

export interface MeshtasticActivityInput {
  sourceId: string;
  message: {
    id: string;
    fromNodeNum: number;
    replyId?: number | null;
    emoji?: number | null;
    text: string;
    /** -1 for a DM. */
    channel: number;
    toNodeNum?: number;
    /** For the cross-source dedup key; the packet id falls back to the row id. */
    portnum?: number | null;
    packetId?: number | null;
  };
}

/** Never throws: a notification failure must not break message processing. */
export async function notifyMeshtasticActivity({ sourceId, message }: MeshtasticActivityInput): Promise<void> {
  try {
    if (isOwnNodeNum(message.fromNodeNum) || isTapbackMessage(message)) return;
    const manager = sourceManagerRegistry.getManager(sourceId);
    const ownNum = manager && isMeshtasticManager(manager) ? manager.getLocalNodeInfo()?.nodeNum : null;
    // No local node yet (or an MQTT source): nothing here is ours.
    if (ownNum == null) return;
    const ownNodeNum = Number(ownNum);

    const isReply = !!message.replyId &&
      await databaseService.isReplyToOwnMeshtasticMessageAsync(sourceId, ownNodeNum, Number(message.replyId));
    if (!isReply && !textMentionsNode(message.text, nodeIdFromNum(ownNodeNum))) return;

    const isDirectMessage = message.channel === -1;
    const senderId = nodeIdFromNum(message.fromNodeNum);
    const sender = await databaseService.nodes.getNode(message.fromNodeNum, sourceId);
    const senderName = sender?.longName || sender?.shortName || senderId;
    const sourceName = (await databaseService.sources.getSource(sourceId))?.name || sourceId;
    const place = isDirectMessage ? 'a direct message' : `#${await resolveChannelName(message.channel, sourceId)}`;
    const line = `${senderName}: ${message.text.trim()}`;
    const dedupKey = packetDedupKey(
      message.fromNodeNum,
      message.packetId ?? extractPacketIdFromRowId(message.id),
      message.portnum,
    );

    await notificationService.broadcastToPreferenceUsers(isReply ? 'notifyOnReply' : 'notifyOnMention', {
      title: `${isReply ? 'Reply' : 'Mention'} in ${place} · ${sourceName}`,
      body: line.length > BODY_MAX ? `${line.slice(0, BODY_MAX - 1)}…` : line,
      type: 'info',
      sourceId,
      sourceName,
      data: isDirectMessage
        ? { type: 'dm', messageId: message.id, senderNodeId: senderId }
        : { type: 'channel', channelId: message.channel, messageId: message.id },
      // Same key as the message notifier, which runs after this: a recipient
      // who got this push gets no second one for the message.
      ...(dedupKey ? { dedup: { key: dedupKey } } : {}),
      muteVenue: isDirectMessage
        ? { isDirectMessage: true, muteKey: senderId, meshtasticReadGate: true }
        : { isDirectMessage: false, channelId: message.channel, meshtasticReadGate: true },
    });
  } catch (error) {
    logger.error('❌ Error sending reply/mention notification:', error);
  }
}
