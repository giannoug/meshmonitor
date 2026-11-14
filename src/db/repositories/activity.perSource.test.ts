/**
 * ActivityRepository (#6365 Task 2.7): replies to, reactions on and mentions
 * of a source's own node, on SQLite, PostgreSQL and MySQL.
 *
 * Pinned here: each kind is found; rows from source B never appear for
 * source A; tapbacks on other people's messages are excluded; reactions are
 * collapsed per target message; paging by `before` never repeats a target.
 *
 * Node numbers and packet ids sit above 2^31 so the PG/MySQL BIGINT path is
 * exercised. PG/MySQL tables come from the migration registry in a private
 * database each (see CLAUDE.md, fixture isolation).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import * as schema from '../schema/index.js';
import { registry } from '../migrations.js';
import {
  readAppliedMigrationsPostgres,
  markMigrationAppliedPostgres,
  readAppliedMigrationsMysql,
  markMigrationAppliedMysql,
  runLedgeredMigrations,
} from '../migrationLedger.js';
import { ActivityRepository } from './activity.js';
import { MessagesRepository } from './messages.js';
import { MeshCoreRepository } from './meshcore.js';
import { NodesRepository } from './nodes.js';
import { PortNum } from '../../server/constants/meshtastic.js';
import {
  postgresAvailable,
  mysqlAvailable,
  createIsolatedPostgresDatabase,
  createIsolatedMysqlDatabase,
} from './test-utils.js';
import { createTestDb } from '../../server/test-helpers/testDb.js';

const A = 'act-src-a';
const B = 'act-src-b';
const NOW = 1_790_000_000_000;
const MIN = 60_000;
const OWN = 0x80000001;
const OWN_ID = '!80000001';
const ALICE = 0xf0000001;
const BOB = 0x00000202;
const P_OWN_CH = 0xdeadbeef;
const P_OWN_DM = 0xdeadbef0;
const P_ALICE = 0xc0000001;
const ME = 'aa'.repeat(32);
const PEER = 'bb'.repeat(32);

interface Ctx {
  activity: ActivityRepository;
  messages: MessagesRepository;
  meshcore: MeshCoreRepository;
  nodes: NodesRepository;
  reset: () => Promise<void>;
}

const hex = (n: number) => `!${n.toString(16).padStart(8, '0')}`;

function suite(getCtx: () => Ctx) {
  let seq = 0;
  const msg = (sourceId: string, from: number, packet: number, over: Record<string, unknown> = {}) =>
    getCtx().messages.insertMessage({
      id: `${sourceId}_${from}_${packet}`,
      fromNodeNum: from,
      toNodeNum: 0xffffffff,
      fromNodeId: hex(from),
      toNodeId: '!ffffffff',
      text: 'hi',
      channel: 0,
      portnum: PortNum.TEXT_MESSAGE_APP,
      timestamp: NOW,
      createdAt: NOW,
      ...over,
    } as never, sourceId);
  const other = (sourceId: string, from: number, minutesAgo: number, over: Record<string, unknown> = {}) =>
    msg(sourceId, from, 0x90000000 + ++seq, { timestamp: NOW - minutesAgo * MIN, ...over });

  beforeEach(async () => {
    seq = 0;
    await getCtx().reset();
    const { nodes } = getCtx();
    for (const src of [A, B]) {
      await nodes.upsertNode({ nodeNum: OWN, nodeId: OWN_ID, longName: 'Me' }, src);
      await nodes.upsertNode({ nodeNum: ALICE, nodeId: hex(ALICE), longName: 'Alice' }, src);
      await nodes.upsertNode({ nodeNum: BOB, nodeId: hex(BOB), shortName: 'BOB' }, src);
    }
  });

  async function seedMeshtastic() {
    await msg(A, OWN, P_OWN_CH, { text: 'hello mesh', timestamp: NOW - 30 * MIN, requestId: P_OWN_CH });
    await msg(A, OWN, P_OWN_DM, { text: 'dm out', channel: -1, toNodeNum: ALICE, toNodeId: hex(ALICE), timestamp: NOW - 30 * MIN });
    await msg(A, ALICE, P_ALICE, { text: 'alice says', timestamp: NOW - 30 * MIN });
    await other(A, ALICE, 1, { text: 'hi back', replyId: P_OWN_CH });                  // reply
    await other(A, ALICE, 2, { text: '👍', emoji: 1, replyId: P_OWN_CH });             // reaction
    await other(A, BOB, 3, { text: '👍', emoji: 1, replyId: P_OWN_CH });               // same reaction, collapsed
    await other(A, BOB, 4, { text: '❤️', replyId: P_OWN_CH });                         // emoji-only = tapback
    await other(A, BOB, 5, { text: 'ping @!80000001 there' });                         // mention
    await other(A, BOB, 6, { text: '👍', emoji: 1, replyId: P_ALICE });                // tapback to Alice: excluded
    await other(A, BOB, 7, { text: 'agreed', replyId: P_ALICE });                      // reply to Alice: excluded
    await other(A, BOB, 8, { text: 'not @!80000001ff' });                              // longer hex: not a mention
    await other(A, ALICE, 9, { text: 'got it', channel: -1, replyId: P_OWN_DM, toNodeNum: OWN, toNodeId: OWN_ID }); // DM reply
    await other(A, OWN, 10, { text: 'note to self @!80000001', replyId: P_OWN_CH });  // our own: never an item
    // Source B: the same shapes, own message with the same packet id.
    await msg(B, OWN, P_OWN_CH, { text: 'hello b', timestamp: NOW - 30 * MIN });
    await other(B, ALICE, 1, { text: 'b reply', replyId: P_OWN_CH });
    await other(B, ALICE, 2, { text: '👍', emoji: 1, replyId: P_OWN_CH });
    await other(B, BOB, 3, { text: 'b @!80000001' });
  }

  const listA = (over: Partial<Parameters<ActivityRepository['listMeshtastic']>[0]> = {}) =>
    getCtx().activity.listMeshtastic({ sourceId: A, ownNodeNum: OWN, ownNodeId: OWN_ID, scopes: 'all', limit: 50, ...over });

  it('finds replies, collapsed reactions and mentions, newest first', async () => {
    await seedMeshtastic();
    const page = await listA();
    expect(page.nextBefore).toBeNull();
    expect(page.items.map((i) => [i.kind, i.text])).toEqual([
      ['reply', 'hi back'],
      ['reaction', 'hello mesh'],
      ['mention', 'ping @!80000001 there'],
      ['reply', 'got it'],
    ]);
    const [reply, reaction, mention, dm] = page.items;
    const ownCh = `${A}_${OWN}_${P_OWN_CH}`;
    expect(reply).toMatchObject({
      targetMessageId: ownCh, fromId: hex(ALICE), fromName: 'Alice',
      conversation: { type: 'channel', channel: 0 }, timestamp: NOW - MIN,
    });
    expect(reaction).toMatchObject({
      id: `reaction:${ownCh}`, targetMessageId: ownCh, fromName: 'Alice', timestamp: NOW - 2 * MIN,
      reactions: [
        { emoji: '👍', count: 2, fromNames: ['Alice', 'BOB'] },
        { emoji: '❤️', count: 1, fromNames: ['BOB'] },
      ],
    });
    expect(mention).toMatchObject({ targetMessageId: null, fromName: 'BOB', conversation: { type: 'channel', channel: 0 } });
    expect(dm).toMatchObject({
      targetMessageId: `${A}_${OWN}_${P_OWN_DM}`,
      conversation: { type: 'dm', peerId: hex(ALICE) },
    });
    expect(typeof reply.timestamp).toBe('number');
  });

  it('never shows another source’s rows', async () => {
    await seedMeshtastic();
    const ids = (await listA()).items.map((i) => i.id);
    expect(ids.some((id) => id.includes(B))).toBe(false);
    const b = await getCtx().activity.listMeshtastic({ sourceId: B, ownNodeNum: OWN, ownNodeId: OWN_ID, scopes: 'all', limit: 50 });
    expect(b.items.map((i) => [i.kind, i.text])).toEqual([
      ['reply', 'b reply'],
      ['reaction', 'hello b'],
      ['mention', 'b @!80000001'],
    ]);
  });

  it('keeps to the readable channels: no DMs without -1, nothing on an unlisted channel', async () => {
    await seedMeshtastic();
    expect((await listA({ scopes: [0] })).items.map((i) => i.text)).toEqual(['hi back', 'hello mesh', 'ping @!80000001 there']);
    expect((await listA({ scopes: [-1] })).items.map((i) => i.text)).toEqual(['got it']);
    expect((await listA({ scopes: [1] })).items).toEqual([]);
    expect((await listA({ scopes: [] })).items).toEqual([]);
  });

  it('pages by before without repeating a collapsed reaction', async () => {
    await seedMeshtastic();
    const first = await listA({ limit: 2 });
    expect(first.items.map((i) => i.kind)).toEqual(['reply', 'reaction']);
    expect(first.nextBefore).toBe(NOW - 2 * MIN);
    const second = await listA({ limit: 2, before: first.nextBefore! });
    expect(second.items.map((i) => i.text)).toEqual(['ping @!80000001 there', 'got it']);
    expect(second.nextBefore).toBeNull();
  });

  it('returns nothing when the own node has no activity', async () => {
    await seedMeshtastic();
    const page = await getCtx().activity.listMeshtastic({
      sourceId: A, ownNodeNum: 0x12345678, ownNodeId: '!12345678', scopes: 'all', limit: 50,
    });
    expect(page).toEqual({ items: [], nextBefore: null });
  });

  async function seedMeshcore() {
    const { meshcore } = getCtx();
    const at = (m: number) => ({ timestamp: NOW - m * MIN, createdAt: NOW - m * MIN });
    const ins = (sourceId: string, id: string, over: Record<string, unknown>) =>
      meshcore.insertMessage({ id, fromPublicKey: 'channel-1', text: 't', messageType: 'text', sourceId, ...at(0), ...over } as never, sourceId);
    await ins(A, 'own-ch', { fromPublicKey: ME, fromName: 'Base', toPublicKey: 'channel-1', text: 'my post', ...at(30) });
    await ins(A, 'own-dm', { fromPublicKey: ME, toPublicKey: PEER, text: 'my dm', ...at(30) });
    await ins(A, 'theirs', { fromName: 'Zed', text: 'zed post', ...at(30) });
    await ins(A, 'r1', { fromName: 'Ann', text: '👍', reactionEmoji: '👍', reactionTargetId: 'own-ch', ...at(1) });
    await ins(A, 'r2', { fromName: 'Cy', text: '👍', reactionEmoji: '👍', reactionTargetId: 'own-ch', ...at(2) });
    await ins(A, 'r3', { fromName: 'Cy', text: '👍', reactionEmoji: '👍', reactionTargetId: 'theirs', ...at(3) }); // other target
    await ins(A, 'm1', { fromName: 'Ann', text: 'hey @[Base] look', ...at(4) });
    await ins(A, 'm2', { fromName: 'Ann', text: 'hey @[Basement]', ...at(5) }); // not our name
    await ins(A, 'dm1', { fromPublicKey: PEER.slice(0, 12), fromName: 'Peer', toPublicKey: ME, text: '@[base] dm', ...at(6) });
    await ins(A, 'r4', { fromPublicKey: PEER.slice(0, 12), fromName: 'Peer', toPublicKey: ME, text: '❤️', reactionEmoji: '❤️', reactionTargetId: 'own-dm', ...at(7) });
    await ins(A, 'self', { fromPublicKey: ME, toPublicKey: 'channel-1', text: '@[Base] me', ...at(8) });
    await ins(B, 'b-own', { fromPublicKey: ME, toPublicKey: 'channel-1', text: 'b post', ...at(30) });
    await ins(B, 'b-r', { fromName: 'Ann', text: '👍', reactionEmoji: '👍', reactionTargetId: 'b-own', ...at(1) });
    await ins(B, 'b-m', { fromName: 'Ann', text: '@[Base] b', ...at(2) });
  }

  const mcA = (over: Partial<Parameters<ActivityRepository['listMeshcore']>[0]> = {}) =>
    getCtx().activity.listMeshcore({
      sourceId: A, ownPublicKey: ME, ownName: 'Base',
      scopes: { channels: 'all', includeDms: true }, limit: 50, ...over,
    });

  it('MeshCore: collapsed reactions and name mentions, no replies, source-isolated', async () => {
    await seedMeshcore();
    const page = await mcA();
    expect(page.items.map((i) => [i.kind, i.id, i.text])).toEqual([
      ['reaction', 'reaction:own-ch', 'my post'],
      ['mention', 'm1', 'hey @[Base] look'],
      ['mention', 'dm1', '@[base] dm'],
      ['reaction', 'reaction:own-dm', 'my dm'],
    ]);
    expect(page.items[0]).toMatchObject({
      conversation: { type: 'channel', channel: 1 }, fromName: 'Ann', timestamp: NOW - MIN,
      reactions: [{ emoji: '👍', count: 2, fromNames: ['Ann', 'Cy'] }],
    });
    expect(page.items[2].conversation).toEqual({ type: 'dm', peerId: PEER.slice(0, 12) });
    expect(page.items.some((i) => i.id.startsWith('b-') || i.id.includes('b-own'))).toBe(false);
  });

  it('MeshCore: keeps to the readable scope and pages by before', async () => {
    await seedMeshcore();
    expect((await mcA({ scopes: { channels: [1], includeDms: false } })).items.map((i) => i.id)).toEqual(['reaction:own-ch', 'm1']);
    expect((await mcA({ scopes: { channels: [], includeDms: true } })).items.map((i) => i.id)).toEqual(['dm1', 'reaction:own-dm']);
    expect((await mcA({ scopes: { channels: [], includeDms: false } })).items).toEqual([]);
    const first = await mcA({ limit: 1 });
    expect(first.items.map((i) => i.id)).toEqual(['reaction:own-ch']);
    expect(first.nextBefore).toBe(NOW - MIN);
    const second = await mcA({ limit: 1, before: first.nextBefore! });
    expect(second.items.map((i) => i.id)).toEqual(['m1']);
  });
}

describe('ActivityRepository — SQLite', () => {
  let testDb: ReturnType<typeof createTestDb>;
  const ctx = {} as Ctx;
  beforeEach(() => {
    testDb?.close();
    testDb = createTestDb();
    const db = testDb.db as never;
    ctx.activity = new ActivityRepository(db, 'sqlite');
    ctx.messages = new MessagesRepository(db, 'sqlite');
    ctx.meshcore = new MeshCoreRepository(db, 'sqlite');
    ctx.nodes = new NodesRepository(db, 'sqlite');
    ctx.reset = async () => {};
  });
  afterAll(() => testDb?.close());
  suite(() => ctx);
});

describe.skipIf(!postgresAvailable)('ActivityRepository — PostgreSQL', () => {
  let isolated: Awaited<ReturnType<typeof createIsolatedPostgresDatabase>>;
  const ctx = {} as Ctx;
  beforeAll(async () => {
    isolated = await createIsolatedPostgresDatabase('activity');
    const client = await isolated.pool.connect();
    try {
      await runLedgeredMigrations({
        backend: 'PostgreSQL', handle: client, migrations: registry.getAll(), pick: (m) => m.postgres,
        readApplied: readAppliedMigrationsPostgres, markApplied: markMigrationAppliedPostgres,
      });
    } finally {
      client.release();
    }
    const db = drizzlePostgres(isolated.pool, { schema }) as never;
    ctx.activity = new ActivityRepository(db, 'postgres');
    ctx.messages = new MessagesRepository(db, 'postgres');
    ctx.meshcore = new MeshCoreRepository(db, 'postgres');
    ctx.nodes = new NodesRepository(db, 'postgres');
    ctx.reset = async () => {
      await isolated.pool.query('TRUNCATE messages, nodes, meshcore_messages RESTART IDENTITY CASCADE');
    };
  }, 120_000);
  afterAll(async () => { await isolated?.cleanup(); });
  suite(() => ctx);
});

describe.skipIf(!mysqlAvailable)('ActivityRepository — MySQL', () => {
  let isolated: Awaited<ReturnType<typeof createIsolatedMysqlDatabase>>;
  const ctx = {} as Ctx;
  beforeAll(async () => {
    isolated = await createIsolatedMysqlDatabase('activity');
    await runLedgeredMigrations({
      backend: 'MySQL', handle: isolated.pool, migrations: registry.getAll(), pick: (m) => m.mysql,
      readApplied: readAppliedMigrationsMysql, markApplied: markMigrationAppliedMysql,
    });
    const db = drizzleMysql(isolated.pool, { schema, mode: 'default' }) as never;
    ctx.activity = new ActivityRepository(db, 'mysql');
    ctx.messages = new MessagesRepository(db, 'mysql');
    ctx.meshcore = new MeshCoreRepository(db, 'mysql');
    ctx.nodes = new NodesRepository(db, 'mysql');
    ctx.reset = async () => {
      for (const t of ['messages', 'meshcore_messages', 'nodes']) await isolated.pool.query(`DELETE FROM ${t}`);
    };
  }, 180_000);
  afterAll(async () => { await isolated?.cleanup(); });
  suite(() => ctx);
});
