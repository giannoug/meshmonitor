/**
 * Task 5.9: Station G2's mesh with the remote nodes the boards draw (Hilltop
 * Relay three hops out, Psychiko Base), and today's admin routes answering for
 * Hilltop Relay. Shared by the board tests and the Playwright boards.
 */
import { athensFixture } from '../../__fixtures__/athens';
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';

export const HILLTOP = 0x7c3e10a2;
export const PSYCHIKO = 0x5d21aa07;
export const NODE = '!7c3e10a2';

const node = (num: number, longName: string, shortName: string, hopsAway: number, hasRemoteAdmin = false) => ({
  nodeNum: num,
  user: { id: `!${num.toString(16).padStart(8, '0')}`, longName, shortName, hwModel: 9, role: '2' },
  lastHeard: Math.floor(Date.now() / 1000) - 300,
  hopsAway,
  hasRemoteAdmin,
});

/** What Hilltop Relay answers to each load-config. */
export const HILLTOP_CONFIG: Record<string, unknown> = {
  position: { positionBroadcastSecs: 1800, positionBroadcastSmartEnabled: true, fixedPosition: false, gpsMode: 2, positionFlags: 3 },
  lora: { usePreset: true, modemPreset: 0, region: 3, hopLimit: 3, txPower: 20 },
  device: { role: 2, nodeInfoBroadcastSecs: 10800 },
  security: { adminKeys: ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='], isManaged: false, serialEnabled: true, packetSignaturePolicy: 0 },
};

export const remoteFixtures = (extra: Record<string, FixtureHandler> = {}): Record<string, FixtureHandler> => ({
  'GET /api/poll': () => ({
    ...athensFixture.poll,
    nodes: [...(athensFixture.poll.nodes ?? []), node(HILLTOP, 'Hilltop Relay', 'HTR', 3, true), node(PSYCHIKO, 'Psychiko Base', 'PSY', 2)],
  }),
  'POST /api/admin/session-passkey-status': () => ({ success: true, isLocalNode: false, hasPasskey: true, remainingSeconds: 212 }),
  'POST /api/admin/ensure-session-passkey': () => ({ success: true, hasPasskey: true, remainingSeconds: 212 }),
  'POST /api/admin/load-config': (_url, init) => {
    const { configType } = JSON.parse(String(init?.body)) as { configType: string };
    return HILLTOP_CONFIG[configType] ? { config: HILLTOP_CONFIG[configType] } : { config: {} };
  },
  'POST /api/admin/load-owner': () => ({ owner: { longName: 'Hilltop Relay', shortName: 'HTR', isUnmessagable: false, isLicensed: false } }),
  'POST /api/admin/get-channel': (_url, init) => {
    const { channelIndex } = JSON.parse(String(init?.body)) as { channelIndex: number };
    return {
      channel:
        channelIndex === 0
          ? { name: 'LongFast', psk: 'AQ==', role: 1, uplinkEnabled: true, downlinkEnabled: false, positionPrecision: 13 }
          : { name: '', psk: '', role: 0 },
    };
  },
  'POST /api/admin/commands': () => ({ success: true, message: 'Command sent' }),
  'POST /api/admin/get-device-metadata': () => ({
    deviceMetadata: {
      firmwareVersion: '2.7.15', deviceStateVersion: 23, canShutdown: true, hasWifi: false, hasBluetooth: true, hasEthernet: false,
      role: 2, positionFlags: 3, hwModel: 9, hasRemoteHardware: false,
    },
  }),
  'POST /api/admin/set-time': () => ({ success: true }),
  'GET /api/admin/auto-favorite-targets/:nodeNum': () => ({
    configured: true, enabled: true, useNeighborInfo: true, useTraceroutes: true, intervalHours: 24, maxNeighborAgeHours: 24,
    maxNewPerCycle: 1, maxRefavoritePerCycle: 1, eligibleRoles: [2, 11], lastRunAt: null, lastNeighborRequestAt: null, assignments: [],
  }),
  'POST /api/sources/:id/meshtastic/admin/cli': () => ({
    success: true,
    data: { output: 'Set device.role to ROUTER', stdout: '', stderr: '', exitCode: 0, elapsedMs: 900 },
  }),
  ...extra,
});

