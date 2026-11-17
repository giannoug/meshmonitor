/**
 * Renders Server › Devices (Task 6.6) in the shell against the h4 install
 * (`devicesFixtures`); `log` holds the device requests.
 */
import { newServerLog } from '../../__fixtures__/server';
import { devicesFixtures, type DevicesFixtureOptions } from '../../__fixtures__/devices';
import { renderServer, type ServerRenderOptions } from '../../server/__tests__/serverHarness';

export function renderDevices(route = '/server/devices', { outcome, stays, fixtures, ...opts }: ServerRenderOptions & DevicesFixtureOptions = {}) {
  const log = newServerLog();
  const result = renderServer(route, { ...opts, fixtures: { ...devicesFixtures(log, { outcome, stays }), ...fixtures } });
  return { ...result, log };
}

export const statusReads = (log: { reads: string[] }, id: string) => log.reads.filter((r) => r === `/api/sources/${id}/status`).length;
