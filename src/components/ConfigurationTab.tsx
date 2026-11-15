import React, { useState, useEffect } from 'react';
import ModuleAvailabilityGate from './configuration/ModuleAvailabilityGate';
import { UiIcon } from './icons';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useToast } from './ToastContainer';
import { useSource } from '../contexts/SourceContext';
import type { DeviceInfo, Channel } from '../types/device';
import { logger } from '../utils/logger';
import NodeIdentitySection from './configuration/NodeIdentitySection';
import DeviceConfigSection from './configuration/DeviceConfigSection';
import LoRaConfigSection from './configuration/LoRaConfigSection';
import PositionConfigSection from './configuration/PositionConfigSection';
import MQTTConfigSection from './configuration/MQTTConfigSection';
import NeighborInfoSection from './configuration/NeighborInfoSection';
import NetworkConfigSection from './configuration/NetworkConfigSection';
import PowerConfigSection from './configuration/PowerConfigSection';
import DisplayConfigSection from './configuration/DisplayConfigSection';
import TelemetryConfigSection from './configuration/TelemetryConfigSection';
import ExternalNotificationConfigSection from './configuration/ExternalNotificationConfigSection';
import StoreForwardConfigSection from './configuration/StoreForwardConfigSection';
import RangeTestConfigSection from './configuration/RangeTestConfigSection';
import CannedMessageConfigSection from './configuration/CannedMessageConfigSection';
import AudioConfigSection from './configuration/AudioConfigSection';
import RemoteHardwareConfigSection from './configuration/RemoteHardwareConfigSection';
import DetectionSensorConfigSection from './configuration/DetectionSensorConfigSection';
import PaxcounterConfigSection from './configuration/PaxcounterConfigSection';
import StatusMessageConfigSection from './configuration/StatusMessageConfigSection';
import StatusMessageReapplyOption from './configuration/StatusMessageReapplyOption';
import TAKConfigSection from './configuration/TAKConfigSection';
import TrafficManagementConfigSection from './configuration/TrafficManagementConfigSection';
import MeshBeaconConfigSection from './configuration/MeshBeaconConfigSection';
import SerialConfigSection from './configuration/SerialConfigSection';
import AmbientLightingConfigSection from './configuration/AmbientLightingConfigSection';
import SecurityConfigSection from './configuration/SecurityConfigSection';
import PkiDmDecryptionSection from './configuration/PkiDmDecryptionSection';
import FirmwareUpdateSection from './configuration/FirmwareUpdateSection';
import { MovedSettingNote } from './common/MovedSettingNote';
import { useAuth } from '../contexts/AuthContext';
import { useHealth } from '../hooks/useHealth';
import ChannelsConfigSection from './configuration/ChannelsConfigSection';
import GpioPinSummary from './configuration/GpioPinSummary';
import BackupManagementSection from './configuration/BackupManagementSection';
import { ImportConfigModal } from './configuration/ImportConfigModal';
import { ExportConfigModal } from './configuration/ExportConfigModal';
import { ConfirmDialog } from './shared/automation/ConfirmDialog';
import { ConfigSection } from './shared/config/ConfigSection';
import { TypedConfirmDialog } from './common/TypedConfirmDialog';
import { DangerZone, DangerZoneActions, DangerZoneButton } from './shared/config/DangerZone';
import { buildAdminCommandsPath } from '../utils/adminDeepLink';
import SectionNav from './SectionNav';
import sectionNavLayout from './SectionNav.module.css';
import { configurationNavItems } from './search/configSections';
import styles from './ConfigurationTab.module.css';
import { useDeviceConfigState } from '../hooks/deviceConfig/useDeviceConfigState';
import { useDeviceConfigSaves } from '../hooks/deviceConfig/useDeviceConfigSaves';

interface ConfigurationTabProps {
  baseUrl?: string; // Optional, not used in component but passed from App.tsx
  nodes?: DeviceInfo[]; // Pass nodes from App to avoid separate API call
  channels?: Channel[]; // Pass channels from App
  onRebootDevice?: () => Promise<boolean>;
  /**
   * Called after a save the node reboots to apply (#5823). `possible` means
   * the node restarts only if certain fields changed.
   */
  onConfigChangeTriggeringReboot?: (expectation: 'always' | 'possible') => void;
  onChannelsUpdated?: () => void; // Callback when channels are updated
  refreshTrigger?: number; // Increment this to trigger config refresh
}

const ConfigurationTab: React.FC<ConfigurationTabProps> = ({ baseUrl = '', nodes, channels = [], onRebootDevice, onConfigChangeTriggeringReboot, onChannelsUpdated, refreshTrigger }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId } = useSource();
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin ?? false;
  // Firmware update acts on the device, so it lives here and not on Settings
  // (#5683 follow-up). Same gate it had there: an admin, on an install with
  // OTA enabled. Shares TanStack's ['health', baseUrl] cache with App's poll.
  const { data: health } = useHealth({ baseUrl, refetchInterval: 60000 });
  const showFirmware = isAdmin && health?.firmwareOtaEnabled === true;
  // PKI DM decryption is a MeshMonitor-side switch and moved to this source's
  // Settings page. A viewer who cannot open that page keeps it here: its
  // routes check `configuration`, the grant this page already needs.
  const canViewSourceSettings = hasPermission('settings', 'read', { anySource: true });
  // Every save on this page, and reboot / purge, needs configuration:write on
  // this source (#5830). Read-only viewers see the values with the controls
  // disabled; the routes refuse the write regardless.
  const canWrite = hasPermission('configuration', 'write', { sourceId });
  const deviceConfigState = useDeviceConfigState(sourceId, refreshTrigger);
  const {
    loading: isLoading,
    longName, setLongName, shortName, setShortName, isUnmessagable, setIsUnmessagable, isLicensed,
    setIsLicensed, role, setRole, nodeInfoBroadcastSecs, setNodeInfoBroadcastSecs, tzdef, setTzdef,
    rebroadcastMode, setRebroadcastMode, doubleTapAsButtonPress, setDoubleTapAsButtonPress,
    disableTripleClick, setDisableTripleClick, ledHeartbeatDisabled, setLedHeartbeatDisabled, buzzerMode,
    setBuzzerMode, buttonGpio, setButtonGpio, buzzerGpio, setBuzzerGpio, usePreset, setUsePreset, modemPreset,
    setModemPreset, unknownModemPresetName, localFirmwareVersion, bandwidth, setBandwidth, spreadFactor,
    setSpreadFactor, codingRate, setCodingRate, frequencyOffset, setFrequencyOffset, overrideFrequency,
    setOverrideFrequency, region, setRegion, hopLimit, setHopLimit, txPower, setTxPower, channelNum,
    setChannelNum, femLnaMode, setFemLnaMode, sx126xRxBoostedGain, setSx126xRxBoostedGain, ignoreMqtt,
    setIgnoreMqtt, configOkToMqtt, setConfigOkToMqtt, txEnabled, setTxEnabled, overrideDutyCycle,
    setOverrideDutyCycle, paFanDisabled, setPaFanDisabled, positionBroadcastSecs, setPositionBroadcastSecs,
    positionSmartEnabled, setPositionSmartEnabled, fixedPosition, setFixedPosition, fixedLatitude,
    setFixedLatitude, fixedLongitude, setFixedLongitude, fixedAltitude, setFixedAltitude, gpsUpdateInterval,
    setGpsUpdateInterval, gpsMode, setGpsMode, broadcastSmartMinimumDistance,
    setBroadcastSmartMinimumDistance, broadcastSmartMinimumIntervalSecs, setBroadcastSmartMinimumIntervalSecs,
    positionFlags, setPositionFlags, rxGpio, setRxGpio, txGpio, setTxGpio, gpsEnGpio, setGpsEnGpio,
    mqttEnabled, setMqttEnabled, mqttAddress, setMqttAddress, mqttUsername, setMqttUsername, mqttPassword,
    setMqttPassword, mqttEncryptionEnabled, setMqttEncryptionEnabled, mqttJsonEnabled, setMqttJsonEnabled,
    mqttRoot, setMqttRoot, mqttTlsEnabled, setMqttTlsEnabled, mqttProxyToClientEnabled,
    setMqttProxyToClientEnabled, isBridged, mqttProxyClientAttached, mqttMapReportingEnabled,
    setMqttMapReportingEnabled, mqttMapPublishIntervalSecs, setMqttMapPublishIntervalSecs,
    mqttMapPositionPrecision, setMqttMapPositionPrecision, mqttMapShouldReportLocation,
    setMqttMapShouldReportLocation, neighborInfoEnabled, setNeighborInfoEnabled, neighborInfoInterval,
    setNeighborInfoInterval, neighborInfoTransmitOverLora, setNeighborInfoTransmitOverLora, wifiEnabled,
    setWifiEnabled, wifiSsid, setWifiSsid, wifiPsk, setWifiPsk, ntpServer, setNtpServer, rsyslogServer,
    setRsyslogServer, addressMode, setAddressMode, ipv4Address, setIpv4Address, ipv4Gateway, setIpv4Gateway,
    ipv4Subnet, setIpv4Subnet, ipv4Dns, setIpv4Dns, enabledProtocols, setEnabledProtocols, isPowerSaving,
    setIsPowerSaving, onBatteryShutdownAfterSecs, setOnBatteryShutdownAfterSecs, adcMultiplierOverride,
    setAdcMultiplierOverride, waitBluetoothSecs, setWaitBluetoothSecs, sdsSecs, setSdsSecs, lsSecs, setLsSecs,
    minWakeSecs, setMinWakeSecs, deviceBatteryInaAddress, setDeviceBatteryInaAddress, screenOnSecs,
    setScreenOnSecs, autoScreenCarouselSecs, setAutoScreenCarouselSecs, flipScreen, setFlipScreen,
    displayUnits, setDisplayUnits, oled, setOled, displayMode, setDisplayMode, headingBold, setHeadingBold,
    wakeOnTapOrMotion, setWakeOnTapOrMotion, compassOrientation, setCompassOrientation, deviceUpdateInterval,
    setDeviceUpdateInterval, deviceTelemetryEnabled, setDeviceTelemetryEnabled, environmentUpdateInterval,
    setEnvironmentUpdateInterval, environmentMeasurementEnabled, setEnvironmentMeasurementEnabled,
    environmentScreenEnabled, setEnvironmentScreenEnabled, environmentDisplayFahrenheit,
    setEnvironmentDisplayFahrenheit, airQualityEnabled, setAirQualityEnabled, airQualityInterval,
    setAirQualityInterval, powerMeasurementEnabled, setPowerMeasurementEnabled, powerUpdateInterval,
    setPowerUpdateInterval, powerScreenEnabled, setPowerScreenEnabled, healthMeasurementEnabled,
    setHealthMeasurementEnabled, healthUpdateInterval, setHealthUpdateInterval, healthScreenEnabled,
    setHealthScreenEnabled, configVersion, extNotifEnabled, setExtNotifEnabled, extNotifOutputMs,
    setExtNotifOutputMs, extNotifOutput, setExtNotifOutput, extNotifActive, setExtNotifActive,
    extNotifAlertMessage, setExtNotifAlertMessage, extNotifAlertMessageVibra, setExtNotifAlertMessageVibra,
    extNotifAlertMessageBuzzer, setExtNotifAlertMessageBuzzer, extNotifAlertBell, setExtNotifAlertBell,
    extNotifAlertBellVibra, setExtNotifAlertBellVibra, extNotifAlertBellBuzzer, setExtNotifAlertBellBuzzer,
    extNotifUsePwm, setExtNotifUsePwm, extNotifNagTimeout, setExtNotifNagTimeout, extNotifUseI2sAsBuzzer,
    setExtNotifUseI2sAsBuzzer, extNotifOutputVibra, setExtNotifOutputVibra, extNotifOutputBuzzer,
    setExtNotifOutputBuzzer, storeForwardEnabled, setStoreForwardEnabled, storeForwardHeartbeat,
    setStoreForwardHeartbeat, storeForwardRecords, setStoreForwardRecords, storeForwardHistoryReturnMax,
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
    supportedModules, serialEnabled, setSerialEnabled, serialEcho, setSerialEcho, serialRxd, setSerialRxd,
    serialTxd, setSerialTxd, serialBaud, setSerialBaud, serialTimeout, setSerialTimeout, serialMode,
    setSerialMode, serialOverrideConsoleSerialPort, setSerialOverrideConsoleSerialPort, ambientLedState,
    setAmbientLedState, ambientCurrent, setAmbientCurrent, ambientRed, setAmbientRed, ambientGreen,
    setAmbientGreen, ambientBlue, setAmbientBlue, securityPublicKey, securityPrivateKey,
    setSecurityPrivateKey, securityAdminKeys, setSecurityAdminKeys, securityIsManaged, setSecurityIsManaged,
    securitySerialEnabled, setSecuritySerialEnabled, securityDebugLogApiEnabled,
    setSecurityDebugLogApiEnabled, securityAdminChannelEnabled, setSecurityAdminChannelEnabled,
    securityLoadedSignaturePolicy, securitySignaturePolicy, setSecuritySignaturePolicy, isSaving,
    statusMessage, isReloading, configChanges, showChanges, setShowChanges,
  } = deviceConfigState;

  // UI State
  // Which danger-zone action is waiting on its confirm dialog (#5830).
  const [confirmAction, setConfirmAction] = useState<'reboot' | 'purge' | null>(null);

  // Import/Export Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Separate effect to load position data when nodes become available
  // This runs independently of config loading to avoid re-fetching config
  useEffect(() => {
    const loadPositionFromNodes = async () => {
      if (!nodes || nodes.length === 0) return;

      // Only load position if we haven't already loaded it
      if (fixedLatitude !== 0 || fixedLongitude !== 0) return;

      try {
        const config = await apiService.getCurrentConfig(sourceId);
        if (config.localNodeInfo?.nodeNum) {
          const localNode = nodes.find((n: any) => n.nodeNum === config.localNodeInfo.nodeNum);
          logger.debug('🔍 Loading position from nodes:', config.localNodeInfo.nodeNum, 'found:', !!localNode);
          if (localNode?.position) {
            if (localNode.position.latitude !== undefined) {
              setFixedLatitude(localNode.position.latitude);
            }
            if (localNode.position.longitude !== undefined) {
              setFixedLongitude(localNode.position.longitude);
            }
            if (localNode.position.altitude !== undefined) {
              setFixedAltitude(localNode.position.altitude);
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load position from nodes:', error);
      }
    };

    void loadPositionFromNodes();
  }, [nodes]); // Run when nodes first populate

  const {
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
    reboot,
    purgeNodeDb,
    reload: handleReloadConfig,
  } = useDeviceConfigSaves(deviceConfigState, {
    onRebootExpected: expectation => onConfigChangeTriggeringReboot?.(expectation),
    onRebootDevice,
  });

  // Reboot and purge each confirm in an in-app dialog (#5830); the handlers
  // below run only from that dialog's Confirm.
  const handleRebootDevice = () => {
    setConfirmAction(null);
    return reboot();
  };

  const handlePurgeNodeDb = () => {
    setConfirmAction(null);
    return purgeNodeDb();
  };

  /*
   * ONE return, so the firmware section keeps its place in the tree while the
   * config (re)loads. `isLoading` goes true again on every `refreshTrigger`,
   * and an OTA update reboots the node, which bumps it. With an early return
   * for the loading state the section would unmount mid-update and its wizard
   * (Cancel, Dismiss) would blink out. The loading text swaps only the config
   * body; the picker, the GPIO summary and the modals wait for the config.
   */
  return (
    <div className="tab-content">
      {/* Picker + form share one flex row on a landscape phone (#5069): the
          picker becomes a left rail so the form keeps the full usable height. */}
      <div className={sectionNavLayout.shell}>
      {!isLoading && (
      <SectionNav
        searchable
        searchPlaceholder={t('config_search.filter_configuration', 'Search configuration...')}
        searchLabel={t('config_search.filter_configuration', 'Search configuration...')}
        noMatchesLabel={t('config_search.no_sections', 'No matching sections')}
        items={configurationNavItems(t, { showFirmware })}
      />
      )}

      {/* Two-column layout: main content on left, GPIO summary on right */}
      <div className={sectionNavLayout.body} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Main content column */}
        <div style={{ flex: 1, minWidth: 0 }}>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>{t('config.loading')}</p>
        </div>
      ) : (
      <>
      {/* Reload, import and export (#5830). Nothing here restarts or erases
          the node, so it stays at the top; reboot and purge moved to the
          danger zone at the end of the page. */}
      <div className={styles.topSection}>
      <ConfigSection
        id="config-import-export"
        title={t('config.import_export_title')}
        description={t('config.import_export_description')}
        headerActions={
          <button
            type="button"
            className={styles.reloadButton}
            onClick={handleReloadConfig}
            disabled={isReloading}
          >
            {isReloading ? (
              <>
                <span className={styles.spin}><UiIcon name="refresh" /></span>
                {' '}{t('config.reloading')}
              </>
            ) : (
              <><UiIcon name="refresh" /> {t('config.reload_config')}</>
            )}
          </button>
        }
        notice={
          <p className={styles.pageWarning} role="note">
            <UiIcon name="alert" /> <span>{t('config.warning_text')}</span>
          </p>
        }
      >
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsImportModalOpen(true)}
            disabled={!canWrite}
            style={{
              backgroundColor: 'var(--color-accent)',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '4px',
              cursor: canWrite ? 'pointer' : 'not-allowed',
              opacity: canWrite ? 1 : 0.6,
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            <UiIcon name="import" /> {t('config.import_config')}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            style={{
              backgroundColor: 'var(--color-success)',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            <UiIcon name="upload" /> {t('config.export_config')}
          </button>
        </div>
        {/* Config Changes Display */}
        {configChanges.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setShowChanges(!showChanges)}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-surface-active)',
                color: 'var(--color-text)',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span><UiIcon name={showChanges ? 'chevronDown' : 'forward'} /></span>
              {t('config.changes_detected', { count: configChanges.length })}
            </button>
            {showChanges && (
              <div style={{
                marginTop: '0.5rem',
                padding: '1rem',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '4px',
                border: '1px solid var(--color-surface-active)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-active)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text-subtle)' }}>{t('config.field')}</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text-subtle)' }}>{t('config.old_value')}</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text-subtle)' }}>{t('config.new_value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configChanges.map((change, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                        <td style={{ padding: '0.5rem' }}>{change.field}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--color-error)' }}>{change.oldValue}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--color-success)' }}>{change.newValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ConfigSection>
      </div>

      {statusMessage && (
        <div
          className={statusMessage.startsWith('Error') ? 'error-message' : 'success-message'}
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            backgroundColor: statusMessage.startsWith('Error') ? '#ffebee' : '#e8f5e9',
            color: statusMessage.startsWith('Error') ? '#c62828' : '#2e7d32',
            border: `1px solid ${statusMessage.startsWith('Error') ? '#ef5350' : '#66bb6a'}`
          }}
        >
          {statusMessage}
        </div>
      )}

      <div className={`settings-content ${styles.sectionStack}`}>
        <div id="config-node-identity">
          <NodeIdentitySection
            canWrite={canWrite}
            configVersion={configVersion}
            longName={longName}
            shortName={shortName}
            isUnmessagable={isUnmessagable}
            isLicensed={isLicensed}
            setLongName={setLongName}
            setShortName={setShortName}
            setIsUnmessagable={setIsUnmessagable}
            setIsLicensed={setIsLicensed}
            isSaving={isSaving}
            onSave={handleSaveNodeOwner}
          />
        </div>

        <div id="config-device">
          <DeviceConfigSection
            canWrite={canWrite}
            configVersion={configVersion}
            role={role}
            setRole={setRole}
            nodeInfoBroadcastSecs={nodeInfoBroadcastSecs}
            setNodeInfoBroadcastSecs={setNodeInfoBroadcastSecs}
            tzdef={tzdef}
            setTzdef={setTzdef}
            rebroadcastMode={rebroadcastMode}
            setRebroadcastMode={setRebroadcastMode}
            doubleTapAsButtonPress={doubleTapAsButtonPress}
            setDoubleTapAsButtonPress={setDoubleTapAsButtonPress}
            disableTripleClick={disableTripleClick}
            setDisableTripleClick={setDisableTripleClick}
            ledHeartbeatDisabled={ledHeartbeatDisabled}
            setLedHeartbeatDisabled={setLedHeartbeatDisabled}
            buzzerMode={buzzerMode}
            setBuzzerMode={setBuzzerMode}
            buttonGpio={buttonGpio}
            setButtonGpio={setButtonGpio}
            buzzerGpio={buzzerGpio}
            setBuzzerGpio={setBuzzerGpio}
            isSaving={isSaving}
            onSave={handleSaveDeviceConfig}
          />
        </div>

        <div id="config-lora">
          <LoRaConfigSection
            canWrite={canWrite}
            configVersion={configVersion}
            usePreset={usePreset}
            setUsePreset={setUsePreset}
            modemPreset={modemPreset}
            setModemPreset={setModemPreset}
            unknownModemPresetName={unknownModemPresetName}
            firmwareVersion={localFirmwareVersion}
            bandwidth={bandwidth}
            setBandwidth={setBandwidth}
            spreadFactor={spreadFactor}
            setSpreadFactor={setSpreadFactor}
            codingRate={codingRate}
            setCodingRate={setCodingRate}
            frequencyOffset={frequencyOffset}
            setFrequencyOffset={setFrequencyOffset}
            overrideFrequency={overrideFrequency}
            setOverrideFrequency={setOverrideFrequency}
            region={region}
            setRegion={setRegion}
            hopLimit={hopLimit}
            setHopLimit={setHopLimit}
            txPower={txPower}
            setTxPower={setTxPower}
            channelNum={channelNum}
            setChannelNum={setChannelNum}
            femLnaMode={femLnaMode}
            setFemLnaMode={setFemLnaMode}
            sx126xRxBoostedGain={sx126xRxBoostedGain}
            setSx126xRxBoostedGain={setSx126xRxBoostedGain}
            ignoreMqtt={ignoreMqtt}
            setIgnoreMqtt={setIgnoreMqtt}
            configOkToMqtt={configOkToMqtt}
            setConfigOkToMqtt={setConfigOkToMqtt}
            txEnabled={txEnabled}
            setTxEnabled={setTxEnabled}
            overrideDutyCycle={overrideDutyCycle}
            setOverrideDutyCycle={setOverrideDutyCycle}
            paFanDisabled={paFanDisabled}
            setPaFanDisabled={setPaFanDisabled}
            isSaving={isSaving}
            onSave={handleSaveLoRaConfig}
          />
        </div>

        <div id="config-position">
          <PositionConfigSection
            canWrite={canWrite}
            configVersion={configVersion}
            positionBroadcastSecs={positionBroadcastSecs}
            setPositionBroadcastSecs={setPositionBroadcastSecs}
            positionSmartEnabled={positionSmartEnabled}
            setPositionSmartEnabled={setPositionSmartEnabled}
            fixedPosition={fixedPosition}
            setFixedPosition={setFixedPosition}
            fixedLatitude={fixedLatitude}
            setFixedLatitude={setFixedLatitude}
            fixedLongitude={fixedLongitude}
            setFixedLongitude={setFixedLongitude}
            fixedAltitude={fixedAltitude}
            setFixedAltitude={setFixedAltitude}
            gpsUpdateInterval={gpsUpdateInterval}
            setGpsUpdateInterval={setGpsUpdateInterval}
            gpsMode={gpsMode}
            setGpsMode={setGpsMode}
            broadcastSmartMinimumDistance={broadcastSmartMinimumDistance}
            setBroadcastSmartMinimumDistance={setBroadcastSmartMinimumDistance}
            broadcastSmartMinimumIntervalSecs={broadcastSmartMinimumIntervalSecs}
            setBroadcastSmartMinimumIntervalSecs={setBroadcastSmartMinimumIntervalSecs}
            positionFlags={positionFlags}
            setPositionFlags={setPositionFlags}
            rxGpio={rxGpio}
            setRxGpio={setRxGpio}
            txGpio={txGpio}
            setTxGpio={setTxGpio}
            gpsEnGpio={gpsEnGpio}
            setGpsEnGpio={setGpsEnGpio}
            isSaving={isSaving}
            onSave={handleSavePositionConfig}
          />
        </div>

        <div id="config-power">
          <PowerConfigSection
            canWrite={canWrite}
            configVersion={configVersion}
            isPowerSaving={isPowerSaving}
            setIsPowerSaving={setIsPowerSaving}
            onBatteryShutdownAfterSecs={onBatteryShutdownAfterSecs}
            setOnBatteryShutdownAfterSecs={setOnBatteryShutdownAfterSecs}
            adcMultiplierOverride={adcMultiplierOverride}
            setAdcMultiplierOverride={setAdcMultiplierOverride}
            waitBluetoothSecs={waitBluetoothSecs}
            setWaitBluetoothSecs={setWaitBluetoothSecs}
            sdsSecs={sdsSecs}
            setSdsSecs={setSdsSecs}
            lsSecs={lsSecs}
            setLsSecs={setLsSecs}
            minWakeSecs={minWakeSecs}
            setMinWakeSecs={setMinWakeSecs}
            deviceBatteryInaAddress={deviceBatteryInaAddress}
            setDeviceBatteryInaAddress={setDeviceBatteryInaAddress}
            isSaving={isSaving}
            onSave={handleSavePowerConfig}
          />
        </div>

        <div id="config-display">
          <DisplayConfigSection
            canWrite={canWrite}
            configVersion={configVersion}
            screenOnSecs={screenOnSecs}
            setScreenOnSecs={setScreenOnSecs}
            autoScreenCarouselSecs={autoScreenCarouselSecs}
            setAutoScreenCarouselSecs={setAutoScreenCarouselSecs}
            flipScreen={flipScreen}
            setFlipScreen={setFlipScreen}
            units={displayUnits}
            setUnits={setDisplayUnits}
            oled={oled}
            setOled={setOled}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            headingBold={headingBold}
            setHeadingBold={setHeadingBold}
            wakeOnTapOrMotion={wakeOnTapOrMotion}
            setWakeOnTapOrMotion={setWakeOnTapOrMotion}
            compassOrientation={compassOrientation}
            setCompassOrientation={setCompassOrientation}
            isSaving={isSaving}
            onSave={handleSaveDisplayConfig}
          />
        </div>

        <div id="config-telemetry">
          <ModuleAvailabilityGate available={supportedModules?.telemetry} moduleName="Telemetry">
            <TelemetryConfigSection
              canWrite={canWrite}
              configVersion={configVersion}
              deviceUpdateInterval={deviceUpdateInterval}
              setDeviceUpdateInterval={setDeviceUpdateInterval}
              deviceTelemetryEnabled={deviceTelemetryEnabled}
              setDeviceTelemetryEnabled={setDeviceTelemetryEnabled}
              environmentUpdateInterval={environmentUpdateInterval}
              setEnvironmentUpdateInterval={setEnvironmentUpdateInterval}
              environmentMeasurementEnabled={environmentMeasurementEnabled}
              setEnvironmentMeasurementEnabled={setEnvironmentMeasurementEnabled}
              environmentScreenEnabled={environmentScreenEnabled}
              setEnvironmentScreenEnabled={setEnvironmentScreenEnabled}
              environmentDisplayFahrenheit={environmentDisplayFahrenheit}
              setEnvironmentDisplayFahrenheit={setEnvironmentDisplayFahrenheit}
              airQualityEnabled={airQualityEnabled}
              setAirQualityEnabled={setAirQualityEnabled}
              airQualityInterval={airQualityInterval}
              setAirQualityInterval={setAirQualityInterval}
              powerMeasurementEnabled={powerMeasurementEnabled}
              setPowerMeasurementEnabled={setPowerMeasurementEnabled}
              powerUpdateInterval={powerUpdateInterval}
              setPowerUpdateInterval={setPowerUpdateInterval}
              powerScreenEnabled={powerScreenEnabled}
              setPowerScreenEnabled={setPowerScreenEnabled}
              healthMeasurementEnabled={healthMeasurementEnabled}
              setHealthMeasurementEnabled={setHealthMeasurementEnabled}
              healthUpdateInterval={healthUpdateInterval}
              setHealthUpdateInterval={setHealthUpdateInterval}
              healthScreenEnabled={healthScreenEnabled}
              setHealthScreenEnabled={setHealthScreenEnabled}
              isSaving={isSaving}
              onSave={handleSaveTelemetryConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-mqtt">
          <ModuleAvailabilityGate available={supportedModules?.mqtt} moduleName="MQTT">
            <MQTTConfigSection
              configVersion={configVersion}
              loraRegion={region}
              mqttEnabled={mqttEnabled}
              setMqttEnabled={setMqttEnabled}
              mqttAddress={mqttAddress}
              setMqttAddress={setMqttAddress}
              mqttUsername={mqttUsername}
              setMqttUsername={setMqttUsername}
              mqttPassword={mqttPassword}
              setMqttPassword={setMqttPassword}
              mqttEncryptionEnabled={mqttEncryptionEnabled}
              setMqttEncryptionEnabled={setMqttEncryptionEnabled}
              mqttJsonEnabled={mqttJsonEnabled}
              setMqttJsonEnabled={setMqttJsonEnabled}
              mqttRoot={mqttRoot}
              setMqttRoot={setMqttRoot}
              tlsEnabled={mqttTlsEnabled}
              setTlsEnabled={setMqttTlsEnabled}
              proxyToClientEnabled={mqttProxyToClientEnabled}
              setProxyToClientEnabled={setMqttProxyToClientEnabled}
              mapReportingEnabled={mqttMapReportingEnabled}
              setMapReportingEnabled={setMqttMapReportingEnabled}
              mapPublishIntervalSecs={mqttMapPublishIntervalSecs}
              setMapPublishIntervalSecs={setMqttMapPublishIntervalSecs}
              mapPositionPrecision={mqttMapPositionPrecision}
              setMapPositionPrecision={setMqttMapPositionPrecision}
              mapShouldReportLocation={mqttMapShouldReportLocation}
              setMapShouldReportLocation={setMqttMapShouldReportLocation}
              isBridged={isBridged}
              proxyClientAttached={mqttProxyClientAttached}
              isSaving={isSaving}
              onSave={handleSaveMQTTConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-neighbor">
          <ModuleAvailabilityGate available={supportedModules?.neighborinfo} moduleName="Neighbor Info">
            <NeighborInfoSection
              canWrite={canWrite}
              configVersion={configVersion}
              neighborInfoEnabled={neighborInfoEnabled}
              setNeighborInfoEnabled={setNeighborInfoEnabled}
              neighborInfoInterval={neighborInfoInterval}
              setNeighborInfoInterval={setNeighborInfoInterval}
              neighborInfoTransmitOverLora={neighborInfoTransmitOverLora}
              setNeighborInfoTransmitOverLora={setNeighborInfoTransmitOverLora}
              isSaving={isSaving}
              onSave={handleSaveNeighborInfoConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-network">
          <ModuleAvailabilityGate available={supportedModules?.network} moduleName="Network">
            <NetworkConfigSection
              canWrite={canWrite}
              configVersion={configVersion}
              wifiEnabled={wifiEnabled}
              setWifiEnabled={setWifiEnabled}
              wifiSsid={wifiSsid}
              setWifiSsid={setWifiSsid}
              wifiPsk={wifiPsk}
              setWifiPsk={setWifiPsk}
              ntpServer={ntpServer}
              setNtpServer={setNtpServer}
              rsyslogServer={rsyslogServer}
              setRsyslogServer={setRsyslogServer}
              addressMode={addressMode}
              setAddressMode={setAddressMode}
              enabledProtocols={enabledProtocols}
              setEnabledProtocols={setEnabledProtocols}
              ipv4Address={ipv4Address}
              setIpv4Address={setIpv4Address}
              ipv4Gateway={ipv4Gateway}
              setIpv4Gateway={setIpv4Gateway}
              ipv4Subnet={ipv4Subnet}
              setIpv4Subnet={setIpv4Subnet}
              ipv4Dns={ipv4Dns}
              setIpv4Dns={setIpv4Dns}
              isBridged={isBridged}
              isSaving={isSaving}
              onSave={handleSaveNetworkConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-extnotif">
          <ModuleAvailabilityGate available={supportedModules?.extnotif} moduleName="External Notification">
            <ExternalNotificationConfigSection
              canWrite={canWrite}
              enabled={extNotifEnabled}
              setEnabled={setExtNotifEnabled}
              outputMs={extNotifOutputMs}
              setOutputMs={setExtNotifOutputMs}
              output={extNotifOutput}
              setOutput={setExtNotifOutput}
              active={extNotifActive}
              setActive={setExtNotifActive}
              alertMessage={extNotifAlertMessage}
              setAlertMessage={setExtNotifAlertMessage}
              alertMessageVibra={extNotifAlertMessageVibra}
              setAlertMessageVibra={setExtNotifAlertMessageVibra}
              alertMessageBuzzer={extNotifAlertMessageBuzzer}
              setAlertMessageBuzzer={setExtNotifAlertMessageBuzzer}
              alertBell={extNotifAlertBell}
              setAlertBell={setExtNotifAlertBell}
              alertBellVibra={extNotifAlertBellVibra}
              setAlertBellVibra={setExtNotifAlertBellVibra}
              alertBellBuzzer={extNotifAlertBellBuzzer}
              setAlertBellBuzzer={setExtNotifAlertBellBuzzer}
              usePwm={extNotifUsePwm}
              setUsePwm={setExtNotifUsePwm}
              nagTimeout={extNotifNagTimeout}
              setNagTimeout={setExtNotifNagTimeout}
              useI2sAsBuzzer={extNotifUseI2sAsBuzzer}
              setUseI2sAsBuzzer={setExtNotifUseI2sAsBuzzer}
              outputVibra={extNotifOutputVibra}
              setOutputVibra={setExtNotifOutputVibra}
              outputBuzzer={extNotifOutputBuzzer}
              setOutputBuzzer={setExtNotifOutputBuzzer}
              isSaving={isSaving}
              onSave={handleSaveExternalNotificationConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-storeforward">
          <ModuleAvailabilityGate available={supportedModules?.storeforward} moduleName="Store & Forward">
            <StoreForwardConfigSection
              canWrite={canWrite}
              enabled={storeForwardEnabled}
              setEnabled={setStoreForwardEnabled}
              heartbeat={storeForwardHeartbeat}
              setHeartbeat={setStoreForwardHeartbeat}
              records={storeForwardRecords}
              setRecords={setStoreForwardRecords}
              historyReturnMax={storeForwardHistoryReturnMax}
              setHistoryReturnMax={setStoreForwardHistoryReturnMax}
              historyReturnWindow={storeForwardHistoryReturnWindow}
              setHistoryReturnWindow={setStoreForwardHistoryReturnWindow}
              isServer={storeForwardIsServer}
              setIsServer={setStoreForwardIsServer}
              isSaving={isSaving}
              onSave={handleSaveStoreForwardConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-rangetest">
          <ModuleAvailabilityGate available={supportedModules?.rangetest} moduleName="Range Test">
          <RangeTestConfigSection
            canWrite={canWrite}
            enabled={rangeTestEnabled}
            setEnabled={setRangeTestEnabled}
            sender={rangeTestSender}
            setSender={setRangeTestSender}
            save={rangeTestSave}
            setSave={setRangeTestSave}
            // Range Test was removed in firmware 2.8 (#5031). Unlike the
            // "requires firmware X" gates above, this one must fail OPEN: only
            // a node that positively reports 2.8+ disables the section, so an
            // unknown/absent firmware version keeps the previous behaviour.
            isDisabled={supportedModules?.rangeTest === false}
            isSaving={isSaving}
            onSave={handleSaveRangeTestConfig}
          />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-cannedmsg">
          <ModuleAvailabilityGate available={supportedModules?.cannedmsg} moduleName="Canned Messages">
            <CannedMessageConfigSection
              canWrite={canWrite}
              enabled={cannedMsgEnabled}
              setEnabled={setCannedMsgEnabled}
              rotary1Enabled={cannedMsgRotary1Enabled}
              setRotary1Enabled={setCannedMsgRotary1Enabled}
              inputbrokerPinA={cannedMsgInputbrokerPinA}
              setInputbrokerPinA={setCannedMsgInputbrokerPinA}
              inputbrokerPinB={cannedMsgInputbrokerPinB}
              setInputbrokerPinB={setCannedMsgInputbrokerPinB}
              inputbrokerPinPress={cannedMsgInputbrokerPinPress}
              setInputbrokerPinPress={setCannedMsgInputbrokerPinPress}
              inputbrokerEventCw={cannedMsgInputbrokerEventCw}
              setInputbrokerEventCw={setCannedMsgInputbrokerEventCw}
              inputbrokerEventCcw={cannedMsgInputbrokerEventCcw}
              setInputbrokerEventCcw={setCannedMsgInputbrokerEventCcw}
              inputbrokerEventPress={cannedMsgInputbrokerEventPress}
              setInputbrokerEventPress={setCannedMsgInputbrokerEventPress}
              updown1Enabled={cannedMsgUpdown1Enabled}
              setUpdown1Enabled={setCannedMsgUpdown1Enabled}
              sendBell={cannedMsgSendBell}
              setSendBell={setCannedMsgSendBell}
              allowInputSource={cannedMsgAllowInputSource}
              setAllowInputSource={setCannedMsgAllowInputSource}
              isSaving={isSaving}
              onSave={handleSaveCannedMessageConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-audio">
          <ModuleAvailabilityGate available={supportedModules?.audio} moduleName="Audio">
            <AudioConfigSection
              canWrite={canWrite}
              codec2Enabled={audioCodec2Enabled}
              setCodec2Enabled={setAudioCodec2Enabled}
              pttPin={audioPttPin}
              setPttPin={setAudioPttPin}
              bitrate={audioBitrate}
              setBitrate={setAudioBitrate}
              i2sWs={audioI2sWs}
              setI2sWs={setAudioI2sWs}
              i2sSd={audioI2sSd}
              setI2sSd={setAudioI2sSd}
              i2sDin={audioI2sDin}
              setI2sDin={setAudioI2sDin}
              i2sSck={audioI2sSck}
              setI2sSck={setAudioI2sSck}
              isSaving={isSaving}
              onSave={handleSaveAudioConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-remotehardware">
          <ModuleAvailabilityGate available={supportedModules?.remotehardware} moduleName="Remote Hardware">
            <RemoteHardwareConfigSection
              canWrite={canWrite}
              enabled={remoteHardwareEnabled}
              setEnabled={setRemoteHardwareEnabled}
              allowUndefinedPinAccess={remoteHardwareAllowUndefinedPinAccess}
              setAllowUndefinedPinAccess={setRemoteHardwareAllowUndefinedPinAccess}
              isSaving={isSaving}
              onSave={handleSaveRemoteHardwareConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-detectionsensor">
          <ModuleAvailabilityGate available={supportedModules?.detectionsensor} moduleName="Detection Sensor">
            <DetectionSensorConfigSection
              canWrite={canWrite}
              enabled={detectionSensorEnabled}
              setEnabled={setDetectionSensorEnabled}
              minimumBroadcastSecs={detectionSensorMinimumBroadcastSecs}
              setMinimumBroadcastSecs={setDetectionSensorMinimumBroadcastSecs}
              stateBroadcastSecs={detectionSensorStateBroadcastSecs}
              setStateBroadcastSecs={setDetectionSensorStateBroadcastSecs}
              sendBell={detectionSensorSendBell}
              setSendBell={setDetectionSensorSendBell}
              name={detectionSensorName}
              setName={setDetectionSensorName}
              monitorPin={detectionSensorMonitorPin}
              setMonitorPin={setDetectionSensorMonitorPin}
              detectionTriggerType={detectionSensorDetectionTriggerType}
              setDetectionTriggerType={setDetectionSensorDetectionTriggerType}
              usePullup={detectionSensorUsePullup}
              setUsePullup={setDetectionSensorUsePullup}
              isSaving={isSaving}
              onSave={handleSaveDetectionSensorConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-paxcounter">
          <ModuleAvailabilityGate available={supportedModules?.paxcounter} moduleName="Paxcounter">
            <PaxcounterConfigSection
              canWrite={canWrite}
              enabled={paxcounterEnabled}
              setEnabled={setPaxcounterEnabled}
              paxcounterUpdateInterval={paxcounterUpdateInterval}
              setPaxcounterUpdateInterval={setPaxcounterUpdateInterval}
              wifiThreshold={paxcounterWifiThreshold}
              setWifiThreshold={setPaxcounterWifiThreshold}
              bleThreshold={paxcounterBleThreshold}
              setBleThreshold={setPaxcounterBleThreshold}
              isSaving={isSaving}
              onSave={handleSavePaxcounterConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-statusmessage">
          <StatusMessageConfigSection
            canWrite={canWrite}
            nodeStatus={statusMessageNodeStatus}
            setNodeStatus={setStatusMessageNodeStatus}
            isDisabled={!supportedModules?.statusmessage}
            isSaving={isSaving}
            onSave={handleSaveStatusMessageConfig}
          />
          <StatusMessageReapplyOption isDisabled={!supportedModules?.statusmessage} />
        </div>

        <div id="config-trafficmanagement">
          <TrafficManagementConfigSection
            canWrite={canWrite}
            positionMinIntervalSecs={trafficManagementPositionMinIntervalSecs}
            setPositionMinIntervalSecs={setTrafficManagementPositionMinIntervalSecs}
            nodeinfoDirectResponseMaxHops={trafficManagementNodeinfoDirectResponseMaxHops}
            setNodeinfoDirectResponseMaxHops={setTrafficManagementNodeinfoDirectResponseMaxHops}
            rateLimitWindowSecs={trafficManagementRateLimitWindowSecs}
            setRateLimitWindowSecs={setTrafficManagementRateLimitWindowSecs}
            rateLimitMaxPackets={trafficManagementRateLimitMaxPackets}
            setRateLimitMaxPackets={setTrafficManagementRateLimitMaxPackets}
            unknownPacketThreshold={trafficManagementUnknownPacketThreshold}
            setUnknownPacketThreshold={setTrafficManagementUnknownPacketThreshold}
            isDisabled={!supportedModules?.trafficManagement}
            isSaving={isSaving}
            onSave={handleSaveTrafficManagementConfig}
          />
        </div>

        <div id="config-meshbeacon">
          <MeshBeaconConfigSection
            canWrite={canWrite}
            listenEnabled={meshBeaconListenEnabled}
            setListenEnabled={setMeshBeaconListenEnabled}
            broadcastEnabled={meshBeaconBroadcastEnabled}
            setBroadcastEnabled={setMeshBeaconBroadcastEnabled}
            legacySplit={meshBeaconLegacySplit}
            setLegacySplit={setMeshBeaconLegacySplit}
            broadcastMessage={meshBeaconBroadcastMessage}
            setBroadcastMessage={setMeshBeaconBroadcastMessage}
            broadcastOfferChannelName={meshBeaconBroadcastOfferChannelName}
            setBroadcastOfferChannelName={setMeshBeaconBroadcastOfferChannelName}
            broadcastOfferChannelPsk={meshBeaconBroadcastOfferChannelPsk}
            setBroadcastOfferChannelPsk={setMeshBeaconBroadcastOfferChannelPsk}
            broadcastOfferRegion={meshBeaconBroadcastOfferRegion}
            setBroadcastOfferRegion={setMeshBeaconBroadcastOfferRegion}
            broadcastOfferPreset={meshBeaconBroadcastOfferPreset}
            setBroadcastOfferPreset={setMeshBeaconBroadcastOfferPreset}
            broadcastIntervalSecs={meshBeaconBroadcastIntervalSecs}
            setBroadcastIntervalSecs={setMeshBeaconBroadcastIntervalSecs}
            broadcastTargets={meshBeaconBroadcastTargets}
            setBroadcastTargets={setMeshBeaconBroadcastTargets}
            channels={channels}
            isDisabled={!supportedModules?.meshBeacon}
            isSaving={isSaving}
            onSave={handleSaveMeshBeaconConfig}
          />
        </div>

        {/* Two gates, two flags: `tak` is false when this firmware BUILD left
            the module out (excluded_modules bit 0x20000); `takConfig` is false
            when the firmware is older than 2.8.0. */}
        <div id="config-tak">
          <ModuleAvailabilityGate available={supportedModules?.tak} moduleName="TAK">
            <TAKConfigSection
              canWrite={canWrite}
              team={takTeam}
              setTeam={setTakTeam}
              role={takRole}
              setRole={setTakRole}
              isDisabled={!supportedModules?.takConfig}
              isSaving={isSaving}
              onSave={handleSaveTAKConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-serial">
          <ModuleAvailabilityGate available={supportedModules?.serial} moduleName="Serial">
            <SerialConfigSection
              canWrite={canWrite}
              enabled={serialEnabled}
              setEnabled={setSerialEnabled}
              echo={serialEcho}
              setEcho={setSerialEcho}
              rxd={serialRxd}
              setRxd={setSerialRxd}
              txd={serialTxd}
              setTxd={setSerialTxd}
              baud={serialBaud}
              setBaud={setSerialBaud}
              timeout={serialTimeout}
              setTimeout={setSerialTimeout}
              mode={serialMode}
              setMode={setSerialMode}
              overrideConsoleSerialPort={serialOverrideConsoleSerialPort}
              setOverrideConsoleSerialPort={setSerialOverrideConsoleSerialPort}
              isSaving={isSaving}
              onSave={handleSaveSerialConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-ambientlighting">
          <ModuleAvailabilityGate available={supportedModules?.ambientlighting} moduleName="Ambient Lighting">
            <AmbientLightingConfigSection
              canWrite={canWrite}
              ledState={ambientLedState}
              setLedState={setAmbientLedState}
              current={ambientCurrent}
              setCurrent={setAmbientCurrent}
              red={ambientRed}
              setRed={setAmbientRed}
              green={ambientGreen}
              setGreen={setAmbientGreen}
              blue={ambientBlue}
              setBlue={setAmbientBlue}
              isSaving={isSaving}
              onSave={handleSaveAmbientLightingConfig}
            />
          </ModuleAvailabilityGate>
        </div>

        <div id="config-security">
          <SecurityConfigSection
            canWrite={canWrite}
            publicKey={securityPublicKey}
            privateKey={securityPrivateKey}
            setPrivateKey={setSecurityPrivateKey}
            adminKeys={securityAdminKeys}
            isManaged={securityIsManaged}
            serialEnabled={securitySerialEnabled}
            debugLogApiEnabled={securityDebugLogApiEnabled}
            adminChannelEnabled={securityAdminChannelEnabled}
            setAdminKeys={setSecurityAdminKeys}
            setIsManaged={setSecurityIsManaged}
            setSerialEnabled={setSecuritySerialEnabled}
            setDebugLogApiEnabled={setSecurityDebugLogApiEnabled}
            setAdminChannelEnabled={setSecurityAdminChannelEnabled}
            packetSignaturePolicy={securitySignaturePolicy}
            setPacketSignaturePolicy={setSecuritySignaturePolicy}
            loadedPacketSignaturePolicy={securityLoadedSignaturePolicy}
            firmwareVersion={localFirmwareVersion}
            nodeShortName={shortName}
            nodeLabel={longName || shortName}
            isSaving={isSaving}
            onSave={handleSaveSecurityConfig}
          />
          {canViewSourceSettings ? (
            sourceId && (
              <MovedSettingNote
                id="config-pki-dm"
                testId="pki-dm-moved"
                text={t('moved.pki_dm', 'PKI direct message decryption moved to Settings.')}
                linkLabel={t('moved.open_source_settings', 'Open Settings')}
                to={`/source/${encodeURIComponent(sourceId)}/settings#settings-pki-dm`}
              />
            )
          ) : (
            <PkiDmDecryptionSection canWrite={canWrite} />
          )}
        </div>

        <div id="config-channels">
          <ChannelsConfigSection
            channels={channels}
            onChannelsUpdated={onChannelsUpdated}
            aeadSupported={supportedModules?.aeadChannels === true}
          />
        </div>

        {/* Backups are held by MeshMonitor, but they are backups OF this
            device's configuration and restore to it, so the list and schedule
            stay on Device Configuration (#5683 follow-up decision). */}
        <div id="config-backup">
          <BackupManagementSection protocol="meshtastic" canWrite={canWrite} />
        </div>
      </div>{/* End settings-content */}
      </>
      )}

      {/* Firmware update (#5683 follow-up). Outside the loading swap above, on
          purpose: see the comment on this return. It keeps every guard it had
          on Settings; only the page changed. */}
      {showFirmware && <FirmwareUpdateSection baseUrl={baseUrl} />}

      {/* Danger zone, last on the page as on MeshCore (#5830). Each action
          confirms in an in-app dialog; purge needs a typed word. Shutdown and
          factory reset stay on Admin Commands, linked below. */}
      {!isLoading && (
        <DangerZone
          id="config-danger"
          canWrite={canWrite}
          description={t('config.danger_zone_description', 'These actions restart the node or erase data. They cannot be undone.')}
          footer={isAdmin && sourceId ? (
            <MovedSettingNote
              testId="danger-admin-commands-link"
              text={t('config.danger_zone_admin_note', 'Shutdown, DFU mode and factory reset are on Admin Commands.')}
              linkLabel={t('config.danger_zone_admin_link', 'Open Admin Commands')}
              to={buildAdminCommandsPath(sourceId)}
            />
          ) : undefined}
        >
          <DangerZoneActions>
            <DangerZoneButton
              onClick={() => setConfirmAction('reboot')}
              disabled={isSaving || !canWrite}
              data-testid="config-reboot-button"
            >
              <UiIcon name="refresh" /> {t('config.reboot_device')}
            </DangerZoneButton>
            <DangerZoneButton
              onClick={() => setConfirmAction('purge')}
              disabled={isSaving || !canWrite}
              data-testid="config-purge-button"
            >
              <UiIcon name="delete" /> {t('config.purge_node_db')}
            </DangerZoneButton>
          </DangerZoneActions>
        </DangerZone>
      )}

        </div>{/* End main content column */}

        {/* GPIO Pin Summary sidebar - only show on larger screens */}
        {!isLoading && (
        <div className="gpio-summary-sidebar" style={{
          width: '280px',
          flexShrink: 0,
          alignSelf: 'flex-start',
          position: 'sticky',
          /*
           * Park below BOTH sticky things above it, not under them (#5100).
           *
           * `.app-header` is `position: fixed` and `.section-nav` is itself
           * sticky at `top: var(--app-header-height)` with `z-index: 10`, so
           * together they own the band from 0 to header+nav. A bare `top: 1rem`
           * parked this panel at 16px — inside that band — and the chip rows
           * drew straight over its heading. Measured at 1500x800: bar 0-60px,
           * nav 60-192px, panel stuck at 76px. Same trap the config rail hit in
           * #5070; see the banner on `--app-header-height` in App.css.
           *
           * The nav's height is published by `useSectionNavHeightVar` because
           * it wraps: 29 chips are three rows here and fewer as the window
           * widens. The `0px` fallback keeps the offset sane before the first
           * measurement lands.
           */
          top: 'calc(var(--app-header-height) + var(--section-nav-height, 0px) + 1rem)',
          /*
           * The same question asked downward. With no cap, a panel taller than
           * the space left below those two cannot fit in the viewport at all,
           * so scrolling drags its bottom half off the screen with no way to
           * reach it — the reported bug. Cap it and let it scroll its own
           * content.
           */
          maxHeight: 'calc(100dvh - var(--app-header-height) - var(--section-nav-height, 0px) - 2rem)',
          overflowY: 'auto',
          display: 'none' // Hidden by default, shown via media query
        }}>
          <GpioPinSummary
            buttonGpio={buttonGpio}
            buzzerGpio={buzzerGpio}
            rxGpio={rxGpio}
            txGpio={txGpio}
            gpsEnGpio={gpsEnGpio}
            extNotifOutput={extNotifOutput}
            extNotifOutputVibra={extNotifOutputVibra}
            extNotifOutputBuzzer={extNotifOutputBuzzer}
            cannedMsgInputbrokerPinA={cannedMsgInputbrokerPinA}
            cannedMsgInputbrokerPinB={cannedMsgInputbrokerPinB}
            cannedMsgInputbrokerPinPress={cannedMsgInputbrokerPinPress}
            audioPttPin={audioPttPin}
            audioI2sWs={audioI2sWs}
            audioI2sSd={audioI2sSd}
            audioI2sDin={audioI2sDin}
            audioI2sSck={audioI2sSck}
            detectionSensorMonitorPin={detectionSensorMonitorPin}
            serialRxd={serialRxd}
            serialTxd={serialTxd}
          />
        </div>
        )}
      </div>{/* End two-column layout */}
      </div>{/* End landscape rail shell */}

      {confirmAction === 'reboot' && (
        <ConfirmDialog
          title={t('config.reboot_dialog_title', 'Reboot the device?')}
          message={t('config.reboot_dialog_message', 'The device restarts and is offline for about 30 to 60 seconds.')}
          confirmLabel={t('config.reboot_device')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => { void handleRebootDevice(); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      <TypedConfirmDialog
        isOpen={confirmAction === 'purge'}
        title={t('config.purge_dialog_title', 'Purge the node database?')}
        confirmWord="PURGE"
        confirmLabel={t('config.purge_node_db')}
        danger
        busy={isSaving}
        onConfirm={() => { void handlePurgeNodeDb(); }}
        onCancel={() => setConfirmAction(null)}
      >
        <p>{t('config.purge_dialog_body', 'This deletes every stored node from the device and from MeshMonitor\'s database for this source. It cannot be undone. The device rebuilds its list as it hears nodes on the mesh.')}</p>
      </TypedConfirmDialog>

      {/* Import/Export Modals */}
      {!isLoading && (
      <>
      <ImportConfigModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          showToast(t('config.import_success'), 'success');
          if (onChannelsUpdated) onChannelsUpdated();
        }}
      />

      <ExportConfigModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        channels={channels}
        deviceConfig={{
          lora: {
            usePreset,
            modemPreset,
            region,
            hopLimit
          }
        }}
      />
      </>
      )}
    </div>
  );
};

export default ConfigurationTab;
