/**
 * `notifyOnReply` on /push/preferences (#6365 Task 2.9): default off, carried
 * by the GET/POST round-trip, and kept by a save that omits it (Classic's
 * Notifications tab does not send it).
 *
 * Real session + requireAuth + requirePermission chain and the real
 * notifications repository against the harness DB.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';
import { pushRouter } from './notificationRoutes.js';

vi.mock('../sourceManagerRegistry.js', () => ({
  sourceManagerRegistry: {
    getManager: vi.fn().mockReturnValue(null),
    getAllManagers: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../meshtasticManager.js', () => ({
  fallbackManager: { getLocalNodeInfo: vi.fn().mockReturnValue(null) },
}));

describe('/push/preferences — notifyOnReply', () => {
  let harness: RouteTestHarness;

  beforeEach(async () => {
    harness = await createRouteTestApp({ mount: app => app.use('/push', pushRouter) });
    await harness.grant(harness.limited.id, 'messages', 'read', harness.sourceA);
  });

  afterEach(() => harness.cleanup());

  const get = async (agent: Awaited<ReturnType<RouteTestHarness['loginAs']>>) =>
    (await agent.get('/push/preferences').query({ sourceId: harness.sourceA }).expect(200)).body;

  it('defaults to off for a never-configured source', async () => {
    const agent = await harness.loginAs(harness.limited);
    expect((await get(agent)).notifyOnReply).toBe(false);
  });

  it('round-trips through POST and GET', async () => {
    const agent = await harness.loginAs(harness.limited);
    await agent.post('/push/preferences').send({ sourceId: harness.sourceA, notifyOnReply: true }).expect(200);
    expect((await get(agent)).notifyOnReply).toBe(true);
    await agent.post('/push/preferences').send({ sourceId: harness.sourceA, notifyOnReply: false }).expect(200);
    expect((await get(agent)).notifyOnReply).toBe(false);
  });

  it('a save without notifyOnReply (Classic) keeps the stored value', async () => {
    const agent = await harness.loginAs(harness.limited);
    await agent.post('/push/preferences').send({ sourceId: harness.sourceA, notifyOnReply: true }).expect(200);
    await agent.post('/push/preferences').send({
      sourceId: harness.sourceA,
      enableWebPush: false,
      notifyOnMention: true,
    }).expect(200);
    const prefs = await get(agent);
    expect(prefs).toMatchObject({ notifyOnReply: true, enableWebPush: false, notifyOnMention: true });
  });

  it('rejects a non-boolean notifyOnReply', async () => {
    const agent = await harness.loginAs(harness.limited);
    await agent.post('/push/preferences').send({ sourceId: harness.sourceA, notifyOnReply: 'yes' }).expect(400);
  });
});
