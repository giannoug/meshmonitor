/**
 * The device settings categories (spec §6 P5, Task 5.2): one entry per page of
 * a device's settings, and the map from today's `#config-*` / `#settings-*`
 * section ids to them, so every control a power user finds today has exactly
 * one page (spec §2).
 *
 * - On the radio (`scope: 'radio'`): a Meshtastic radio's Device
 *   Configuration, gated as App's Configuration tab (`configuration:read`).
 *   Device ›, Modules › and Maintenance › are groups with an index page.
 * - In MeshMonitor (`scope: 'meshmonitor'`): the source's Settings tab and
 *   Notifications, gated as `settingsNavItems(mode: 'source')` and App's tabs.
 *
 * Until Tasks 5.3–5.8 build each page, a category's `component` renders
 * today's section for it (`ClassicCategories`); LoRa is built (Task 5.3),
 * Identity, Channels and Security (Task 5.5, `categories/`), Device's
 * categories and the modules but MQTT (Task 5.6).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { TFunction } from 'i18next';
import type { useAuth } from '../../contexts/AuthContext';
import type { ConfigSaveSection } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { configurationNavItems, settingsNavItems } from '../../components/search/configSections';
import { isCoverageMqttSourceType } from '../../utils/coverage';

/** The device types the settings frame serves (Classic serves them with App). */
export type SourceType = 'meshtastic_tcp' | 'mqtt_broker' | 'mqtt_bridge';

export interface GateCtx {
  sourceId: string;
  sourceType: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  /** `/api/health` says OTA firmware updates are on. */
  firmwareOtaEnabled: boolean;
  hasPermission: ReturnType<typeof useAuth>['hasPermission'];
}

export type CategoryTarget = { kind: 'local' } | { kind: 'remote'; nodeNum: number };

export type CategoryProps = { sourceId: string; target: CategoryTarget; readOnly: boolean; /** The path after the category, for its own deeper pages. */ sub?: string };

export type CategoryDef = {
  id: string;
  scope: 'radio' | 'meshmonitor';
  group?: 'device' | 'modules' | 'maintenance';
  labelKey: string;
  sourceTypes: SourceType[];
  gate?: (ctx: GateCtx) => boolean;
  saveSection?: ConfigSaveSection;
  component: LazyExoticComponent<ComponentType<CategoryProps>>;
};

export type CategoryGroup = NonNullable<CategoryDef['group']>;
export const GROUPS: readonly CategoryGroup[] = ['device', 'modules', 'maintenance'];

type ClassicName = keyof typeof import('./ClassicCategories');
// One chunk for every placeholder; each category takes its own export.
const classic = (name: ClassicName) =>
  lazy(() => import('./ClassicCategories.tsx').then((m) => ({ default: m[name] as ComponentType<CategoryProps> })));

export const RADIO: SourceType[] = ['meshtastic_tcp'];
const ALL: SourceType[] = ['meshtastic_tcp', 'mqtt_broker', 'mqtt_bridge'];

const canReadConfig = (c: GateCtx) => c.hasPermission('configuration', 'read', { sourceId: c.sourceId });
// The Settings tab's gate (canOpenSourceSettings); its bridge exception opens only the bridge setup, which has its own gate.
const canReadSettings = (c: GateCtx) => c.hasPermission('settings', 'read', { anySource: true });

const radio = (
  id: string,
  labelKey: string,
  component: ClassicName | CategoryDef['component'],
  extra: Partial<Pick<CategoryDef, 'group' | 'saveSection' | 'gate'>> = {},
): CategoryDef => ({
  id,
  scope: 'radio',
  labelKey,
  sourceTypes: RADIO,
  component: typeof component === 'string' ? classic(component) : component,
  ...extra,
  gate: (c) => canReadConfig(c) && (extra.gate?.(c) ?? true),
});

// One chunk for every module page; each reads its module from the category id.
const moduleCategory = lazy(() => import('./categories/ModuleCategory.tsx'));
const mod = (name: string, labelKey: string, saveSection: ConfigSaveSection, component: ClassicName | CategoryDef['component'] = moduleCategory) =>
  radio(`modules/${name}`, labelKey, component, { group: 'modules', saveSection });

const meshmonitor = (
  id: string,
  labelKey: string,
  component: ClassicName,
  extra: Partial<Pick<CategoryDef, 'sourceTypes' | 'gate'>> = {},
): CategoryDef => ({
  id,
  scope: 'meshmonitor',
  labelKey,
  sourceTypes: ALL,
  component: classic(component),
  ...extra,
  gate: extra.gate ?? canReadSettings,
});

export const CATEGORIES: CategoryDef[] = [
  radio('identity', 'configuration.node_identity', lazy(() => import('./categories/IdentityCategory.tsx')), { saveSection: 'owner' }),
  radio('lora', 'workspace.settings.label.lora', lazy(() => import('./LoraCategory.tsx')), { saveSection: 'lora' }),
  radio('channels', 'channels.title', lazy(() => import('./categories/ChannelsCategory.tsx'))),
  radio('security', 'security_config.title', lazy(() => import('./categories/SecurityCategory.tsx')), { saveSection: 'security' }),
  radio('device/device', 'workspace.settings.label.device', lazy(() => import('./categories/DeviceCategory.tsx')), { group: 'device', saveSection: 'device' }),
  radio('device/position', 'workspace.settings.label.position', lazy(() => import('./categories/PositionCategory.tsx')), { group: 'device', saveSection: 'position' }),
  radio('device/power', 'workspace.settings.label.power', lazy(() => import('./categories/PowerCategory.tsx')), { group: 'device', saveSection: 'power' }),
  radio('device/display', 'workspace.settings.label.display', lazy(() => import('./categories/DisplayCategory.tsx')), { group: 'device', saveSection: 'display' }),
  radio('device/network', 'workspace.settings.label.network', lazy(() => import('./categories/NetworkCategory.tsx')), { group: 'device', saveSection: 'network' }),
  // Modules, A–Z by their English label (the index sorts by the shown label).
  mod('ambientlighting', 'ambientlighting_config.title', 'ambientlighting'),
  mod('audio', 'audio_config.title', 'audio'),
  mod('cannedmsg', 'cannedmsg_config.title', 'cannedmsg'),
  mod('detectionsensor', 'detectionsensor_config.title', 'detectionsensor'),
  mod('extnotif', 'extnotif_config.title', 'extnotif'),
  mod('meshbeacon', 'workspace.settings.label.meshbeacon', 'meshbeacon'),
  mod('mqtt', 'workspace.settings.label.mqtt', 'mqtt', 'MqttCategory'),
  mod('neighbor', 'workspace.settings.label.neighbor', 'neighborinfo'),
  mod('paxcounter', 'paxcounter_config.title', 'paxcounter'),
  mod('rangetest', 'rangetest_config.title', 'rangetest'),
  mod('remotehardware', 'workspace.settings.label.remotehardware', 'remotehardware'),
  mod('serial', 'serial_config.title', 'serial'),
  mod('statusmessage', 'workspace.settings.label.statusmessage', 'statusmessage'),
  mod('storeforward', 'storeforward_config.title', 'storeforward'),
  mod('tak', 'tak_config.title', 'tak'),
  mod('telemetry', 'workspace.settings.label.module_telemetry', 'telemetry'),
  mod('trafficmanagement', 'trafficmanagement_config.title', 'trafficmanagement'),
  radio('maintenance/backup', 'config.backup_management', 'BackupCategory', { group: 'maintenance' }),
  // Today's gate: an admin, on an install with OTA updates on (ConfigurationTab showFirmware).
  radio('maintenance/firmware', 'firmware.title', 'FirmwareCategory', {
    group: 'maintenance',
    gate: (c) => c.isAdmin && c.firmwareOtaEnabled,
  }),
  radio('maintenance/danger', 'config.danger_zone', 'DangerCategory', { group: 'maintenance' }),

  // The bridge setup reads `sources` (#5683 follow-up): its own grant, not the Settings tab's.
  meshmonitor('mqtt-bridge', 'mqtt_bridge_config.title', 'MqttBridgeCategory', {
    sourceTypes: ['mqtt_bridge'],
    gate: (c) => c.hasPermission('sources', 'read'),
  }),
  meshmonitor('node-display', 'settings.node_display', 'SourceSettingsCategory'),
  meshmonitor('telemetry', 'settings.telemetry', 'SourceSettingsCategory'),
  // App's Notifications tab is open to every signed-in user; its Settings section rides along.
  meshmonitor('notifications', 'nav.notifications', 'NotificationsCategory', { gate: (c) => c.isAuthenticated }),
  meshmonitor('packet-monitor', 'settings.packet_monitor', 'SourceSettingsCategory'),
  // Its routes check this source's `configuration`; today a viewer without Settings finds it in Configuration instead.
  meshmonitor('pki-dm', 'workspace.settings.label.pki_dm', 'PkiDmCategory', { sourceTypes: RADIO, gate: canReadConfig }),
  meshmonitor('reliable-pki', 'settings.reliable_pki.title', 'ReliablePkiCategory', { sourceTypes: RADIO }),
  meshmonitor('data', 'workspace.settings.label.data', 'SourceSettingsCategory'),
  meshmonitor('coverage-recording', 'settings.coverage_mqtt_section', 'CoverageRecordingCategory', {
    sourceTypes: ['mqtt_broker', 'mqtt_bridge'],
    gate: (c) =>
      canReadSettings(c) && isCoverageMqttSourceType(c.sourceType) && c.hasPermission('settings', 'write', { sourceId: c.sourceId }),
  }),
];

/**
 * Today's section ids and the one category each lives in. Configuration's
 * Import/Export (reload, import, export) goes to Maintenance › Backup; the
 * Settings tab's Reset UI, Settings Management and Danger Zone are Data.
 */
export const SECTION_TO_CATEGORY: Readonly<Record<string, string>> = {
  'config-import-export': 'maintenance/backup',
  'config-node-identity': 'identity',
  'config-device': 'device/device',
  'config-lora': 'lora',
  'config-position': 'device/position',
  'config-power': 'device/power',
  'config-display': 'device/display',
  'config-telemetry': 'modules/telemetry',
  'config-mqtt': 'modules/mqtt',
  'config-neighbor': 'modules/neighbor',
  'config-network': 'device/network',
  'config-extnotif': 'modules/extnotif',
  'config-storeforward': 'modules/storeforward',
  'config-rangetest': 'modules/rangetest',
  'config-cannedmsg': 'modules/cannedmsg',
  'config-audio': 'modules/audio',
  'config-remotehardware': 'modules/remotehardware',
  'config-detectionsensor': 'modules/detectionsensor',
  'config-paxcounter': 'modules/paxcounter',
  'config-statusmessage': 'modules/statusmessage',
  'config-trafficmanagement': 'modules/trafficmanagement',
  'config-meshbeacon': 'modules/meshbeacon',
  'config-tak': 'modules/tak',
  'config-serial': 'modules/serial',
  'config-ambientlighting': 'modules/ambientlighting',
  'config-security': 'security',
  'config-channels': 'channels',
  'config-backup': 'maintenance/backup',
  'config-firmware': 'maintenance/firmware',
  'config-danger': 'maintenance/danger',
  'settings-mqtt-bridge': 'mqtt-bridge',
  'settings-node-display': 'node-display',
  'settings-telemetry': 'telemetry',
  'settings-pki-dm': 'pki-dm',
  'settings-reliable-pki': 'reliable-pki',
  'settings-notifications': 'notifications',
  'settings-packet-monitor': 'packet-monitor',
  'settings-reset-ui': 'data',
  'settings-coverage-mqtt': 'coverage-recording',
  'settings-management': 'data',
  'settings-danger': 'data',
};

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: string): CategoryDef | undefined {
  return BY_ID.get(id);
}

/** Today's first section of a category, which the Classic page scrolls to. */
export function firstSectionOf(categoryId: string): string | undefined {
  return Object.keys(SECTION_TO_CATEGORY).find((s) => SECTION_TO_CATEGORY[s] === categoryId);
}

/**
 * Today's write gate for a category's controls on this device; without it the
 * viewer may only look. A group index (no category) follows the radio's.
 */
export function readOnlyFor(def: CategoryDef | undefined, hasPermission: GateCtx['hasPermission'], sourceId: string): boolean {
  // The viewer's own notification choices, open to every signed-in user.
  if (def?.id === 'notifications') return false;
  // The bridge setup saves to the source row (MqttBridgeConfigurationView checks sources:write).
  if (def?.id === 'mqtt-bridge') return !hasPermission('sources', 'write');
  // PKI DM decryption saves this source's configuration.
  const configuration = !def || def.scope === 'radio' || def.id === 'pki-dm';
  return !hasPermission(configuration ? 'configuration' : 'settings', 'write', { sourceId });
}

/** Categories this viewer may open on this device, in list order. */
export function visibleCategories(ctx: GateCtx): CategoryDef[] {
  return CATEGORIES.filter((c) => (c.sourceTypes as string[]).includes(ctx.sourceType) && (c.gate?.(ctx) ?? true));
}

/**
 * What `/settings/<rest>` asks for: a category (its id may hold a slash, so
 * the longest match wins), a group's index, or nothing. `sub` is the rest of
 * the path, for a category's own deeper pages.
 */
export function resolveSettingsPath(rest: string): { categoryId?: string; group?: CategoryGroup; sub: string } {
  const parts = rest.split('/').filter(Boolean);
  if (parts.length >= 2 && BY_ID.has(`${parts[0]}/${parts[1]}`)) {
    return { categoryId: `${parts[0]}/${parts[1]}`, sub: parts.slice(2).join('/') };
  }
  if (parts.length >= 1 && BY_ID.has(parts[0])) return { categoryId: parts[0], sub: parts.slice(1).join('/') };
  if (parts.length >= 1 && (GROUPS as readonly string[]).includes(parts[0])) {
    return { group: parts[0] as CategoryGroup, sub: parts.slice(1).join('/') };
  }
  return { sub: parts.join('/') };
}

/**
 * Every category with the words search should match it by (Task 5.4 lists
 * categories that are not mounted): today's section keywords, joined per category.
 */
export function categoryIndex(): Array<{ id: string; labelKey: string; keywords: string[] }> {
  const keyOnly = ((key: string) => key) as unknown as TFunction;
  const sections = [
    ...configurationNavItems(keyOnly, { showFirmware: true }),
    ...settingsNavItems(keyOnly, {
      mode: 'source',
      isAdmin: true,
      canWriteSettings: true,
      sourceType: 'mqtt_bridge',
      canReadSources: true,
      canReadConfiguration: true,
    }),
    // Reliable PKI and PKI DMs show on a radio only, so ask once more for a radio source.
    ...settingsNavItems(keyOnly, { mode: 'source', isAdmin: true, canWriteSettings: true, sourceType: 'meshtastic_tcp', canReadConfiguration: true }),
  ];
  const words = new Map<string, Set<string>>();
  for (const s of sections) {
    const id = SECTION_TO_CATEGORY[s.id];
    if (!id) continue;
    const set = words.get(id) ?? new Set<string>();
    for (const k of s.keywords ?? []) set.add(k);
    words.set(id, set);
  }
  return CATEGORIES.map((c) => ({ id: c.id, labelKey: c.labelKey, keywords: [...(words.get(c.id) ?? [])] }));
}

/** Modules the firmware build or version leaves out, read as today's gates do (fail open on an unknown answer). */
export function moduleAvailable(id: string, supported: DeviceConfigState['supportedModules']): boolean {
  const name = id.replace(/^modules\//, '');
  if (!supported) return true;
  switch (name) {
    case 'statusmessage':
      return supported.statusmessage;
    case 'trafficmanagement':
      return supported.trafficManagement;
    case 'meshbeacon':
      return supported.meshBeacon;
    // Firmware before 2.8.0 (takConfig) shows TAK view only, as today, rather than folding it.
    case 'tak':
      return supported.tak !== false;
    case 'rangetest':
      return supported.rangetest !== false && supported.rangeTest !== false;
    case 'neighbor':
      return supported.neighborinfo !== false;
    default:
      return supported[name as keyof typeof supported] !== false;
  }
}

/** A module's On/Off at a glance, from its enable flag; null for a module without one. */
export function moduleOn(id: string, s: DeviceConfigState): boolean | null {
  switch (id.replace(/^modules\//, '')) {
    case 'ambientlighting': return s.ambientLedState;
    case 'audio': return s.audioCodec2Enabled;
    case 'cannedmsg': return s.cannedMsgEnabled;
    case 'detectionsensor': return s.detectionSensorEnabled;
    case 'extnotif': return s.extNotifEnabled;
    case 'meshbeacon': return s.meshBeaconListenEnabled || s.meshBeaconBroadcastEnabled;
    case 'mqtt': return s.mqttEnabled;
    case 'neighbor': return s.neighborInfoEnabled;
    case 'paxcounter': return s.paxcounterEnabled;
    case 'rangetest': return s.rangeTestEnabled;
    case 'remotehardware': return s.remoteHardwareEnabled;
    case 'serial': return s.serialEnabled;
    case 'statusmessage': return s.statusMessageNodeStatus.trim() !== '';
    case 'storeforward': return s.storeForwardEnabled;
    case 'telemetry':
      return s.deviceTelemetryEnabled || s.environmentMeasurementEnabled || s.airQualityEnabled || s.powerMeasurementEnabled || s.healthMeasurementEnabled;
    default: return null; // TAK and Traffic Management have no enable flag.
  }
}
