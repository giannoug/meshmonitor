/**
 * `POST /api/messages/mark-read` with a `sourceId` marks that source's DMs and
 * checks permissions on it. Without it the handler falls back to the primary
 * source, which is what Classic's "Mark all as read" used to hit on a
 * non-primary device.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import messageRoutes from './messageRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';

const LOCAL_A = { nodeNum: 0x0a000001, nodeId: '!0a000001' };
const LOCAL_B = { nodeNum: 0x0b000001, nodeId: '!0b000001' };
const PEER_A = { nodeNum: 0x0a000002, nodeId: '!0a000002' };
const PEER_B = { nodeNum: 0x0b000002, nodeId: '!0b000002' };

const nodesBySource: Record<string, Array<{ nodeNum: number; user: { id: string }; channel: number }>> = {};
const localBySource: Record<string, { nodeNum: number; nodeId: string } | null> = {};

vi.mock('../sourceManagerRegistry.js', () => ({
  sourceManagerRegistry: {
    getManager: vi.fn((sourceId: string) => {
      if (!(sourceId in localBySource)) return null;
      return {
        sourceId,
        sourceType: 'meshtastic_tcp',
        getLocalNodeInfo: () => localBySource[sourceId],
        getAllNodesAsync: async () => nodesBySource[sourceId] ?? [],
      };
    }),
    getAllManagers: vi.fn(() => []),
    startManager: vi.fn(),
    stopManager: vi.fn(),
  },
}));

vi.mock('../meshtasticManager.js', () => ({
  MeshtasticManager: vi.fn(),
  fallbackManager: {
    getLocalNodeInfo: () => null,
    getAllNodesAsync: async () => [],
  },
}));

describe('POST /api/messages/mark-read sourceId scoping', () => {
  let harness: RouteTestHarness;

  const seedDm = async (
    sourceId: string,
    from: { nodeNum: number; nodeId: string },
    to: { nodeNum: number; nodeId: string },
    packetId: number,
  ) => {
    await harness.db.messages.insertMessage(
      {
        id: `${sourceId}_${from.nodeNum}_${packetId}`,
        fromNodeNum: from.nodeNum,
        toNodeNum: to.nodeNum,
        fromNodeId: from.nodeId,
        toNodeId: to.nodeId,
        text: 'hello',
        channel: -1,
        portnum: 1,
        timestamp: Date.now(),
        createdAt: Date.now(),
      } as never,
      sourceId,
    );
  };

  const seedNode = async (sourceId: string, n: { nodeNum: number; nodeId: string }) => {
    await harness.db.nodes.upsertNode(
      { nodeNum: n.nodeNum, nodeId: n.nodeId, channel: 0, lastHeard: Date.now() } as never,
      sourceId,
    );
  };

  beforeEach(async () => {
    harness = await createRouteTestApp({
      mount: (app) => app.use('/', messageRoutes),
    });

    localBySource[harness.sourceA] = LOCAL_A;
    localBySource[harness.sourceB] = LOCAL_B;
    nodesBySource[harness.sourceA] = [
      { nodeNum: PEER_A.nodeNum, user: { id: PEER_A.nodeId }, channel: 0 },
    ];
    nodesBySource[harness.sourceB] = [
      { nodeNum: PEER_B.nodeNum, user: { id: PEER_B.nodeId }, channel: 0 },
    ];

    for (const n of [LOCAL_A, PEER_A]) await seedNode(harness.sourceA, n);
    for (const n of [LOCAL_B, PEER_B]) await seedNode(harness.sourceB, n);

    await seedDm(harness.sourceA, PEER_A, LOCAL_A, 1001);
    await seedDm(harness.sourceB, PEER_B, LOCAL_B, 2001);
  });

  afterEach(async () => {
    await harness.cleanup();
    for (const k of Object.keys(localBySource)) delete localBySource[k];
    for (const k of Object.keys(nodesBySource)) delete nodesBySource[k];
    vi.clearAllMocks();
  });

  const unread = async () => (await (await harness.loginAs(harness.admin)).get('/unread-by-source')).body.sources;

  it('allDMs on source B leaves source A unread', async () => {
    const agent = await harness.loginAs(harness.admin);
    const res = await agent.post('/mark-read').send({ allDMs: true, sourceId: harness.sourceB });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(1);

    const after = await unread();
    expect(after[harness.sourceB]).toBeUndefined();
    expect(after[harness.sourceA]).toEqual({ directMessages: 1 });
  });

  it('a single DM conversation on source B leaves source A unread', async () => {
    const agent = await harness.loginAs(harness.admin);
    const res = await agent
      .post('/mark-read')
      .send({ nodeId: PEER_B.nodeId, channelId: -1, sourceId: harness.sourceB });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(1);

    const after = await unread();
    expect(after[harness.sourceB]).toBeUndefined();
    expect(after[harness.sourceA]).toEqual({ directMessages: 1 });
  });

  it('checks messages:read on the named source', async () => {
    await harness.grant(harness.limited.id, 'messages', 'read', harness.sourceB);
    const limited = await harness.loginAs(harness.limited);

    expect((await limited.post('/mark-read').send({ allDMs: true, sourceId: harness.sourceA })).status).toBe(403);
    expect((await limited.post('/mark-read').send({ allDMs: true, sourceId: harness.sourceB })).status).toBe(200);
  });
});
