/**
 * Device configuration state for one Meshtastic source, extracted from
 * ConfigurationTab so Classic and the Workspace settings screens share it
 * (#6365, Rule X). Every value/setter pair ConfigurationTab owned, the initial
 * load from `/api/config/current`, and the UI flags the saves drive.
 *
 * Moved unchanged: the load sends the same requests in the same order.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { logger } from '../../utils/logger';
import type { ExcludedModuleKey } from '../../utils/excludedModules';
import { toKnownPolicy } from '../../utils/packetSignaturePolicy';
import { normalizeTakConfig } from '../../utils/takConfig';
import { unpackMeshBeaconFlags, pskToBase64, MESH_BEACON_MIN_INTERVAL_SECS, type BroadcastTarget } from '../../components/admin-commands/useAdminCommandsState';
import { ROLE_MAP, REGION_MAP, resolveModemPresetValue, UNKNOWN_MODEM_PRESET } from '../../components/configuration/constants';

/**
 * `supportedModules` from `/api/config` (#5065). Bitmask keys are optional so
 * an older server, or a response that predates the field, reads as undefined
 * and leaves every section enabled — the gate only acts on an explicit false.
 */
export type SupportedModules = Partial<Record<ExcludedModuleKey, boolean>> & {
  statusmessage: boolean;
  trafficManagement: boolean;
  meshBeacon: boolean;
  /** Firmware carries the TAK module config (2.8.0+). Absent on an older server. */
  takConfig?: boolean;
  rangeTest?: boolean;
  /** AES-CCM channels, firmware 2.8.1+ (#5248). Absent on an older server. */
  aeadChannels?: boolean;
};

/**
 * `sourceId` may be null outside a SourceProvider (Classic's legacy view);
 * the api then targets the primary source, as it always has.
 *
 * `load: false` (Workspace's remote target, Task 5.9) holds a second set of
 * values that never loads from this source's radio: it starts not loading and
 * sends nothing; its owner fills it from what a remote node answers.
 */
export function useDeviceConfigState(sourceId: string | null, refreshTrigger?: number, { load = true }: { load?: boolean } = {}) {
  const { t } = useTranslation();

  // Device Config State
  const [longName, setLongName] = useState('');
  const [shortName, setShortName] = useState('');
  const [isUnmessagable, setIsUnmessagable] = useState(false);
  const [isLicensed, setIsLicensed] = useState(false);
  const [role, setRole] = useState<number>(0);
  const [nodeInfoBroadcastSecs, setNodeInfoBroadcastSecs] = useState(3600);
  const [tzdef, setTzdef] = useState('');
  const [rebroadcastMode, setRebroadcastMode] = useState(0);
  const [doubleTapAsButtonPress, setDoubleTapAsButtonPress] = useState(false);
  const [disableTripleClick, setDisableTripleClick] = useState(false);
  const [ledHeartbeatDisabled, setLedHeartbeatDisabled] = useState(false);
  const [buzzerMode, setBuzzerMode] = useState(0);
  const [buttonGpio, setButtonGpio] = useState(0);
  const [buzzerGpio, setBuzzerGpio] = useState(0);

  // LoRa Config State
  // proto3 elides zero values from the wire, so a bool field the user set
  // to `false` arrives as `undefined` here. The initial state MUST be the
  // proto3 zero (`false`) so the UI reflects reality when a load skips or
  // the guard fails (#5028 class).
  const [usePreset, setUsePreset] = useState(false);
  const [modemPreset, setModemPreset] = useState<number>(0);
  // Raw preset the radio reported when MeshMonitor cannot name it (#5547).
  // While set, modemPreset holds UNKNOWN_MODEM_PRESET and the LoRa save path
  // refuses to invent a value for it.
  const [unknownModemPresetName, setUnknownModemPresetName] = useState<string | null>(null);
  // Local node firmware version, from /api/config localNodeInfo. Gates the
  // 2.8-only modem presets and picks the region preset rule (#5547).
  const [localFirmwareVersion, setLocalFirmwareVersion] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState<number>(250);
  const [spreadFactor, setSpreadFactor] = useState<number>(11);
  const [codingRate, setCodingRate] = useState<number>(8);
  const [frequencyOffset, setFrequencyOffset] = useState<number>(0);
  const [overrideFrequency, setOverrideFrequency] = useState<number>(0);
  const [region, setRegion] = useState<number>(0);
  const [hopLimit, setHopLimit] = useState<number>(3);
  const [txPower, setTxPower] = useState<number>(0);
  const [channelNum, setChannelNum] = useState<number>(0);
  // FEM_LNA_Mode enum (firmware >= v2.7.20): 0=DISABLED (proto3 zero/default), 1=ENABLED, 2=NOT_PRESENT
  const [femLnaMode, setFemLnaMode] = useState<number>(0);
  const [sx126xRxBoostedGain, setSx126xRxBoostedGain] = useState<boolean>(false);
  const [ignoreMqtt, setIgnoreMqtt] = useState<boolean>(false);
  const [configOkToMqtt, setConfigOkToMqtt] = useState<boolean>(false);
  const [txEnabled, setTxEnabled] = useState<boolean>(true);
  const [overrideDutyCycle, setOverrideDutyCycle] = useState<boolean>(false);
  const [paFanDisabled, setPaFanDisabled] = useState<boolean>(false);

  // Position Config State
  const [positionBroadcastSecs, setPositionBroadcastSecs] = useState(900);
  const [positionSmartEnabled, setPositionSmartEnabled] = useState(false);
  const [fixedPosition, setFixedPosition] = useState(false);
  const [fixedLatitude, setFixedLatitude] = useState<number>(0);
  const [fixedLongitude, setFixedLongitude] = useState<number>(0);
  const [fixedAltitude, setFixedAltitude] = useState<number>(0);
  const [gpsUpdateInterval, setGpsUpdateInterval] = useState(0);
  const [gpsMode, setGpsMode] = useState(0);
  const [broadcastSmartMinimumDistance, setBroadcastSmartMinimumDistance] = useState(0);
  const [broadcastSmartMinimumIntervalSecs, setBroadcastSmartMinimumIntervalSecs] = useState(0);
  const [positionFlags, setPositionFlags] = useState(0);
  const [rxGpio, setRxGpio] = useState(0);
  const [txGpio, setTxGpio] = useState(0);
  const [gpsEnGpio, setGpsEnGpio] = useState(0);

  // MQTT Config State
  const [mqttEnabled, setMqttEnabled] = useState(false);
  const [mqttAddress, setMqttAddress] = useState('');
  const [mqttUsername, setMqttUsername] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttEncryptionEnabled, setMqttEncryptionEnabled] = useState(false);
  const [mqttJsonEnabled, setMqttJsonEnabled] = useState(false);
  const [mqttRoot, setMqttRoot] = useState('');
  const [mqttTlsEnabled, setMqttTlsEnabled] = useState(false);
  const [mqttProxyToClientEnabled, setMqttProxyToClientEnabled] = useState(false);
  // Whether this source's node is bridged (no native WiFi/Ethernet — reached via
  // a TCP proxy). Drives the MQTT Client Proxy recommendation in the MQTT section.
  const [isBridged, setIsBridged] = useState(false);
  // A Virtual Node client carries MQTT for this node (#5013); see MQTTConfigSection.
  const [mqttProxyClientAttached, setMqttProxyClientAttached] = useState(false);
  const [mqttMapReportingEnabled, setMqttMapReportingEnabled] = useState(false);
  const [mqttMapPublishIntervalSecs, setMqttMapPublishIntervalSecs] = useState(0);
  // 0 = firmware default (14 bits); a node that reports 0 must load as 0.
  const [mqttMapPositionPrecision, setMqttMapPositionPrecision] = useState(0);
  // MapReportSettings.should_report_location (fw 2.6.8+): the node's consent
  // to put its position in map reports. Save must send it back as loaded.
  const [mqttMapShouldReportLocation, setMqttMapShouldReportLocation] = useState(false);

  // NeighborInfo Config State
  const [neighborInfoEnabled, setNeighborInfoEnabled] = useState(false);
  const [neighborInfoInterval, setNeighborInfoInterval] = useState(14400);
  const [neighborInfoTransmitOverLora, setNeighborInfoTransmitOverLora] = useState(false);

  // Network Config State - store full config to avoid wiping fields when saving
  const [wifiEnabled, setWifiEnabled] = useState(false);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPsk, setWifiPsk] = useState('');
  const [ntpServer, setNtpServer] = useState('');
  const [rsyslogServer, setRsyslogServer] = useState('');
  const [addressMode, setAddressMode] = useState(0);
  const [ipv4Address, setIpv4Address] = useState('');
  const [ipv4Gateway, setIpv4Gateway] = useState('');
  const [ipv4Subnet, setIpv4Subnet] = useState('');
  const [ipv4Dns, setIpv4Dns] = useState('');
  const [enabledProtocols, setEnabledProtocols] = useState(0);
  const [fullNetworkConfig, setFullNetworkConfig] = useState<Record<string, unknown> | null>(null);

  // Power Config State
  const [isPowerSaving, setIsPowerSaving] = useState(false);
  const [onBatteryShutdownAfterSecs, setOnBatteryShutdownAfterSecs] = useState(0);
  const [adcMultiplierOverride, setAdcMultiplierOverride] = useState(0);
  const [waitBluetoothSecs, setWaitBluetoothSecs] = useState(60);
  const [sdsSecs, setSdsSecs] = useState(31536000);
  const [lsSecs, setLsSecs] = useState(300);
  const [minWakeSecs, setMinWakeSecs] = useState(10);
  const [deviceBatteryInaAddress, setDeviceBatteryInaAddress] = useState(0);

  // Display Config State
  const [screenOnSecs, setScreenOnSecs] = useState(60);
  const [autoScreenCarouselSecs, setAutoScreenCarouselSecs] = useState(0);
  const [flipScreen, setFlipScreen] = useState(false);
  const [displayUnits, setDisplayUnits] = useState(0);
  const [oled, setOled] = useState(0);
  const [displayMode, setDisplayMode] = useState(0);
  const [headingBold, setHeadingBold] = useState(false);
  const [wakeOnTapOrMotion, setWakeOnTapOrMotion] = useState(false);
  const [compassOrientation, setCompassOrientation] = useState(0);

  // Telemetry Config State
  const [deviceUpdateInterval, setDeviceUpdateInterval] = useState(900);
  const [deviceTelemetryEnabled, setDeviceTelemetryEnabled] = useState(false);
  const [environmentUpdateInterval, setEnvironmentUpdateInterval] = useState(900);
  const [environmentMeasurementEnabled, setEnvironmentMeasurementEnabled] = useState(false);
  const [environmentScreenEnabled, setEnvironmentScreenEnabled] = useState(false);
  const [environmentDisplayFahrenheit, setEnvironmentDisplayFahrenheit] = useState(false);
  const [airQualityEnabled, setAirQualityEnabled] = useState(false);
  const [airQualityInterval, setAirQualityInterval] = useState(900);
  const [powerMeasurementEnabled, setPowerMeasurementEnabled] = useState(false);
  const [powerUpdateInterval, setPowerUpdateInterval] = useState(900);
  const [powerScreenEnabled, setPowerScreenEnabled] = useState(false);
  const [healthMeasurementEnabled, setHealthMeasurementEnabled] = useState(false);
  const [healthUpdateInterval, setHealthUpdateInterval] = useState(900);
  const [healthScreenEnabled, setHealthScreenEnabled] = useState(false);
  // Bumped whenever config is (re)loaded from the node, so each section can
  // move its SaveBar baseline to the loaded values (#5797).
  const [configVersion, setConfigVersion] = useState(0);

  // External Notification Config State
  const [extNotifEnabled, setExtNotifEnabled] = useState(false);
  const [extNotifOutputMs, setExtNotifOutputMs] = useState(1000);
  const [extNotifOutput, setExtNotifOutput] = useState(0);
  const [extNotifActive, setExtNotifActive] = useState(false);
  const [extNotifAlertMessage, setExtNotifAlertMessage] = useState(false);
  const [extNotifAlertMessageVibra, setExtNotifAlertMessageVibra] = useState(false);
  const [extNotifAlertMessageBuzzer, setExtNotifAlertMessageBuzzer] = useState(false);
  const [extNotifAlertBell, setExtNotifAlertBell] = useState(false);
  const [extNotifAlertBellVibra, setExtNotifAlertBellVibra] = useState(false);
  const [extNotifAlertBellBuzzer, setExtNotifAlertBellBuzzer] = useState(false);
  const [extNotifUsePwm, setExtNotifUsePwm] = useState(false);
  const [extNotifNagTimeout, setExtNotifNagTimeout] = useState(0);
  const [extNotifUseI2sAsBuzzer, setExtNotifUseI2sAsBuzzer] = useState(false);
  const [extNotifOutputVibra, setExtNotifOutputVibra] = useState(0);
  const [extNotifOutputBuzzer, setExtNotifOutputBuzzer] = useState(0);

  // Store & Forward Config State
  const [storeForwardEnabled, setStoreForwardEnabled] = useState(false);
  const [storeForwardHeartbeat, setStoreForwardHeartbeat] = useState(false);
  const [storeForwardRecords, setStoreForwardRecords] = useState(0);
  const [storeForwardHistoryReturnMax, setStoreForwardHistoryReturnMax] = useState(0);
  const [storeForwardHistoryReturnWindow, setStoreForwardHistoryReturnWindow] = useState(0);
  const [storeForwardIsServer, setStoreForwardIsServer] = useState(false);

  // Range Test Config State
  const [rangeTestEnabled, setRangeTestEnabled] = useState(false);
  const [rangeTestSender, setRangeTestSender] = useState(0);
  const [rangeTestSave, setRangeTestSave] = useState(false);

  // Canned Message Config State
  const [cannedMsgEnabled, setCannedMsgEnabled] = useState(false);
  const [cannedMsgRotary1Enabled, setCannedMsgRotary1Enabled] = useState(false);
  const [cannedMsgInputbrokerPinA, setCannedMsgInputbrokerPinA] = useState(0);
  const [cannedMsgInputbrokerPinB, setCannedMsgInputbrokerPinB] = useState(0);
  const [cannedMsgInputbrokerPinPress, setCannedMsgInputbrokerPinPress] = useState(0);
  const [cannedMsgInputbrokerEventCw, setCannedMsgInputbrokerEventCw] = useState(0);
  const [cannedMsgInputbrokerEventCcw, setCannedMsgInputbrokerEventCcw] = useState(0);
  const [cannedMsgInputbrokerEventPress, setCannedMsgInputbrokerEventPress] = useState(0);
  const [cannedMsgUpdown1Enabled, setCannedMsgUpdown1Enabled] = useState(false);
  const [cannedMsgSendBell, setCannedMsgSendBell] = useState(false);
  const [cannedMsgAllowInputSource, setCannedMsgAllowInputSource] = useState(0);

  // Audio Config State
  const [audioCodec2Enabled, setAudioCodec2Enabled] = useState(false);
  const [audioPttPin, setAudioPttPin] = useState(0);
  const [audioBitrate, setAudioBitrate] = useState(0);
  const [audioI2sWs, setAudioI2sWs] = useState(0);
  const [audioI2sSd, setAudioI2sSd] = useState(0);
  const [audioI2sDin, setAudioI2sDin] = useState(0);
  const [audioI2sSck, setAudioI2sSck] = useState(0);

  // Remote Hardware Config State
  const [remoteHardwareEnabled, setRemoteHardwareEnabled] = useState(false);
  const [remoteHardwareAllowUndefinedPinAccess, setRemoteHardwareAllowUndefinedPinAccess] = useState(false);

  // Detection Sensor Config State
  const [detectionSensorEnabled, setDetectionSensorEnabled] = useState(false);
  const [detectionSensorMinimumBroadcastSecs, setDetectionSensorMinimumBroadcastSecs] = useState(0);
  const [detectionSensorStateBroadcastSecs, setDetectionSensorStateBroadcastSecs] = useState(0);
  const [detectionSensorSendBell, setDetectionSensorSendBell] = useState(false);
  const [detectionSensorName, setDetectionSensorName] = useState('');
  const [detectionSensorMonitorPin, setDetectionSensorMonitorPin] = useState(0);
  const [detectionSensorDetectionTriggerType, setDetectionSensorDetectionTriggerType] = useState(0);
  const [detectionSensorUsePullup, setDetectionSensorUsePullup] = useState(false);

  // Paxcounter Config State
  const [paxcounterEnabled, setPaxcounterEnabled] = useState(false);
  const [paxcounterUpdateInterval, setPaxcounterUpdateInterval] = useState(0);
  const [paxcounterWifiThreshold, setPaxcounterWifiThreshold] = useState(-80);
  const [paxcounterBleThreshold, setPaxcounterBleThreshold] = useState(-80);

  // Status Message Config State
  const [statusMessageNodeStatus, setStatusMessageNodeStatus] = useState('');

  // TAK Config State (#5613): team colour + member role, firmware 2.8.0+
  const [takTeam, setTakTeam] = useState(0);
  const [takRole, setTakRole] = useState(0);

  // Traffic Management Config State
  // Traffic Management — v2.8 "non-zero implies enabled" schema. The nine bool
  // toggles and position_precision_bits were removed upstream and their tags
  // reserved; a non-zero value on each remaining uint32 is what enables the
  // feature on the device (#5123).
  const [trafficManagementPositionMinIntervalSecs, setTrafficManagementPositionMinIntervalSecs] = useState(0);
  const [trafficManagementNodeinfoDirectResponseMaxHops, setTrafficManagementNodeinfoDirectResponseMaxHops] = useState(0);
  const [trafficManagementRateLimitWindowSecs, setTrafficManagementRateLimitWindowSecs] = useState(0);
  const [trafficManagementRateLimitMaxPackets, setTrafficManagementRateLimitMaxPackets] = useState(0);
  const [trafficManagementUnknownPacketThreshold, setTrafficManagementUnknownPacketThreshold] = useState(0);

  // MeshBeacon Config State (firmware 2.8+, #3854). The wire `flags` bitfield is
  // split into three booleans here and repacked on save.
  const [meshBeaconListenEnabled, setMeshBeaconListenEnabled] = useState(false);
  const [meshBeaconBroadcastEnabled, setMeshBeaconBroadcastEnabled] = useState(false);
  const [meshBeaconLegacySplit, setMeshBeaconLegacySplit] = useState(false);
  const [meshBeaconBroadcastMessage, setMeshBeaconBroadcastMessage] = useState('');
  const [meshBeaconBroadcastOfferChannelName, setMeshBeaconBroadcastOfferChannelName] = useState('');
  const [meshBeaconBroadcastOfferChannelPsk, setMeshBeaconBroadcastOfferChannelPsk] = useState('');
  const [meshBeaconBroadcastOfferRegion, setMeshBeaconBroadcastOfferRegion] = useState(0);
  // null = advertise no preset; the proto field is `optional`, so this is not 0.
  const [meshBeaconBroadcastOfferPreset, setMeshBeaconBroadcastOfferPreset] = useState<number | null>(null);
  // Interval + broadcast targets (issue #4802). The single `broadcast_on_*`
  // transmit fields were removed from the firmware and their tags reserved
  // (issue #5062) — the targets list is now the only transmit destination.
  const [meshBeaconBroadcastIntervalSecs, setMeshBeaconBroadcastIntervalSecs] = useState(MESH_BEACON_MIN_INTERVAL_SECS);
  const [meshBeaconBroadcastTargets, setMeshBeaconBroadcastTargets] = useState<BroadcastTarget[]>([]);

  // Supported modules tracking (for unsupported firmware detection)
  // `rangeTest` is optional on purpose (#5031). The backend always sends it, but
  // it is the one gate that must fail OPEN, so the type keeps "absent" a legal
  // state — a response from an older server, or a shape change, then reads as
  // "supported" rather than flashing a removal notice at a node that still has
  // the module. The consumer below tests `=== false` for the same reason.
  const [supportedModules, setSupportedModules] = useState<SupportedModules | null>(null);

  // Serial Config State
  const [serialEnabled, setSerialEnabled] = useState(false);
  const [serialEcho, setSerialEcho] = useState(false);
  const [serialRxd, setSerialRxd] = useState(0);
  const [serialTxd, setSerialTxd] = useState(0);
  const [serialBaud, setSerialBaud] = useState(0);
  const [serialTimeout, setSerialTimeout] = useState(0);
  const [serialMode, setSerialMode] = useState(0);
  const [serialOverrideConsoleSerialPort, setSerialOverrideConsoleSerialPort] = useState(false);

  // Ambient Lighting Config State
  const [ambientLedState, setAmbientLedState] = useState(false);
  const [ambientCurrent, setAmbientCurrent] = useState(10);
  const [ambientRed, setAmbientRed] = useState(0);
  const [ambientGreen, setAmbientGreen] = useState(0);
  const [ambientBlue, setAmbientBlue] = useState(0);

  // Security Config State
  const [securityPublicKey, setSecurityPublicKey] = useState('');
  const [securityPrivateKey, setSecurityPrivateKey] = useState('');
  // The private key as loaded from the device, so a save can tell whether the
  // user actually pasted a new one (#4632) vs. left the existing identity.
  const loadedSecurityPrivateKeyRef = useRef('');
  const [securityAdminKeys, setSecurityAdminKeys] = useState<string[]>(['']);
  const [securityIsManaged, setSecurityIsManaged] = useState(false);
  const [securitySerialEnabled, setSecuritySerialEnabled] = useState(false);
  const [securityDebugLogApiEnabled, setSecurityDebugLogApiEnabled] = useState(false);
  const [securityAdminChannelEnabled, setSecurityAdminChannelEnabled] = useState(false);
  // Packet signature policy (#5612): what the node holds, and what the form
  // shows. null = not read from the node; the picker then stays disabled.
  const [securityLoadedSignaturePolicy, setSecurityLoadedSignaturePolicy] = useState<number | null>(null);
  const [securitySignaturePolicy, setSecuritySignaturePolicy] = useState<number | null>(null);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(load);
  const [isReloading, setIsReloading] = useState(false);
  const [configChanges, setConfigChanges] = useState<{ field: string; oldValue: string; newValue: string }[]>([]);
  const [showChanges, setShowChanges] = useState(false);

  // Fetch current configuration on mount (run once only)
  useEffect(() => {
    if (!load) return;
    const fetchConfig = async () => {
      console.log(`[ConfigurationTab] useEffect triggered - refreshTrigger=${refreshTrigger}`);
      try {
        setIsLoading(true);
        console.log('[ConfigurationTab] Fetching config from API...');
        const config = await apiService.getCurrentConfig(sourceId);
        console.log('[ConfigurationTab] Received config:', config);

        setIsBridged(config.isBridged || false);
        setMqttProxyClientAttached(config.mqttProxyClientAttached === true);

        // Populate node info from localNodeInfo
        if (config.localNodeInfo) {
          setLongName(config.localNodeInfo.longName || '');
          setShortName(config.localNodeInfo.shortName || '');
          setIsUnmessagable(config.localNodeInfo.isUnmessagable || false);
          setIsLicensed(config.localNodeInfo.isLicensed || false);
          setLocalFirmwareVersion(config.localNodeInfo.firmwareVersion ?? null);
        }

        // Populate device config
        if (config.deviceConfig?.device) {
          if (config.deviceConfig.device.role !== undefined) {
            const roleValue = typeof config.deviceConfig.device.role === 'string'
              ? ROLE_MAP[config.deviceConfig.device.role] || 0
              : config.deviceConfig.device.role;
            setRole(roleValue);
          }
          if (config.deviceConfig.device.nodeInfoBroadcastSecs !== undefined) {
            setNodeInfoBroadcastSecs(config.deviceConfig.device.nodeInfoBroadcastSecs);
          }
          if (config.deviceConfig.device.tzdef !== undefined) {
            setTzdef(config.deviceConfig.device.tzdef);
          }
          if (config.deviceConfig.device.rebroadcastMode !== undefined) {
            setRebroadcastMode(config.deviceConfig.device.rebroadcastMode);
          }
          if (config.deviceConfig.device.doubleTapAsButtonPress !== undefined) {
            setDoubleTapAsButtonPress(config.deviceConfig.device.doubleTapAsButtonPress);
          }
          if (config.deviceConfig.device.disableTripleClick !== undefined) {
            setDisableTripleClick(config.deviceConfig.device.disableTripleClick);
          }
          if (config.deviceConfig.device.ledHeartbeatDisabled !== undefined) {
            setLedHeartbeatDisabled(config.deviceConfig.device.ledHeartbeatDisabled);
          }
          if (config.deviceConfig.device.buzzerMode !== undefined) {
            setBuzzerMode(config.deviceConfig.device.buzzerMode);
          }
          if (config.deviceConfig.device.buttonGpio !== undefined) {
            setButtonGpio(config.deviceConfig.device.buttonGpio);
          }
          if (config.deviceConfig.device.buzzerGpio !== undefined) {
            setBuzzerGpio(config.deviceConfig.device.buzzerGpio);
          }
        }

        // Populate LoRa config
        if (config.deviceConfig?.lora) {
          // proto3 elides `false` from the wire, so treat missing as false
          // rather than skipping the update (#5028 class).
          setUsePreset(config.deviceConfig.lora.usePreset === true);
          if (config.deviceConfig.lora.modemPreset !== undefined) {
            // Never coerce an unrecognised preset to 0 (LONG_FAST): the save is
            // a whole-struct replace and would push LONG_FAST to the radio (#5547).
            const presetValue = resolveModemPresetValue(config.deviceConfig.lora.modemPreset);
            if (presetValue === null) {
              setUnknownModemPresetName(String(config.deviceConfig.lora.modemPreset));
              setModemPreset(UNKNOWN_MODEM_PRESET);
            } else {
              setUnknownModemPresetName(null);
              setModemPreset(presetValue);
            }
          }
          if (config.deviceConfig.lora.bandwidth !== undefined) {
            setBandwidth(config.deviceConfig.lora.bandwidth);
          }
          if (config.deviceConfig.lora.spreadFactor !== undefined) {
            setSpreadFactor(config.deviceConfig.lora.spreadFactor);
          }
          if (config.deviceConfig.lora.codingRate !== undefined) {
            setCodingRate(config.deviceConfig.lora.codingRate);
          }
          if (config.deviceConfig.lora.frequencyOffset !== undefined) {
            setFrequencyOffset(config.deviceConfig.lora.frequencyOffset);
          }
          if (config.deviceConfig.lora.overrideFrequency !== undefined) {
            setOverrideFrequency(config.deviceConfig.lora.overrideFrequency);
          }
          if (config.deviceConfig.lora.region !== undefined) {
            const regionValue = typeof config.deviceConfig.lora.region === 'string'
              ? REGION_MAP[config.deviceConfig.lora.region] || 0
              : config.deviceConfig.lora.region;
            setRegion(regionValue);
          }
          if (config.deviceConfig.lora.hopLimit !== undefined) {
            console.log(`[ConfigurationTab] Setting hopLimit to: ${config.deviceConfig.lora.hopLimit}`);
            setHopLimit(config.deviceConfig.lora.hopLimit);
          }
          if (config.deviceConfig.lora.txPower !== undefined) {
            setTxPower(config.deviceConfig.lora.txPower);
          }
          if (config.deviceConfig.lora.channelNum !== undefined) {
            setChannelNum(config.deviceConfig.lora.channelNum);
          }
          if (config.deviceConfig.lora.femLnaMode !== undefined) {
            setFemLnaMode(config.deviceConfig.lora.femLnaMode);
          }
          if (config.deviceConfig.lora.sx126xRxBoostedGain !== undefined) {
            setSx126xRxBoostedGain(config.deviceConfig.lora.sx126xRxBoostedGain);
          }
          if (config.deviceConfig.lora.ignoreMqtt !== undefined) {
            setIgnoreMqtt(config.deviceConfig.lora.ignoreMqtt);
          }
          if (config.deviceConfig.lora.configOkToMqtt !== undefined) {
            setConfigOkToMqtt(config.deviceConfig.lora.configOkToMqtt);
          }
          if (config.deviceConfig.lora.txEnabled !== undefined) {
            setTxEnabled(config.deviceConfig.lora.txEnabled);
          }
          if (config.deviceConfig.lora.overrideDutyCycle !== undefined) {
            setOverrideDutyCycle(config.deviceConfig.lora.overrideDutyCycle);
          }
          if (config.deviceConfig.lora.paFanDisabled !== undefined) {
            setPaFanDisabled(config.deviceConfig.lora.paFanDisabled);
          }
        }

        // Populate position config
        if (config.deviceConfig?.position) {
          if (config.deviceConfig.position.positionBroadcastSecs !== undefined) {
            setPositionBroadcastSecs(config.deviceConfig.position.positionBroadcastSecs);
          }
          setPositionSmartEnabled(config.deviceConfig.position.positionBroadcastSmartEnabled === true);
          if (config.deviceConfig.position.fixedPosition !== undefined) {
            setFixedPosition(config.deviceConfig.position.fixedPosition);
          }
          if (config.deviceConfig.position.gpsUpdateInterval !== undefined) {
            setGpsUpdateInterval(config.deviceConfig.position.gpsUpdateInterval);
          }
          // GpsMode.DISABLED = 0 is a real enum value and proto3 elides it
          // from the wire; fall through to 0 rather than keeping the init (#5028).
          setGpsMode(config.deviceConfig.position.gpsMode ?? 0);
          if (config.deviceConfig.position.broadcastSmartMinimumDistance !== undefined) {
            setBroadcastSmartMinimumDistance(config.deviceConfig.position.broadcastSmartMinimumDistance);
          }
          if (config.deviceConfig.position.broadcastSmartMinimumIntervalSecs !== undefined) {
            setBroadcastSmartMinimumIntervalSecs(config.deviceConfig.position.broadcastSmartMinimumIntervalSecs);
          }
          if (config.deviceConfig.position.positionFlags !== undefined) {
            setPositionFlags(config.deviceConfig.position.positionFlags);
          }
          if (config.deviceConfig.position.rxGpio !== undefined) {
            setRxGpio(config.deviceConfig.position.rxGpio);
          }
          if (config.deviceConfig.position.txGpio !== undefined) {
            setTxGpio(config.deviceConfig.position.txGpio);
          }
          if (config.deviceConfig.position.gpsEnGpio !== undefined) {
            setGpsEnGpio(config.deviceConfig.position.gpsEnGpio);
          }
        }

        // Populate MQTT config
        if (config.moduleConfig?.mqtt) {
          setMqttEnabled(config.moduleConfig.mqtt.enabled || false);
          setMqttAddress(config.moduleConfig.mqtt.address || '');
          setMqttUsername(config.moduleConfig.mqtt.username || '');
          setMqttPassword(config.moduleConfig.mqtt.password || '');
          // proto3 elides `false`; `!== false` misreads elided-false as true (#5028 class).
          setMqttEncryptionEnabled(config.moduleConfig.mqtt.encryptionEnabled === true);
          setMqttJsonEnabled(config.moduleConfig.mqtt.jsonEnabled || false);
          setMqttRoot(config.moduleConfig.mqtt.root || '');
          setMqttTlsEnabled(config.moduleConfig.mqtt.tlsEnabled || false);
          setMqttProxyToClientEnabled(config.moduleConfig.mqtt.proxyToClientEnabled || false);
          setMqttMapReportingEnabled(config.moduleConfig.mqtt.mapReportingEnabled || false);
          setMqttMapPublishIntervalSecs(config.moduleConfig.mqtt.mapReportSettings?.publishIntervalSecs || 0);
          // A stored 0 is "firmware default" and stays 0; it used to load as 14.
          setMqttMapPositionPrecision(config.moduleConfig.mqtt.mapReportSettings?.positionPrecision ?? 0);
          setMqttMapShouldReportLocation(config.moduleConfig.mqtt.mapReportSettings?.shouldReportLocation === true);
        }

        // Populate NeighborInfo config
        if (config.moduleConfig?.neighborInfo) {
          setNeighborInfoEnabled(config.moduleConfig.neighborInfo.enabled || false);
          setNeighborInfoInterval(config.moduleConfig.neighborInfo.updateInterval || 14400);
          setNeighborInfoTransmitOverLora(config.moduleConfig.neighborInfo.transmitOverLora || false);
        }

        // Populate Network config - store full config to preserve all fields when saving
        if (config.deviceConfig?.network) {
          setFullNetworkConfig(config.deviceConfig.network);
          setWifiEnabled(config.deviceConfig.network.wifiEnabled || false);
          setWifiSsid(config.deviceConfig.network.wifiSsid || '');
          setWifiPsk(config.deviceConfig.network.wifiPsk || '');
          setNtpServer(config.deviceConfig.network.ntpServer || '');
          setRsyslogServer(config.deviceConfig.network.rsyslogServer || '');
          setAddressMode(config.deviceConfig.network.addressMode ?? 0);
          setEnabledProtocols(config.deviceConfig.network.enabledProtocols || 0);
          // Static IP config
          if (config.deviceConfig.network.ipv4Config) {
            setIpv4Address(config.deviceConfig.network.ipv4Config.ip || '');
            setIpv4Gateway(config.deviceConfig.network.ipv4Config.gateway || '');
            setIpv4Subnet(config.deviceConfig.network.ipv4Config.subnet || '');
            setIpv4Dns(config.deviceConfig.network.ipv4Config.dns || '');
          }
        }

        // Populate Power config
        if (config.deviceConfig?.power) {
          setIsPowerSaving(config.deviceConfig.power.isPowerSaving || false);
          setOnBatteryShutdownAfterSecs(config.deviceConfig.power.onBatteryShutdownAfterSecs || 0);
          setAdcMultiplierOverride(config.deviceConfig.power.adcMultiplierOverride || 0);
          setWaitBluetoothSecs(config.deviceConfig.power.waitBluetoothSecs ?? 60);
          setSdsSecs(config.deviceConfig.power.sdsSecs ?? 31536000);
          setLsSecs(config.deviceConfig.power.lsSecs ?? 300);
          setMinWakeSecs(config.deviceConfig.power.minWakeSecs ?? 10);
          setDeviceBatteryInaAddress(config.deviceConfig.power.deviceBatteryInaAddress || 0);
        }

        // Populate Display config
        if (config.deviceConfig?.display) {
          setScreenOnSecs(config.deviceConfig.display.screenOnSecs ?? 60);
          setAutoScreenCarouselSecs(config.deviceConfig.display.autoScreenCarouselSecs || 0);
          setFlipScreen(config.deviceConfig.display.flipScreen || false);
          setDisplayUnits(config.deviceConfig.display.units ?? 0);
          setOled(config.deviceConfig.display.oled ?? 0);
          setDisplayMode(config.deviceConfig.display.displaymode ?? 0);
          setHeadingBold(config.deviceConfig.display.headingBold || false);
          setWakeOnTapOrMotion(config.deviceConfig.display.wakeOnTapOrMotion || false);
          setCompassOrientation(config.deviceConfig.display.compassOrientation ?? 0);
        }

        // Populate Telemetry config
        if (config.moduleConfig?.telemetry) {
          setDeviceUpdateInterval(config.moduleConfig.telemetry.deviceUpdateInterval ?? 900);
          setDeviceTelemetryEnabled(config.moduleConfig.telemetry.deviceTelemetryEnabled || false);
          setEnvironmentUpdateInterval(config.moduleConfig.telemetry.environmentUpdateInterval ?? 900);
          setEnvironmentMeasurementEnabled(config.moduleConfig.telemetry.environmentMeasurementEnabled || false);
          setEnvironmentScreenEnabled(config.moduleConfig.telemetry.environmentScreenEnabled || false);
          setEnvironmentDisplayFahrenheit(config.moduleConfig.telemetry.environmentDisplayFahrenheit || false);
          setAirQualityEnabled(config.moduleConfig.telemetry.airQualityEnabled || false);
          setAirQualityInterval(config.moduleConfig.telemetry.airQualityInterval ?? 900);
          setPowerMeasurementEnabled(config.moduleConfig.telemetry.powerMeasurementEnabled || false);
          setPowerUpdateInterval(config.moduleConfig.telemetry.powerUpdateInterval ?? 900);
          setPowerScreenEnabled(config.moduleConfig.telemetry.powerScreenEnabled || false);
          setHealthMeasurementEnabled(config.moduleConfig.telemetry.healthMeasurementEnabled || false);
          setHealthUpdateInterval(config.moduleConfig.telemetry.healthUpdateInterval ?? 900);
          setHealthScreenEnabled(config.moduleConfig.telemetry.healthScreenEnabled || false);
          // Increment version to signal config load to TelemetryConfigSection
          setConfigVersion(v => v + 1);
        }

        // Populate External Notification config
        if (config.moduleConfig?.externalNotification) {
          const extNotif = config.moduleConfig.externalNotification;
          setExtNotifEnabled(extNotif.enabled || false);
          setExtNotifOutputMs(extNotif.outputMs ?? 1000);
          setExtNotifOutput(extNotif.output ?? 0);
          setExtNotifActive(extNotif.active || false);
          setExtNotifAlertMessage(extNotif.alertMessage || false);
          setExtNotifAlertMessageVibra(extNotif.alertMessageVibra || false);
          setExtNotifAlertMessageBuzzer(extNotif.alertMessageBuzzer || false);
          setExtNotifAlertBell(extNotif.alertBell || false);
          setExtNotifAlertBellVibra(extNotif.alertBellVibra || false);
          setExtNotifAlertBellBuzzer(extNotif.alertBellBuzzer || false);
          setExtNotifUsePwm(extNotif.usePwm || false);
          setExtNotifNagTimeout(extNotif.nagTimeout ?? 0);
          setExtNotifUseI2sAsBuzzer(extNotif.useI2sAsBuzzer || false);
          setExtNotifOutputVibra(extNotif.outputVibra ?? 0);
          setExtNotifOutputBuzzer(extNotif.outputBuzzer ?? 0);
        }

        // Populate Store & Forward config
        if (config.moduleConfig?.storeForward) {
          const sf = config.moduleConfig.storeForward;
          setStoreForwardEnabled(sf.enabled || false);
          setStoreForwardHeartbeat(sf.heartbeat || false);
          setStoreForwardRecords(sf.records ?? 0);
          setStoreForwardHistoryReturnMax(sf.historyReturnMax ?? 0);
          setStoreForwardHistoryReturnWindow(sf.historyReturnWindow ?? 0);
          setStoreForwardIsServer(sf.isServer || false);
        }

        // Populate Range Test config
        if (config.moduleConfig?.rangeTest) {
          const rt = config.moduleConfig.rangeTest;
          setRangeTestEnabled(rt.enabled || false);
          setRangeTestSender(rt.sender ?? 0);
          setRangeTestSave(rt.save || false);
        }

        // Populate Canned Message config
        if (config.moduleConfig?.cannedMessage) {
          const cm = config.moduleConfig.cannedMessage;
          setCannedMsgEnabled(cm.enabled || false);
          setCannedMsgRotary1Enabled(cm.rotary1Enabled || false);
          setCannedMsgInputbrokerPinA(cm.inputbrokerPinA ?? 0);
          setCannedMsgInputbrokerPinB(cm.inputbrokerPinB ?? 0);
          setCannedMsgInputbrokerPinPress(cm.inputbrokerPinPress ?? 0);
          setCannedMsgInputbrokerEventCw(cm.inputbrokerEventCw ?? 0);
          setCannedMsgInputbrokerEventCcw(cm.inputbrokerEventCcw ?? 0);
          setCannedMsgInputbrokerEventPress(cm.inputbrokerEventPress ?? 0);
          setCannedMsgUpdown1Enabled(cm.updown1Enabled || false);
          setCannedMsgSendBell(cm.sendBell || false);
          setCannedMsgAllowInputSource(cm.allowInputSource ?? 0);
        }

        // Populate Audio config
        if (config.moduleConfig?.audio) {
          const audio = config.moduleConfig.audio;
          setAudioCodec2Enabled(audio.codec2Enabled || false);
          setAudioPttPin(audio.pttPin ?? 0);
          setAudioBitrate(audio.bitrate ?? 0);
          setAudioI2sWs(audio.i2sWs ?? 0);
          setAudioI2sSd(audio.i2sSd ?? 0);
          setAudioI2sDin(audio.i2sDin ?? 0);
          setAudioI2sSck(audio.i2sSck ?? 0);
        }

        // Populate Remote Hardware config
        if (config.moduleConfig?.remoteHardware) {
          const rh = config.moduleConfig.remoteHardware;
          setRemoteHardwareEnabled(rh.enabled || false);
          setRemoteHardwareAllowUndefinedPinAccess(rh.allowUndefinedPinAccess || false);
        }

        // Populate Detection Sensor config
        if (config.moduleConfig?.detectionSensor) {
          const ds = config.moduleConfig.detectionSensor;
          setDetectionSensorEnabled(ds.enabled || false);
          setDetectionSensorMinimumBroadcastSecs(ds.minimumBroadcastSecs ?? 0);
          setDetectionSensorStateBroadcastSecs(ds.stateBroadcastSecs ?? 0);
          setDetectionSensorSendBell(ds.sendBell || false);
          setDetectionSensorName(ds.name || '');
          setDetectionSensorMonitorPin(ds.monitorPin ?? 0);
          setDetectionSensorDetectionTriggerType(ds.detectionTriggerType ?? 0);
          setDetectionSensorUsePullup(ds.usePullup || false);
        }

        // Populate Paxcounter config
        if (config.moduleConfig?.paxcounter) {
          const pax = config.moduleConfig.paxcounter;
          setPaxcounterEnabled(pax.enabled || false);
          setPaxcounterUpdateInterval(pax.paxcounterUpdateInterval ?? 0);
          setPaxcounterWifiThreshold(pax.wifiThreshold ?? -80);
          setPaxcounterBleThreshold(pax.bleThreshold ?? -80);
        }

        // Populate Status Message config
        if (config.moduleConfig?.statusmessage) {
          const sm = config.moduleConfig.statusmessage;
          setStatusMessageNodeStatus(sm.nodeStatus || '');
        }

        // Populate TAK config. Absent means both fields are at their default.
        {
          const tak = normalizeTakConfig(config.moduleConfig?.tak);
          setTakTeam(tak.team);
          setTakRole(tak.role);
        }

        // Populate Traffic Management config
        if (config.moduleConfig?.trafficManagement) {
          const tm = config.moduleConfig.trafficManagement;
          setTrafficManagementPositionMinIntervalSecs(tm.positionMinIntervalSecs ?? 0);
          setTrafficManagementNodeinfoDirectResponseMaxHops(tm.nodeinfoDirectResponseMaxHops ?? 0);
          setTrafficManagementRateLimitWindowSecs(tm.rateLimitWindowSecs ?? 0);
          setTrafficManagementRateLimitMaxPackets(tm.rateLimitMaxPackets ?? 0);
          setTrafficManagementUnknownPacketThreshold(tm.unknownPacketThreshold ?? 0);
        }

        // Populate MeshBeacon config (firmware 2.8+, #3854)
        if (config.moduleConfig?.meshBeacon) {
          const mb = config.moduleConfig.meshBeacon;
          const flags = unpackMeshBeaconFlags(mb.flags);
          setMeshBeaconListenEnabled(flags.listenEnabled);
          setMeshBeaconBroadcastEnabled(flags.broadcastEnabled);
          setMeshBeaconLegacySplit(flags.legacySplit);
          setMeshBeaconBroadcastMessage(mb.broadcastMessage ?? '');
          setMeshBeaconBroadcastOfferChannelName(mb.broadcastOfferChannel?.name ?? '');
          setMeshBeaconBroadcastOfferChannelPsk(pskToBase64(mb.broadcastOfferChannel?.psk));
          setMeshBeaconBroadcastOfferRegion(mb.broadcastOfferRegion ?? 0);
          // `optional` — absent means "advertise no preset", not LONG_FAST.
          setMeshBeaconBroadcastOfferPreset(mb.broadcastOfferPreset ?? null);
          // Interval + targets (#4802). Interval absence reads as the firmware
          // minimum (3600), not 0.
          setMeshBeaconBroadcastIntervalSecs(mb.broadcastIntervalSecs || MESH_BEACON_MIN_INTERVAL_SECS);
          setMeshBeaconBroadcastTargets(
            // Narrow on `typeof`, not `??` (#5030): a non-numeric value here
            // silently became a `<select value>` matching no `<option>`, so a
            // configured target rendered as "Running config" / "UNSET".
            (Array.isArray(mb.broadcastTargets) ? mb.broadcastTargets : []).map((target: Record<string, unknown>) => ({
              preset: typeof target?.preset === 'number' ? target.preset : null,
              region: typeof target?.region === 'number' ? target.region : 0,
              channelIndex: typeof target?.channelIndex === 'number' ? target.channelIndex : null,
            }))
          );
        }

        // Store supported modules info. Clear it when a response carries none,
        // so switching sources cannot leave one device's exclusions gating
        // another device's sections (#5065). Null reads as "unknown", which
        // fails open and enables every section.
        setSupportedModules(config.supportedModules ?? null);

        // Populate Serial config
        if (config.moduleConfig?.serial) {
          const serial = config.moduleConfig.serial;
          setSerialEnabled(serial.enabled || false);
          setSerialEcho(serial.echo || false);
          setSerialRxd(serial.rxd ?? 0);
          setSerialTxd(serial.txd ?? 0);
          setSerialBaud(serial.baud ?? 0);
          setSerialTimeout(serial.timeout ?? 0);
          setSerialMode(serial.mode ?? 0);
          setSerialOverrideConsoleSerialPort(serial.overrideConsoleSerialPort || false);
        }

        // Populate Ambient Lighting config
        if (config.moduleConfig?.ambientLighting) {
          const al = config.moduleConfig.ambientLighting;
          setAmbientLedState(al.ledState || false);
          setAmbientCurrent(al.current ?? 10);
          setAmbientRed(al.red ?? 0);
          setAmbientGreen(al.green ?? 0);
          setAmbientBlue(al.blue ?? 0);
        }

        // Populate Security config
        if (config.deviceConfig?.security) {
          const sec = config.deviceConfig.security;
          // Admin keys may come as base64 strings, Buffer-like objects, or byte arrays
          // from the raw config endpoint — coerce all to strings for the UI
          if (sec.adminKey && Array.isArray(sec.adminKey)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim from ConfigurationTab; raw wire shapes
            const keys = sec.adminKey.map((key: any) => {
              if (typeof key === 'string') return key;
              // Handle JSON-serialized Buffer: { type: 'Buffer', data: [...] }
              if (key && typeof key === 'object' && key.type === 'Buffer' && Array.isArray(key.data)) {
                return btoa(String.fromCharCode(...key.data));
              }
              // Handle plain byte arrays
              if (Array.isArray(key)) {
                return btoa(String.fromCharCode(...key));
              }
              // Handle JSON-serialized Uint8Array or other objects with numeric values
              if (key && typeof key === 'object') {
                try {
                  const bytes = Object.values(key) as number[];
                  return btoa(String.fromCharCode(...bytes));
                } catch {
                  // fall through
                }
              }
              return '';
            });
            setSecurityAdminKeys(keys.length > 0 ? keys : ['']);
          }
          setSecurityIsManaged(sec.isManaged || false);
          // proto3 elides `false`; only trust a wire-present `true` (#5028 class).
          setSecuritySerialEnabled(sec.serialEnabled === true);
          setSecurityDebugLogApiEnabled(sec.debugLogApiEnabled || false);
          setSecurityAdminChannelEnabled(sec.adminChannelEnabled || false);
          // #5612: the node's own policy. Anything we cannot read as a known
          // value stays null ("unknown"), never Compatible.
          const loadedPolicy = toKnownPolicy(sec.packetSignaturePolicy);
          setSecurityLoadedSignaturePolicy(loadedPolicy);
          setSecuritySignaturePolicy(loadedPolicy);
        }

        // Fetch security keys (public/private) separately
        try {
          const securityKeys = await apiService.getSecurityKeys(sourceId);
          if (securityKeys.publicKey) {
            setSecurityPublicKey(securityKeys.publicKey);
          }
          if (securityKeys.privateKey) {
            setSecurityPrivateKey(securityKeys.privateKey);
            loadedSecurityPrivateKeyRef.current = securityKeys.privateKey;
          }
        } catch (keyError) {
          logger.warn('Could not fetch security keys:', keyError);
          // Non-fatal, continue loading
        }
      } catch (error) {
        logger.error('Error fetching configuration:', error);
        setStatusMessage(t('config.load_warning'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 moved verbatim from ConfigurationTab; `t` was never a dep
  }, [refreshTrigger, sourceId]); // Re-run when refreshTrigger or sourceId changes

  return {
    sourceId,
    loading: isLoading,
    securityKeys: { publicKey: securityPublicKey, privateKey: securityPrivateKey },
    longName, setLongName, shortName, setShortName, isUnmessagable, setIsUnmessagable, isLicensed,
    setIsLicensed, role, setRole, nodeInfoBroadcastSecs, setNodeInfoBroadcastSecs, tzdef, setTzdef,
    rebroadcastMode, setRebroadcastMode, doubleTapAsButtonPress, setDoubleTapAsButtonPress,
    disableTripleClick, setDisableTripleClick, ledHeartbeatDisabled, setLedHeartbeatDisabled, buzzerMode,
    setBuzzerMode, buttonGpio, setButtonGpio, buzzerGpio, setBuzzerGpio, usePreset, setUsePreset, modemPreset,
    setModemPreset, unknownModemPresetName, setUnknownModemPresetName, localFirmwareVersion,
    setLocalFirmwareVersion, bandwidth, setBandwidth, spreadFactor, setSpreadFactor, codingRate,
    setCodingRate, frequencyOffset, setFrequencyOffset, overrideFrequency, setOverrideFrequency, region,
    setRegion, hopLimit, setHopLimit, txPower, setTxPower, channelNum, setChannelNum, femLnaMode,
    setFemLnaMode, sx126xRxBoostedGain, setSx126xRxBoostedGain, ignoreMqtt, setIgnoreMqtt, configOkToMqtt,
    setConfigOkToMqtt, txEnabled, setTxEnabled, overrideDutyCycle, setOverrideDutyCycle, paFanDisabled,
    setPaFanDisabled, positionBroadcastSecs, setPositionBroadcastSecs, positionSmartEnabled,
    setPositionSmartEnabled, fixedPosition, setFixedPosition, fixedLatitude, setFixedLatitude, fixedLongitude,
    setFixedLongitude, fixedAltitude, setFixedAltitude, gpsUpdateInterval, setGpsUpdateInterval, gpsMode,
    setGpsMode, broadcastSmartMinimumDistance, setBroadcastSmartMinimumDistance,
    broadcastSmartMinimumIntervalSecs, setBroadcastSmartMinimumIntervalSecs, positionFlags, setPositionFlags,
    rxGpio, setRxGpio, txGpio, setTxGpio, gpsEnGpio, setGpsEnGpio, mqttEnabled, setMqttEnabled, mqttAddress,
    setMqttAddress, mqttUsername, setMqttUsername, mqttPassword, setMqttPassword, mqttEncryptionEnabled,
    setMqttEncryptionEnabled, mqttJsonEnabled, setMqttJsonEnabled, mqttRoot, setMqttRoot, mqttTlsEnabled,
    setMqttTlsEnabled, mqttProxyToClientEnabled, setMqttProxyToClientEnabled, isBridged, setIsBridged,
    mqttProxyClientAttached, setMqttProxyClientAttached, mqttMapReportingEnabled, setMqttMapReportingEnabled,
    mqttMapPublishIntervalSecs, setMqttMapPublishIntervalSecs, mqttMapPositionPrecision,
    setMqttMapPositionPrecision, mqttMapShouldReportLocation, setMqttMapShouldReportLocation,
    neighborInfoEnabled, setNeighborInfoEnabled, neighborInfoInterval, setNeighborInfoInterval,
    neighborInfoTransmitOverLora, setNeighborInfoTransmitOverLora, wifiEnabled, setWifiEnabled, wifiSsid,
    setWifiSsid, wifiPsk, setWifiPsk, ntpServer, setNtpServer, rsyslogServer, setRsyslogServer, addressMode,
    setAddressMode, ipv4Address, setIpv4Address, ipv4Gateway, setIpv4Gateway, ipv4Subnet, setIpv4Subnet,
    ipv4Dns, setIpv4Dns, enabledProtocols, setEnabledProtocols, fullNetworkConfig, setFullNetworkConfig,
    isPowerSaving, setIsPowerSaving, onBatteryShutdownAfterSecs, setOnBatteryShutdownAfterSecs,
    adcMultiplierOverride, setAdcMultiplierOverride, waitBluetoothSecs, setWaitBluetoothSecs, sdsSecs,
    setSdsSecs, lsSecs, setLsSecs, minWakeSecs, setMinWakeSecs, deviceBatteryInaAddress,
    setDeviceBatteryInaAddress, screenOnSecs, setScreenOnSecs, autoScreenCarouselSecs,
    setAutoScreenCarouselSecs, flipScreen, setFlipScreen, displayUnits, setDisplayUnits, oled, setOled,
    displayMode, setDisplayMode, headingBold, setHeadingBold, wakeOnTapOrMotion, setWakeOnTapOrMotion,
    compassOrientation, setCompassOrientation, deviceUpdateInterval, setDeviceUpdateInterval,
    deviceTelemetryEnabled, setDeviceTelemetryEnabled, environmentUpdateInterval,
    setEnvironmentUpdateInterval, environmentMeasurementEnabled, setEnvironmentMeasurementEnabled,
    environmentScreenEnabled, setEnvironmentScreenEnabled, environmentDisplayFahrenheit,
    setEnvironmentDisplayFahrenheit, airQualityEnabled, setAirQualityEnabled, airQualityInterval,
    setAirQualityInterval, powerMeasurementEnabled, setPowerMeasurementEnabled, powerUpdateInterval,
    setPowerUpdateInterval, powerScreenEnabled, setPowerScreenEnabled, healthMeasurementEnabled,
    setHealthMeasurementEnabled, healthUpdateInterval, setHealthUpdateInterval, healthScreenEnabled,
    setHealthScreenEnabled, configVersion, setConfigVersion, extNotifEnabled, setExtNotifEnabled,
    extNotifOutputMs, setExtNotifOutputMs, extNotifOutput, setExtNotifOutput, extNotifActive,
    setExtNotifActive, extNotifAlertMessage, setExtNotifAlertMessage, extNotifAlertMessageVibra,
    setExtNotifAlertMessageVibra, extNotifAlertMessageBuzzer, setExtNotifAlertMessageBuzzer,
    extNotifAlertBell, setExtNotifAlertBell, extNotifAlertBellVibra, setExtNotifAlertBellVibra,
    extNotifAlertBellBuzzer, setExtNotifAlertBellBuzzer, extNotifUsePwm, setExtNotifUsePwm,
    extNotifNagTimeout, setExtNotifNagTimeout, extNotifUseI2sAsBuzzer, setExtNotifUseI2sAsBuzzer,
    extNotifOutputVibra, setExtNotifOutputVibra, extNotifOutputBuzzer, setExtNotifOutputBuzzer,
    storeForwardEnabled, setStoreForwardEnabled, storeForwardHeartbeat, setStoreForwardHeartbeat,
    storeForwardRecords, setStoreForwardRecords, storeForwardHistoryReturnMax,
    setStoreForwardHistoryReturnMax, storeForwardHistoryReturnWindow, setStoreForwardHistoryReturnWindow,
    storeForwardIsServer, setStoreForwardIsServer, rangeTestEnabled, setRangeTestEnabled, rangeTestSender,
    setRangeTestSender, rangeTestSave, setRangeTestSave, cannedMsgEnabled, setCannedMsgEnabled,
    cannedMsgRotary1Enabled, setCannedMsgRotary1Enabled, cannedMsgInputbrokerPinA,
    setCannedMsgInputbrokerPinA, cannedMsgInputbrokerPinB, setCannedMsgInputbrokerPinB,
    cannedMsgInputbrokerPinPress, setCannedMsgInputbrokerPinPress, cannedMsgInputbrokerEventCw,
    setCannedMsgInputbrokerEventCw, cannedMsgInputbrokerEventCcw, setCannedMsgInputbrokerEventCcw,
    cannedMsgInputbrokerEventPress, setCannedMsgInputbrokerEventPress, cannedMsgUpdown1Enabled,
    setCannedMsgUpdown1Enabled, cannedMsgSendBell, setCannedMsgSendBell, cannedMsgAllowInputSource,
    setCannedMsgAllowInputSource, audioCodec2Enabled, setAudioCodec2Enabled, audioPttPin, setAudioPttPin,
    audioBitrate, setAudioBitrate, audioI2sWs, setAudioI2sWs, audioI2sSd, setAudioI2sSd, audioI2sDin,
    setAudioI2sDin, audioI2sSck, setAudioI2sSck, remoteHardwareEnabled, setRemoteHardwareEnabled,
    remoteHardwareAllowUndefinedPinAccess, setRemoteHardwareAllowUndefinedPinAccess, detectionSensorEnabled,
    setDetectionSensorEnabled, detectionSensorMinimumBroadcastSecs, setDetectionSensorMinimumBroadcastSecs,
    detectionSensorStateBroadcastSecs, setDetectionSensorStateBroadcastSecs, detectionSensorSendBell,
    setDetectionSensorSendBell, detectionSensorName, setDetectionSensorName, detectionSensorMonitorPin,
    setDetectionSensorMonitorPin, detectionSensorDetectionTriggerType, setDetectionSensorDetectionTriggerType,
    detectionSensorUsePullup, setDetectionSensorUsePullup, paxcounterEnabled, setPaxcounterEnabled,
    paxcounterUpdateInterval, setPaxcounterUpdateInterval, paxcounterWifiThreshold,
    setPaxcounterWifiThreshold, paxcounterBleThreshold, setPaxcounterBleThreshold, statusMessageNodeStatus,
    setStatusMessageNodeStatus, takTeam, setTakTeam, takRole, setTakRole,
    trafficManagementPositionMinIntervalSecs, setTrafficManagementPositionMinIntervalSecs,
    trafficManagementNodeinfoDirectResponseMaxHops, setTrafficManagementNodeinfoDirectResponseMaxHops,
    trafficManagementRateLimitWindowSecs, setTrafficManagementRateLimitWindowSecs,
    trafficManagementRateLimitMaxPackets, setTrafficManagementRateLimitMaxPackets,
    trafficManagementUnknownPacketThreshold, setTrafficManagementUnknownPacketThreshold,
    meshBeaconListenEnabled, setMeshBeaconListenEnabled, meshBeaconBroadcastEnabled,
    setMeshBeaconBroadcastEnabled, meshBeaconLegacySplit, setMeshBeaconLegacySplit,
    meshBeaconBroadcastMessage, setMeshBeaconBroadcastMessage, meshBeaconBroadcastOfferChannelName,
    setMeshBeaconBroadcastOfferChannelName, meshBeaconBroadcastOfferChannelPsk,
    setMeshBeaconBroadcastOfferChannelPsk, meshBeaconBroadcastOfferRegion, setMeshBeaconBroadcastOfferRegion,
    meshBeaconBroadcastOfferPreset, setMeshBeaconBroadcastOfferPreset, meshBeaconBroadcastIntervalSecs,
    setMeshBeaconBroadcastIntervalSecs, meshBeaconBroadcastTargets, setMeshBeaconBroadcastTargets,
    supportedModules, setSupportedModules, serialEnabled, setSerialEnabled, serialEcho, setSerialEcho,
    serialRxd, setSerialRxd, serialTxd, setSerialTxd, serialBaud, setSerialBaud, serialTimeout,
    setSerialTimeout, serialMode, setSerialMode, serialOverrideConsoleSerialPort,
    setSerialOverrideConsoleSerialPort, ambientLedState, setAmbientLedState, ambientCurrent,
    setAmbientCurrent, ambientRed, setAmbientRed, ambientGreen, setAmbientGreen, ambientBlue, setAmbientBlue,
    securityPublicKey, setSecurityPublicKey, securityPrivateKey, setSecurityPrivateKey, securityAdminKeys,
    setSecurityAdminKeys, securityIsManaged, setSecurityIsManaged, securitySerialEnabled,
    setSecuritySerialEnabled, securityDebugLogApiEnabled, setSecurityDebugLogApiEnabled,
    securityAdminChannelEnabled, setSecurityAdminChannelEnabled, securityLoadedSignaturePolicy,
    setSecurityLoadedSignaturePolicy, securitySignaturePolicy, setSecuritySignaturePolicy, isSaving,
    setIsSaving, statusMessage, setStatusMessage, isReloading, setIsReloading, configChanges,
    setConfigChanges, showChanges, setShowChanges, loadedSecurityPrivateKeyRef,
  };
}

export type DeviceConfigState = ReturnType<typeof useDeviceConfigState>;
