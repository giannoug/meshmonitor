/** Task 6.6: a device's endpoint line never carries a URL's credentials. */
import { describe, it, expect } from 'vitest';
import { endpointOf, hostOf } from '../deviceInfo';

const port = (p: string) => `port ${p}`;

describe('hostOf / endpointOf', () => {
  it.each([
    ['mqtt://meshdev:large4cats@mqtt.meshtastic.org:1883', 'mqtt.meshtastic.org:1883'],
    ['meshdev:large4cats@broker.example:1883', 'broker.example:1883'],
    ['wss://u:p@mqtt.meshmapper.net:8443/mqtt?token=x', 'mqtt.meshmapper.net:8443'],
    ['broker.example:1883', 'broker.example:1883'],
    ['', ''],
  ])('%s → %s', (url, host) => {
    expect(hostOf(url)).toBe(host);
  });

  it('a bridge or MeshCore MQTT feed with credentials in its URL shows neither the user nor the password', () => {
    const bridge = endpointOf('mqtt_bridge', { upstream: { url: 'meshdev:large4cats@mqtt.meshtastic.org:1883' } }, port);
    const feed = endpointOf('meshcore_mqtt', { brokerUrl: 'mqtts://feeder:s3cret@broker.example:8883', region: 'MCO' }, port);
    for (const line of [bridge, feed]) {
      expect(line).not.toMatch(/meshdev|large4cats|feeder|s3cret/);
    }
    expect(bridge).toBe('mqtt.meshtastic.org:1883');
    expect(feed).toBe('broker.example:8883 · MCO');
  });
});
