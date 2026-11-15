/**
 * GET /api/unified/packets and /packets/distribution — a reader of one source
 * sees no other source's rows, source entry or counts (#6365 Review Focus 2,
 * Overview › Packets). Real auth middleware and real SQL (createRouteTestApp):
 * the same packet heard by both sources is two rows for an admin, while a
 * reader of source A gets A's row only, and no B in the source list or the
 * By source chart.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import unifiedRoutes from './unifiedRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';
import { PortNum } from '../constants/meshtastic.js';

const SENDER = 0x1000;
const T0 = 1_760_000_000_000;

describe('Unified Packets: per-source read (#6365)', () => {
  let harness: RouteTestHarness;

  const heard = async (sourceId: string, packetId: number, preview: string, timestamp: number) => {
    await harness.db.insertPacketLogAsync({
      packet_id: packetId, timestamp, from_node: SENDER, to_node: 0xffffffff, channel: 0, portnum: PortNum.POSITION_APP,
      portnum_name: 'POSITION_APP', encrypted: false, direction: 'rx', payload_preview: preview, sourceId,
    });
  };

  beforeEach(async () => {
    harness = await createRouteTestApp({
      // unifiedRoutes.ts already applies its own `router.use(optionalAuth())`.
      useOptionalAuth: false,
      mount: (app) => app.use('/api/unified', unifiedRoutes),
    });
    harness.db.setSetting('packet_log_enabled', '1');
    await heard(harness.sourceA, 77, 'heard by both', T0 + 1);
    await heard(harness.sourceB, 77, 'heard by both', T0 + 2);
    await heard(harness.sourceB, 78, 'heard by B only', T0 + 3);
  });

  afterEach(async () => {
    await harness.db.packetLog.clearPacketLogs(harness.sourceA).catch(() => {});
    await harness.db.packetLog.clearPacketLogs(harness.sourceB).catch(() => {});
    await harness.cleanup();
  });

  it('an admin gets one row per receiving source', async () => {
    const res = await (await harness.loginAs(harness.admin)).get('/api/unified/packets');
    expect(res.status).toBe(200);
    const mine = res.body.packets.filter((p: any) => [harness.sourceA, harness.sourceB].includes(p.sourceId));
    expect(mine.map((p: any) => p.payload_preview).sort()).toEqual(['heard by B only', 'heard by both', 'heard by both']);
  });

  it('a reader of A gets no B rows, no B source and no B counts', async () => {
    await harness.grant(harness.limited.id, 'packetmonitor', 'read', harness.sourceA);
    await harness.grant(harness.limited.id, 'channel_0', 'read', harness.sourceA);
    const agent = await harness.loginAs(harness.limited);

    const res = await agent.get('/api/unified/packets');
    expect(res.status).toBe(200);
    expect(res.body.packets.map((p: any) => [p.sourceId, p.payload_preview])).toEqual([[harness.sourceA, 'heard by both']]);
    expect(res.body.sources.map((s: any) => s.id)).toEqual([harness.sourceA]);
    expect(JSON.stringify(res.body)).not.toContain(harness.sourceB);

    const dist = await agent.get('/api/unified/packets/distribution');
    expect(dist.status).toBe(200);
    expect(dist.body.bySource.map((s: any) => s.sourceId)).toEqual([harness.sourceA]);
    expect(JSON.stringify(dist.body)).not.toContain(harness.sourceB);
  });
});
