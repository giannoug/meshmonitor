/**
 * Device › Network: today's Network section (NetworkConfigSection) on the row
 * kit, with its limits (SSID 32, password 63, NTP and syslog 32 characters),
 * the static IP rows when the address mode is STATIC, today's note on a
 * bridged node, and today's notice when the firmware build has no network
 * module (view only). Edits queue as the `network` section.
 */
import { ADDRESS_MODE_OPTIONS, UDP_BROADCAST_FLAG } from '../../../components/configuration/constants';
import StateView from '../../patterns/StateView';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import { useWas } from './useWas';
import { labelled, useRows } from './rows';
import { Locked, SettingPassword, Warn } from './RowParts';
import type { CategoryProps } from '../categories';

export default function NetworkCategory({ target }: CategoryProps) {
  const r = useRows('network', 'network');
  const was = useWas('network');
  if (!r) return <StateView kind="loading" />;
  const { s, t } = r;

  return (
    <Locked
      locked={s.supportedModules?.network === false}
      notice={t('module_availability.excluded', { module: 'Network' })}
    >
      {s.isBridged && (
        <p role="note" data-testid="network-bridged-note">
          <Warn tone="note">
            <strong>{t('network_config.bridged_inert_title', 'This is a bridged node')}</strong>{' '}
            {t(
              'network_config.bridged_inert_body',
              'This node has no native WiFi or Ethernet hardware — it is reached through a serial/BLE-to-TCP bridge. These network settings (WiFi, Ethernet, NTP, syslog, static IP) have no effect on it; they only apply to nodes with built-in WiFi/Ethernet. Time sync still works over the mesh/connection. To use MQTT on this node, see the MQTT section’s Client Proxy option.',
            )}
          </Warn>
        </p>
      )}
      <SettingGroup>
        {r.toggle('wifiEnabled', 'network_config.wifi_enabled')}
        {s.wifiEnabled && (
          <>
            {r.text('wifiSsid', 'network_config.wifi_ssid', { maxLength: 32, placeholder: 'MyNetwork' })}
            <SettingRow id="network.wifiPsk" label={t('network_config.wifi_psk')} help={t('network_config.wifi_psk_description')} was={was('wifiPsk')}>
              <SettingPassword value={s.wifiPsk} onChange={s.setWifiPsk} maxLength={63} />
            </SettingRow>
            {r.select('addressMode', 'network_config.address_mode', labelled(ADDRESS_MODE_OPTIONS))}
          </>
        )}
        {r.text('ntpServer', 'network_config.ntp_server', { maxLength: 32, placeholder: 'meshtastic.pool.ntp.org' })}
        {/* Admin Commands neither reads nor sends these for a remote node. */}
        {target.kind === 'local' && r.text('rsyslogServer', 'network_config.rsyslog_server', { maxLength: 32, placeholder: '192.168.1.100:514' })}
        {target.kind === 'local' &&
          r.toggle('enabledProtocols', 'network_config.udp_broadcast', {
            checked: (s.enabledProtocols & UDP_BROADCAST_FLAG) !== 0,
            onChange: (on) => s.setEnabledProtocols(on ? s.enabledProtocols | UDP_BROADCAST_FLAG : s.enabledProtocols & ~UDP_BROADCAST_FLAG),
          })}
      </SettingGroup>
      {s.wifiEnabled && s.addressMode === 1 && (
        <SettingGroup title={t('network_config.static_ip_settings')}>
          {r.text('ipv4Address', 'network_config.ip_address', { placeholder: '192.168.1.100' })}
          {r.text('ipv4Gateway', 'network_config.gateway', { placeholder: '192.168.1.1' })}
          {r.text('ipv4Subnet', 'network_config.subnet', { placeholder: '255.255.255.0' })}
          {r.text('ipv4Dns', 'network_config.dns', { placeholder: '8.8.8.8' })}
        </SettingGroup>
      )}
    </Locked>
  );
}
