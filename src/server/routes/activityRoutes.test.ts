/**
 * GET /api/sources/:id/activity (#6365 Task 2.7) through the real auth
 * middleware and per-source permission rows (route test harness).
 *
 * Review Focus 2: a user who can read only channel 0 must get no DM items
 * and no channel-1 items. Anonymous with no read grant gets 403.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import activityRoutes from './activityRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';
import { PortNum } from '../constants/meshtastic.js';

const OWN = 0x80000001;
const OWN_ID = '!80000001';
const ALICE = 0xf0000001;
const P_CH0 = 0xdeadbeef;
const P_CH1 = 0xdeadbef0;
const P_DM = 0xdeadbef1;
const NOW = Date.now();
const MIN = 60_000;

const localNode = vi.hoisted(() => ({ value: null as { nodeNum: number; nodeId: string } | null }));

vi.mock('../sourceManagerRegistry.js', () => ({
  sourceManagerRegistry: {
    getManager: vi.fn((id: string) =>
      id === 'rt-source-a'
        ? { sourceType: 'meshtastic_tcp', getLocalNodeInfo: () => localNode.value }
        : null),
    getAllManagers: vi.fn(() => []),
  },
}));

const hex = (n: number) => `!${n.toString(16).padStart(8, '0')}`;

describe('GET /api/sources/:id/activity', () => {
  let harness: RouteTestHarness;

  const insert = (from: number, packet: number, over: Record<string, unknown>) =>
    harness.db.messages.insertMessage({
      id: `${harness.sourceA}_${from}_${packet}`,
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
    } as never, harness.sourceA);

  beforeEach(async () => {
    localNode.value = { nodeNum: OWN, nodeId: OWN_ID };
    harness = await createRouteTestApp({
      mount: (app) => app.use('/api/sources/:id/activity', activityRoutes),
    });
    for (const [num, name] of [[OWN, 'Me'], [ALICE, 'Alice']] as const) {
      await harness.db.nodes.upsertNode({ nodeNum: num, nodeId: hex(num), longName: name }, harness.sourceA);
    }
    await insert(OWN, P_CH0, { text: 'own ch0', timestamp: NOW - 30 * MIN });
    await insert(OWN, P_CH1, { text: 'own ch1', channel: 1, timestamp: NOW - 30 * MIN });
    await insert(OWN, P_DM, { text: 'own dm', channel: -1, toNodeNum: ALICE, toNodeId: hex(ALICE), timestamp: NOW - 30 * MIN });
    await insert(ALICE, 1, { text: 'reply ch0', replyId: P_CH0, timestamp: NOW - 1 * MIN });
    await insert(ALICE, 2, { text: 'reply ch1', channel: 1, replyId: P_CH1, timestamp: NOW - 2 * MIN });
    await insert(ALICE, 3, { text: 'reply dm', channel: -1, replyId: P_DM, toNodeNum: OWN, toNodeId: OWN_ID, timestamp: NOW - 3 * MIN });
    await insert(ALICE, 4, { text: `hey @${OWN_ID}`, timestamp: NOW - 4 * MIN });
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  const url = (source: string, query = '') => `/api/sources/${source}/activity${query}`;

  it('channel_0:read only → channel-0 items, no DM and no channel-1 items', async () => {
    await harness.grant(harness.limited.id, 'channel_0', 'read', harness.sourceA);
    const agent = await harness.loginAs(harness.limited);
    const res = await agent.get(url(harness.sourceA));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.map((i: { text: string }) => i.text)).toEqual(['reply ch0', `hey @${OWN_ID}`]);
    expect(res.body.data.nextBefore).toBeNull();
  });

  it('admin sees every kind of conversation', async () => {
    const agent = await harness.loginAs(harness.admin);
    const res = await agent.get(url(harness.sourceA));
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i: { text: string }) => i.text)).toEqual(['reply ch0', 'reply ch1', 'reply dm', `hey @${OWN_ID}`]);
  });

  it('a grant on another source reads nothing here → 403', async () => {
    await harness.grant(harness.limited.id, 'channel_0', 'read', harness.sourceB);
    await harness.grant(harness.limited.id, 'messages', 'read', harness.sourceB);
    const agent = await harness.loginAs(harness.limited);
    const res = await agent.get(url(harness.sourceA));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('anonymous with no read access → 403', async () => {
    const agent = await harness.loginAs(null);
    const res = await agent.get(url(harness.sourceA));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'FORBIDDEN' });
  });

  it('unknown source → 404 SOURCE_NOT_FOUND', async () => {
    const agent = await harness.loginAs(harness.admin);
    const res = await agent.get(url('no-such-source'));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SOURCE_NOT_FOUND');
  });

  it('pages with nextBefore', async () => {
    const agent = await harness.loginAs(harness.admin);
    const first = await agent.get(url(harness.sourceA, '?limit=3'));
    expect(first.body.data.items).toHaveLength(3);
    expect(first.body.data.nextBefore).toBe(NOW - 3 * MIN);
    const second = await agent.get(url(harness.sourceA, `?limit=3&before=${first.body.data.nextBefore}`));
    expect(second.body.data.items.map((i: { text: string }) => i.text)).toEqual([`hey @${OWN_ID}`]);
    expect(second.body.data.nextBefore).toBeNull();
  });

  it('clamps limit to 1..100 and rejects non-numeric before/limit', async () => {
    const agent = await harness.loginAs(harness.admin);
    expect((await agent.get(url(harness.sourceA, '?limit=0'))).body.data.items).toHaveLength(1);
    expect((await agent.get(url(harness.sourceA, '?limit=5000'))).body.data.items).toHaveLength(4);
    for (const q of ['?before=yesterday', '?limit=lots']) {
      const res = await agent.get(url(harness.sourceA, q));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    }
  });

  it('a source whose local node is not known yet → empty list, not an error', async () => {
    localNode.value = null;
    const agent = await harness.loginAs(harness.admin);
    const res = await agent.get(url(harness.sourceA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], nextBefore: null });
  });
});
