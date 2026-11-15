/**
 * Station G2's device configuration (`GET /api/config/current`), the shape
 * `useDeviceConfigState` reads: firmware 2.7.15, role CLIENT, and the module
 * set of boards 12-07 / b-set-p4 (External Notification, MQTT, Neighbor Info,
 * Store & Forward and Telemetry on; Audio, Paxcounter and TAK not on this
 * firmware). Other devices answer 404, as a radio-less source would.
 *
 * Not in fixtureApi's defaults: Classic's chrome snapshot reads the same
 * endpoints (its status pill), so settings tests and boards pass these in.
 */
import { SOURCE_IDS } from './athens';
import type { FixtureHandler } from './fixtureApi';

export const g2DeviceConfig = {
  isBridged: false,
  mqttProxyClientAttached: false,
  localNodeInfo: { nodeNum: 0xa1b2c300, longName: 'Station G2', shortName: 'G2', firmwareVersion: '2.7.15', isUnmessagable: false, isLicensed: false },
  deviceConfig: {
    device: { role: 0, nodeInfoBroadcastSecs: 10_800, rebroadcastMode: 0, ledHeartbeatDisabled: false, buttonGpio: 13, buzzerGpio: 4 },
    lora: { usePreset: true, modemPreset: 0, region: 3, hopLimit: 3, txEnabled: true, txPower: 27 },
    position: { positionBroadcastSecs: 900, positionBroadcastSmartEnabled: true, fixedPosition: true },
    power: { isPowerSaving: false },
    network: { wifiEnabled: true, wifiSsid: 'Athens-Lab', ntpServer: 'pool.ntp.org' },
    display: { screenOnSecs: 60 },
    security: { publicKey: '', adminKey: [], isManaged: false, serialEnabled: true },
  },
  moduleConfig: {
    mqtt: { enabled: true, address: 'mqtt.meshtastic.org', root: 'msh/EU_868' },
    neighborInfo: { enabled: true, updateInterval: 21_600 },
    telemetry: { deviceTelemetryEnabled: true, deviceUpdateInterval: 1800, environmentMeasurementEnabled: false },
    externalNotification: { enabled: true },
    storeForward: { enabled: true, isServer: true, records: 100 },
    rangeTest: { enabled: false },
    cannedMessage: { enabled: false },
    serial: { enabled: false },
  },
  supportedModules: {
    mqtt: true, serial: true, extnotif: true, storeforward: true, rangetest: true, telemetry: true, cannedmsg: true,
    audio: false, remotehardware: true, neighborinfo: true, ambientlighting: true, detectionsensor: true,
    paxcounter: false, bluetooth: true, network: true, tak: false,
    statusmessage: true, trafficManagement: true, meshBeacon: true, takConfig: false, rangeTest: true, aeadChannels: false,
  },
};

export const deviceConfigFixtures: Record<string, FixtureHandler> = {
  'GET /api/config/current': (url: URL) =>
    url.searchParams.get('sourceId') === SOURCE_IDS.g2 ? g2DeviceConfig : undefined,
  'GET /api/device/security-keys': () => ({ publicKey: null, privateKey: null }),
  'GET /api/health': () => ({ status: 'ok', version: 'fixture', firmwareOtaEnabled: false }),
};
