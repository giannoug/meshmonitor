/**
 * In MeshMonitor › Packet monitor (board 12-12, Task 5.8): today's capture
 * switch and limits, saving as you go to the global keys SettingsTab wrote.
 * The 15-minute cleanup reads the limits when it runs; a save re-arms nothing.
 */
import { useTranslation } from 'react-i18next';
import SettingGroup from '../kit/SettingGroup';
import { useServerSettings } from '../useAutosaveSetting';
import { Warn } from './RowParts';
import { AutoNumber, AutoToggle, AutosavePage } from './autosave';
import { bool01, usePageSource } from './autosaveValues';
import pages from './SettingsPages.module.css';

/** Today's reads: absent keys are 1000 packets and 24 hours. */
const count = (raw?: string) => parseInt(raw || '1000', 10);
const hours = (raw?: string) => parseInt(raw || '24', 10);

export default function PacketMonitorCategory() {
  return (
    <AutosavePage>
      <PacketMonitorRows />
    </AutosavePage>
  );
}

function PacketMonitorRows() {
  const { t } = useTranslation();
  const { data = {} } = useServerSettings(usePageSource());
  const on = bool01.parse(data.packet_log_enabled);
  return (
    <SettingGroup title={t('workspace.settings.packet_monitor.capture')}>
      <AutoToggle
        k="packet_log_enabled"
        id="packet-monitor.packet_log_enabled"
        label={t('settings.packet_monitor')}
        help={
          <>
            {t('settings.packet_monitor_description')}
            {!on && <Warn>{t('packet_monitor.settings.disabled_warning')}</Warn>}
          </>
        }
        parse={(raw) => raw === '1'}
        serialize={bool01.serialize}
      />
      <AutoNumber
        k="packet_log_max_count"
        id="packet-monitor.packet_log_max_count"
        label={t('packet_monitor.settings.max_packets')}
        help={t('packet_monitor.settings.max_packets_desc')}
        min={100}
        max={10000}
        step={100}
        disabled={!on}
        parse={count}
      />
      <AutoNumber
        k="packet_log_max_age_hours"
        id="packet-monitor.packet_log_max_age_hours"
        label={t('packet_monitor.settings.keep_packets')}
        help={t('packet_monitor.settings.keep_packets_desc')}
        min={1}
        max={168}
        disabled={!on}
        parse={hours}
      />
      <div className={pages.infoRow}>
        <span className={pages.infoText}>
          <span className={pages.infoHelp}>
            <strong>{t('packet_monitor.settings.storage_estimate')}:</strong>{' '}
            {t('packet_monitor.settings.storage_value', { count: count(data.packet_log_max_count), size: Math.round((count(data.packet_log_max_count) * 0.5) / 1024) })}
          </span>
          <span className={pages.infoHelp}>
            <strong>{t('packet_monitor.settings.note')}:</strong> {t('packet_monitor.settings.cleanup_note')}
          </span>
        </span>
      </div>
    </SettingGroup>
  );
}
