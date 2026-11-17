/**
 * Server › Devices and Add device (Task 6.6, boards h1–h4, i1–i3, 18-09/18-10):
 * the Athens install as h4 draws it (two disabled devices after the five
 * enabled ones; Station G2 is the default Meshtastic source), and the source
 * routes the flow and the page call. Writes stick, as on the server: a saved
 * device shows in the list. `outcome` is what the new device's status says.
 */
import type { DashboardSource, SourceStatus } from '../../hooks/useDashboardData';
import { athensFixture as A, SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';
import type { ServerLog } from './server';

export const NEW_ID = 'src-new';

const BOARD_CONFIG: Record<string, Record<string, unknown>> = {
  [SOURCE_IDS.heltec]: { transport: 'usb', port: '/dev/ttyACM0', deviceType: 'companion', autoConnect: true },
  [SOURCE_IDS.rns]: { mode: 'attach', configDir: '/rns', autoConnect: true },
  [SOURCE_IDS.mqtt]: { listener: { port: 1883, host: '0.0.0.0' }, auth: { username: 'mesh' }, rootTopic: 'msh' },
};

export function deviceList(): DashboardSource[] {
  return [
    ...A.sources.map((s) => ({ ...s, config: BOARD_CONFIG[s.id] ?? s.config })),
    { id: 'src-tbeam', name: 'Test bench T-Beam', type: 'meshtastic_tcp', enabled: false, config: { host: '10.0.0.12', port: 4403 } },
    {
      id: 'src-oldbridge',
      name: 'Old bridge',
      type: 'mqtt_bridge',
      enabled: false,
      config: {
        upstream: { url: 'mqtt://mqtt.meshtastic.org:1883', username: 'meshdev' },
        subscriptions: ['msh/EU_868/#'],
        downlinkFilters: { geo: { minLat: 37.8, maxLat: 38.2, minLng: 23.5, maxLng: 24 } },
      },
      maskedConfigFields: ['upstream.password'],
    },
  ];
}

export interface DevicesFixtureOptions {
  /** The new device's status: connected (h3), or not (i3; Try again connects it unless `stays`). */
  outcome?: 'connected' | 'failed';
  /** With outcome 'failed': Try again does not connect it either. */
  stays?: boolean;
}

export function devicesFixtures(log: ServerLog, { outcome = 'connected', stays = false }: DevicesFixtureOptions = {}): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
  let list = deviceList();
  let connected = outcome === 'connected';
  const write = (reply: (u: URL, b: any) => unknown = () => ({ success: true })): FixtureHandler => (u, init) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 a fixture's JSON body
    const b = body(init);
    log.writes.push({ method: init?.method ?? 'GET', path: u.pathname, body: b });
    return reply(u, b);
  };
  const idOf = (u: URL) => u.pathname.split('/')[3];
  return {
    'GET /api/sources': (u) => {
      log.reads.push(u.pathname);
      return list;
    },
    'POST /api/sources': write((_u, b) => {
      const created = { id: NEW_ID, ...b };
      list = [...list, created];
      return created;
    }),
    'POST /api/sources/reorder': write((_u, b) => {
      const order: string[] = b.order;
      list = order.map((id) => list.find((s) => s.id === id)!).filter(Boolean);
      return { success: true };
    }),
    'PUT /api/sources/:id': write((u, b) => {
      const id = idOf(u);
      list = list.map((s) => (s.id === id ? { ...s, ...b, config: b.config ?? s.config } : s));
      return list.find((s) => s.id === id);
    }),
    'DELETE /api/sources/:id': write((u) => {
      list = list.filter((s) => s.id !== idOf(u));
      return { success: true };
    }),
    'POST /api/sources/:id/connect': write(() => {
      if (!stays) connected = true;
      return { success: true };
    }),
    'POST /api/sources/:id/disconnect': write(),
    'POST /api/sources/:id/resync': write(() => ({ started: true, inFlight: true, cooldownExpiresAt: 0 })),
    'POST /api/sources/:id/prune-outside-roi': write(() => ({ count: 4 })),
    'GET /api/sources/:id/status': (u): SourceStatus => {
      const id = idOf(u);
      log.reads.push(u.pathname);
      if (id === NEW_ID) {
        return connected
          ? { sourceId: id, connected: true, nodeNum: 0xa1b2c3d4, nodeId: '!a1b2c3d4', nodeCount: 31, activeNodeCount: 5 }
          : { sourceId: id, connected: false, nodeCount: 0, activeNodeCount: 0 };
      }
      return A.statuses[id] ?? { sourceId: id, connected: false, nodeCount: 0, activeNodeCount: 0 };
    },
    'GET /api/sources/:id/channels': (u) => {
      log.reads.push(u.pathname);
      return A.channels;
    },
  };
}
