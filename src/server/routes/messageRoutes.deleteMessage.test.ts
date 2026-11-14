/**
 * DELETE /api/messages/:id — DM vs channel classification.
 *
 * DMs are stored with channel -1, so they need messages:write; a channel-0
 * message needs channel_0:write. Both checks are scoped to the message's source.
 * Runs through the real harness so checkPermissionAsync hits seeded rows.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import messageRoutes from './messageRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';

vi.mock('../sourceManagerRegistry.js', () => ({
  sourceManagerRegistry: {
    getManager: vi.fn().mockReturnValue(null),
    getAllManagers: vi.fn(() => []),
    startManager: vi.fn(),
    stopManager: vi.fn(),
  },
}));

vi.mock('../meshtasticManager.js', () => ({
  MeshtasticManager: vi.fn(),
  fallbackManager: { getLocalNodeInfo: () => null, getAllNodesAsync: async () => [] },
}));

const FROM = { nodeNum: 0x0a000002, nodeId: '!0a000002' };
const TO = { nodeNum: 0x0a000001, nodeId: '!0a000001' };

describe('DELETE /api/messages/:id — permission by message type', () => {
  let harness: RouteTestHarness;
  let seq = 0;

  const seedMessage = async (sourceId: string, channel: number): Promise<string> => {
    const id = `${sourceId}_del_${++seq}`;
    await harness.db.messages.insertMessage(
      {
        id,
        fromNodeNum: FROM.nodeNum,
        toNodeNum: channel === -1 ? TO.nodeNum : 0xffffffff,
        fromNodeId: FROM.nodeId,
        toNodeId: channel === -1 ? TO.nodeId : '!ffffffff',
        text: 'hello',
        channel,
        portnum: 1,
        timestamp: Date.now(),
        createdAt: Date.now(),
      } as never,
      sourceId,
    );
    return id;
  };

  beforeEach(async () => {
    harness = await createRouteTestApp({ mount: (app) => app.use('/', messageRoutes) });
    for (const n of [FROM, TO]) {
      await harness.db.nodes.upsertNode(
        { nodeNum: n.nodeNum, nodeId: n.nodeId, channel: 0, lastHeard: Date.now() } as never,
        harness.sourceA,
      );
    }
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('messages:write on the source can delete a DM (channel -1)', async () => {
    await harness.grant(harness.limited.id, 'messages', 'write', harness.sourceA);
    const id = await seedMessage(harness.sourceA, -1);
    const agent = await harness.loginAs(harness.limited);
    const res = await agent.delete(`/${id}`);
    expect(res.status).toBe(200);
    expect(await harness.db.messages.getMessage(id)).toBeFalsy();
  });

  it('channel_0:write alone can delete a channel-0 message but not a DM', async () => {
    await harness.grant(harness.limited.id, 'channel_0', 'write', harness.sourceA);
    const chanId = await seedMessage(harness.sourceA, 0);
    const dmId = await seedMessage(harness.sourceA, -1);
    const agent = await harness.loginAs(harness.limited);

    expect((await agent.delete(`/${chanId}`)).status).toBe(200);
    expect(await harness.db.messages.getMessage(chanId)).toBeFalsy();

    expect((await agent.delete(`/${dmId}`)).status).toBe(403);
    expect(await harness.db.messages.getMessage(dmId)).toBeTruthy();
  });

  it('messages:write alone cannot delete a channel-0 message', async () => {
    await harness.grant(harness.limited.id, 'messages', 'write', harness.sourceA);
    const id = await seedMessage(harness.sourceA, 0);
    const agent = await harness.loginAs(harness.limited);
    expect((await agent.delete(`/${id}`)).status).toBe(403);
    expect(await harness.db.messages.getMessage(id)).toBeTruthy();
  });

  it('a grant on another source does not authorize the delete', async () => {
    await harness.grant(harness.limited.id, 'messages', 'write', harness.sourceB);
    await harness.grant(harness.limited.id, 'channel_0', 'write', harness.sourceB);
    const dmId = await seedMessage(harness.sourceA, -1);
    const chanId = await seedMessage(harness.sourceA, 0);
    const agent = await harness.loginAs(harness.limited);

    expect((await agent.delete(`/${dmId}`)).status).toBe(403);
    expect((await agent.delete(`/${chanId}`)).status).toBe(403);
    expect(await harness.db.messages.getMessage(dmId)).toBeTruthy();
    expect(await harness.db.messages.getMessage(chanId)).toBeTruthy();
  });
});
