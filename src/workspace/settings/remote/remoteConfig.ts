/**
 * What a remote target reads and sends per category (Task 5.9), as today's
 * Admin Commands does for the selected node. Pure; remoteConfig.test.ts pins
 * every command's payload to today's.
 *
 * - A read writes the node's reply into the frame's remote values through
 *   today's appliers (applyLoadedConfig, the same proto3 handling), mapped
 *   onto the Workspace's field names.
 * - A send builds today's admin command for the section: the command name and
 *   the `config` body AdminCommandsTab's `handleSet*Config` builds, with its
 *   clamps. AdminCommandsTab keeps its own (D15: its builders read its form
 *   state, these read the Workspace's).
 */
import type { TFunction } from 'i18next';
import type { ConfigSaveSection } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import { applyLoadedConfig, type LoadConfigType, type LoadedConfigSetters } from '../../../components/admin-commands/applyLoadedConfig';
import { buildAdminMqttSavePayload } from '../../../components/admin-commands/mqttSavePayload';
import { buildMeshBeaconConfigPayload } from '../../../components/admin-commands/useAdminCommandsState';
import { floorKeepingZero, NODE_INFO_BROADCAST_FLOOR_SECS, POSITION_BROADCAST_FLOOR_SECS } from '../../../utils/broadcastIntervalFloor';
import { policyToSend } from '../../../utils/packetSignaturePolicy';
import { encodePositionFlags, type PositionFlagsState } from '../../../utils/positionFlags';
import { setterOf } from '../radioSections';

type Key = keyof DeviceConfigState;

/** The categories a remote target offers, by the request that reads each: today's Admin Commands sections. */
export const REMOTE_READS: Readonly<Record<string, LoadConfigType | 'owner' | 'channels'>> = {
  identity: 'owner',
  lora: 'lora',
  channels: 'channels',
  security: 'security',
  'device/device': 'device',
  'device/position': 'position',
  'device/network': 'network',
  'modules/mqtt': 'mqtt',
  'modules/neighbor': 'neighborinfo',
  'modules/telemetry': 'telemetry',
  'modules/statusmessage': 'statusmessage',
  'modules/trafficmanagement': 'trafficmanagement',
  'modules/meshbeacon': 'meshbeacon',
  'modules/tak': 'tak',
};

/** Load All Config's order: today's (LOAD_CONFIG_TYPES, then owner, then channels), for the categories offered here. */
export const LOAD_ALL_ORDER: readonly string[] = [
  'device/device', 'lora', 'device/position', 'modules/mqtt', 'security', 'device/network', 'modules/neighbor', 'modules/telemetry',
  'modules/statusmessage', 'modules/trafficmanagement', 'modules/meshbeacon', 'modules/tak', 'identity', 'channels',
];

const set = (s: DeviceConfigState, key: Key, value: unknown) => {
  if (value !== undefined) setterOf(s, key)?.(value);
};

/**
 * A field the reply carries as undefined is the proto3 zero on the node (the wire elides 0, false and '').
 * Today's form takes the undefined and its save leaves the field out, which the firmware reads as that
 * zero; the Workspace shows and sends the zero itself, never an earlier read or a default (I5).
 */
const zero = (current: unknown): unknown =>
  typeof current === 'number' ? 0 : typeof current === 'boolean' ? false : typeof current === 'string' ? '' : Array.isArray(current) ? [] : null;

/** Each admin field a reply carries, and the Workspace field it fills. */
const FIELDS: Partial<Record<LoadConfigType, Record<string, Key>>> = {
  device: {
    role: 'role', nodeInfoBroadcastSecs: 'nodeInfoBroadcastSecs', rebroadcastMode: 'rebroadcastMode', tzdef: 'tzdef',
    doubleTapAsButtonPress: 'doubleTapAsButtonPress', disableTripleClick: 'disableTripleClick', ledHeartbeatDisabled: 'ledHeartbeatDisabled',
    buzzerMode: 'buzzerMode', buttonGpio: 'buttonGpio', buzzerGpio: 'buzzerGpio',
  },
  lora: Object.fromEntries(
    ['usePreset', 'modemPreset', 'bandwidth', 'spreadFactor', 'codingRate', 'frequencyOffset', 'overrideFrequency', 'region', 'hopLimit',
      'txPower', 'channelNum', 'femLnaMode', 'sx126xRxBoostedGain', 'ignoreMqtt', 'configOkToMqtt', 'txEnabled', 'overrideDutyCycle', 'paFanDisabled']
      .map((k) => [k, k as Key]),
  ),
  position: Object.fromEntries(
    ['positionBroadcastSecs', 'positionSmartEnabled', 'fixedPosition', 'fixedLatitude', 'fixedLongitude', 'fixedAltitude', 'gpsUpdateInterval',
      'rxGpio', 'txGpio', 'broadcastSmartMinimumDistance', 'broadcastSmartMinimumIntervalSecs', 'gpsEnGpio', 'gpsMode']
      .map((k) => [k, k as Key]),
  ),
  mqtt: {
    enabled: 'mqttEnabled', address: 'mqttAddress', username: 'mqttUsername', password: 'mqttPassword', encryptionEnabled: 'mqttEncryptionEnabled',
    jsonEnabled: 'mqttJsonEnabled', root: 'mqttRoot', tlsEnabled: 'mqttTlsEnabled', proxyToClientEnabled: 'mqttProxyToClientEnabled',
    mapReportingEnabled: 'mqttMapReportingEnabled', mapPublishIntervalSecs: 'mqttMapPublishIntervalSecs',
    mapPositionPrecision: 'mqttMapPositionPrecision', mapShouldReportLocation: 'mqttMapShouldReportLocation',
  },
  network: {
    wifiEnabled: 'wifiEnabled', wifiSsid: 'wifiSsid', wifiPsk: 'wifiPsk', ntpServer: 'ntpServer', addressMode: 'addressMode',
    ipv4Address: 'ipv4Address', ipv4Gateway: 'ipv4Gateway', ipv4Subnet: 'ipv4Subnet', ipv4Dns: 'ipv4Dns',
  },
  neighborinfo: { enabled: 'neighborInfoEnabled', updateInterval: 'neighborInfoInterval', transmitOverLora: 'neighborInfoTransmitOverLora' },
  telemetry: Object.fromEntries(
    ['deviceUpdateInterval', 'deviceTelemetryEnabled', 'environmentUpdateInterval', 'environmentMeasurementEnabled', 'environmentScreenEnabled',
      'environmentDisplayFahrenheit', 'airQualityEnabled', 'airQualityInterval', 'powerMeasurementEnabled', 'powerUpdateInterval',
      'powerScreenEnabled', 'healthMeasurementEnabled', 'healthUpdateInterval', 'healthScreenEnabled'].map((k) => [k, k as Key]),
  ),
  statusmessage: { nodeStatus: 'statusMessageNodeStatus' },
  trafficmanagement: {
    positionMinIntervalSecs: 'trafficManagementPositionMinIntervalSecs', nodeinfoDirectResponseMaxHops: 'trafficManagementNodeinfoDirectResponseMaxHops',
    rateLimitWindowSecs: 'trafficManagementRateLimitWindowSecs', rateLimitMaxPackets: 'trafficManagementRateLimitMaxPackets',
    unknownPacketThreshold: 'trafficManagementUnknownPacketThreshold',
  },
  meshbeacon: Object.fromEntries(
    ['ListenEnabled', 'BroadcastEnabled', 'LegacySplit', 'BroadcastMessage', 'BroadcastOfferChannelName', 'BroadcastOfferChannelPsk',
      'BroadcastOfferRegion', 'BroadcastOfferPreset', 'BroadcastIntervalSecs', 'BroadcastTargets']
      .map((k) => [k[0].toLowerCase() + k.slice(1), `meshBeacon${k}` as Key]),
  ),
  tak: { team: 'takTeam', role: 'takRole' },
  security: {
    isManaged: 'securityIsManaged', serialEnabled: 'securitySerialEnabled', debugLogApiEnabled: 'securityDebugLogApiEnabled',
    adminChannelEnabled: 'securityAdminChannelEnabled', packetSignaturePolicy: 'securitySignaturePolicy',
    loadedPacketSignaturePolicy: 'securityLoadedSignaturePolicy',
  },
};

/** Today's appliers' setters, writing into the remote values. */
function settersFor(s: DeviceConfigState): LoadedConfigSetters {
  const into = (type: LoadConfigType) => (patch: Record<string, unknown>) => {
    for (const [from, to] of Object.entries(FIELDS[type] ?? {})) {
      if (!(from in patch)) continue;
      setterOf(s, to)?.(patch[from] === undefined ? zero(s[to]) : patch[from]);
    }
  };
  return {
    setDeviceConfig: into('device'),
    setLoRaConfig: into('lora'),
    setPositionConfig: (patch) => {
      into('position')(patch as Record<string, unknown>);
      // The applier decodes the mask into checkboxes; the Workspace holds the mask. An elided mask is 0.
      set(s, 'positionFlags', patch.positionFlags ? encodePositionFlags(patch.positionFlags as PositionFlagsState) : 0);
    },
    setMQTTConfig: into('mqtt'),
    setSecurityConfig: (patch) => {
      into('security')(patch as Record<string, unknown>);
      // The node's firmware as the reply names it: Protection Level and the restart rules follow it (#5612).
      if (typeof patch.firmwareVersion === 'string') set(s, 'localFirmwareVersion', patch.firmwareVersion);
      if (patch.adminKeys) {
        const keys = patch.adminKeys.filter((k) => k.trim());
        set(s, 'securityAdminKeys', keys.length > 0 ? keys : ['']);
      }
    },
    // No Bluetooth category in the Workspace (Ruling 5.2 DJ / 5.6).
    setBluetoothConfig: () => {},
    setNetworkConfig: into('network'),
    setNeighborInfoConfig: into('neighborinfo'),
    setTelemetryConfig: into('telemetry'),
    setStatusMessageConfig: into('statusmessage'),
    setTrafficManagementConfig: into('trafficmanagement'),
    setMeshBeaconConfig: into('meshbeacon'),
    setTAKConfig: into('tak'),
  };
}

/** Writes one load-config reply into the remote values; false when there was nothing to apply (today's rule). */
export function applyRemoteConfig(type: LoadConfigType, config: unknown, s: DeviceConfigState, nodeNum: number): boolean {
  return applyLoadedConfig(type, config, settersFor(s), { nodeNum });
}

/** Writes a load-owner reply. */
export function applyRemoteOwner(owner: { longName?: string; shortName?: string; isUnmessagable?: boolean; isLicensed?: boolean } | undefined, s: DeviceConfigState): boolean {
  if (!owner) return false;
  set(s, 'longName', owner.longName ?? '');
  set(s, 'shortName', owner.shortName ?? '');
  set(s, 'isUnmessagable', owner.isUnmessagable ?? false);
  set(s, 'isLicensed', owner.isLicensed ?? false);
  return true;
}

export type RemoteCommand = { command: string; params: Record<string, unknown> } | { error: string };

/** The admin command today's Admin Commands sends for `section`, from the remote values; or the message it shows instead. */
export function remoteCommand(section: ConfigSaveSection, s: DeviceConfigState, t: TFunction): RemoteCommand {
  switch (section) {
    case 'owner':
      if (!s.longName.trim() || !s.shortName.trim()) return { error: t('admin_commands.long_short_name_required') };
      return {
        command: 'setOwner',
        params: { longName: s.longName.trim(), shortName: s.shortName.trim(), isUnmessagable: s.isUnmessagable, isLicensed: s.isLicensed },
      };
    case 'device':
      return {
        command: 'setDeviceConfig',
        params: {
          config: {
            role: s.role,
            // A stored 0 goes back as 0 so the node keeps its firmware default.
            nodeInfoBroadcastSecs: floorKeepingZero(s.nodeInfoBroadcastSecs, NODE_INFO_BROADCAST_FLOOR_SECS),
            rebroadcastMode: s.rebroadcastMode,
            tzdef: s.tzdef,
            doubleTapAsButtonPress: s.doubleTapAsButtonPress,
            disableTripleClick: s.disableTripleClick,
            ledHeartbeatDisabled: s.ledHeartbeatDisabled,
            buzzerMode: s.buzzerMode,
            buttonGpio: s.buttonGpio,
            buzzerGpio: s.buzzerGpio,
          },
        },
      };
    case 'lora': {
      const config: Record<string, unknown> = {
        usePreset: s.usePreset,
        hopLimit: Math.min(7, Math.max(1, s.hopLimit)),
        txPower: s.txPower,
        channelNum: s.channelNum,
        femLnaMode: s.femLnaMode,
        sx126xRxBoostedGain: s.sx126xRxBoostedGain,
        ignoreMqtt: s.ignoreMqtt,
        configOkToMqtt: s.configOkToMqtt,
        txEnabled: s.txEnabled,
        overrideDutyCycle: s.overrideDutyCycle,
        paFanDisabled: s.paFanDisabled,
      };
      if (s.usePreset) config.modemPreset = s.modemPreset;
      else Object.assign(config, { bandwidth: s.bandwidth, spreadFactor: s.spreadFactor, codingRate: s.codingRate, frequencyOffset: s.frequencyOffset, overrideFrequency: s.overrideFrequency });
      config.region = s.region;
      return { command: 'setLoRaConfig', params: { config } };
    }
    case 'position': {
      const config: Record<string, unknown> = {
        positionBroadcastSecs: floorKeepingZero(s.positionBroadcastSecs, POSITION_BROADCAST_FLOOR_SECS),
        positionBroadcastSmartEnabled: s.positionSmartEnabled,
        fixedPosition: s.fixedPosition,
        gpsUpdateInterval: s.gpsUpdateInterval,
        positionFlags: s.positionFlags,
        broadcastSmartMinimumDistance: s.broadcastSmartMinimumDistance,
        broadcastSmartMinimumIntervalSecs: s.broadcastSmartMinimumIntervalSecs,
        gpsMode: s.gpsMode,
      };
      // The server sends setFixedPosition first from these.
      if (s.fixedPosition) Object.assign(config, { latitude: s.fixedLatitude, longitude: s.fixedLongitude, altitude: s.fixedAltitude });
      for (const k of ['rxGpio', 'txGpio', 'gpsEnGpio'] as const) if (s[k] !== undefined) config[k] = s[k];
      return { command: 'setPositionConfig', params: { config } };
    }
    case 'network': {
      const config: Record<string, unknown> = {
        wifiEnabled: s.wifiEnabled, wifiSsid: s.wifiSsid, wifiPsk: s.wifiPsk, ntpServer: s.ntpServer, addressMode: s.addressMode,
      };
      if (s.addressMode === 1) config.ipv4Config = { ip: s.ipv4Address, gateway: s.ipv4Gateway, subnet: s.ipv4Subnet, dns: s.ipv4Dns };
      return { command: 'setNetworkConfig', params: { config } };
    }
    case 'mqtt':
      return {
        command: 'setMQTTConfig',
        params: {
          config: buildAdminMqttSavePayload({
            enabled: s.mqttEnabled, address: s.mqttAddress, username: s.mqttUsername, password: s.mqttPassword,
            encryptionEnabled: s.mqttEncryptionEnabled, jsonEnabled: s.mqttJsonEnabled, root: s.mqttRoot, tlsEnabled: s.mqttTlsEnabled,
            proxyToClientEnabled: s.mqttProxyToClientEnabled, mapReportingEnabled: s.mqttMapReportingEnabled,
            mapPublishIntervalSecs: s.mqttMapPublishIntervalSecs, mapPositionPrecision: s.mqttMapPositionPrecision,
            mapShouldReportLocation: s.mqttMapShouldReportLocation,
          }),
        },
      };
    case 'security': {
      const policy = policyToSend(s.securityLoadedSignaturePolicy, s.securitySignaturePolicy);
      return {
        command: 'setSecurityConfig',
        params: {
          config: {
            adminKeys: s.securityAdminKeys.filter((k) => k && k.trim().length > 0),
            isManaged: s.securityIsManaged,
            serialEnabled: s.securitySerialEnabled,
            debugLogApiEnabled: s.securityDebugLogApiEnabled,
            adminChannelEnabled: s.securityAdminChannelEnabled,
            // No keypair: the server merges the node's own (#4736). The policy only when changed (#5612).
            ...(policy !== undefined ? { packetSignaturePolicy: policy } : {}),
          },
        },
      };
    }
    case 'neighborinfo':
      return {
        command: 'setNeighborInfoConfig',
        params: { config: { enabled: s.neighborInfoEnabled, updateInterval: s.neighborInfoInterval, transmitOverLora: s.neighborInfoTransmitOverLora } },
      };
    case 'telemetry':
      return {
        command: 'setTelemetryConfig',
        params: {
          config: Object.fromEntries(Object.values(FIELDS.telemetry!).map((k) => [k, s[k]])),
        },
      };
    case 'statusmessage':
      return { command: 'setStatusMessageConfig', params: { config: { nodeStatus: s.statusMessageNodeStatus } } };
    case 'trafficmanagement':
      return {
        command: 'setTrafficManagementConfig',
        params: { config: Object.fromEntries(Object.entries(FIELDS.trafficmanagement!).map(([from, to]) => [from, s[to]])) },
      };
    case 'tak':
      return { command: 'setTAKConfig', params: { config: { team: s.takTeam, role: s.takRole } } };
    case 'meshbeacon':
      return {
        command: 'setMeshBeaconConfig',
        params: {
          config: buildMeshBeaconConfigPayload({
            listenEnabled: s.meshBeaconListenEnabled,
            broadcastEnabled: s.meshBeaconBroadcastEnabled,
            legacySplit: s.meshBeaconLegacySplit,
            broadcastMessage: s.meshBeaconBroadcastMessage,
            broadcastOfferChannelName: s.meshBeaconBroadcastOfferChannelName,
            broadcastOfferChannelPsk: s.meshBeaconBroadcastOfferChannelPsk,
            broadcastOfferRegion: s.meshBeaconBroadcastOfferRegion,
            broadcastOfferPreset: s.meshBeaconBroadcastOfferPreset,
            broadcastIntervalSecs: s.meshBeaconBroadcastIntervalSecs,
            broadcastTargets: s.meshBeaconBroadcastTargets,
          }),
        },
      };
    default:
      return { error: t('admin_commands.failed_execute_command') };
  }
}
