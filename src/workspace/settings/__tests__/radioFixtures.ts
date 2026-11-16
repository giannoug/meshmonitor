/** Station G2's configuration with some LoRa values changed, for the radio save tests. */
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2DeviceConfig } from '../../__fixtures__/deviceConfig';

export const g2deviceConfigWith = (lora: Record<string, unknown>) => ({
  'GET /api/config/current': (url: URL) =>
    url.searchParams.get('sourceId') === SOURCE_IDS.g2
      ? { ...g2DeviceConfig, deviceConfig: { ...g2DeviceConfig.deviceConfig, lora: { ...g2DeviceConfig.deviceConfig.lora, ...lora } } }
      : undefined,
});
