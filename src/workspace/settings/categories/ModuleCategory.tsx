/**
 * Modules › <module>: each module's Configuration section on the row kit, one
 * page per module (`modules/<name>`), with today's labels, ranges, conditions
 * and warnings (D9b / D9d). Edits queue as the module's own save section.
 *
 * A module the firmware build leaves out shows today's notice and its rows
 * view only (ModuleAvailabilityGate); a module the firmware is too old for
 * (Range Test on 2.8, Status Message, Traffic Management, MeshBeacon, TAK)
 * does the same with today's words. MQTT keeps today's section (Ruling 5.6).
 */
import { useEffect, type ReactNode } from 'react';
import { useEnclosingNumberInputScope } from '../../../components/common/numberInputScopeContext';
import {
  AUDIO_BAUD_OPTIONS,
  INPUT_EVENT_OPTIONS,
  MODEM_PRESET_OPTIONS,
  REGION_OPTIONS,
  SERIAL_BAUD_OPTIONS,
  SERIAL_MODE_OPTIONS,
  TRIGGER_TYPE_OPTIONS,
} from '../../../components/configuration/constants';
import BroadcastTargetsEditor from '../../../components/configuration/BroadcastTargetsEditor';
import TrafficManagementReplayPanel from '../../../components/configuration/TrafficManagementReplayPanel';
import { useStatusMessageReapply } from '../../../components/configuration/useStatusMessageReapply';
import { MESH_BEACON_MESSAGE_MAX_BYTES, MESH_BEACON_MIN_INTERVAL_SECS } from '../../../components/admin-commands/useAdminCommandsState';
import { usePoll } from '../../../hooks/usePoll';
import type { ConfigSaveSection } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import { NODE_STATUS_MAX_BYTES, truncateToUtf8Bytes, utf8ByteLength } from '../../../utils/statusMessage';
import { TAK_ROLE_OPTIONS, TAK_TEAM_OPTIONS } from '../../../utils/takConfig';
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingSelect from '../kit/SettingSelect';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly, useSettingsCategory } from '../kit/useFieldRegistry';
import type { CategoryProps } from '../categories';
import { meshBeaconTooLong } from '../moduleChecks';
import { labelled, named, useDuration, useRows, type Rows } from './rows';
import { Locked, Warn } from './RowParts';
import { useWas } from './useWas';
import styles from './SettingsPages.module.css';

const MAX = 4294967295;

type Supported = NonNullable<Rows['s']['supportedModules']>;

/** Today's gate: false only when the build left the module out (ModuleAvailabilityGate, #5065). */
const excluded = (s: Rows['s'], flag: keyof Supported) => s.supportedModules?.[flag] === false;

function Gate({ r, flag, name, children }: { r: Rows; flag: keyof Supported; name: string; children: ReactNode }) {
  return (
    <Locked locked={excluded(r.s, flag)} notice={r.t('module_availability.excluded', { module: name })}>
      {children}
    </Locked>
  );
}

/** A sub-heading inside a card, as today's sections head their groups. */
const Sub = ({ children }: { children: ReactNode }) => <h3 className={styles.cardSub}>{children}</h3>;

function Telemetry({ r }: { r: Rows }) {
  const duration = useDuration();
  const { s, t } = r;
  const interval = (key: 'deviceUpdateInterval' | 'environmentUpdateInterval' | 'airQualityInterval' | 'powerUpdateInterval' | 'healthUpdateInterval', label: string) =>
    r.number(key, label, { min: 0, max: MAX, help: t(`${label}_description`) + duration(s[key]) });
  const advanced = [
    <Sub key="aq">{t('telemetry_config.air_quality_section')}</Sub>,
    r.toggle('airQualityEnabled', 'telemetry_config.air_quality_enabled'),
    interval('airQualityInterval', 'telemetry_config.air_quality_interval'),
    <Sub key="power">{t('telemetry_config.power_section')}</Sub>,
    r.toggle('powerMeasurementEnabled', 'telemetry_config.power_enabled'),
    interval('powerUpdateInterval', 'telemetry_config.power_interval'),
    r.toggle('powerScreenEnabled', 'telemetry_config.power_screen'),
    <Sub key="health">{t('telemetry_config.health_section')}</Sub>,
    r.toggle('healthMeasurementEnabled', 'telemetry_config.health_enabled'),
    ...(s.healthMeasurementEnabled
      ? [interval('healthUpdateInterval', 'telemetry_config.health_interval'), r.toggle('healthScreenEnabled', 'telemetry_config.health_screen')]
      : []),
  ];
  return (
    <Gate r={r} flag="telemetry" name="Telemetry">
      <SettingGroup title={t('telemetry_config.device_section')}>
        {r.toggle('deviceTelemetryEnabled', 'telemetry_config.device_enabled')}
        {s.deviceTelemetryEnabled && interval('deviceUpdateInterval', 'telemetry_config.device_interval')}
      </SettingGroup>
      <SettingGroup title={t('telemetry_config.environment_section')}>
        {r.toggle('environmentMeasurementEnabled', 'telemetry_config.environment_enabled')}
        {interval('environmentUpdateInterval', 'telemetry_config.environment_interval')}
        {r.toggle('environmentScreenEnabled', 'telemetry_config.environment_screen')}
        {r.toggle('environmentDisplayFahrenheit', 'telemetry_config.environment_fahrenheit')}
      </SettingGroup>
      <AdvancedCard count={advanced.filter((a) => a.type !== Sub).length}>{advanced}</AdvancedCard>
    </Gate>
  );
}

function NeighborInfo({ r }: { r: Rows }) {
  return (
    <Gate r={r} flag="neighborinfo" name="Neighbor Info">
      <SettingGroup>
        {r.toggle('neighborInfoEnabled', 'neighbor_info.enable')}
        {r.s.neighborInfoEnabled && (
          <>
            {r.number('neighborInfoInterval', 'neighbor_info.interval', { min: 14400, max: 86400 })}
            {r.toggle('neighborInfoTransmitOverLora', 'neighbor_info.transmit_over_lora')}
          </>
        )}
      </SettingGroup>
    </Gate>
  );
}

function ExternalNotification({ r }: { r: Rows }) {
  const { s, t } = r;
  const advanced = [
    r.toggle('extNotifUsePwm', 'extnotif_config.use_pwm'),
    r.toggle('extNotifUseI2sAsBuzzer', 'extnotif_config.use_i2s'),
    r.number('extNotifNagTimeout', 'extnotif_config.nag_timeout', { min: 0, max: 3600 }),
    <Sub key="gpio">{t('extnotif_config.gpio_section')}</Sub>,
    r.number('extNotifOutput', 'extnotif_config.output_gpio', { min: 0, max: 255 }),
    r.number('extNotifOutputVibra', 'extnotif_config.output_vibra_gpio', { min: 0, max: 255 }),
    r.number('extNotifOutputBuzzer', 'extnotif_config.output_buzzer_gpio', { min: 0, max: 255 }),
  ];
  return (
    <Gate r={r} flag="extnotif" name="External Notification">
      <SettingGroup>
        {r.toggle('extNotifEnabled', 'extnotif_config.enabled')}
        {s.extNotifEnabled && (
          <>
            {r.number('extNotifOutputMs', 'extnotif_config.output_ms', { min: 0, max: 60000 })}
            {r.toggle('extNotifActive', 'extnotif_config.active_high')}
          </>
        )}
      </SettingGroup>
      {s.extNotifEnabled && (
        <>
          <SettingGroup title={t('extnotif_config.alert_section')}>
            {r.toggle('extNotifAlertMessage', 'extnotif_config.alert_message')}
            {r.toggle('extNotifAlertMessageVibra', 'extnotif_config.alert_message_vibra')}
            {r.toggle('extNotifAlertMessageBuzzer', 'extnotif_config.alert_message_buzzer')}
            {r.toggle('extNotifAlertBell', 'extnotif_config.alert_bell')}
            {r.toggle('extNotifAlertBellVibra', 'extnotif_config.alert_bell_vibra')}
            {r.toggle('extNotifAlertBellBuzzer', 'extnotif_config.alert_bell_buzzer')}
          </SettingGroup>
          <AdvancedCard count={advanced.length - 1}>{advanced}</AdvancedCard>
        </>
      )}
    </Gate>
  );
}

function StoreForward({ r }: { r: Rows }) {
  return (
    <Gate r={r} flag="storeforward" name="Store & Forward">
      <SettingGroup>
        {r.toggle('storeForwardEnabled', 'storeforward_config.enabled')}
        {r.s.storeForwardEnabled && (
          <>
            {r.toggle('storeForwardIsServer', 'storeforward_config.is_server')}
            {r.toggle('storeForwardHeartbeat', 'storeforward_config.heartbeat')}
            {r.number('storeForwardRecords', 'storeforward_config.records', { min: 0, max: 65535 })}
            {r.number('storeForwardHistoryReturnMax', 'storeforward_config.history_return_max', { min: 0, max: 255 })}
            {r.number('storeForwardHistoryReturnWindow', 'storeforward_config.history_return_window', { min: 0, max: 86400 })}
          </>
        )}
      </SettingGroup>
    </Gate>
  );
}

function RangeTest({ r }: { r: Rows }) {
  const { s, t } = r;
  const gated = excluded(s, 'rangetest');
  // Removed from the firmware in 2.8 (#5031): today's own notice, or a sentence after the gate's.
  const removed = s.supportedModules?.rangeTest === false;
  const detail = t('rangetest_config.removed_in_28_detail', 'It was removed from Meshtastic firmware in 2.8.');
  return (
    <Locked
      locked={gated || removed}
      notice={
        gated
          ? `${t('module_availability.excluded', { module: 'Range Test' })}${removed ? ` ${detail}` : ''}`
          : t('rangetest_config.removed_in_28', 'Range Test was removed in Meshtastic 2.8 and is not available on this firmware. These settings cannot be changed.')
      }
    >
      <SettingGroup>
        {r.toggle('rangeTestEnabled', 'rangetest_config.enabled')}
        {s.rangeTestEnabled && (
          <>
            {r.number('rangeTestSender', 'rangetest_config.sender', { min: 0, max: 65535 })}
            {r.toggle('rangeTestSave', 'rangetest_config.save')}
          </>
        )}
      </SettingGroup>
    </Locked>
  );
}

function CannedMessage({ r }: { r: Rows }) {
  const { s, t } = r;
  const events = named(INPUT_EVENT_OPTIONS);
  const advanced = [
    <Sub key="gpio">{t('cannedmsg_config.gpio_section')}</Sub>,
    r.number('cannedMsgInputbrokerPinA', 'cannedmsg_config.pin_a', { min: 0, max: 255 }),
    r.number('cannedMsgInputbrokerPinB', 'cannedmsg_config.pin_b', { min: 0, max: 255 }),
    r.number('cannedMsgInputbrokerPinPress', 'cannedmsg_config.pin_press', { min: 0, max: 255 }),
    <Sub key="events">{t('cannedmsg_config.events_section')}</Sub>,
    r.select('cannedMsgInputbrokerEventCw', 'cannedmsg_config.event_cw', events),
    r.select('cannedMsgInputbrokerEventCcw', 'cannedmsg_config.event_ccw', events),
    r.select('cannedMsgInputbrokerEventPress', 'cannedmsg_config.event_press', events),
  ];
  return (
    <Gate r={r} flag="cannedmsg" name="Canned Messages">
      <SettingGroup>
        {r.toggle('cannedMsgEnabled', 'cannedmsg_config.enabled')}
        {s.cannedMsgEnabled && (
          <>
            {r.toggle('cannedMsgRotary1Enabled', 'cannedmsg_config.rotary1_enabled')}
            {r.toggle('cannedMsgUpdown1Enabled', 'cannedmsg_config.updown1_enabled')}
            {r.toggle('cannedMsgSendBell', 'cannedmsg_config.send_bell')}
            {r.select('cannedMsgAllowInputSource', 'cannedmsg_config.allow_input_source', events)}
          </>
        )}
      </SettingGroup>
      {s.cannedMsgEnabled && <AdvancedCard count={advanced.length - 2}>{advanced}</AdvancedCard>}
    </Gate>
  );
}

function Audio({ r }: { r: Rows }) {
  const { s, t } = r;
  const pin = (key: 'audioPttPin' | 'audioI2sWs' | 'audioI2sSd' | 'audioI2sDin' | 'audioI2sSck', label: string) => r.number(key, label, { min: 0, max: 255 });
  const advanced = [
    pin('audioPttPin', 'audio_config.ptt_pin'),
    <Sub key="i2s">{t('audio_config.i2s_section')}</Sub>,
    pin('audioI2sWs', 'audio_config.i2s_ws'),
    pin('audioI2sSd', 'audio_config.i2s_sd'),
    pin('audioI2sDin', 'audio_config.i2s_din'),
    pin('audioI2sSck', 'audio_config.i2s_sck'),
  ];
  return (
    <Gate r={r} flag="audio" name="Audio">
      <SettingGroup>
        {r.toggle('audioCodec2Enabled', 'audio_config.codec2_enabled')}
        {s.audioCodec2Enabled && r.select('audioBitrate', 'audio_config.bitrate', named(AUDIO_BAUD_OPTIONS))}
      </SettingGroup>
      {s.audioCodec2Enabled && <AdvancedCard count={advanced.length - 1}>{advanced}</AdvancedCard>}
    </Gate>
  );
}

function RemoteHardware({ r }: { r: Rows }) {
  const { s, t } = r;
  return (
    <Gate r={r} flag="remotehardware" name="Remote Hardware">
      <SettingGroup>
        {r.toggle('remoteHardwareEnabled', 'remotehw_config.enabled')}
        {s.remoteHardwareEnabled &&
          r.toggle('remoteHardwareAllowUndefinedPinAccess', 'remotehw_config.allow_undefined', {
            extra: <Warn>{t('remotehw_config.pins_note')}</Warn>,
          })}
      </SettingGroup>
    </Gate>
  );
}

function DetectionSensor({ r }: { r: Rows }) {
  const { s } = r;
  const advanced = [
    r.number('detectionSensorMinimumBroadcastSecs', 'detectionsensor_config.min_broadcast_secs', { min: 0, max: 86400 }),
    r.number('detectionSensorStateBroadcastSecs', 'detectionsensor_config.state_broadcast_secs', { min: 0, max: 86400 }),
  ];
  return (
    <Gate r={r} flag="detectionsensor" name="Detection Sensor">
      <SettingGroup>
        {r.toggle('detectionSensorEnabled', 'detectionsensor_config.enabled')}
        {s.detectionSensorEnabled && (
          <>
            {r.text('detectionSensorName', 'detectionsensor_config.name', { maxLength: 19 })}
            {r.number('detectionSensorMonitorPin', 'detectionsensor_config.monitor_pin', { min: 0, max: 255 })}
            {r.select('detectionSensorDetectionTriggerType', 'detectionsensor_config.trigger_type', named(TRIGGER_TYPE_OPTIONS))}
            {r.toggle('detectionSensorUsePullup', 'detectionsensor_config.use_pullup')}
            {r.toggle('detectionSensorSendBell', 'detectionsensor_config.send_bell')}
          </>
        )}
      </SettingGroup>
      {s.detectionSensorEnabled && <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>}
    </Gate>
  );
}

function Paxcounter({ r }: { r: Rows }) {
  return (
    <Gate r={r} flag="paxcounter" name="Paxcounter">
      <SettingGroup>
        {r.toggle('paxcounterEnabled', 'paxcounter_config.enabled')}
        {r.s.paxcounterEnabled && (
          <>
            {r.number('paxcounterUpdateInterval', 'paxcounter_config.update_interval', { min: 0, max: 86400 })}
            {r.number('paxcounterWifiThreshold', 'paxcounter_config.wifi_threshold', { min: -127, max: 0 })}
            {r.number('paxcounterBleThreshold', 'paxcounter_config.ble_threshold', { min: -127, max: 0 })}
          </>
        )}
      </SettingGroup>
    </Gate>
  );
}

function StatusMessage({ r, sourceId }: { r: Rows; sourceId: string }) {
  const { s, t } = r;
  const disabled = !s.supportedModules?.statusmessage;
  const reapply = useStatusMessageReapply(sourceId);
  const bytes = utf8ByteLength(s.statusMessageNodeStatus);
  return (
    <>
      <Locked locked={disabled} notice={t('statusmessage_config.unsupported', 'Unsupported by device firmware — Requires firmware 2.7.20 or greater')}>
        <SettingGroup>
          {r.text('statusMessageNodeStatus', ['statusmessage_config.node_status', 'Node Status'], {
            // The firmware limit is in UTF-8 bytes, cut on whole characters (#5616).
            onChange: (v) => s.setStatusMessageNodeStatus(truncateToUtf8Bytes(v)),
            placeholder: t('statusmessage_config.node_status_placeholder', 'Enter status message...'),
            help: (
              <>
                {t('statusmessage_config.node_status_description_bytes', 'A short status message shown for this node. Up to {{max}} bytes: an emoji takes 4 or more.', { max: NODE_STATUS_MAX_BYTES })}
                <span className={styles.block} data-near={bytes >= NODE_STATUS_MAX_BYTES - 10 || undefined} data-testid="status-message-counter">
                  {t('statusmessage_config.byte_counter', '{{used}}/{{max}} bytes', { used: bytes, max: NODE_STATUS_MAX_BYTES })}
                </span>
              </>
            ),
          })}
        </SettingGroup>
      </Locked>
      {/* A MeshMonitor setting for this source, saved on change (#5745), not queued. */}
      <SettingGroup title={t('workspace.settings.in_meshmonitor')}>
        <SettingRow
          id="statusmessage.reapply"
          label={t('statusmessage_config.reapply_label', 'Re-apply after a reboot')}
          help={
            <>
              {t(
                'statusmessage_config.reapply_help',
                'Some firmware loses the Status Message when the node reboots. With this on, MeshMonitor writes the last status it saved once more when the node reconnects with an empty status. A status cleared from another app would be restored too.',
              )}
              {reapply.error && <Warn tone="danger">{t('statusmessage_config.reapply_save_failed', 'Could not save this setting.')}</Warn>}
            </>
          }
        >
          <SettingToggle
            checked={reapply.enabled === true}
            // Today's gate for this switch: the module's support only (StatusMessageReapplyOption).
            readOnly={disabled || reapply.saving || reapply.enabled === null}
            onChange={(v) => void reapply.onChange(v)}
          />
        </SettingRow>
      </SettingGroup>
    </>
  );
}

function TrafficManagement({ r }: { r: Rows }) {
  const { s, t } = r;
  const disabled = !s.supportedModules?.trafficManagement;
  const tm = (key: string, fallback: string) => [`trafficmanagement_config.${key}`, fallback] as const;
  return (
    <>
      <Locked
        locked={disabled}
        notice={t('trafficmanagement_config.unsupported', 'Unsupported by this device — Traffic Management requires Meshtastic firmware 2.8.0 or newer. Saving on 2.7.x firmware would not persist on the device.')}
      >
        <p className={styles.note}>{t('trafficmanagement_config.zero_disables')}</p>
        {/* These settings drop other people's packets: say so beside the controls. */}
        <p className={styles.note} data-testid="tm-drop-warning">
          <Warn>{t('trafficmanagement_config.drop_warning')}</Warn>
        </p>
        <SettingGroup title={t('trafficmanagement_config.position_dedup')}>
          {r.number('trafficManagementPositionMinIntervalSecs', tm('position_min_interval_secs', 'Minimum Interval (seconds)'), { min: 0 })}
        </SettingGroup>
        <SettingGroup title={t('trafficmanagement_config.nodeinfo_direct_response')}>
          {r.number('trafficManagementNodeinfoDirectResponseMaxHops', tm('nodeinfo_max_hops', 'Max Hops'), { min: 0, max: 7 })}
        </SettingGroup>
        <SettingGroup title={t('trafficmanagement_config.rate_limiting')}>
          {r.number('trafficManagementRateLimitWindowSecs', tm('rate_limit_window', 'Window (seconds)'), { min: 0 })}
          {r.number('trafficManagementRateLimitMaxPackets', tm('rate_limit_max_packets', 'Max Packets Per Window'), { min: 0 })}
        </SettingGroup>
        <SettingGroup title={t('trafficmanagement_config.drop_unknown')}>
          {r.number('trafficManagementUnknownPacketThreshold', tm('unknown_packet_threshold', 'Unknown Packet Threshold'), { min: 0 })}
        </SettingGroup>
      </Locked>
      {/* Today's "Estimate impact": one GET when pressed, nothing sent to the node (#5670). */}
      <div className={styles.embedded}>
        <TrafficManagementReplayPanel
          positionMinIntervalSecs={s.trafficManagementPositionMinIntervalSecs}
          rateLimitWindowSecs={s.trafficManagementRateLimitWindowSecs}
          rateLimitMaxPackets={s.trafficManagementRateLimitMaxPackets}
          disabled={disabled}
        />
      </div>
    </>
  );
}

function MeshBeacon({ r }: { r: Rows }) {
  const { s, t } = r;
  const disabled = !s.supportedModules?.meshBeacon;
  const was = useWas('meshbeacon');
  const readOnly = useReadOnly();
  const channels = usePoll().data?.channels;
  const mb = (key: string, fallback: string) => [`meshbeacon_config.${key}`, fallback] as const;
  const bytes = new TextEncoder().encode(s.meshBeaconBroadcastMessage).length;
  const tooLong = meshBeaconTooLong(s);
  // Today's save bar held the save on an over-long message; the queue's Save holds the same way (#5649 scope).
  const scope = useEnclosingNumberInputScope();
  useEffect(() => {
    scope?.report('meshbeacon.message', tooLong);
    return () => scope?.report('meshbeacon.message', false);
  }, [scope, tooLong]);
  return (
    <Locked
      locked={disabled}
      notice={t(
        'meshbeacon_config.unsupported',
        'Unsupported by this device — the MeshBeacon module is not in any released Meshtastic firmware yet (it is only on the development branch for 2.8). Saving here would not persist on the device. It requires firmware 2.8 or newer.',
      )}
    >
      <SettingGroup>
        {r.toggle('meshBeaconListenEnabled', mb('listen_enabled', 'Listen for beacons'), {
          help: t('meshbeacon_config.listen_enabled_description', 'Receive beacons from other nodes. The text goes to the local inbox; any offered channel or preset is cached for you to act on — firmware never applies it automatically.'),
        })}
        {r.toggle('meshBeaconBroadcastEnabled', mb('broadcast_enabled', 'Broadcast beacons'), {
          help: t('meshbeacon_config.broadcast_enabled_description', "Periodically broadcast this node's beacon to the mesh."),
        })}
      </SettingGroup>
      {(s.meshBeaconBroadcastEnabled || disabled) && (
        <>
          <SettingGroup title={t('meshbeacon_config.broadcast_section', 'Broadcast Content')}>
            {r.text('meshBeaconBroadcastMessage', mb('broadcast_message', 'Beacon Message'), {
              placeholder: t('meshbeacon_config.broadcast_message_placeholder', 'e.g. Welcome to the local mesh'),
              help: (
                <>
                  {t('meshbeacon_config.broadcast_message_desc', 'Human-readable text sent with each beacon.')}{' '}
                  {t('meshbeacon_config.broadcast_message_count', '{{used}}/{{max}} bytes used', { used: bytes, max: MESH_BEACON_MESSAGE_MAX_BYTES })}
                  {tooLong && (
                    <Warn tone="danger">
                      {t('meshbeacon_config.broadcast_message_too_long', 'Over the limit. The device rejects the whole MeshBeacon config without reporting an error, so nothing would save.')}
                    </Warn>
                  )}
                </>
              ),
            })}
            {r.toggle('meshBeaconLegacySplit', mb('legacy_split', 'Legacy split'), {
              help: t('meshbeacon_config.legacy_split_desc', 'Send the text and the offer as two packets, so nodes that only decode text messages still see the text. Costs one extra transmission per beacon.'),
            })}
          </SettingGroup>
          <SettingGroup title={t('meshbeacon_config.offer_section', 'Offered Network (optional)')}>
            {r.text('meshBeaconBroadcastOfferChannelName', mb('offer_channel_name', 'Offer Channel Name'), {
              help: t('meshbeacon_config.offer_channel_name_desc', 'Channel advertised to listeners. Leave blank to advertise no channel.'),
            })}
            {s.meshBeaconBroadcastOfferChannelName.trim().length > 0 &&
              r.text('meshBeaconBroadcastOfferChannelPsk', mb('offer_channel_psk', 'Offer Channel PSK'), {
                mono: true,
                placeholder: t('meshbeacon_config.offer_channel_psk_placeholder', 'base64, e.g. AQ=='),
                help: t('meshbeacon_config.offer_channel_psk_desc', 'Base64 pre-shared key for the advertised channel. Anyone receiving the beacon can read this key.'),
              })}
            {r.select('meshBeaconBroadcastOfferRegion', mb('offer_region', 'Offer Region'), labelled(REGION_OPTIONS), {
              help: t('meshbeacon_config.offer_region_desc', 'Region advertised alongside the preset.'),
            })}
            <SettingRow
              id="meshbeacon.meshBeaconBroadcastOfferPreset"
              label={t('meshbeacon_config.offer_preset', 'Offer Modem Preset')}
              help={t('meshbeacon_config.offer_preset_desc', 'Modem preset advertised with the region — tells listeners "there is a mesh on this preset".')}
              was={was('meshBeaconBroadcastOfferPreset')}
            >
              <SettingSelect
                value={s.meshBeaconBroadcastOfferPreset === null ? '' : String(s.meshBeaconBroadcastOfferPreset)}
                onChange={(v) => s.setMeshBeaconBroadcastOfferPreset(v === '' ? null : Number(v))}
                options={[
                  { value: '', label: t('meshbeacon_config.offer_preset_none', 'None — advertise no preset') },
                  ...MODEM_PRESET_OPTIONS.map((o) => ({ value: String(o.value), label: `${o.name} — ${o.description}` })),
                ]}
              />
            </SettingRow>
          </SettingGroup>
          <SettingGroup title={t('meshbeacon_config.transmit_section', 'Transmit Settings')}>
            {r.number('meshBeaconBroadcastIntervalSecs', mb('interval', 'Broadcast Interval (seconds)'), {
              min: MESH_BEACON_MIN_INTERVAL_SECS,
              help: t('meshbeacon_config.interval_desc', 'How often to broadcast. Firmware enforces a minimum of 3600 seconds (1 hour) and rejects lower values, so a shorter interval will not persist on the device.'),
            })}
            <div className={styles.embedded}>
              <BroadcastTargetsEditor
                targets={s.meshBeaconBroadcastTargets}
                onChange={s.setMeshBeaconBroadcastTargets}
                disabled={readOnly || disabled}
                channels={channels}
              />
            </div>
          </SettingGroup>
        </>
      )}
    </Locked>
  );
}

function Tak({ r }: { r: Rows }) {
  const { s, t } = r;
  const disabled = !s.supportedModules?.takConfig;
  return (
    <Gate r={r} flag="tak" name="TAK">
      <Locked locked={disabled} notice={t('tak_config.unsupported')}>
        <p className={styles.note}>{t('tak_config.tracker_only_note')}</p>
        <p className={styles.note}>{t('tak_config.reboot_note')}</p>
        <SettingGroup>
          {r.select('takTeam', 'tak_config.team', TAK_TEAM_OPTIONS.map((o) => ({ value: o.value, label: t(`tak_config.team_option_${o.name}`, o.label) })))}
          {r.select('takRole', 'tak_config.role', TAK_ROLE_OPTIONS.map((o) => ({ value: o.value, label: t(`tak_config.role_option_${o.name}`, o.label) })))}
        </SettingGroup>
      </Locked>
    </Gate>
  );
}

function Serial({ r }: { r: Rows }) {
  const { s } = r;
  const advanced = [
    r.number('serialRxd', 'serial_config.rxd', { min: 0, max: 255 }),
    r.number('serialTxd', 'serial_config.txd', { min: 0, max: 255 }),
    r.number('serialTimeout', 'serial_config.timeout', { min: 0, max: 65535 }),
    r.toggle('serialOverrideConsoleSerialPort', 'serial_config.override_console'),
  ];
  return (
    <Gate r={r} flag="serial" name="Serial">
      <SettingGroup>
        {r.toggle('serialEnabled', 'serial_config.enabled')}
        {s.serialEnabled && (
          <>
            {r.select('serialMode', 'serial_config.mode', named(SERIAL_MODE_OPTIONS))}
            {r.select('serialBaud', 'serial_config.baud', named(SERIAL_BAUD_OPTIONS))}
            {r.toggle('serialEcho', 'serial_config.echo')}
          </>
        )}
      </SettingGroup>
      {s.serialEnabled && <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>}
    </Gate>
  );
}

function AmbientLighting({ r }: { r: Rows }) {
  const { s, t } = r;
  const preview = `rgb(${s.ambientRed}, ${s.ambientGreen}, ${s.ambientBlue})`;
  return (
    <Gate r={r} flag="ambientlighting" name="Ambient Lighting">
      <SettingGroup>
        {r.toggle('ambientLedState', 'ambientlighting_config.led_state')}
        {s.ambientLedState && r.number('ambientCurrent', 'ambientlighting_config.current', { min: 0, max: 255 })}
      </SettingGroup>
      {s.ambientLedState && (
        <SettingGroup title={t('ambientlighting_config.color_section')}>
          <div className={styles.infoRow}>
            <span className={styles.swatch} style={{ background: preview }} title={t('ambientlighting_config.preview')} />
            <span className={styles.infoValue}>{`${t('ambientlighting_config.preview')}: ${preview}`}</span>
          </div>
          {r.number('ambientRed', 'ambientlighting_config.red', { min: 0, max: 255 })}
          {r.number('ambientGreen', 'ambientlighting_config.green', { min: 0, max: 255 })}
          {r.number('ambientBlue', 'ambientlighting_config.blue', { min: 0, max: 255 })}
        </SettingGroup>
      )}
    </Gate>
  );
}

const MODULES: Record<string, ConfigSaveSection> = {
  telemetry: 'telemetry',
  neighbor: 'neighborinfo',
  extnotif: 'extnotif',
  storeforward: 'storeforward',
  rangetest: 'rangetest',
  cannedmsg: 'cannedmsg',
  audio: 'audio',
  remotehardware: 'remotehardware',
  detectionsensor: 'detectionsensor',
  paxcounter: 'paxcounter',
  statusmessage: 'statusmessage',
  trafficmanagement: 'trafficmanagement',
  meshbeacon: 'meshbeacon',
  tak: 'tak',
  serial: 'serial',
  ambientlighting: 'ambientlighting',
};

/** The open module's page: `modules/<name>` names it. */
export default function ModuleCategory({ sourceId }: CategoryProps) {
  const name = (useSettingsCategory()?.categoryId ?? '').replace(/^modules\//, '');
  const r = useRows(MODULES[name] ?? 'telemetry', `modules.${name}`);
  if (!r) return <StateView kind="loading" />;
  switch (name) {
    case 'telemetry': return <Telemetry r={r} />;
    case 'neighbor': return <NeighborInfo r={r} />;
    case 'extnotif': return <ExternalNotification r={r} />;
    case 'storeforward': return <StoreForward r={r} />;
    case 'rangetest': return <RangeTest r={r} />;
    case 'cannedmsg': return <CannedMessage r={r} />;
    case 'audio': return <Audio r={r} />;
    case 'remotehardware': return <RemoteHardware r={r} />;
    case 'detectionsensor': return <DetectionSensor r={r} />;
    case 'paxcounter': return <Paxcounter r={r} />;
    case 'statusmessage': return <StatusMessage r={r} sourceId={sourceId} />;
    case 'trafficmanagement': return <TrafficManagement r={r} />;
    case 'meshbeacon': return <MeshBeacon r={r} />;
    case 'tak': return <Tak r={r} />;
    case 'serial': return <Serial r={r} />;
    case 'ambientlighting': return <AmbientLighting r={r} />;
    default: return null;
  }
}
