/**
 * The six source types as the Add device flow and Server › Devices name them
 * (h1, i1), and where a device connects, as one short line.
 */
import type { UiIconName } from '../../components/icons';
import type { DashboardSource, SourceStatus } from '../../hooks/useDashboardData';
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

/**
 * The host (and port) of a URL. Never its credentials: a value that does not
 * parse as a URL with a host (`user:pw@broker:1883`, `host:port`) keeps only
 * what follows its last `@`.
 */
export function hostOf(url: unknown): string {
  const text = typeof url === 'string' ? url : '';
  try {
    const host = new URL(text).host;
    if (host) return host;
  } catch {
    // Not a URL: fall through.
  }
  return text.slice(text.lastIndexOf('@') + 1);
}

/**
 * Where a device connects, from its stored config: `192.168.1.40:4403`,
 * `/dev/ttyACM0`, the broker's host, `port 1883`. Empty when the server
 * withheld it. A URL shows only its host and port (`hostOf`).
 */
interface EndpointConfig {
  host?: unknown;
  port?: unknown;
  transport?: unknown;
  tcpHost?: unknown;
  tcpPort?: unknown;
  serialPort?: unknown;
  brokerUrl?: unknown;
  region?: unknown;
  listener?: { port?: unknown };
  upstream?: { url?: unknown };
  mode?: unknown;
  peers?: Array<{ host?: unknown; port?: unknown }>;
  configDir?: unknown;
}

export function endpointOf(type: string, config: Record<string, unknown> | undefined, portLabel: (port: string) => string): string {
  const c: EndpointConfig = config ?? {};
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

/**
 * Today's Connect / Disconnect on a source card (DashboardSidebar, admins),
 * for this source now: Connect for a manual source, or one that stopped after
 * rejected logins or evictions; Retry when only gateways stopped; Disconnect
 * for a connected manual source. Shared by Server › Devices and the Connection card.
 */
export function sourceControls(s: DashboardSource, status: SourceStatus | null | undefined) {
  const autoConnectOff = (s.config as { autoConnect?: unknown } | undefined)?.autoConnect === false;
  const connected = status?.connected === true;
  return {
    canConnect:
      s.enabled &&
      (((autoConnectOff || status?.authStopped === true || status?.evictionStopped === true) && !connected) ||
        (status?.authStoppedGatewayCount ?? 0) > 0 ||
        (status?.evictionStoppedGatewayCount ?? 0) > 0),
    gatewaysOnly: connected,
    canDisconnect: autoConnectOff && connected,
  };
}
