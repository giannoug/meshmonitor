/**
 * GET /api/unified/messages and /channels — a reader of one source sees no
 * other source's rows or receptions (#6365 Review Focus 2, Overview ›
 * Messages). Real auth middleware and real SQL (createRouteTestApp): one
 * packet heard by both sources merges into one entry for an admin, while a
 * reader of source A gets that entry with A's reception only, and nothing
 * heard only by B.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import unifiedRoutes from './unifiedRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';

const SENDER = 0x1000;
const BROADCAST = 0xffffffff;
const T0 = 1_760_000_000_000;

describe('Unified Messages: per-source read (#6365)', () => {
  let harness: RouteTestHarness;

  const heard = async (sourceId: string, packet: number, text: string, createdAt: number) => {
    await harness.db.messages.insertMessage(
      {
        id: `${sourceId}_${SENDER}_${packet}`,
        fromNodeNum: SENDER,
        toNodeNum: BROADCAST,
        fromNodeId: '!00001000',
        toNodeId: '!ffffffff',
        text,
        channel: 0,
        portnum: 1,
        timestamp: createdAt,
        rxTime: createdAt,
        createdAt,
      },
      sourceId,
    );
  };

  beforeEach(async () => {
    harness = await createRouteTestApp({
      // unifiedRoutes.ts already applies its own `router.use(optionalAuth())`.
      useOptionalAuth: false,
      mount: (app) => app.use('/api/unified', unifiedRoutes),
    });
    await harness.db.messages.deleteAllMessages(harness.sourceA);
    await harness.db.messages.deleteAllMessages(harness.sourceB);
    for (const sourceId of [harness.sourceA, harness.sourceB]) {
      await harness.db.channels.upsertChannel({ id: 0, name: 'LongFast', role: 1 }, sourceId);
    }
    await heard(harness.sourceA, 77, 'heard by both', T0 + 1);
    await heard(harness.sourceB, 77, 'heard by both', T0 + 2);
    await heard(harness.sourceB, 78, 'heard by B only', T0 + 3);
  });

  afterEach(async () => {
    await harness.db.messages.deleteAllMessages(harness.sourceA).catch(() => {});
    await harness.db.messages.deleteAllMessages(harness.sourceB).catch(() => {});
    await harness.cleanup();
  });

  it('an admin gets one entry for the shared packet, with both receptions', async () => {
    const res = await (await harness.loginAs(harness.admin)).get('/api/unified/messages?channel=LongFast');
    expect(res.status).toBe(200);
    const both = res.body.find((m: any) => m.text === 'heard by both');
    expect(both.receptions.map((r: any) => r.sourceId).sort()).toEqual([harness.sourceA, harness.sourceB].sort());
  });

  it('a reader of A gets no B rows, no B receptions, and no B channel source', async () => {
    await harness.grant(harness.limited.id, 'messages', 'read', harness.sourceA);
    const agent = await harness.loginAs(harness.limited);

    const res = await agent.get('/api/unified/messages?channel=LongFast');
    expect(res.status).toBe(200);
    expect(res.body.map((m: any) => m.text)).toEqual(['heard by both']);
    expect(res.body[0].receptions.map((r: any) => r.sourceId)).toEqual([harness.sourceA]);
    expect(JSON.stringify(res.body)).not.toContain(harness.sourceB);

    const channels = await agent.get('/api/unified/channels');
    expect(channels.status).toBe(200);
    const ids = channels.body.flatMap((c: any) => c.sources.map((s: any) => s.sourceId));
    expect(ids).toContain(harness.sourceA);
    expect(ids).not.toContain(harness.sourceB);
  });
});
