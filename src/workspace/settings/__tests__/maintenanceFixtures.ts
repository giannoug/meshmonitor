/**
 * Station G2's Maintenance as boards 12-08 … 12-28 draw it (Task 5.7): three
 * automatic backups, the restore summary of g2-1111.yaml, the stable releases
 * (2.8.2 latest) with OTA on, and a reload that finds three changes.
 */
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { g2DeviceConfig } from '../../__fixtures__/deviceConfig';
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';

const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T03:00:00Z`;

export const backupList = [12, 11, 10].map((d) => ({
  filename: `g2-11${d}.yaml`,
  timestamp: day(d),
  size: 6144,
  type: 'automatic' as const,
}));

export const backupFixtures: Record<string, FixtureHandler> = {
  'GET /api/backup/settings': () => ({
    enabled: true,
    maxBackups: 7,
    backupTime: '03:00',
    lastAutomaticBackupAt: day(12),
    lastAutomaticBackupError: null,
  }),
  'GET /api/backup/list': () => backupList,
  'GET /api/backup/summary/:file': () => ({
    data: {
      protocol: 'meshtastic',
      channels: [
        { idx: 0, name: 'LongFast' },
        { idx: 1, name: 'gauntlet' },
        { idx: 2, name: 'Athens Ops' },
      ],
      sections: ['config.lora', 'config.device'],
      requiresReboot: true,
      legacy: false,
    },
  }),
};

export const firmwareFixtures: Record<string, FixtureHandler> = {
  'GET /api/health': () => ({ status: 'ok', version: 'fixture', firmwareOtaEnabled: true }),
  'GET /api/firmware/releases': () => ({
    success: true,
    channel: 'stable',
    releases: [
      { tagName: 'v2.8.2', version: '2.8.2', prerelease: false, publishedAt: '2026-11-06T00:00:00Z', htmlUrl: 'https://github.com/meshtastic/firmware/releases/tag/v2.8.2', assets: [] },
      { tagName: 'v2.7.17', version: '2.7.17', prerelease: false, publishedAt: '2026-10-14T00:00:00Z', htmlUrl: 'https://github.com/meshtastic/firmware/releases/tag/v2.7.17', assets: [] },
    ],
  }),
  'GET /api/firmware/status': () => ({
    success: true,
    status: { state: 'idle', step: null, message: '', logs: [] },
    channel: 'stable',
    customUrl: null,
    lastChecked: Date.parse('2026-11-16T08:00:00Z'),
    stagedUpload: null,
  }),
  'GET /api/firmware/backups': () => ({ success: true, backups: [] }),
};

/** The OTA wizard stopped part-way through the flash (12-09's sheet). */
export const flashFailed: Record<string, FixtureHandler> = {
  'GET /api/firmware/status': () => ({
    success: true,
    status: {
      state: 'error',
      step: 'flash',
      message: 'Flash failed',
      progress: 62,
      logs: ['Flashing… 62 %', 'connection lost'],
      targetVersion: '2.8.2',
      error: 'connection lost',
      sourceId: SOURCE_IDS.g2,
    },
    channel: 'stable',
    customUrl: null,
    lastChecked: Date.parse('2026-11-16T08:00:00Z'),
    stagedUpload: null,
  }),
};

/** The wizard holding at the flash step for Confirm & Proceed (s12n4), with Cancel Update. */
export const flashAwaiting: Record<string, FixtureHandler> = {
  'GET /api/firmware/status': () => ({
    success: true,
    status: {
      state: 'awaiting-confirm',
      step: 'flash',
      message: 'Ready to flash',
      logs: [],
      targetVersion: '2.8.2',
      matchedFile: 'firmware-heltec-v3-2.8.2.bin',
      sourceId: SOURCE_IDS.g2,
    },
    channel: 'stable',
    customUrl: null,
    lastChecked: Date.parse('2026-11-16T08:00:00Z'),
    stagedUpload: null,
  }),
};

/** Station G2 reported as a RAK4631 (nRF52): the board MeshMonitor cannot flash (12-09's lower card). */
export const rakGateway: Record<string, FixtureHandler> = {
  'GET /api/poll': () => ({
    ...athensFixture.poll,
    nodes: (athensFixture.poll.nodes ?? []).map((n) =>
      n.user?.id === '!a1b2c300' ? { ...n, user: { ...n.user, hwModel: 9 } } : n,
    ),
  }),
};

/** `/api/config/current` before and after the reload: hop limit, role and TX power changed on the node. */
export function reloadFixtures(): Record<string, FixtureHandler> {
  let refreshed = false;
  const changed = {
    ...g2DeviceConfig,
    deviceConfig: {
      ...g2DeviceConfig.deviceConfig,
      device: { ...g2DeviceConfig.deviceConfig.device, role: 1 },
      lora: { ...g2DeviceConfig.deviceConfig.lora, hopLimit: 4, txPower: 20 },
    },
  };
  return {
    'POST /api/nodes/refresh': () => {
      refreshed = true;
      return { success: true, nodeCount: 47, channelCount: 3 };
    },
    'GET /api/config/current': (url) =>
      url.searchParams.get('sourceId') === SOURCE_IDS.g2 ? (refreshed ? changed : g2DeviceConfig) : undefined,
  };
}

export const maintenanceFixtures: Record<string, FixtureHandler> = { ...backupFixtures, ...firmwareFixtures };
