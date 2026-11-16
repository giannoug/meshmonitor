/**
 * Station G2 as the Identity, Channels and Security boards draw it (Task 5.5):
 * three channels (LongFast on the default key, gauntlet, Athens Ops with a
 * key of its own, uplink and downlink), and the configuration with changes.
 */
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { g2DeviceConfig } from '../../__fixtures__/deviceConfig';
import type { Channel } from '../../../types/device';

const base = athensFixture.poll.channels as Channel[];

export const boardChannels: Channel[] = [
  base[0],
  { ...base[1], psk: 'MTIzNDU2Nzg5MDEyMzQ1Ng==', positionPrecision: 0 },
  { ...base[2], psk: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=', uplinkEnabled: true, downlinkEnabled: true, positionPrecision: 15 },
];

/** The poll with `channels` in place of the fixture's. */
export const pollWith = (channels: Channel[]) => ({
  'GET /api/poll': () => ({ ...athensFixture.poll, channels }),
});

/** Station G2's configuration with `patch` merged into localNodeInfo, security and supportedModules. */
export const g2With = (patch: {
  localNodeInfo?: Record<string, unknown>;
  security?: Record<string, unknown>;
  supportedModules?: Record<string, unknown>;
}) => ({
  'GET /api/config/current': (url: URL) =>
    url.searchParams.get('sourceId') === SOURCE_IDS.g2
      ? {
          ...g2DeviceConfig,
          localNodeInfo: { ...g2DeviceConfig.localNodeInfo, ...patch.localNodeInfo },
          deviceConfig: { ...g2DeviceConfig.deviceConfig, security: { ...g2DeviceConfig.deviceConfig.security, ...patch.security } },
          supportedModules: { ...g2DeviceConfig.supportedModules, ...patch.supportedModules },
        }
      : undefined,
});

export const ADMIN_KEYS = ['cEwybVhjOGs0bDNtMXo5cjdRZTg=', 'SG40MGFWcTJ4M2Y4dmtkMVpzMT0='];

/** Station G2 after the 2.8.2 update (12-04): Protection Level can be set, two admin keys. */
export const g2On282 = g2With({
  localNodeInfo: { firmwareVersion: '2.8.2' },
  security: { adminKey: ADMIN_KEYS, packetSignaturePolicy: 0 },
});
