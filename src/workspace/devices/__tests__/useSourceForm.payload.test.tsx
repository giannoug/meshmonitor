/**
 * @vitest-environment jsdom
 *
 * Task 6.6 (Rule X): `useSourceForm` holds DashboardPage's source form. For
 * each of the six source types, the body the hook sends equals the body
 * today's DashboardPage sends for the same inputs. The expected bodies below
 * were captured from DashboardPage before the extraction, so the check still
 * means something now that the page sends through the hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../../../pages/DashboardPage';
import { useSourceForm, type SourceFormValues } from '../useSourceForm';

const BROKER = { id: 'src-brk', name: 'Athens MQTT', type: 'mqtt_broker', enabled: true, config: { listener: { port: 1883 } } };
const SOURCES = [BROKER];

vi.mock('../../../hooks/useDashboardData', () => ({
  useDashboardSources: vi.fn(() => ({ data: SOURCES, isSuccess: true, isLoading: false })),
  useSourceStatuses: vi.fn(() => new Map()),
  useDashboardSourceData: vi.fn(() => ({ nodes: [], traceroutes: [], neighborInfo: [], channels: [], status: null, isLoading: false, isError: false })),
  useDashboardUnifiedData: vi.fn(() => ({ nodes: [], traceroutes: [], neighborInfo: [], channels: [], status: null, isLoading: false, isError: false })),
  useUnifiedStatus: vi.fn(() => ({ nodeCount: 0, connected: false })),
  UNIFIED_SOURCE_ID: '__unified__',
}));
vi.mock('../../../hooks/useMapAnalysisData', () => ({
  useMeshCoreNeighbors: vi.fn(() => ({ data: { items: [] }, isLoading: false, isError: false })),
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    authStatus: { authenticated: true, user: { id: 1, username: 'admin', isAdmin: true }, permissions: {} },
    loading: false,
    hasPermission: vi.fn(() => true),
  })),
}));
vi.mock('../../../contexts/CsrfContext', () => ({
  useCsrf: vi.fn(() => ({ csrfToken: 'test-token', isLoading: false, refreshToken: vi.fn(), getToken: vi.fn(() => 'test-token') })),
}));
vi.mock('../../../contexts/SettingsContext', () => ({
  useNodeListStyle: () => 'monochrome',
  SettingsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSettings: vi.fn(() => ({ mapTileset: 'openstreetmap', customTilesets: [], defaultMapCenterLat: 30, defaultMapCenterLon: -90, defaultLandingPage: 'unified' })),
}));
vi.mock('../../../components/Dashboard/DashboardSidebar', () => ({
  default: ({ onAddSource }: { onAddSource: () => void }) => (
    <button type="button" onClick={onAddSource}>
      source.add_short
    </button>
  ),
}));
vi.mock('../../../components/Dashboard/DashboardMap', () => ({ default: () => null }));
vi.mock('../../../components/LoginModal', () => ({ default: () => null }));
vi.mock('../../../components/MQTT/MqttRootFinder', () => ({ MqttRootFinder: () => null }));
vi.mock('../../../init', () => ({ appBasename: '' }));

interface Case {
  type: SourceFormValues['formType'];
  /** Drive today's modal (after Add and the type pick). */
  ui(): void;
  /** The same inputs as form values. */
  values: Partial<SourceFormValues>;
  expected: Record<string, unknown>;
}

/** The control inside the form label whose text is `label` (the page's mocked t() returns keys). */
function field(label: string): HTMLElement {
  const span = screen.getAllByText(label).find((el) => el.closest('label'));
  const control = span?.closest('label')?.querySelector('input, select, textarea');
  if (!control) throw new Error(`no field ${label}`);
  return control as HTMLElement;
}
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }));

const CASES: Case[] = [
  {
    type: 'meshtastic_tcp',
    ui() {
      type('source.form.name', '  Station G2 ');
      type('source.form.host', ' 192.168.1.40 ');
      type('source.form.tcp_port', '4404');
      type('source.form.heartbeat', '60');
      tick('source.form.auto_connect');
      tick('source.form.passive_mode');
      type('source.form.passive_resync_stale_hours', '6');
      tick('source.form.enable_virtual_node');
      type('source.form.virtual_node_port', '4410');
      tick('source.form.allow_admin_commands');
      fireEvent.change(screen.getByDisplayValue('source.form.mqtt_proxy_none'), { target: { value: 'src-brk' } });
    },
    values: {
      formName: '  Station G2 ', formHost: ' 192.168.1.40 ', formPort: '4404', formHeartbeat: '60', formAutoConnect: false,
      formPassiveMode: true, formPassiveResyncStaleHours: '6', formVnEnabled: true, formVnPort: '4410', formVnAllowAdmin: true,
      formMtMqttLinkBrokerId: 'src-brk',
    },
    expected: {
      name: 'Station G2',
      type: 'meshtastic_tcp',
      enabled: true,
      config: {
        host: '192.168.1.40',
        port: 4404,
        heartbeatIntervalSeconds: 60,
        virtualNode: { enabled: true, port: 4410, allowAdminCommands: true },
        autoConnect: false,
        passiveMode: true,
        passiveResyncStaleMs: 21_600_000,
        mqttLink: { enabled: true, mqttBrokerSourceId: 'src-brk' },
      },
    },
  },
  {
    type: 'meshcore',
    ui() {
      type('source.form.name', 'Heltec MeshCore');
      type('meshcore.form.transport', 'tcp');
      type('source.form.host', '10.0.0.5');
      type('meshcore.form.device_type', 'repeater');
    },
    values: { formName: 'Heltec MeshCore', formMcTransport: 'tcp', formMcTcpHost: '10.0.0.5', formMcDeviceType: 'repeater', formHeartbeat: '0' },
    expected: {
      name: 'Heltec MeshCore',
      type: 'meshcore',
      enabled: true,
      config: { transport: 'tcp', tcpHost: '10.0.0.5', tcpPort: 5000, deviceType: 'repeater', autoConnect: true },
    },
  },
  {
    type: 'meshcore_mqtt',
    ui() {
      type('source.form.name', 'Region Feed');
      type('source.form.mc_mqtt_broker_url', ' wss://mqtt.meshmapper.net:443 ');
      type('source.form.mc_mqtt_region', 'mco');
      type('source.form.mc_mqtt_username', ' feeder ');
      type('source.form.mc_mqtt_password', 'pw1');
      tick('source.form.mc_mqtt_reject_unauthorized');
    },
    values: {
      formName: 'Region Feed', formMcMqttBrokerUrl: ' wss://mqtt.meshmapper.net:443 ', formMcMqttRegion: 'mco',
      formMcMqttUsername: ' feeder ', formMcMqttPassword: 'pw1', formMcMqttRejectUnauthorized: false,
    },
    expected: {
      name: 'Region Feed',
      type: 'meshcore_mqtt',
      enabled: true,
      config: { brokerUrl: 'wss://mqtt.meshmapper.net:443', region: 'MCO', rejectUnauthorized: false, autoConnect: true, username: 'feeder', password: 'pw1' },
    },
  },
  {
    type: 'mqtt_broker',
    ui() {
      type('source.form.name', 'Athens MQTT 2');
      type('source.form.mqtt_listen_port', '1884');
      type('source.form.mqtt_username', ' mesh ');
      type('source.form.mqtt_password', 'secret');
      type('source.form.mqtt_root_topic', ' msh/GR ');
    },
    values: { formName: 'Athens MQTT 2', formMqttListenPort: '1884', formMqttUsername: ' mesh ', formMqttPassword: 'secret', formMqttRootTopic: ' msh/GR ' },
    expected: {
      name: 'Athens MQTT 2',
      type: 'mqtt_broker',
      enabled: true,
      config: {
        listener: { port: 1884, host: '0.0.0.0' },
        auth: { username: 'mesh', password: 'secret' },
        gateway: { nodeNum: 3221225471, nodeId: '!bfffffff', longName: 'Athens MQTT 2', shortName: 'Athe' },
        rootTopic: 'msh/GR',
      },
    },
  },
  {
    type: 'mqtt_bridge',
    ui() {
      type('source.form.name', 'Old bridge');
      type('source.form.mqtt_upstream_url', 'mqtt://mqtt.meshtastic.org:1883');
      type('source.form.mqtt_username', 'meshdev');
      type('source.form.mqtt_password', 'large4cats');
      type('source.form.mqtt_subscriptions', 'msh/EU_868/#');
    },
    values: {
      formName: 'Old bridge', formMqttBridgeUrl: 'mqtt://mqtt.meshtastic.org:1883', formMqttBridgeUsername: 'meshdev',
      formMqttBridgePassword: 'large4cats', formMqttBridgeSubscriptions: 'msh/EU_868/#',
    },
    expected: {
      name: 'Old bridge',
      type: 'mqtt_bridge',
      enabled: true,
      config: { upstream: { url: 'mqtt://mqtt.meshtastic.org:1883', username: 'meshdev', password: 'large4cats' }, subscriptions: ['msh/EU_868/#'] },
    },
  },
  {
    type: 'reticulum',
    ui() {
      type('source.form.name', 'Reticulum node');
      type('reticulum.form.mode', 'tcp_peer');
      type('source.form.host', 'amsterdam.connect.reticulum.network');
      type('source.form.tcp_port', '4242');
      type('reticulum.form.token', ' tok ');
    },
    values: { formName: 'Reticulum node', formRnsMode: 'tcp_peer', formRnsPeerHost: 'amsterdam.connect.reticulum.network', formRnsPeerPort: '4242', formRnsToken: ' tok ' },
    expected: {
      name: 'Reticulum node',
      type: 'reticulum',
      enabled: true,
      config: { mode: 'tcp_peer', autoConnect: true, token: 'tok', peers: [{ host: 'amsterdam.connect.reticulum.network', port: 4242 }] },
    },
  },
];

function okFetch() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ id: 'new', name: 'x', type: 'x', enabled: true }),
    text: async () => JSON.stringify({ id: 'new', name: 'x', type: 'x', enabled: true }),
  }) as unknown as typeof fetch;
}

function postedBody(): Record<string, unknown> | undefined {
  const call = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).endsWith('/api/sources') && init?.method === 'POST');
  return call ? JSON.parse(String(call[1]!.body)) : undefined;
}

async function dashboardBody(c: Case) {
  okFetch();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'source.add_short' }));
  fireEvent.change(screen.getByLabelText('source.form.type'), { target: { value: c.type } });
  c.ui();
  fireEvent.click(screen.getByRole('button', { name: /^common\.save$/ }));
  await waitFor(() => expect(postedBody()).toBeTruthy());
  const body = postedBody()!;
  view.unmount();
  return body;
}

async function hookBody(c: Case) {
  okFetch();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useSourceForm(SOURCES), { wrapper });
  act(() => {
    result.current.startAdd();
    result.current.set('formType', c.type);
    for (const [k, v] of Object.entries(c.values)) result.current.set(k as keyof SourceFormValues, v as never);
  });
  expect(result.current.validate()).toBeNull();
  let saved: unknown;
  await act(async () => {
    saved = await result.current.submit();
  });
  expect(saved).toMatchObject({ id: 'new' });
  return postedBody()!;
}

describe('useSourceForm payloads equal DashboardPage payloads', () => {
  beforeEach(() => {
    // The broker's synthetic gateway number is random; fix it for both runs.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(CASES.map((c) => [c.type, c] as const))('%s', async (_t, c) => {
    const page = await dashboardBody(c);
    expect(page).toEqual(c.expected);
    expect(await hookBody(c)).toEqual(page);
  });

  it('validate() names the first missing field, as today, and submit() sends nothing', async () => {
    okFetch();
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSourceForm(SOURCES), { wrapper });
    act(() => result.current.startAdd());
    expect(result.current.validate()).toBe('source.form.error_name_required');
    expect(result.current.validate({ connectionOnly: true })).toBe('source.form.error_host_required');
    act(() => result.current.set('formHost', '1.2.3.4'));
    expect(result.current.validate({ connectionOnly: true })).toBeNull();
    let saved: unknown = 'x';
    await act(async () => {
      saved = await result.current.submit();
    });
    expect(saved).toBeNull();
    expect(result.current.formError).toBe('source.form.error_name_required');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
