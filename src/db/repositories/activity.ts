/**
 * Activity feed reads (#6365 Task 2.7): replies to, reactions on and mentions
 * of ONE source's own node, newest first.
 *
 * - reply: a Meshtastic message whose `replyId` points at one of our messages
 *   and that is not a tapback. MeshCore has no reply ids, so no replies.
 * - reaction: a Meshtastic tapback (`utils/messageReplies` rule) or a MeshCore
 *   `reactionEmoji` row on one of our messages, collapsed to one item per
 *   target message at its newest reaction.
 * - mention: `@!<own id>` (Meshtastic) or `@[<own name>]` (MeshCore).
 *
 * Our own messages are never items. Every query runs inside the caller's
 * readable scope (the same fragments message search and the v1 list use), so
 * a channel or DM the caller cannot read never yields an item.
 *
 * Paging: `before` (ms) returns items strictly older. Meshtastic orders on the
 * server receipt `timestamp`, MeshCore on server arrival `createdAt` (#5973).
 */
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, SQL } from 'drizzle-orm';
import { BaseRepository, DrizzleDatabase } from './base.js';
import { DatabaseType } from '../types.js';
import { MessagesRepository, type MessageChannelScope } from './messages.js';
import { MeshCoreRepository, type MeshCoreMessageScope } from './meshcore.js';
import { isTapbackMessage } from '../../utils/messageReplies.js';
import { textMentionsNode } from '../../utils/mentions.js';
import { textMentionsMeshCoreName } from '../../utils/meshcoreMentions.js';
import type { ActivityConversation, ActivityItem, ActivityPage } from '../../types/activity.js';

export type { ActivityConversation, ActivityItem, ActivityPage };

export interface MeshtasticActivityQuery {
  sourceId: string;
  ownNodeNum: number;
  ownNodeId: string;
  /** Readable channels on this source (`resolveReadableMeshtasticChannels`). */
  scopes: MessageChannelScope;
  /** Other local nodes MeshMonitor owns (`getOwnNodeNums`); their messages are ours too. */
  otherOwnNodeNums?: number[];
  before?: number;
  limit: number;
}

export interface MeshcoreActivityQuery {
  sourceId: string;
  ownPublicKey: string;
  ownName: string;
  /** Readable traffic on this source (`resolveReadableMeshcoreScope`). */
  scopes: Omit<MeshCoreMessageScope, 'sourceId'>;
  /** Other local MeshCore keys MeshMonitor owns (`getOwnPublicKeys`). */
  otherOwnPublicKeys?: string[];
  before?: number;
  limit: number;
}

/** shortcut: bounded scan; index if slow */
export const ACTIVITY_SCAN_ROWS = 2000;

const EMPTY: ActivityPage = { items: [], nextBefore: null };

/** Collapsed reaction id: prefixed so it can never equal a message id. */
const reactionItemId = (targetId: string) => `reaction:${targetId}`;

interface Sender {
  fromId: string;
  fromName: string;
  conversation: ActivityConversation;
  timestamp: number;
}

/** Fold one reaction into its target's item, creating it at the newest reaction. */
function addReaction(
  groups: Map<string, ActivityItem>,
  items: ActivityItem[],
  targetId: string,
  targetText: string,
  emoji: string,
  from: Sender,
): void {
  let item = groups.get(targetId);
  if (!item) {
    item = { kind: 'reaction', id: reactionItemId(targetId), targetMessageId: targetId, text: targetText, reactions: [], ...from };
    groups.set(targetId, item);
    items.push(item);
  }
  let r = item.reactions!.find((x) => x.emoji === emoji);
  if (!r) item.reactions!.push((r = { emoji, count: 0, fromNames: [] }));
  r.count++;
  if (!r.fromNames.includes(from.fromName)) r.fromNames.push(from.fromName);
}

/**
 * Cut one page. More may exist when items overflow the limit, or when the
 * scan hit its cap (then page on from the oldest row scanned).
 */
function toPage(items: ActivityItem[], limit: number, scanned: number, oldestScanned: number): ActivityPage {
  if (items.length > limit) return { items: items.slice(0, limit), nextBefore: items[limit - 1].timestamp };
  return { items, nextBefore: scanned >= ACTIVITY_SCAN_ROWS ? oldestScanned : null };
}

export class ActivityRepository extends BaseRepository {
  private readonly messagesRepo: MessagesRepository;
  private readonly meshcoreRepo: MeshCoreRepository;

  constructor(db: DrizzleDatabase, dbType: DatabaseType) {
    super(db, dbType);
    this.messagesRepo = new MessagesRepository(db, dbType);
    this.meshcoreRepo = new MeshCoreRepository(db, dbType);
  }

  async listMeshtastic(q: MeshtasticActivityQuery): Promise<ActivityPage> {
    const { messages: t, nodes } = this.tables;
    const scoped = this.messagesRepo.sourceScopesCondition([{ sourceId: q.sourceId, channels: q.scopes }]);
    if (!q.sourceId || !scoped) return EMPTY;
    const notOurs = and(
      this.withSourceScope(t, q.sourceId),
      scoped,
      notInArray(t.fromNodeNum, [q.ownNodeNum, ...(q.otherOwnNodeNums ?? [])]),
    ) as SQL;

    const rows = this.normalizeBigInts(await this.db
      .select()
      .from(t)
      .where(and(
        notOurs,
        q.before !== undefined ? lt(t.timestamp, q.before) : undefined,
        or(and(isNotNull(t.replyId), ne(t.replyId, 0)), this.textContains(t.text, `@${q.ownNodeId}`)),
      ))
      .orderBy(desc(t.timestamp), desc(t.id))
      .limit(ACTIVITY_SCAN_ROWS)) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- dialect-union row
    if (rows.length === 0) return EMPTY;

    // Our message a replyId points at: same id rule as the views (messageReplies).
    const targetIdOf = (replyId: unknown) => (replyId ? `${q.sourceId}_${q.ownNodeNum}_${Number(replyId)}` : null);
    const wanted = [...new Set(rows.map((r) => targetIdOf(r.replyId)).filter((id): id is string => id !== null))];
    const targets = new Map<string, string>();
    if (wanted.length > 0) {
      const found = await this.db
        .select({ id: t.id, text: t.text })
        .from(t)
        .where(and(
          scoped,
          inArray(t.id, wanted),
          eq(t.fromNodeNum, q.ownNodeNum),
          // #2584: a spoofed row claiming our node is never ours.
          or(isNull(t.spoofSuspected), eq(t.spoofSuspected, false)),
        ));
      for (const f of found) targets.set(f.id, f.text);
    }

    const nums = [...new Set(rows.map((r) => Number(r.fromNodeNum)))];
    const names = new Map<number, string>();
    for (const n of await this.db
      .select({ nodeNum: nodes.nodeNum, longName: nodes.longName, shortName: nodes.shortName })
      .from(nodes)
      .where(and(eq(nodes.sourceId, q.sourceId), inArray(nodes.nodeNum, nums)))) {
      const name = n.longName || n.shortName;
      if (name) names.set(Number(n.nodeNum), name);
    }

    const items: ActivityItem[] = [];
    const groups = new Map<string, ActivityItem>();
    for (const r of rows) {
      const from: Sender = {
        fromId: r.fromNodeId,
        fromName: names.get(Number(r.fromNodeNum)) ?? r.fromNodeId,
        conversation: r.channel === -1 ? { type: 'dm', peerId: r.fromNodeId } : { type: 'channel', channel: Number(r.channel) },
        timestamp: Number(r.timestamp),
      };
      const targetId = targetIdOf(r.replyId);
      const targetText = targetId ? targets.get(targetId) : undefined;
      if (isTapbackMessage(r)) {
        if (targetId && targetText !== undefined) addReaction(groups, items, targetId, targetText, r.text, from);
      } else if (targetId && targetText !== undefined) {
        items.push({ kind: 'reply', id: r.id, targetMessageId: targetId, targetText, text: r.text, ...from });
      } else if (textMentionsNode(r.text, q.ownNodeId)) {
        items.push({ kind: 'mention', id: r.id, targetMessageId: null, text: r.text, ...from });
      }
    }

    // A target with a reaction at or after `before` was shown on an earlier page.
    if (q.before !== undefined && groups.size > 0) {
      const packets = [...groups.keys()].map((id) => Number(id.split('_').pop()));
      const newer = await this.db
        .select({ replyId: t.replyId, text: t.text, emoji: t.emoji })
        .from(t)
        .where(and(notOurs, gte(t.timestamp, q.before), inArray(t.replyId, packets)));
      for (const n of this.normalizeBigInts(newer) as Array<{ replyId: number; text: string; emoji: number | null }>) {
        if (isTapbackMessage(n)) groups.delete(targetIdOf(n.replyId)!);
      }
    }

    const kept = items.filter((i) => i.kind !== 'reaction' || groups.has(i.targetMessageId!));
    return toPage(kept, q.limit, rows.length, Number(rows[rows.length - 1].timestamp));
  }

  async listMeshcore(q: MeshcoreActivityQuery): Promise<ActivityPage> {
    const { meshcoreMessages: t } = this.tables;
    const scoped = this.meshcoreRepo.meshcoreScopesCondition([{ sourceId: q.sourceId, ...q.scopes }]);
    if (!q.sourceId || !scoped) return EMPTY;
    const ownKeys = [q.ownPublicKey, 'local'];
    const notOurs = and(
      this.withSourceScope(t, q.sourceId),
      scoped,
      notInArray(t.fromPublicKey, [...ownKeys, ...(q.otherOwnPublicKeys ?? [])]),
    ) as SQL;
    const ownName = q.ownName.trim();

    const rows = this.normalizeBigInts(await this.db
      .select()
      .from(t)
      .where(and(
        notOurs,
        q.before !== undefined ? lt(t.createdAt, q.before) : undefined,
        or(
          isNotNull(t.reactionTargetId),
          ownName ? and(isNull(t.reactionEmoji), this.textContains(t.text, ownName)) : undefined,
        ),
      ))
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(ACTIVITY_SCAN_ROWS)) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- dialect-union row
    if (rows.length === 0) return EMPTY;

    const wanted = [...new Set(rows.map((r) => r.reactionTargetId).filter(Boolean))] as string[];
    const targets = new Map<string, string>();
    if (wanted.length > 0) {
      const found = await this.db
        .select({ id: t.id, text: t.text })
        .from(t)
        .where(and(scoped, inArray(t.id, wanted), inArray(t.fromPublicKey, ownKeys), isNull(t.reactionEmoji)));
      for (const f of found) targets.set(f.id, f.text);
    }

    const items: ActivityItem[] = [];
    const groups = new Map<string, ActivityItem>();
    for (const r of rows) {
      const from: Sender = {
        fromId: r.fromPublicKey,
        fromName: r.fromName || String(r.fromPublicKey).slice(0, 12),
        conversation: this.meshcoreConversation(r.fromPublicKey, r.toPublicKey, ownKeys),
        timestamp: Number(r.createdAt),
      };
      if (r.reactionEmoji) {
        const targetText = r.reactionTargetId ? targets.get(r.reactionTargetId) : undefined;
        if (targetText !== undefined) addReaction(groups, items, r.reactionTargetId, targetText, r.reactionEmoji, from);
      } else if (textMentionsMeshCoreName(r.text, ownName)) {
        items.push({ kind: 'mention', id: r.id, targetMessageId: null, text: r.text, ...from });
      }
    }

    if (q.before !== undefined && groups.size > 0) {
      const newer = await this.db
        .select({ targetId: t.reactionTargetId })
        .from(t)
        .where(and(notOurs, gte(t.createdAt, q.before), inArray(t.reactionTargetId, [...groups.keys()])));
      for (const n of newer) groups.delete(n.targetId);
    }

    const kept = items.filter((i) => i.kind !== 'reaction' || groups.has(i.targetMessageId!));
    return toPage(kept, q.limit, rows.length, Number(rows[rows.length - 1].createdAt));
  }

  /**
   * Channel from the synthesised `channel-N` key (legacy channel-0 rows have no
   * recipient); otherwise a DM or room post, keyed by the end that is not us.
   */
  private meshcoreConversation(from: string, to: string | null, ownKeys: string[]): ActivityConversation {
    const ch = /^channel-(\d+)$/.exec(from) ?? /^channel-(\d+)$/.exec(to ?? '');
    if (ch) return { type: 'channel', channel: Number(ch[1]) };
    if (!to) return { type: 'channel', channel: 0 };
    return { type: 'dm', peerId: ownKeys.includes(to) ? from : to };
  }
}
