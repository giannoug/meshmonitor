/**
 * Device configuration saves for one Meshtastic source, extracted from
 * ConfigurationTab (#6365, Rule X). These are today's `handleSave*Config`
 * bodies, moved unchanged: each sends the same api call, body and sourceId,
 * with the same toasts, status text and reboot signal, in the same order.
 * Nothing new is sent, retried or timed.
 *
 * Each save resolves true when its success path ran and false when its error
 * (or held-by-validation) path ran.
 */
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useToast } from '../../components/ToastContainer';
import { logger } from '../../utils/logger';
import { sourcePollQueryKey } from '../pollQueryKey';
import { mqttRootErrorMessage } from '../../components/MQTT/mqttRootApiError';
import { normalizeMeshtasticKey } from '../../utils/meshtasticKeyFormat';
import { policyToSend } from '../../utils/packetSignaturePolicy';
import { buildAdminMqttSavePayload } from '../../components/admin-commands/mqttSavePayload';
import { statusMessageSaveErrorText } from '../../utils/statusMessage';
import { floorKeepingZero, neighborInfoIntervalToSend, NODE_INFO_BROADCAST_FLOOR_SECS, POSITION_BROADCAST_FLOOR_SECS } from '../../utils/broadcastIntervalFloor';
import { buildMeshBeaconConfigPayload } from '../../components/admin-commands/useAdminCommandsState';
import { ROLE_MAP, REGION_MAP, resolveModemPresetValue, UNKNOWN_MODEM_PRESET } from '../../components/configuration/constants';
import { rebootExpectation, type ConfigSaveSection as RebootRuleSection } from '../../utils/configRebootRules';
import type { DeviceConfigState } from './useDeviceConfigState';

/** One save per Device Configuration section, named after configRebootRules. */
export type ConfigSaveSection = Exclude<RebootRuleSection, 'bluetooth'>;

/**
 * A field a reload found changed on the node: today's tracked fields only,
 * with `field` the label Classic's change table shows (e.g. "LoRa: Hop Limit")
 * and `before` / `after` the raw values.
 */
export interface ConfigChange {
  section: ConfigSaveSection;
  field: string;
  before: unknown;
  after: unknown;
}

export interface DeviceConfigSaveOptions {
  /** A save succeeded that the node reboots to apply (configRebootRules). */
  onRebootExpected(e: 'always' | 'possible'): void;
  /** Classic's parent reboot handler; without it reboot() calls the api directly. */
  onRebootDevice?: () => Promise<boolean>;
}

export type DeviceConfigSaves = Omit<Record<ConfigSaveSection, () => Promise<boolean>>, 'mqtt'> & {
  mqtt: (extra?: { brokerPresetId?: number }) => Promise<boolean>;
  reboot: () => Promise<boolean>;
  purgeNodeDb: () => Promise<boolean>;
  reload: () => Promise<ConfigChange[]>;
};

export function useDeviceConfigSaves(state: DeviceConfigState, opts: DeviceConfigSaveOptions): DeviceConfigSaves {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const onRebootDevice = opts.onRebootDevice;
  const {
    sourceId, longName, setLongName, shortName, setShortName, isUnmessagable, setIsUnmessagable, isLicensed,
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
    setPositionSmartEnabled, fixedPosition, setFixedPosition, fixedLatitude, fixedLongitude, fixedAltitude,
    gpsUpdateInterval, setGpsUpdateInterval, gpsMode, setGpsMode, broadcastSmartMinimumDistance,
    setBroadcastSmartMinimumDistance, broadcastSmartMinimumIntervalSecs, setBroadcastSmartMinimumIntervalSecs,
    positionFlags, setPositionFlags, rxGpio, setRxGpio, txGpio, setTxGpio, gpsEnGpio, setGpsEnGpio,
    mqttEnabled, setMqttEnabled, mqttAddress, setMqttAddress, mqttUsername, setMqttUsername, mqttPassword,
    setMqttPassword, mqttEncryptionEnabled, setMqttEncryptionEnabled, mqttJsonEnabled, setMqttJsonEnabled,
    mqttRoot, setMqttRoot, mqttTlsEnabled, setMqttTlsEnabled, mqttProxyToClientEnabled,
    setMqttProxyToClientEnabled, mqttMapReportingEnabled, setMqttMapReportingEnabled,
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
    setHealthScreenEnabled, setConfigVersion, extNotifEnabled, extNotifOutputMs, extNotifOutput,
    extNotifActive, extNotifAlertMessage, extNotifAlertMessageVibra, extNotifAlertMessageBuzzer,
    extNotifAlertBell, extNotifAlertBellVibra, extNotifAlertBellBuzzer, extNotifUsePwm, extNotifNagTimeout,
    extNotifUseI2sAsBuzzer, extNotifOutputVibra, extNotifOutputBuzzer, storeForwardEnabled,
    storeForwardHeartbeat, storeForwardRecords, storeForwardHistoryReturnMax, storeForwardHistoryReturnWindow,
    storeForwardIsServer, rangeTestEnabled, rangeTestSender, rangeTestSave, cannedMsgEnabled,
    cannedMsgRotary1Enabled, cannedMsgInputbrokerPinA, cannedMsgInputbrokerPinB, cannedMsgInputbrokerPinPress,
    cannedMsgInputbrokerEventCw, cannedMsgInputbrokerEventCcw, cannedMsgInputbrokerEventPress,
    cannedMsgUpdown1Enabled, cannedMsgSendBell, cannedMsgAllowInputSource, audioCodec2Enabled, audioPttPin,
    audioBitrate, audioI2sWs, audioI2sSd, audioI2sDin, audioI2sSck, remoteHardwareEnabled,
    remoteHardwareAllowUndefinedPinAccess, detectionSensorEnabled, detectionSensorMinimumBroadcastSecs,
    detectionSensorStateBroadcastSecs, detectionSensorSendBell, detectionSensorName,
    detectionSensorMonitorPin, detectionSensorDetectionTriggerType, detectionSensorUsePullup,
    paxcounterEnabled, paxcounterUpdateInterval, paxcounterWifiThreshold, paxcounterBleThreshold,
    statusMessageNodeStatus, takTeam, takRole, trafficManagementPositionMinIntervalSecs,
    trafficManagementNodeinfoDirectResponseMaxHops, trafficManagementRateLimitWindowSecs,
    trafficManagementRateLimitMaxPackets, trafficManagementUnknownPacketThreshold, meshBeaconListenEnabled,
    meshBeaconBroadcastEnabled, meshBeaconLegacySplit, meshBeaconBroadcastMessage,
    meshBeaconBroadcastOfferChannelName, meshBeaconBroadcastOfferChannelPsk, meshBeaconBroadcastOfferRegion,
    meshBeaconBroadcastOfferPreset, meshBeaconBroadcastIntervalSecs, meshBeaconBroadcastTargets,
    serialEnabled, serialEcho, serialRxd, serialTxd, serialBaud, serialTimeout, serialMode,
    serialOverrideConsoleSerialPort, ambientLedState, ambientCurrent, ambientRed, ambientGreen, ambientBlue,
    securityPrivateKey, securityAdminKeys, securityIsManaged, securitySerialEnabled,
    securityDebugLogApiEnabled, securityAdminChannelEnabled, securityLoadedSignaturePolicy,
    setSecurityLoadedSignaturePolicy, securitySignaturePolicy, setIsSaving, setStatusMessage, setIsReloading,
    setConfigChanges, setShowChanges, loadedSecurityPrivateKeyRef,
  } = state;

  // After a successful save, tell the parent to expect the reboot the firmware
  // starts on its own about 7 s later. This sends nothing to the node.
  // configRebootRules.ts says which saves reboot (#5823).
  const expectRebootAfterSave = (section: ConfigSaveSection) => {
    const expectation = rebootExpectation(section, localFirmwareVersion);
    if (expectation !== 'never') opts.onRebootExpected(expectation);
  };

  const handleSaveDeviceConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // A stored 0 goes back as 0 so the node keeps its firmware default;
      // any other value under the floor is raised and the save is held.
      const validNodeInfoBroadcastSecs = floorKeepingZero(nodeInfoBroadcastSecs, NODE_INFO_BROADCAST_FLOOR_SECS);
      if (validNodeInfoBroadcastSecs !== nodeInfoBroadcastSecs) {
        setNodeInfoBroadcastSecs(validNodeInfoBroadcastSecs);
        showToast(t('config.node_info_adjusted'), 'warning');
        setIsSaving(false);
        return false;
      }

      await apiService.setDeviceConfig({
        role,
        nodeInfoBroadcastSecs: validNodeInfoBroadcastSecs,
        tzdef,
        rebroadcastMode,
        doubleTapAsButtonPress,
        disableTripleClick,
        ledHeartbeatDisabled,
        buzzerMode,
        buttonGpio,
        buzzerGpio
      }, sourceId);
      setStatusMessage(t('config.device_config_saved'));
      showToast(t('config.device_config_saved_toast'), 'success');
      expectRebootAfterSave('device');
      return true;
    } catch (error) {
      logger.error('Error saving device config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.device_config_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.device_config_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNodeOwner = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setNodeOwner(longName, shortName, isUnmessagable, isLicensed, sourceId);
      setStatusMessage(t('config.node_names_saved'));
      showToast(t('config.node_names_saved_toast'), 'success');
      expectRebootAfterSave('owner');
      return true;
    } catch (error) {
      logger.error('Error saving node owner:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.node_names_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.node_names_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLoRaConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Validate hop limit (max 7)
      const validHopLimit = Math.min(7, Math.max(1, hopLimit));
      if (validHopLimit !== hopLimit) {
        setHopLimit(validHopLimit);
        showToast(t('config.hop_limit_adjusted'), 'warning');
        setIsSaving(false);
        return false;
      }

      // An unrecognised preset must never be written back as a guess (#5547).
      // With presets on, the user has to pick one. With custom parameters the
      // firmware ignores modem_preset, so leave it out and let the server keep
      // the radio's current value.
      const presetUnknown = modemPreset === UNKNOWN_MODEM_PRESET;
      if (presetUnknown && usePreset) {
        showToast(t('config.lora_unknown_preset', { name: unknownModemPresetName ?? '?' }), 'error');
        setIsSaving(false);
        return false;
      }

      await apiService.setLoRaConfig({
        usePreset,
        ...(presetUnknown ? {} : { modemPreset }),
        bandwidth,
        spreadFactor,
        codingRate,
        frequencyOffset,
        overrideFrequency,
        region,
        hopLimit: validHopLimit,
        txPower,
        channelNum,
        femLnaMode,
        sx126xRxBoostedGain,
        ignoreMqtt,
        configOkToMqtt,
        txEnabled,
        overrideDutyCycle,
        paFanDisabled
      }, sourceId);
      setStatusMessage(t('config.lora_saved'));
      showToast(t('config.lora_saved_toast'), 'success');
      // Refresh TX status promptly so the global banner + gated controls reflect
      // the new txEnabled value without waiting for the 30s poll (#4294).
      void queryClient.invalidateQueries({ queryKey: ['txStatus'] });
      expectRebootAfterSave('lora');
      return true;
    } catch (error) {
      logger.error('Error saving LoRa config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.lora_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.lora_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePositionConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Enforce MeshMonitor's 32-second floor; firmware itself does not clamp this field (#5055).
      // A stored 0 goes back as 0 so the node keeps its firmware default.
      const validPositionBroadcastSecs = floorKeepingZero(positionBroadcastSecs, POSITION_BROADCAST_FLOOR_SECS);
      if (validPositionBroadcastSecs !== positionBroadcastSecs) {
        setPositionBroadcastSecs(validPositionBroadcastSecs);
        showToast(t('config.position_interval_adjusted'), 'warning');
        setIsSaving(false);
        return false;
      }

      // Validate lat/long ranges if fixed position is enabled
      if (fixedPosition) {
        if (fixedLatitude < -90 || fixedLatitude > 90) {
          showToast(t('config.latitude_range_error'), 'error');
          setIsSaving(false);
          return false;
        }
        if (fixedLongitude < -180 || fixedLongitude > 180) {
          showToast(t('config.longitude_range_error'), 'error');
          setIsSaving(false);
          return false;
        }
      }

      await apiService.setPositionConfig({
        positionBroadcastSecs: validPositionBroadcastSecs,
        positionBroadcastSmartEnabled: positionSmartEnabled,
        fixedPosition,
        latitude: fixedPosition ? fixedLatitude : undefined,
        longitude: fixedPosition ? fixedLongitude : undefined,
        altitude: fixedPosition ? fixedAltitude : undefined,
        gpsUpdateInterval,
        gpsMode,
        broadcastSmartMinimumDistance,
        broadcastSmartMinimumIntervalSecs,
        positionFlags,
        rxGpio,
        txGpio,
        gpsEnGpio
      }, sourceId);
      setStatusMessage(t('config.position_saved'));
      showToast(t('config.position_saved_toast'), 'success');
      expectRebootAfterSave('position');
      return true;
    } catch (error) {
      logger.error('Error saving position config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.position_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.position_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMQTTConfig = async (extra?: { brokerPresetId?: number }): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Firmware replaces the whole MQTT struct, so every field goes out,
      // map report settings included even while map reporting is off.
      await apiService.setMQTTConfig({ ...buildAdminMqttSavePayload({
        enabled: mqttEnabled,
        address: mqttAddress,
        username: mqttUsername,
        password: mqttPassword,
        encryptionEnabled: mqttEncryptionEnabled,
        jsonEnabled: mqttJsonEnabled,
        root: mqttRoot,
        tlsEnabled: mqttTlsEnabled,
        proxyToClientEnabled: mqttProxyToClientEnabled,
        mapReportingEnabled: mqttMapReportingEnabled,
        mapPublishIntervalSecs: mqttMapPublishIntervalSecs,
        mapPositionPrecision: mqttMapPositionPrecision,
        mapShouldReportLocation: mqttMapShouldReportLocation,
      }), ...(extra?.brokerPresetId !== undefined ? { brokerPresetId: extra.brokerPresetId } : {}) }, sourceId);
      setStatusMessage(t('config.mqtt_saved'));
      showToast(t('config.mqtt_saved_toast'), 'success');
      expectRebootAfterSave('mqtt');
      return true;
    } catch (error) {
      logger.error('Error saving MQTT config:', error);
      const errorMsg = mqttRootErrorMessage(error, t)
        ?? (error instanceof Error ? error.message : t('config.mqtt_failed'));
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.mqtt_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNeighborInfoConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Enforce minimum interval
      const validInterval = neighborInfoIntervalToSend(neighborInfoInterval);
      if (validInterval !== neighborInfoInterval) {
        setNeighborInfoInterval(validInterval);
        showToast(t('config.neighbor_interval_adjusted'), 'warning');
      }

      await apiService.setNeighborInfoConfig({
        enabled: neighborInfoEnabled,
        updateInterval: validInterval,
        transmitOverLora: neighborInfoTransmitOverLora
      }, sourceId);
      setStatusMessage(t('config.neighbor_saved'));
      showToast(t('config.neighbor_saved_toast'), 'success');
      expectRebootAfterSave('neighborinfo');
      return true;
    } catch (error) {
      logger.error('Error saving NeighborInfo config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.neighbor_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.neighbor_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNetworkConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Build the full network config with all updated fields
      const updatedConfig = {
        ...fullNetworkConfig,
        wifiEnabled,
        wifiSsid,
        wifiPsk,
        ntpServer,
        rsyslogServer,
        addressMode,
        enabledProtocols,
        // Static IP config - only include if using static address mode
        ipv4Config: addressMode === 1 ? {
          ip: ipv4Address,
          gateway: ipv4Gateway,
          subnet: ipv4Subnet,
          dns: ipv4Dns
        } : fullNetworkConfig?.ipv4Config
      };
      await apiService.setNetworkConfig(updatedConfig, sourceId);
      // Update stored full config with the new values
      setFullNetworkConfig(updatedConfig);
      setStatusMessage(t('config.network_saved'));
      showToast(t('config.network_saved_toast'), 'success');
      expectRebootAfterSave('network');
      return true;
    } catch (error) {
      logger.error('Error saving Network config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.network_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.network_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePowerConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setPowerConfig({
        isPowerSaving,
        onBatteryShutdownAfterSecs,
        adcMultiplierOverride,
        waitBluetoothSecs,
        sdsSecs,
        lsSecs,
        minWakeSecs,
        deviceBatteryInaAddress
      }, sourceId);
      setStatusMessage(t('config.power_saved'));
      showToast(t('config.power_saved_toast'), 'success');
      expectRebootAfterSave('power');
      return true;
    } catch (error) {
      logger.error('Error saving Power config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.power_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.power_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDisplayConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setDisplayConfig({
        screenOnSecs,
        autoScreenCarouselSecs,
        flipScreen,
        units: displayUnits,
        oled,
        displaymode: displayMode,
        headingBold,
        wakeOnTapOrMotion,
        compassOrientation
      }, sourceId);
      setStatusMessage(t('config.display_saved'));
      showToast(t('config.display_saved_toast'), 'success');
      expectRebootAfterSave('display');
      return true;
    } catch (error) {
      logger.error('Error saving Display config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.display_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.display_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTelemetryConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setTelemetryConfig({
        deviceUpdateInterval,
        deviceTelemetryEnabled,
        environmentUpdateInterval,
        environmentMeasurementEnabled,
        environmentScreenEnabled,
        environmentDisplayFahrenheit,
        airQualityEnabled,
        airQualityInterval,
        powerMeasurementEnabled,
        powerUpdateInterval,
        powerScreenEnabled,
        healthMeasurementEnabled,
        healthUpdateInterval,
        healthScreenEnabled
      }, sourceId);
      setStatusMessage(t('config.telemetry_saved'));
      showToast(t('config.telemetry_saved_toast'), 'success');
      expectRebootAfterSave('telemetry');
      return true;
    } catch (error) {
      logger.error('Error saving Telemetry config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.telemetry_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.telemetry_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExternalNotificationConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('extnotif', {
        enabled: extNotifEnabled,
        outputMs: extNotifOutputMs,
        output: extNotifOutput,
        active: extNotifActive,
        alertMessage: extNotifAlertMessage,
        alertMessageVibra: extNotifAlertMessageVibra,
        alertMessageBuzzer: extNotifAlertMessageBuzzer,
        alertBell: extNotifAlertBell,
        alertBellVibra: extNotifAlertBellVibra,
        alertBellBuzzer: extNotifAlertBellBuzzer,
        usePwm: extNotifUsePwm,
        nagTimeout: extNotifNagTimeout,
        useI2sAsBuzzer: extNotifUseI2sAsBuzzer,
        outputVibra: extNotifOutputVibra,
        outputBuzzer: extNotifOutputBuzzer
      }, sourceId);
      setStatusMessage(t('config.extnotif_saved'));
      showToast(t('config.extnotif_saved_toast'), 'success');
      expectRebootAfterSave('extnotif');
      return true;
    } catch (error) {
      logger.error('Error saving External Notification config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.extnotif_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.extnotif_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStoreForwardConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('storeforward', {
        enabled: storeForwardEnabled,
        heartbeat: storeForwardHeartbeat,
        records: storeForwardRecords,
        historyReturnMax: storeForwardHistoryReturnMax,
        historyReturnWindow: storeForwardHistoryReturnWindow,
        isServer: storeForwardIsServer
      }, sourceId);
      setStatusMessage(t('config.storeforward_saved'));
      showToast(t('config.storeforward_saved_toast'), 'success');
      expectRebootAfterSave('storeforward');
      return true;
    } catch (error) {
      logger.error('Error saving Store & Forward config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.storeforward_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.storeforward_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRangeTestConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('rangetest', {
        enabled: rangeTestEnabled,
        sender: rangeTestSender,
        save: rangeTestSave
      }, sourceId);
      setStatusMessage(t('config.rangetest_saved'));
      showToast(t('config.rangetest_saved_toast'), 'success');
      expectRebootAfterSave('rangetest');
      return true;
    } catch (error) {
      logger.error('Error saving Range Test config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.rangetest_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.rangetest_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCannedMessageConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('cannedmsg', {
        enabled: cannedMsgEnabled,
        rotary1Enabled: cannedMsgRotary1Enabled,
        inputbrokerPinA: cannedMsgInputbrokerPinA,
        inputbrokerPinB: cannedMsgInputbrokerPinB,
        inputbrokerPinPress: cannedMsgInputbrokerPinPress,
        inputbrokerEventCw: cannedMsgInputbrokerEventCw,
        inputbrokerEventCcw: cannedMsgInputbrokerEventCcw,
        inputbrokerEventPress: cannedMsgInputbrokerEventPress,
        updown1Enabled: cannedMsgUpdown1Enabled,
        sendBell: cannedMsgSendBell,
        allowInputSource: cannedMsgAllowInputSource
      }, sourceId);
      setStatusMessage(t('config.cannedmsg_saved'));
      showToast(t('config.cannedmsg_saved_toast'), 'success');
      expectRebootAfterSave('cannedmsg');
      return true;
    } catch (error) {
      logger.error('Error saving Canned Message config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.cannedmsg_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.cannedmsg_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAudioConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('audio', {
        codec2Enabled: audioCodec2Enabled,
        pttPin: audioPttPin,
        bitrate: audioBitrate,
        i2sWs: audioI2sWs,
        i2sSd: audioI2sSd,
        i2sDin: audioI2sDin,
        i2sSck: audioI2sSck
      }, sourceId);
      setStatusMessage(t('config.audio_saved'));
      showToast(t('config.audio_saved_toast'), 'success');
      expectRebootAfterSave('audio');
      return true;
    } catch (error) {
      logger.error('Error saving Audio config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.audio_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.audio_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRemoteHardwareConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('remotehardware', {
        enabled: remoteHardwareEnabled,
        allowUndefinedPinAccess: remoteHardwareAllowUndefinedPinAccess
      }, sourceId);
      setStatusMessage(t('config.remotehardware_saved'));
      showToast(t('config.remotehardware_saved_toast'), 'success');
      expectRebootAfterSave('remotehardware');
      return true;
    } catch (error) {
      logger.error('Error saving Remote Hardware config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.remotehardware_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.remotehardware_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDetectionSensorConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('detectionsensor', {
        enabled: detectionSensorEnabled,
        minimumBroadcastSecs: detectionSensorMinimumBroadcastSecs,
        stateBroadcastSecs: detectionSensorStateBroadcastSecs,
        sendBell: detectionSensorSendBell,
        name: detectionSensorName,
        monitorPin: detectionSensorMonitorPin,
        detectionTriggerType: detectionSensorDetectionTriggerType,
        usePullup: detectionSensorUsePullup
      }, sourceId);
      setStatusMessage(t('config.detectionsensor_saved'));
      showToast(t('config.detectionsensor_saved_toast'), 'success');
      expectRebootAfterSave('detectionsensor');
      return true;
    } catch (error) {
      logger.error('Error saving Detection Sensor config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.detectionsensor_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.detectionsensor_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePaxcounterConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('paxcounter', {
        enabled: paxcounterEnabled,
        paxcounterUpdateInterval: paxcounterUpdateInterval,
        wifiThreshold: paxcounterWifiThreshold,
        bleThreshold: paxcounterBleThreshold
      }, sourceId);
      setStatusMessage(t('config.paxcounter_saved'));
      showToast(t('config.paxcounter_saved_toast'), 'success');
      expectRebootAfterSave('paxcounter');
      return true;
    } catch (error) {
      logger.error('Error saving Paxcounter config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.paxcounter_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.paxcounter_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStatusMessageConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('statusmessage', {
        nodeStatus: statusMessageNodeStatus
      }, sourceId);
      setStatusMessage(t('config.statusmessage_saved', 'Status Message config saved'));
      showToast(t('config.statusmessage_saved_toast', 'Status Message config saved successfully'), 'success');
      expectRebootAfterSave('statusmessage');
      return true;
    } catch (error) {
      logger.error('Error saving Status Message config:', error);
      // A save the node did not confirm (#5745) gets its own text.
      const known = statusMessageSaveErrorText((error as { code?: string } | null)?.code);
      const errorMsg = known
        ? t(known.key, known.fallback)
        : error instanceof Error ? error.message : t('config.statusmessage_failed', 'Failed to save Status Message config');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.statusmessage_failed', 'Failed to save Status Message config')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTAKConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('tak', { team: takTeam, role: takRole }, sourceId);
      setStatusMessage(t('config.tak_saved'));
      showToast(t('config.tak_saved_toast'), 'success');
      expectRebootAfterSave('tak');
      return true;
    } catch (error) {
      logger.error('Error saving TAK config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.tak_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.tak_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTrafficManagementConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('trafficmanagement', {
        positionMinIntervalSecs: trafficManagementPositionMinIntervalSecs,
        nodeinfoDirectResponseMaxHops: trafficManagementNodeinfoDirectResponseMaxHops,
        rateLimitWindowSecs: trafficManagementRateLimitWindowSecs,
        rateLimitMaxPackets: trafficManagementRateLimitMaxPackets,
        unknownPacketThreshold: trafficManagementUnknownPacketThreshold
      }, sourceId);
      setStatusMessage(t('config.trafficmanagement_saved', 'Traffic Management config saved'));
      showToast(t('config.trafficmanagement_saved_toast', 'Traffic Management config saved successfully'), 'success');
      expectRebootAfterSave('trafficmanagement');
      return true;
    } catch (error) {
      logger.error('Error saving Traffic Management config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.trafficmanagement_failed', 'Failed to save Traffic Management config');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.trafficmanagement_failed', 'Failed to save Traffic Management config')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMeshBeaconConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Shared builder owns the wire omit-logic (offer channel, optional
      // preset, target normalisation) — see buildMeshBeaconConfigPayload.
      const config = buildMeshBeaconConfigPayload({
        listenEnabled: meshBeaconListenEnabled,
        broadcastEnabled: meshBeaconBroadcastEnabled,
        legacySplit: meshBeaconLegacySplit,
        broadcastMessage: meshBeaconBroadcastMessage,
        broadcastOfferChannelName: meshBeaconBroadcastOfferChannelName,
        broadcastOfferChannelPsk: meshBeaconBroadcastOfferChannelPsk,
        broadcastOfferRegion: meshBeaconBroadcastOfferRegion,
        broadcastOfferPreset: meshBeaconBroadcastOfferPreset,
        broadcastIntervalSecs: meshBeaconBroadcastIntervalSecs,
        broadcastTargets: meshBeaconBroadcastTargets,
      });

      await apiService.setModuleConfig('meshbeacon', config, sourceId);
      setStatusMessage(t('config.meshbeacon_saved', 'MeshBeacon config saved'));
      showToast(t('config.meshbeacon_saved_toast', 'MeshBeacon config saved successfully'), 'success');
      expectRebootAfterSave('meshbeacon');
      return true;
    } catch (error) {
      logger.error('Error saving MeshBeacon config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.meshbeacon_failed', 'Failed to save MeshBeacon config');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.meshbeacon_failed', 'Failed to save MeshBeacon config')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSerialConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('serial', {
        enabled: serialEnabled,
        echo: serialEcho,
        rxd: serialRxd,
        txd: serialTxd,
        baud: serialBaud,
        timeout: serialTimeout,
        mode: serialMode,
        overrideConsoleSerialPort: serialOverrideConsoleSerialPort
      }, sourceId);
      setStatusMessage(t('config.serial_saved'));
      showToast(t('config.serial_saved_toast'), 'success');
      expectRebootAfterSave('serial');
      return true;
    } catch (error) {
      logger.error('Error saving Serial config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.serial_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.serial_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAmbientLightingConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.setModuleConfig('ambientlighting', {
        ledState: ambientLedState,
        current: ambientCurrent,
        red: ambientRed,
        green: ambientGreen,
        blue: ambientBlue
      }, sourceId);
      setStatusMessage(t('config.ambientlighting_saved'));
      showToast(t('config.ambientlighting_saved_toast'), 'success');
      expectRebootAfterSave('ambientlighting');
      return true;
    } catch (error) {
      logger.error('Error saving Ambient Lighting config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.ambientlighting_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.ambientlighting_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecurityConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      // Filter out empty admin keys
      const validAdminKeys = securityAdminKeys.filter(key => key && key.trim().length > 0);

      // Send the private key only when the user actually pasted a new one — an
      // unchanged key is left off so the firmware keeps the current identity
      // (#4632). The server derives the matching public key and enforces
      // local-node-only.
      const newPrivateKey = securityPrivateKey.trim();
      const privateKeyChanged =
        newPrivateKey.length > 0 &&
        normalizeMeshtasticKey(newPrivateKey) !== normalizeMeshtasticKey(loadedSecurityPrivateKeyRef.current);

      // The policy goes out only when the user changed it (#5612). Left out,
      // the server keeps the value it reads from the node.
      const newSignaturePolicy = policyToSend(securityLoadedSignaturePolicy, securitySignaturePolicy);

      await apiService.setSecurityConfig({
        adminKeys: validAdminKeys,
        isManaged: securityIsManaged,
        serialEnabled: securitySerialEnabled,
        debugLogApiEnabled: securityDebugLogApiEnabled,
        adminChannelEnabled: securityAdminChannelEnabled,
        ...(privateKeyChanged ? { privateKey: newPrivateKey } : {}),
        ...(newSignaturePolicy !== undefined ? { packetSignaturePolicy: newSignaturePolicy } : {})
      }, sourceId);
      if (privateKeyChanged) {
        loadedSecurityPrivateKeyRef.current = newPrivateKey;
      }
      if (newSignaturePolicy !== undefined) {
        setSecurityLoadedSignaturePolicy(newSignaturePolicy);
      }
      setStatusMessage(t('config.security_saved'));
      showToast(t('config.security_saved_toast'), 'success');
      expectRebootAfterSave('security');
      return true;
    } catch (error) {
      logger.error('Error saving Security config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.security_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.security_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Reboot and purge: the caller confirms first (#5830); Classic's dialog
  // state stays in ConfigurationTab.
  const handleRebootDevice = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      if (onRebootDevice) {
        // Use the parent handler which manages connection status
        setStatusMessage(t('config.rebooting'));
        showToast(t('config.rebooting_toast'), 'info');
        const success = await onRebootDevice();
        if (success) {
          setStatusMessage(t('config.reboot_success'));
          showToast(t('config.reboot_success_toast'), 'success');
        } else {
          setStatusMessage(t('config.reboot_failed_reconnect'));
          showToast(t('config.reboot_failed_reconnect_toast'), 'warning');
        }
        return success;
      } else {
        // Fallback to direct API call if handler not provided
        await apiService.rebootDevice(5, sourceId);
        setStatusMessage(t('config.reboot_sent'));
        showToast(t('config.reboot_sent_toast'), 'success');
        return true;
      }
    } catch (error) {
      logger.error('Error rebooting device:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.reboot_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.reboot_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePurgeNodeDb = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await apiService.purgeNodeDb(0, sourceId);
      setStatusMessage(t('config.purge_success'));
      showToast(t('config.purge_success'), 'success');
      return true;
    } catch (error) {
      logger.error('Error purging node database:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.purge_failed');
      setStatusMessage(`Error: ${errorMsg}`);
      showToast(`${t('config.purge_failed')}: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to format value for display
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  // Reload configuration from device
  const handleReloadConfig = async (): Promise<ConfigChange[]> => {
    setIsReloading(true);
    setConfigChanges([]);
    setShowChanges(false);

    try {
      // Request fresh config from device
      await apiService.refreshNodes(sourceId);

      // Wait a moment for device to respond
      await new Promise(resolve => setTimeout(resolve, 2000));

      // The reload re-saves every channel slot the node sends, but the
      // channel list on this page comes from the poll cache, which refetches
      // only every 30 s while the WebSocket is up (and no channel event is
      // pushed). Refetch it now, or a renamed or newly enabled slot keeps its
      // stale name until the next poll (#5919).
      void queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) });

      // Fetch updated config
      const config = await apiService.getCurrentConfig(sourceId);

      const changes: ConfigChange[] = [];

      // Update state and track changes for Device Config
      if (config.deviceConfig?.device) {
        const device = config.deviceConfig.device;
        if (device.role !== undefined) {
          const newRole = typeof device.role === 'string' ? ROLE_MAP[device.role] || 0 : device.role;
          if (newRole !== role) {
            changes.push({ section: 'device', field: 'Device: Role', before: role, after: newRole });
          }
          setRole(newRole);
        }
        if (device.nodeInfoBroadcastSecs !== undefined && device.nodeInfoBroadcastSecs !== nodeInfoBroadcastSecs) {
          changes.push({ section: 'device', field: 'Device: Node Info Broadcast (s)', before: nodeInfoBroadcastSecs, after: device.nodeInfoBroadcastSecs });
          setNodeInfoBroadcastSecs(device.nodeInfoBroadcastSecs);
        }
        if (device.buzzerMode !== undefined && device.buzzerMode !== buzzerMode) {
          changes.push({ section: 'device', field: 'Device: Buzzer Mode', before: buzzerMode, after: device.buzzerMode });
          setBuzzerMode(device.buzzerMode);
        }
        if (device.ledHeartbeatDisabled !== undefined && device.ledHeartbeatDisabled !== ledHeartbeatDisabled) {
          changes.push({ section: 'device', field: 'Device: LED Heartbeat Disabled', before: ledHeartbeatDisabled, after: device.ledHeartbeatDisabled });
          setLedHeartbeatDisabled(device.ledHeartbeatDisabled);
        }
        if (device.rebroadcastMode !== undefined && device.rebroadcastMode !== rebroadcastMode) {
          changes.push({ section: 'device', field: 'Device: Rebroadcast Mode', before: rebroadcastMode, after: device.rebroadcastMode });
          setRebroadcastMode(device.rebroadcastMode);
        }
        if (device.tzdef !== undefined && device.tzdef !== tzdef) {
          changes.push({ section: 'device', field: 'Device: Timezone', before: tzdef, after: device.tzdef });
          setTzdef(device.tzdef);
        }
        if (device.doubleTapAsButtonPress !== undefined) setDoubleTapAsButtonPress(device.doubleTapAsButtonPress);
        if (device.disableTripleClick !== undefined) setDisableTripleClick(device.disableTripleClick);
        if (device.buttonGpio !== undefined) setButtonGpio(device.buttonGpio);
        if (device.buzzerGpio !== undefined) setBuzzerGpio(device.buzzerGpio);
      }

      // Update LoRa Config
      if (config.deviceConfig?.lora) {
        const lora = config.deviceConfig.lora;
        // proto3 elides `false`; normalize to bool before comparing (#5028 class).
        const newUsePreset = lora.usePreset === true;
        if (newUsePreset !== usePreset) {
          changes.push({ section: 'lora', field: 'LoRa: Use Preset', before: usePreset, after: newUsePreset });
          setUsePreset(newUsePreset);
        }
        if (lora.modemPreset !== undefined) {
          // Unknown names stay unknown rather than becoming LONG_FAST (#5547).
          const resolved = resolveModemPresetValue(lora.modemPreset);
          const newPreset = resolved ?? UNKNOWN_MODEM_PRESET;
          if (newPreset !== modemPreset) {
            changes.push({ section: 'lora', field: 'LoRa: Modem Preset', before: modemPreset, after: resolved === null ? lora.modemPreset : newPreset });
          }
          setUnknownModemPresetName(resolved === null ? String(lora.modemPreset) : null);
          setModemPreset(newPreset);
        }
        if (lora.region !== undefined) {
          const newRegion = typeof lora.region === 'string' ? REGION_MAP[lora.region] || 0 : lora.region;
          if (newRegion !== region) {
            changes.push({ section: 'lora', field: 'LoRa: Region', before: region, after: newRegion });
          }
          setRegion(newRegion);
        }
        if (lora.hopLimit !== undefined && lora.hopLimit !== hopLimit) {
          changes.push({ section: 'lora', field: 'LoRa: Hop Limit', before: hopLimit, after: lora.hopLimit });
          setHopLimit(lora.hopLimit);
        }
        if (lora.txPower !== undefined && lora.txPower !== txPower) {
          changes.push({ section: 'lora', field: 'LoRa: TX Power', before: txPower, after: lora.txPower });
          setTxPower(lora.txPower);
        }
        if (lora.txEnabled !== undefined && lora.txEnabled !== txEnabled) {
          changes.push({ section: 'lora', field: 'LoRa: TX Enabled', before: txEnabled, after: lora.txEnabled });
          setTxEnabled(lora.txEnabled);
        }
        // Update remaining LoRa fields without change tracking
        if (lora.bandwidth !== undefined) setBandwidth(lora.bandwidth);
        if (lora.spreadFactor !== undefined) setSpreadFactor(lora.spreadFactor);
        if (lora.codingRate !== undefined) setCodingRate(lora.codingRate);
        if (lora.frequencyOffset !== undefined) setFrequencyOffset(lora.frequencyOffset);
        if (lora.overrideFrequency !== undefined) setOverrideFrequency(lora.overrideFrequency);
        if (lora.channelNum !== undefined) setChannelNum(lora.channelNum);
        if (lora.femLnaMode !== undefined) setFemLnaMode(lora.femLnaMode);
        if (lora.sx126xRxBoostedGain !== undefined) setSx126xRxBoostedGain(lora.sx126xRxBoostedGain);
        if (lora.ignoreMqtt !== undefined) setIgnoreMqtt(lora.ignoreMqtt);
        if (lora.configOkToMqtt !== undefined) setConfigOkToMqtt(lora.configOkToMqtt);
        if (lora.overrideDutyCycle !== undefined) setOverrideDutyCycle(lora.overrideDutyCycle);
        if (lora.paFanDisabled !== undefined) setPaFanDisabled(lora.paFanDisabled);
      }

      // Update Position Config
      if (config.deviceConfig?.position) {
        const pos = config.deviceConfig.position;
        if (pos.positionBroadcastSecs !== undefined && pos.positionBroadcastSecs !== positionBroadcastSecs) {
          changes.push({ section: 'position', field: 'Position: Broadcast Interval (s)', before: positionBroadcastSecs, after: pos.positionBroadcastSecs });
          setPositionBroadcastSecs(pos.positionBroadcastSecs);
        }
        // proto3 elides `false` (#5028 class).
        const newPositionSmartEnabled = pos.positionBroadcastSmartEnabled === true;
        if (newPositionSmartEnabled !== positionSmartEnabled) {
          changes.push({ section: 'position', field: 'Position: Smart Enabled', before: positionSmartEnabled, after: newPositionSmartEnabled });
          setPositionSmartEnabled(newPositionSmartEnabled);
        }
        if (pos.fixedPosition !== undefined && pos.fixedPosition !== fixedPosition) {
          changes.push({ section: 'position', field: 'Position: Fixed Position', before: fixedPosition, after: pos.fixedPosition });
          setFixedPosition(pos.fixedPosition);
        }
        // GpsMode.DISABLED = 0 is a real enum value and proto3 elides it (#5028).
        const newGpsMode = pos.gpsMode ?? 0;
        if (newGpsMode !== gpsMode) {
          changes.push({ section: 'position', field: 'Position: GPS Mode', before: gpsMode, after: newGpsMode });
          setGpsMode(newGpsMode);
        }
        // Update remaining position fields
        if (pos.gpsUpdateInterval !== undefined) setGpsUpdateInterval(pos.gpsUpdateInterval);
        if (pos.broadcastSmartMinimumDistance !== undefined) setBroadcastSmartMinimumDistance(pos.broadcastSmartMinimumDistance);
        if (pos.broadcastSmartMinimumIntervalSecs !== undefined) setBroadcastSmartMinimumIntervalSecs(pos.broadcastSmartMinimumIntervalSecs);
        if (pos.positionFlags !== undefined) setPositionFlags(pos.positionFlags);
        if (pos.rxGpio !== undefined) setRxGpio(pos.rxGpio);
        if (pos.txGpio !== undefined) setTxGpio(pos.txGpio);
        if (pos.gpsEnGpio !== undefined) setGpsEnGpio(pos.gpsEnGpio);
      }

      // Update MQTT Config
      if (config.moduleConfig?.mqtt) {
        const mqtt = config.moduleConfig.mqtt;
        if (mqtt.enabled !== undefined && mqtt.enabled !== mqttEnabled) {
          changes.push({ section: 'mqtt', field: 'MQTT: Enabled', before: mqttEnabled, after: mqtt.enabled });
          setMqttEnabled(mqtt.enabled);
        }
        if (mqtt.address !== undefined && mqtt.address !== mqttAddress) {
          changes.push({ section: 'mqtt', field: 'MQTT: Address', before: mqttAddress, after: mqtt.address });
          setMqttAddress(mqtt.address);
        }
        // proto3 elides `false` (#5028 class).
        const newMqttEncryptionEnabled = mqtt.encryptionEnabled === true;
        if (newMqttEncryptionEnabled !== mqttEncryptionEnabled) {
          changes.push({ section: 'mqtt', field: 'MQTT: Encryption Enabled', before: mqttEncryptionEnabled, after: newMqttEncryptionEnabled });
          setMqttEncryptionEnabled(newMqttEncryptionEnabled);
        }
        if (mqtt.tlsEnabled !== undefined && mqtt.tlsEnabled !== mqttTlsEnabled) {
          changes.push({ section: 'mqtt', field: 'MQTT: TLS Enabled', before: mqttTlsEnabled, after: mqtt.tlsEnabled });
          setMqttTlsEnabled(mqtt.tlsEnabled);
        }
        // Update remaining MQTT fields
        if (mqtt.username !== undefined) setMqttUsername(mqtt.username);
        if (mqtt.password !== undefined) setMqttPassword(mqtt.password);
        if (mqtt.jsonEnabled !== undefined) setMqttJsonEnabled(mqtt.jsonEnabled);
        if (mqtt.root !== undefined) setMqttRoot(mqtt.root);
        if (mqtt.proxyToClientEnabled !== undefined) setMqttProxyToClientEnabled(mqtt.proxyToClientEnabled);
        // Map reporting: read like the initial load. proto3 elides `false`, so
        // an absent flag is off; skipping it on `undefined` left a box ticked
        // after it was turned off on the radio. Report Location was never
        // re-read at all.
        const newMapReportingEnabled = mqtt.mapReportingEnabled === true;
        if (newMapReportingEnabled !== mqttMapReportingEnabled) {
          changes.push({ section: 'mqtt', field: 'MQTT: Map Reporting', before: mqttMapReportingEnabled, after: newMapReportingEnabled });
          setMqttMapReportingEnabled(newMapReportingEnabled);
        }
        const newMapShouldReportLocation = mqtt.mapReportSettings?.shouldReportLocation === true;
        if (newMapShouldReportLocation !== mqttMapShouldReportLocation) {
          changes.push({ section: 'mqtt', field: 'MQTT: Map Report Location', before: mqttMapShouldReportLocation, after: newMapShouldReportLocation });
          setMqttMapShouldReportLocation(newMapShouldReportLocation);
        }
        if (mqtt.mapReportSettings?.publishIntervalSecs !== undefined) setMqttMapPublishIntervalSecs(mqtt.mapReportSettings.publishIntervalSecs);
        if (mqtt.mapReportSettings?.positionPrecision !== undefined) setMqttMapPositionPrecision(mqtt.mapReportSettings.positionPrecision);
      }

      // Update Network Config
      if (config.deviceConfig?.network) {
        const net = config.deviceConfig.network;
        if (net.wifiEnabled !== undefined && net.wifiEnabled !== wifiEnabled) {
          changes.push({ section: 'network', field: 'Network: WiFi Enabled', before: wifiEnabled, after: net.wifiEnabled });
          setWifiEnabled(net.wifiEnabled);
        }
        if (net.wifiSsid !== undefined && net.wifiSsid !== wifiSsid) {
          changes.push({ section: 'network', field: 'Network: WiFi SSID', before: wifiSsid, after: net.wifiSsid });
          setWifiSsid(net.wifiSsid);
        }
        if (net.addressMode !== undefined && net.addressMode !== addressMode) {
          changes.push({ section: 'network', field: 'Network: Address Mode', before: addressMode, after: net.addressMode });
          setAddressMode(net.addressMode);
        }
        // Update remaining network fields
        if (net.wifiPsk !== undefined) setWifiPsk(net.wifiPsk);
        if (net.ntpServer !== undefined) setNtpServer(net.ntpServer);
        if (net.rsyslogServer !== undefined) setRsyslogServer(net.rsyslogServer);
        if (net.enabledProtocols !== undefined) setEnabledProtocols(net.enabledProtocols);
        if (net.ipv4Config) {
          if (net.ipv4Config.ip !== undefined) setIpv4Address(net.ipv4Config.ip);
          if (net.ipv4Config.gateway !== undefined) setIpv4Gateway(net.ipv4Config.gateway);
          if (net.ipv4Config.subnet !== undefined) setIpv4Subnet(net.ipv4Config.subnet);
          if (net.ipv4Config.dns !== undefined) setIpv4Dns(net.ipv4Config.dns);
        }
        setFullNetworkConfig(net);
      }

      // Update Power Config
      if (config.deviceConfig?.power) {
        const pwr = config.deviceConfig.power;
        if (pwr.isPowerSaving !== undefined && pwr.isPowerSaving !== isPowerSaving) {
          changes.push({ section: 'power', field: 'Power: Power Saving', before: isPowerSaving, after: pwr.isPowerSaving });
          setIsPowerSaving(pwr.isPowerSaving);
        }
        // Update remaining power fields
        if (pwr.onBatteryShutdownAfterSecs !== undefined) setOnBatteryShutdownAfterSecs(pwr.onBatteryShutdownAfterSecs);
        if (pwr.adcMultiplierOverride !== undefined) setAdcMultiplierOverride(pwr.adcMultiplierOverride);
        if (pwr.waitBluetoothSecs !== undefined) setWaitBluetoothSecs(pwr.waitBluetoothSecs);
        if (pwr.sdsSecs !== undefined) setSdsSecs(pwr.sdsSecs);
        if (pwr.lsSecs !== undefined) setLsSecs(pwr.lsSecs);
        if (pwr.minWakeSecs !== undefined) setMinWakeSecs(pwr.minWakeSecs);
        if (pwr.deviceBatteryInaAddress !== undefined) setDeviceBatteryInaAddress(pwr.deviceBatteryInaAddress);
      }

      // Update Display Config
      if (config.deviceConfig?.display) {
        const disp = config.deviceConfig.display;
        if (disp.screenOnSecs !== undefined && disp.screenOnSecs !== screenOnSecs) {
          changes.push({ section: 'display', field: 'Display: Screen On (s)', before: screenOnSecs, after: disp.screenOnSecs });
          setScreenOnSecs(disp.screenOnSecs);
        }
        if (disp.flipScreen !== undefined && disp.flipScreen !== flipScreen) {
          changes.push({ section: 'display', field: 'Display: Flip Screen', before: flipScreen, after: disp.flipScreen });
          setFlipScreen(disp.flipScreen);
        }
        if (disp.units !== undefined && disp.units !== displayUnits) {
          changes.push({ section: 'display', field: 'Display: Units', before: displayUnits, after: disp.units });
          setDisplayUnits(disp.units);
        }
        // Update remaining display fields
        if (disp.autoScreenCarouselSecs !== undefined) setAutoScreenCarouselSecs(disp.autoScreenCarouselSecs);
        if (disp.oled !== undefined) setOled(disp.oled);
        if (disp.displaymode !== undefined) setDisplayMode(disp.displaymode);
        if (disp.headingBold !== undefined) setHeadingBold(disp.headingBold);
        if (disp.wakeOnTapOrMotion !== undefined) setWakeOnTapOrMotion(disp.wakeOnTapOrMotion);
        if (disp.compassOrientation !== undefined) setCompassOrientation(disp.compassOrientation);
      }

      // Update NeighborInfo Config
      if (config.moduleConfig?.neighborInfo) {
        const ni = config.moduleConfig.neighborInfo;
        if (ni.enabled !== undefined && ni.enabled !== neighborInfoEnabled) {
          changes.push({ section: 'neighborinfo', field: 'Neighbor Info: Enabled', before: neighborInfoEnabled, after: ni.enabled });
          setNeighborInfoEnabled(ni.enabled);
        }
        if (ni.updateInterval !== undefined && ni.updateInterval !== neighborInfoInterval) {
          changes.push({ section: 'neighborinfo', field: 'Neighbor Info: Interval (s)', before: neighborInfoInterval, after: ni.updateInterval });
          setNeighborInfoInterval(ni.updateInterval);
        }
        if (ni.transmitOverLora !== undefined) setNeighborInfoTransmitOverLora(ni.transmitOverLora);
      }

      // Update Telemetry Config
      if (config.moduleConfig?.telemetry) {
        const tel = config.moduleConfig.telemetry;
        if (tel.deviceUpdateInterval !== undefined) setDeviceUpdateInterval(tel.deviceUpdateInterval);
        if (tel.deviceTelemetryEnabled !== undefined) setDeviceTelemetryEnabled(tel.deviceTelemetryEnabled);
        if (tel.environmentUpdateInterval !== undefined) setEnvironmentUpdateInterval(tel.environmentUpdateInterval);
        if (tel.environmentMeasurementEnabled !== undefined) setEnvironmentMeasurementEnabled(tel.environmentMeasurementEnabled);
        if (tel.environmentScreenEnabled !== undefined) setEnvironmentScreenEnabled(tel.environmentScreenEnabled);
        if (tel.environmentDisplayFahrenheit !== undefined) setEnvironmentDisplayFahrenheit(tel.environmentDisplayFahrenheit);
        if (tel.airQualityEnabled !== undefined) setAirQualityEnabled(tel.airQualityEnabled);
        if (tel.airQualityInterval !== undefined) setAirQualityInterval(tel.airQualityInterval);
        if (tel.powerMeasurementEnabled !== undefined) setPowerMeasurementEnabled(tel.powerMeasurementEnabled);
        if (tel.powerUpdateInterval !== undefined) setPowerUpdateInterval(tel.powerUpdateInterval);
        if (tel.powerScreenEnabled !== undefined) setPowerScreenEnabled(tel.powerScreenEnabled);
        if (tel.healthMeasurementEnabled !== undefined) setHealthMeasurementEnabled(tel.healthMeasurementEnabled);
        if (tel.healthUpdateInterval !== undefined) setHealthUpdateInterval(tel.healthUpdateInterval);
        if (tel.healthScreenEnabled !== undefined) setHealthScreenEnabled(tel.healthScreenEnabled);
      }

      // Update Node Identity
      if (config.localNodeInfo) {
        if (config.localNodeInfo.longName !== undefined) setLongName(config.localNodeInfo.longName);
        if (config.localNodeInfo.shortName !== undefined) setShortName(config.localNodeInfo.shortName);
        if (config.localNodeInfo.isUnmessagable !== undefined) setIsUnmessagable(config.localNodeInfo.isUnmessagable);
        if (config.localNodeInfo.isLicensed !== undefined) setIsLicensed(config.localNodeInfo.isLicensed);
        if (config.localNodeInfo.firmwareVersion !== undefined) setLocalFirmwareVersion(config.localNodeInfo.firmwareVersion ?? null);
      }

      // The reloaded values are what the node holds now: re-baseline the
      // sections this reload refreshed. Batched with the setters above, so the
      // first render with the new values already compares against them.
      setConfigVersion(v => v + 1);

      setConfigChanges(changes.map(c => ({ field: c.field, oldValue: formatValue(c.before), newValue: formatValue(c.after) })));
      if (changes.length > 0) {
        setShowChanges(true);
        showToast(t('config.reload_changes_detected', { count: changes.length }), 'info');
      } else {
        showToast(t('config.reload_no_changes'), 'success');
      }

      logger.info(`Config reloaded. ${changes.length} changes detected.`);
      return changes;
    } catch (error) {
      logger.error('Error reloading config:', error);
      const errorMsg = error instanceof Error ? error.message : t('config.reload_failed');
      showToast(`${t('config.reload_failed')}: ${errorMsg}`, 'error');
      return [];
    } finally {
      setIsReloading(false);
    }
  };

  return {
    owner: handleSaveNodeOwner,
    device: handleSaveDeviceConfig,
    lora: handleSaveLoRaConfig,
    position: handleSavePositionConfig,
    mqtt: handleSaveMQTTConfig,
    neighborinfo: handleSaveNeighborInfoConfig,
    network: handleSaveNetworkConfig,
    power: handleSavePowerConfig,
    display: handleSaveDisplayConfig,
    telemetry: handleSaveTelemetryConfig,
    extnotif: handleSaveExternalNotificationConfig,
    storeforward: handleSaveStoreForwardConfig,
    rangetest: handleSaveRangeTestConfig,
    cannedmsg: handleSaveCannedMessageConfig,
    audio: handleSaveAudioConfig,
    remotehardware: handleSaveRemoteHardwareConfig,
    detectionsensor: handleSaveDetectionSensorConfig,
    paxcounter: handleSavePaxcounterConfig,
    statusmessage: handleSaveStatusMessageConfig,
    tak: handleSaveTAKConfig,
    trafficmanagement: handleSaveTrafficManagementConfig,
    meshbeacon: handleSaveMeshBeaconConfig,
    serial: handleSaveSerialConfig,
    ambientlighting: handleSaveAmbientLightingConfig,
    security: handleSaveSecurityConfig,
    reboot: handleRebootDevice,
    purgeNodeDb: handlePurgeNodeDb,
    reload: handleReloadConfig,
  };
}
