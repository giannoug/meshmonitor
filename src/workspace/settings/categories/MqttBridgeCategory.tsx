/**
 * In MeshMonitor › MQTT bridge (boards 12-13 / 12-24, Task 5.8): today's
 * bridge setup (MqttBridgeConfigurationView), stored with the source. It keeps
 * its own Save because saving reconnects the upstream broker (s12n1), so it is
 * not saved as you go and is not on the radio queue. Its save registers with
 * the frame's one SaveBar (the bridge has no radio bar to yield).
 */
import { useTranslation } from 'react-i18next';
import MqttBridgeConfigurationView from '../../../components/MQTT/MqttBridgeConfigurationView';
import type { CategoryProps } from '../categories';
import { useSettingsHeader } from '../settingsDock';
import '../../../styles/settings.css';

export default function MqttBridgeCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  // The phone bar is short: the board's "MQTT bridge" (12-24).
  useSettingsHeader({ scope: t('workspace.settings.mqtt_bridge.own_save'), phoneTitle: t('workspace.settings.mqtt_bridge.phone_title') });
  return <MqttBridgeConfigurationView sourceId={sourceId} />;
}
