/**
 * Modules › MQTT on a remote target (Task 5.9 fix round 1, I4): today's
 * Admin Commands MQTT fields on the row kit, queued with the node's other
 * categories and sent with Send to node (one setMQTTConfig). This radio's
 * MQTT page keeps Classic's own Save (Ruling 5.6); its broker presets,
 * Quick-configure link and proxy warning are about this radio's source, so a
 * remote node's page has none of them.
 */
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import { useRows } from '../categories/rows';
import { SettingPassword } from '../categories/RowParts';
import { useWas } from '../categories/useWas';
import StateView from '../../patterns/StateView';

export default function RemoteMqttCategory() {
  const r = useRows('mqtt', 'modules.mqtt');
  const was = useWas('mqtt');
  if (!r) return <StateView kind="loading" />;
  const { s, t } = r;
  return (
    <>
      <SettingGroup title={t('mqtt_config.group_connection')}>
        {r.toggle('mqttEnabled', 'mqtt_config.enable')}
        {r.text('mqttAddress', 'mqtt_config.server_address')}
        {r.toggle('mqttTlsEnabled', 'mqtt_config.tls_enabled', { help: t('mqtt_config.tls_description') })}
      </SettingGroup>
      <SettingGroup title={t('mqtt_config.group_credentials')}>
        {r.text('mqttUsername', 'mqtt_config.username')}
        <SettingRow id="modules.mqtt.mqttPassword" label={t('mqtt_config.password')} help={t('mqtt_config.password_description')} was={was('mqttPassword')}>
          <SettingPassword value={s.mqttPassword} onChange={s.setMqttPassword} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title={t('mqtt_config.group_topics')}>
        {r.text('mqttRoot', 'mqtt_config.root_topic')}
        {r.toggle('mqttEncryptionEnabled', 'mqtt_config.encryption_enabled', { help: t('mqtt_config.encryption_description') })}
        {r.toggle('mqttJsonEnabled', 'mqtt_config.json_enabled', { help: t('mqtt_config.json_description') })}
        {r.toggle('mqttProxyToClientEnabled', 'mqtt_config.proxy_to_client')}
      </SettingGroup>
      <SettingGroup title={t('mqtt_config.group_privacy')}>
        {r.toggle('mqttMapReportingEnabled', 'mqtt_config.map_reporting')}
        {r.number('mqttMapPublishIntervalSecs', 'mqtt_config.map_publish_interval', { min: 0 })}
        {r.number('mqttMapPositionPrecision', 'mqtt_config.map_position_precision', { min: 0, max: 32 })}
        {r.toggle('mqttMapShouldReportLocation', 'mqtt_config.map_report_location')}
      </SettingGroup>
    </>
  );
}
