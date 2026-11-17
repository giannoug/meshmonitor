/**
 * The six source types as the Add device flow and Server › Devices name them
 * (h1, i1), and where a device connects, as one short line.
 */
import type { UiIconName } from '../../components/icons';
import type { SourceType } from './useSourceForm';

export const DEVICE_TYPES: ReadonlyArray<{ type: SourceType; icon: UiIconName; tone: number }> = [
  { type: 'meshtastic_tcp', icon: 'wifi', tone: 1 },
  { type: 'meshcore', icon: 'companion', tone: 2 },
  { type: 'mqtt_broker', icon: 'server', tone: 6 },
  { type: 'mqtt_bridge', icon: 'link', tone: 3 },
  { type: 'meshcore_mqtt', icon: 'network', tone: 5 },
  { type: 'reticulum', icon: 'globe', tone: 4 },
];

export const typeInfo = (type: string) => DEVICE_TYPES.find((d) => d.type === type);

/** The host part of a URL, or the text as given when it does not parse. */
function hostOf(url: unknown): string {
  const text = typeof url === 'string' ? url : '';
  try {
    return new URL(text).host || text;
  } catch {
    return text;
  }
}

/**
 * Where a device connects, from its stored config: `192.168.1.40:4403`,
 * `/dev/ttyACM0`, the broker's host, `port 1883`. Empty when the server
 * withheld it. Only the host of a URL is shown, never its credentials.
 */
export function endpointOf(type: string, config: Record<string, unknown> | undefined, portLabel: (port: string) => string): string {
  const c = (config ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 today's untyped config blob
  const join = (host: unknown, port: unknown) => (host ? (port != null && port !== '' ? `${host}:${port}` : String(host)) : '');
  switch (type) {
    case 'meshtastic_tcp':
      return join(c.host, c.port);
    case 'meshcore':
      return c.transport === 'tcp' ? join(c.tcpHost, c.tcpPort) : String(c.port ?? c.serialPort ?? '');
    case 'meshcore_mqtt':
      return [hostOf(c.brokerUrl), c.region].filter(Boolean).join(' · ');
    case 'mqtt_broker':
      return c.listener?.port != null ? portLabel(String(c.listener.port)) : '';
    case 'mqtt_bridge':
      return hostOf(c.upstream?.url);
    case 'reticulum':
      return c.mode === 'tcp_peer' ? join(c.peers?.[0]?.host, c.peers?.[0]?.port) : String(c.configDir ?? '');
    default:
      return '';
  }
}
