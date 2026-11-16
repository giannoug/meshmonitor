/**
 * The radio save queue's field map (Task 5.3): for each Device Configuration
 * section the save queue writes, the shared-state values that section's save
 * sends. Each list is the `values` its Classic section compares against its
 * SaveBar baseline (`useSectionBaseline`), under the state's own names.
 *
 * MQTT is not queued (Rulings 5.3, 5.6): its Classic section runs writes of its
 * own around the save (the broker preset and the MQTT link, staged in the
 * section), so it keeps today's in-page save. Security is queued since Task 5.5;
 * its confirms run before its write (securitySaveGuard.tsx).
 */
import type { TFunction } from 'i18next';
import type { ConfigSaveSection } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { normalizeMeshtasticKey } from '../../utils/meshtasticKeyFormat';
import { PacketSignaturePolicy, isPacketSignaturePolicy } from '../../utils/packetSignaturePolicy';
import {
  FEM_LNA_MODE_OPTIONS,
  MODEM_PRESET_OPTIONS,
  REBROADCAST_MODE_OPTIONS,
  REGION_OPTIONS,
  ROLE_OPTIONS,
} from '../../components/configuration/constants';

type Key = keyof DeviceConfigState;

/** Today's names for each Protection Level (PacketSignaturePolicyPicker). */
export const POLICY_OPTION_KEYS: Record<number, string> = {
  [PacketSignaturePolicy.COMPATIBLE]: 'signature_policy.option_compatible',
  [PacketSignaturePolicy.BALANCED]: 'signature_policy.option_balanced',
  [PacketSignaturePolicy.STRICT]: 'signature_policy.option_strict',
};

const prefixed = (prefix: string, names: string[]) => names.map((n) => `${prefix}${n}` as Key);

export const QUEUED_FIELDS: Readonly<Partial<Record<ConfigSaveSection, readonly Key[]>>> = {
  owner: ['longName', 'shortName', 'isUnmessagable', 'isLicensed'],
  device: [
    'role', 'nodeInfoBroadcastSecs', 'tzdef', 'rebroadcastMode', 'doubleTapAsButtonPress', 'disableTripleClick',
    'ledHeartbeatDisabled', 'buzzerMode', 'buttonGpio', 'buzzerGpio',
  ],
  lora: [
    'usePreset', 'modemPreset', 'bandwidth', 'spreadFactor', 'codingRate', 'frequencyOffset', 'overrideFrequency', 'region',
    'hopLimit', 'txPower', 'channelNum', 'femLnaMode', 'sx126xRxBoostedGain', 'ignoreMqtt', 'configOkToMqtt', 'txEnabled',
    'overrideDutyCycle', 'paFanDisabled',
  ],
  position: [
    'positionBroadcastSecs', 'positionSmartEnabled', 'fixedPosition', 'fixedLatitude', 'fixedLongitude', 'fixedAltitude',
    'gpsUpdateInterval', 'gpsMode', 'broadcastSmartMinimumDistance', 'broadcastSmartMinimumIntervalSecs', 'positionFlags',
    'rxGpio', 'txGpio', 'gpsEnGpio',
  ],
  power: [
    'isPowerSaving', 'onBatteryShutdownAfterSecs', 'adcMultiplierOverride', 'waitBluetoothSecs', 'sdsSecs', 'lsSecs',
    'minWakeSecs', 'deviceBatteryInaAddress',
  ],
  display: [
    'screenOnSecs', 'autoScreenCarouselSecs', 'flipScreen', 'displayUnits', 'oled', 'displayMode', 'headingBold',
    'wakeOnTapOrMotion', 'compassOrientation',
  ],
  network: [
    'wifiEnabled', 'wifiSsid', 'wifiPsk', 'ntpServer', 'rsyslogServer', 'addressMode', 'enabledProtocols', 'ipv4Address',
    'ipv4Gateway', 'ipv4Subnet', 'ipv4Dns',
  ],
  telemetry: [
    'deviceUpdateInterval', 'deviceTelemetryEnabled', 'environmentUpdateInterval', 'environmentMeasurementEnabled',
    'environmentScreenEnabled', 'environmentDisplayFahrenheit', 'airQualityEnabled', 'airQualityInterval',
    'powerMeasurementEnabled', 'powerUpdateInterval', 'powerScreenEnabled', 'healthMeasurementEnabled',
    'healthUpdateInterval', 'healthScreenEnabled',
  ],
  neighborinfo: ['neighborInfoEnabled', 'neighborInfoInterval', 'neighborInfoTransmitOverLora'],
  extnotif: prefixed('extNotif', [
    'Enabled', 'OutputMs', 'Output', 'Active', 'AlertMessage', 'AlertMessageVibra', 'AlertMessageBuzzer', 'AlertBell',
    'AlertBellVibra', 'AlertBellBuzzer', 'UsePwm', 'NagTimeout', 'UseI2sAsBuzzer', 'OutputVibra', 'OutputBuzzer',
  ]),
  storeforward: prefixed('storeForward', ['Enabled', 'Heartbeat', 'Records', 'HistoryReturnMax', 'HistoryReturnWindow', 'IsServer']),
  rangetest: prefixed('rangeTest', ['Enabled', 'Sender', 'Save']),
  cannedmsg: prefixed('cannedMsg', [
    'Enabled', 'Rotary1Enabled', 'InputbrokerPinA', 'InputbrokerPinB', 'InputbrokerPinPress', 'InputbrokerEventCw',
    'InputbrokerEventCcw', 'InputbrokerEventPress', 'Updown1Enabled', 'SendBell', 'AllowInputSource',
  ]),
  audio: prefixed('audio', ['Codec2Enabled', 'PttPin', 'Bitrate', 'I2sWs', 'I2sSd', 'I2sDin', 'I2sSck']),
  remotehardware: prefixed('remoteHardware', ['Enabled', 'AllowUndefinedPinAccess']),
  detectionsensor: prefixed('detectionSensor', [
    'Enabled', 'MinimumBroadcastSecs', 'StateBroadcastSecs', 'SendBell', 'Name', 'MonitorPin', 'DetectionTriggerType', 'UsePullup',
  ]),
  paxcounter: prefixed('paxcounter', ['Enabled', 'UpdateInterval', 'WifiThreshold', 'BleThreshold']),
  statusmessage: ['statusMessageNodeStatus'],
  trafficmanagement: prefixed('trafficManagement', [
    'PositionMinIntervalSecs', 'NodeinfoDirectResponseMaxHops', 'RateLimitWindowSecs', 'RateLimitMaxPackets', 'UnknownPacketThreshold',
  ]),
  meshbeacon: prefixed('meshBeacon', [
    'ListenEnabled', 'BroadcastEnabled', 'LegacySplit', 'BroadcastMessage', 'BroadcastOfferChannelName',
    'BroadcastOfferChannelPsk', 'BroadcastOfferRegion', 'BroadcastOfferPreset', 'BroadcastIntervalSecs', 'BroadcastTargets',
  ]),
  tak: ['takTeam', 'takRole'],
  serial: prefixed('serial', ['Enabled', 'Echo', 'Rxd', 'Txd', 'Baud', 'Timeout', 'Mode', 'OverrideConsoleSerialPort']),
  ambientlighting: prefixed('ambient', ['LedState', 'Current', 'Red', 'Green', 'Blue']),
  security: prefixed('security', [
    'AdminKeys', 'IsManaged', 'SerialEnabled', 'DebugLogApiEnabled', 'AdminChannelEnabled', 'PrivateKey', 'SignaturePolicy',
  ]),
};

/**
 * Sections only a remote target queues (Task 5.9): this radio's MQTT keeps
 * today's own Save (Ruling 5.6), a remote node's MQTT goes out with Send to node.
 */
export const REMOTE_QUEUED_FIELDS: Readonly<Partial<Record<ConfigSaveSection, readonly Key[]>>> = {
  mqtt: prefixed('mqtt', [
    'Enabled', 'Address', 'Username', 'Password', 'EncryptionEnabled', 'JsonEnabled', 'Root', 'TlsEnabled', 'ProxyToClientEnabled',
    'MapReportingEnabled', 'MapPublishIntervalSecs', 'MapPositionPrecision', 'MapShouldReportLocation',
  ]),
};

const fieldsOf = (section: ConfigSaveSection) => QUEUED_FIELDS[section] ?? REMOTE_QUEUED_FIELDS[section] ?? [];

/**
 * The queued sections Reload config re-reads from the node (useDeviceConfigSaves
 * `reload()`), whose baselines it moves, as their Classic sections re-baseline on
 * `configVersion`. Modules are not re-read, so a reload keeps their edits queued.
 */
export const RELOADED_SECTIONS: readonly ConfigSaveSection[] = [
  'owner', 'device', 'lora', 'position', 'power', 'display', 'network', 'telemetry', 'neighborinfo',
];

/** Values a reload does not re-read inside a re-read section (PositionConfigSection's keepOnReseed). */
export const KEEP_ON_RELOAD: Readonly<Partial<Record<ConfigSaveSection, readonly Key[]>>> = {
  position: ['fixedLatitude', 'fixedLongitude', 'fixedAltitude'],
};

export const isQueued = (section: ConfigSaveSection | undefined): section is ConfigSaveSection =>
  !!section && section in QUEUED_FIELDS;

export type Values = Record<string, unknown>;

export const pickValues = (state: DeviceConfigState, section: ConfigSaveSection): Values =>
  Object.fromEntries(fieldsOf(section).map((k) => [k, state[k]]));

// As useSectionBaseline compares: scalars by value, arrays and objects by content.
export const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null && JSON.stringify(a) === JSON.stringify(b));

/**
 * The private key counts as changed only once it is non-empty and differs
 * from the saved one, as on today's Security section: an empty box is never sent.
 */
const sameField = (key: Key, value: unknown, base: unknown): boolean => {
  if (key !== 'securityPrivateKey') return sameValue(value, base);
  const next = normalizeMeshtasticKey(String(value ?? ''));
  return next === '' || next === normalizeMeshtasticKey(String(base ?? ''));
};

/** The values of `section` that differ from `baseline`. */
export const changedKeys = (state: DeviceConfigState, section: ConfigSaveSection, baseline: Values): Key[] =>
  fieldsOf(section).filter((k) => !sameField(k, state[k], baseline[k]));

/** The state setter for a value: `hopLimit` → `setHopLimit`. */
export const setterOf = (state: DeviceConfigState, key: Key) =>
  (state as unknown as Record<string, unknown>)[`set${key[0].toUpperCase()}${key.slice(1)}`] as ((v: unknown) => void) | undefined;

/** Today's section prefix for the field labels in en.json. */
const LABEL_PREFIX: Partial<Record<ConfigSaveSection, string>> = {
  owner: 'node_identity', device: 'device_config', lora: 'lora_config', position: 'position_config', power: 'power_config',
  display: 'display_config', network: 'network_config', telemetry: 'telemetry_config', neighborinfo: 'neighbor_info',
  extnotif: 'extnotif_config', storeforward: 'storeforward_config', rangetest: 'rangetest_config', cannedmsg: 'cannedmsg_config',
  audio: 'audio_config', remotehardware: 'remotehw_config', detectionsensor: 'detectionsensor_config', paxcounter: 'paxcounter_config',
  statusmessage: 'statusmessage_config', trafficmanagement: 'trafficmanagement_config', tak: 'tak_config', serial: 'serial_config',
  ambientlighting: 'ambientlighting_config', security: 'security_config',
};

/** The state prefix a module's values carry (`extNotifOutputMs` → `outputMs`). */
const STATE_PREFIX = /^(extNotif|storeForward|rangeTest|cannedMsg|audio|remoteHardware|detectionSensor|paxcounter|statusMessage|trafficManagement|meshBeacon|tak|serial|ambient|neighborInfo|security)(?=[A-Z0-9])/;

/** Labels that today's field key does not spell out. */
const LABEL_KEYS: Partial<Record<Key, string>> = {
  sx126xRxBoostedGain: 'lora_config.rx_boosted_gain',
  configOkToMqtt: 'lora_config.ok_to_mqtt',
  displayUnits: 'display_config.units',
  securitySignaturePolicy: 'signature_policy.label',
  mqttEnabled: 'mqtt_config.enable',
  mqttAddress: 'mqtt_config.server_address',
  mqttUsername: 'mqtt_config.username',
  mqttPassword: 'mqtt_config.password',
  mqttEncryptionEnabled: 'mqtt_config.encryption_enabled',
  mqttJsonEnabled: 'mqtt_config.json_enabled',
  mqttRoot: 'mqtt_config.root_topic',
  mqttTlsEnabled: 'mqtt_config.tls_enabled',
  mqttProxyToClientEnabled: 'mqtt_config.proxy_to_client',
  mqttMapReportingEnabled: 'mqtt_config.map_reporting',
  mqttMapPublishIntervalSecs: 'mqtt_config.map_publish_interval',
  mqttMapPositionPrecision: 'mqtt_config.map_position_precision',
  mqttMapShouldReportLocation: 'mqtt_config.map_report_location',
};

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/**
 * A changed value's label in Review: today's label for that field (D9b), by
 * the field's own en.json key where it follows the section's naming, else
 * the value's name in words ("Rebroadcast mode").
 */
export function fieldLabel(t: TFunction, section: ConfigSaveSection, key: Key): string {
  const bare = key.replace(STATE_PREFIX, '');
  const name = bare[0].toLowerCase() + bare.slice(1);
  const words = snake(name).replace(/_/g, ' ');
  const fallback = words[0].toUpperCase() + words.slice(1);
  const i18nKey = LABEL_KEYS[key] ?? (LABEL_PREFIX[section] ? `${LABEL_PREFIX[section]}.${snake(name)}` : '');
  return i18nKey ? t(i18nKey, fallback) : fallback;
}

const OPTION_NAMES: Partial<Record<Key, ReadonlyArray<{ value: number; name?: string; label?: string }>>> = {
  modemPreset: MODEM_PRESET_OPTIONS,
  region: REGION_OPTIONS,
  role: ROLE_OPTIONS,
  rebroadcastMode: REBROADCAST_MODE_OPTIONS,
  femLnaMode: FEM_LNA_MODE_OPTIONS,
};

/** A value as Review shows it: an option's name, On / Off, or the value. */
export function formatValue(t: TFunction, key: Key, value: unknown): string {
  // Never put the private key or the Wi-Fi password on screen in Review or "was …".
  if (key === 'securityPrivateKey' || key === 'wifiPsk' || key === 'mqttPassword') return value ? '••••••••' : '—';
  if (key === 'securitySignaturePolicy') return isPacketSignaturePolicy(value) ? t(POLICY_OPTION_KEYS[value]) : t('signature_policy.option_unknown');
  const option = OPTION_NAMES[key]?.find((o) => o.value === value);
  if (option) return option.name ?? option.label ?? String(value);
  if (typeof value === 'boolean') return t(value ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off');
  if (Array.isArray(value)) return value.filter((v) => v !== '').join(', ');
  if (value === '' || value === null || value === undefined) return '—';
  return String(value);
}
