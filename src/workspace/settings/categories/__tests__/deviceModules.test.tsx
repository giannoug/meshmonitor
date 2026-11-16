/**
 * @vitest-environment jsdom
 *
 * Task 5.6: Device's categories and each module on the row kit. Table-driven
 * from today's sections: every field each Classic section draws (its label
 * key, from its component file) is a row with today's label, and a change
 * queues that category's ConfigSaveSection in the radio save bar. The device
 * is set up with every module supported and on, so every conditional row shows.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../../__fixtures__/athens';
import { g2DeviceConfig } from '../../../__fixtures__/deviceConfig';
import type { ConfigSaveSection } from '../../../../hooks/deviceConfig/useDeviceConfigSaves';
import { CATEGORIES, categoryById } from '../../categories';
import { g2, renderSettings } from '../../__tests__/renderSettings';

vi.mock('../../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../../App', async () => ({ default: (await import('../../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const en = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../../public/locales/en.json'), 'utf8')) as Record<string, string>;
/** A label key in English; a pair is a key en.json lacks, with today's inline default. */
type L = string | [string, string];
const english = (l: L) => (typeof l === 'string' ? en[l] ?? l : en[l[0]] ?? l[1]);

/** Station G2 with every module supported and switched on, Wi-Fi on a static address. */
const all = (patch: { supportedModules?: Record<string, unknown>; moduleConfig?: Record<string, unknown> } = {}) => ({
  'GET /api/config/current': (url: URL) =>
    url.searchParams.get('sourceId') === SOURCE_IDS.g2
      ? {
          ...g2DeviceConfig,
          deviceConfig: { ...g2DeviceConfig.deviceConfig, network: { ...g2DeviceConfig.deviceConfig.network, addressMode: 1 } },
          moduleConfig: {
            ...g2DeviceConfig.moduleConfig,
            telemetry: { deviceTelemetryEnabled: true, deviceUpdateInterval: 1800, healthMeasurementEnabled: true },
            rangeTest: { enabled: true },
            cannedMessage: { enabled: true },
            audio: { codec2Enabled: true },
            remoteHardware: { enabled: true },
            detectionSensor: { enabled: true },
            paxcounter: { enabled: true },
            serial: { enabled: true },
            ambientLighting: { ledState: true },
            meshBeacon: { flags: 2, broadcastMessage: '', broadcastIntervalSecs: 3600 },
            statusmessage: { nodeStatus: 'Up' },
            trafficManagement: {},
            tak: { team: 0, role: 0 },
            ...patch.moduleConfig,
          },
          supportedModules: {
            ...g2DeviceConfig.supportedModules,
            audio: true, paxcounter: true, tak: true, takConfig: true,
            ...patch.supportedModules,
          },
        }
      : undefined,
});

interface Case {
  path: string;
  section: ConfigSaveSection;
  /** Every field of today's section, by its label key. */
  labels: L[];
  /** One edit: a switch to flip, or a field and the value to type or pick. */
  change: { label: L; value?: string };
}

const p = (prefix: string, keys: string[]) => keys.map((k) => `${prefix}.${k}`);
const mb = (k: string, d: string): L => [`meshbeacon_config.${k}`, d];

const CASES: Case[] = [
  {
    path: 'device/device', section: 'device',
    labels: p('device_config', ['device_role', 'node_info_broadcast', 'timezone', 'rebroadcast_mode', 'buzzer_mode', 'double_tap_as_button', 'disable_triple_click', 'led_heartbeat_disabled', 'button_gpio', 'buzzer_gpio']),
    change: { label: 'device_config.rebroadcast_mode', value: '2' },
  },
  {
    path: 'device/position', section: 'position',
    labels: [
      ...p('position_config', ['broadcast_interval', 'smart_broadcast', 'fixed_position', 'latitude', 'longitude', 'altitude', 'gps_mode', 'gps_update_interval', 'smart_min_distance', 'smart_min_interval', 'rx_gpio', 'tx_gpio', 'gps_en_gpio']),
      'ALTITUDE', 'ALTITUDE_MSL', 'GEOIDAL_SEPARATION', 'DOP', 'HVDOP', 'SATINVIEW', 'SEQ_NO', 'TIMESTAMP', 'HEADING', 'SPEED',
    ],
    change: { label: 'position_config.gps_update_interval', value: '60' },
  },
  {
    path: 'device/power', section: 'power',
    labels: p('power_config', ['power_saving', 'shutdown_on_battery', 'adc_multiplier', 'bluetooth_wait', 'super_deep_sleep', 'light_sleep', 'min_wake', 'ina_address']),
    change: { label: 'power_config.power_saving' },
  },
  {
    path: 'device/display', section: 'display',
    labels: p('display_config', ['screen_on_secs', 'auto_carousel', 'flip_screen', 'units', 'display_mode', 'heading_bold', 'wake_on_tap', 'oled_type', 'compass_orientation']),
    change: { label: 'display_config.flip_screen' },
  },
  {
    path: 'device/network', section: 'network',
    labels: p('network_config', ['wifi_enabled', 'wifi_ssid', 'wifi_psk', 'address_mode', 'ip_address', 'gateway', 'subnet', 'dns', 'ntp_server', 'rsyslog_server', 'udp_broadcast']),
    change: { label: 'network_config.ntp_server', value: 'ntp.example.org' },
  },
  {
    path: 'modules/telemetry', section: 'telemetry',
    labels: p('telemetry_config', [
      'device_enabled', 'device_interval', 'environment_enabled', 'environment_interval', 'environment_screen', 'environment_fahrenheit',
      'air_quality_enabled', 'air_quality_interval', 'power_enabled', 'power_interval', 'power_screen', 'health_enabled', 'health_interval', 'health_screen',
    ]),
    change: { label: 'telemetry_config.environment_screen' },
  },
  {
    path: 'modules/neighbor', section: 'neighborinfo',
    labels: p('neighbor_info', ['enable', 'interval', 'transmit_over_lora']),
    change: { label: 'neighbor_info.transmit_over_lora' },
  },
  {
    path: 'modules/extnotif', section: 'extnotif',
    labels: p('extnotif_config', [
      'enabled', 'output_ms', 'active_high', 'alert_message', 'alert_message_vibra', 'alert_message_buzzer', 'alert_bell', 'alert_bell_vibra',
      'alert_bell_buzzer', 'use_pwm', 'use_i2s', 'nag_timeout', 'output_gpio', 'output_vibra_gpio', 'output_buzzer_gpio',
    ]),
    change: { label: 'extnotif_config.alert_bell' },
  },
  {
    path: 'modules/storeforward', section: 'storeforward',
    labels: p('storeforward_config', ['enabled', 'is_server', 'heartbeat', 'records', 'history_return_max', 'history_return_window']),
    change: { label: 'storeforward_config.heartbeat' },
  },
  {
    path: 'modules/rangetest', section: 'rangetest',
    labels: p('rangetest_config', ['enabled', 'sender', 'save']),
    change: { label: 'rangetest_config.save' },
  },
  {
    path: 'modules/cannedmsg', section: 'cannedmsg',
    labels: p('cannedmsg_config', ['enabled', 'rotary1_enabled', 'updown1_enabled', 'send_bell', 'allow_input_source', 'pin_a', 'pin_b', 'pin_press', 'event_cw', 'event_ccw', 'event_press']),
    change: { label: 'cannedmsg_config.send_bell' },
  },
  {
    path: 'modules/audio', section: 'audio',
    labels: p('audio_config', ['codec2_enabled', 'bitrate', 'ptt_pin', 'i2s_ws', 'i2s_sd', 'i2s_din', 'i2s_sck']),
    change: { label: 'audio_config.bitrate', value: '3' },
  },
  {
    path: 'modules/remotehardware', section: 'remotehardware',
    labels: p('remotehw_config', ['enabled', 'allow_undefined']),
    change: { label: 'remotehw_config.allow_undefined' },
  },
  {
    path: 'modules/detectionsensor', section: 'detectionsensor',
    labels: p('detectionsensor_config', ['enabled', 'name', 'monitor_pin', 'trigger_type', 'use_pullup', 'send_bell', 'min_broadcast_secs', 'state_broadcast_secs']),
    change: { label: 'detectionsensor_config.use_pullup' },
  },
  {
    path: 'modules/paxcounter', section: 'paxcounter',
    labels: p('paxcounter_config', ['enabled', 'update_interval', 'wifi_threshold', 'ble_threshold']),
    change: { label: 'paxcounter_config.wifi_threshold', value: '-70' },
  },
  {
    path: 'modules/statusmessage', section: 'statusmessage',
    labels: [['statusmessage_config.node_status', 'Node Status'], ['statusmessage_config.reapply_label', 'Re-apply after a reboot']],
    change: { label: ['statusmessage_config.node_status', 'Node Status'], value: 'Out walking' },
  },
  {
    path: 'modules/trafficmanagement', section: 'trafficmanagement',
    labels: p('trafficmanagement_config', ['position_min_interval_secs', 'nodeinfo_max_hops', 'rate_limit_window', 'rate_limit_max_packets', 'unknown_packet_threshold']),
    change: { label: 'trafficmanagement_config.nodeinfo_max_hops', value: '3' },
  },
  {
    path: 'modules/meshbeacon', section: 'meshbeacon',
    labels: [
      mb('listen_enabled', 'Listen for beacons'), mb('broadcast_enabled', 'Broadcast beacons'), mb('broadcast_message', 'Beacon Message'),
      mb('legacy_split', 'Legacy split'), mb('offer_channel_name', 'Offer Channel Name'), mb('offer_region', 'Offer Region'),
      mb('offer_preset', 'Offer Modem Preset'), mb('interval', 'Broadcast Interval (seconds)'),
    ],
    change: { label: mb('listen_enabled', 'Listen for beacons') },
  },
  {
    path: 'modules/tak', section: 'tak',
    labels: p('tak_config', ['team', 'role']),
    change: { label: 'tak_config.team', value: '1' },
  },
  {
    path: 'modules/serial', section: 'serial',
    labels: p('serial_config', ['enabled', 'mode', 'baud', 'echo', 'rxd', 'txd', 'timeout', 'override_console']),
    change: { label: 'serial_config.echo' },
  },
  {
    path: 'modules/ambientlighting', section: 'ambientlighting',
    labels: p('ambientlighting_config', ['led_state', 'current', 'red', 'green', 'blue']),
    change: { label: 'ambientlighting_config.red', value: '10' },
  },
];

const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });

describe('Device and module categories on the row kit (Task 5.6)', () => {
  it('covers every queued section but MQTT, which keeps its own save (Ruling 5.6)', () => {
    const queued = CATEGORIES.filter((c) => c.group !== undefined && c.saveSection && c.id !== 'modules/mqtt').map((c) => c.id).sort();
    expect(CASES.map((c) => c.path).sort()).toEqual(queued);
  });

  it.each(CASES)('$path: every field of today\'s section is a row, and a change queues $section', async ({ path, section, labels, change }) => {
    expect(categoryById(path)?.saveSection).toBe(section);
    renderSettings(`${g2}/settings/${path}`, { fixtures: all() });
    const title = english(categoryById(path)!.labelKey);
    await screen.findByRole('heading', { level: 1, name: title }, { timeout: 5000 });
    const first = await screen.findByText(english(labels[0]), { selector: 'label' }, { timeout: 5000 });
    expect(first).toBeInTheDocument();
    const advanced = screen.queryByRole('button', { name: /^Advanced/ });
    if (advanced) fireEvent.click(advanced);
    for (const l of labels) expect(screen.getAllByText(english(l), { selector: 'label' }).length, english(l)).toBeGreaterThan(0);
    // Not queued while nothing changed.
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();

    const control = screen.getByLabelText(english(change.label));
    if (change.value === undefined) fireEvent.click(control);
    else fireEvent.change(control, { target: { value: change.value } });
    const queuedAs = english(CATEGORIES.find((c) => c.saveSection === section)!.labelKey);
    expect(await bar()).toHaveTextContent(`1 change in ${queuedAs}`);
  });
});

describe('module gates and checks', () => {
  it('a module the build leaves out shows today\'s notice, its rows view only', async () => {
    renderSettings(`${g2}/settings/modules/audio`);
    expect(await screen.findByText("Audio is not included in this device's firmware build, so these settings cannot be changed.", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: english('audio_config.codec2_enabled') })).toBeDisabled();
  });

  it('TAK on firmware before 2.8 is listed, and opens view only with today\'s words (D9d)', async () => {
    renderSettings(`${g2}/settings/modules`, { fixtures: all({ supportedModules: { takConfig: false } }) });
    const supported = await screen.findByRole('list', { name: 'Supported' }, { timeout: 5000 });
    fireEvent.click(await within(supported).findByRole('link', { name: /^TAK/ }));
    expect(await screen.findByText(en['tak_config.unsupported'])).toBeInTheDocument();
    expect(screen.getByLabelText(en['tak_config.team'])).toBeDisabled();
  });

  it('neighbor info keeps today\'s range: under 4 hours holds the save', async () => {
    renderSettings(`${g2}/settings/modules/neighbor`, { fixtures: all() });
    const interval = await screen.findByLabelText(en['neighbor_info.interval'], {}, { timeout: 5000 });
    fireEvent.change(interval, { target: { value: '3600' } });
    fireEvent.click(screen.getByLabelText(en['neighbor_info.transmit_over_lora']));
    const save = within(await bar()).getByRole('button', { name: /Save/ });
    expect(save).toBeDisabled();
  });

  it('a MeshBeacon message over 100 bytes says so and holds the save, as today', async () => {
    renderSettings(`${g2}/settings/modules/meshbeacon`, { fixtures: all() });
    const message = await screen.findByLabelText('Beacon Message', {}, { timeout: 5000 });
    fireEvent.change(message, { target: { value: 'x'.repeat(101) } });
    expect(screen.getByText(/Over the limit/)).toBeInTheDocument();
    await waitFor(async () => expect(within(await bar()).getByRole('button', { name: /Save/ })).toBeDisabled());
  });

  it('choosing ROUTER asks first with today\'s words; Cancel keeps the role', async () => {
    renderSettings(`${g2}/settings/device/device`);
    const role = await screen.findByLabelText(en['device_config.device_role'], {}, { timeout: 5000 });
    fireEvent.change(role, { target: { value: '2' } });
    const sheet = await screen.findByRole('dialog', { name: 'Are you sure?' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Cancel/ }));
    expect(role).toHaveValue('0');
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
  });
});

describe('Device index: summaries and the pins in use (12-06 / 12-22)', () => {
  it('each hardware category says what it holds, and the pins in use list where each is set', async () => {
    renderSettings(`${g2}/settings/device`);
    const rows = await screen.findByRole('list', { name: 'Categories' }, { timeout: 5000 });
    expect(await within(rows).findByText('Role CLIENT · rebroadcast ALL · NodeInfo every 3 h · LED heartbeat on', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(within(rows).getByText('Fixed position · broadcast every 15 min · smart broadcast on · GPS disabled')).toBeInTheDocument();
    expect(within(rows).getByText('Wi-Fi on · Athens-Lab · DHCP · NTP pool.ntp.org')).toBeInTheDocument();
    const pins = screen.getByRole('region', { name: 'Pins in use' });
    const table = within(pins).getByRole('table');
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'GPIOUsed asSet in',
      `GPIO 4${en['gpio_summary.buzzer_gpio']}Device`,
      `GPIO 13${en['gpio_summary.button_gpio']}Device`,
    ]);
    expect(within(table).getAllByRole('link', { name: 'Device' })[0]).toHaveAttribute('href', `${g2}/settings/device/device`);
  });

  it('two uses of one pin are flagged with today\'s warning', async () => {
    renderSettings(`${g2}/settings/device`, { fixtures: all({ moduleConfig: { externalNotification: { enabled: true, output: 4 } } }) });
    const pins = await screen.findByRole('region', { name: 'Pins in use' }, { timeout: 5000 });
    expect(await within(pins).findByRole('alert')).toHaveTextContent(en['gpio_summary.conflict_warning']);
  });
});
