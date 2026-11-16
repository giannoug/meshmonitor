/**
 * In MeshMonitor › Telemetry (board 12-12, Task 5.8): today's telemetry
 * window and favourites' retention, saving as you go (global keys, as
 * SettingsTab saved them). The hourly purge reads the retention when it runs;
 * a save re-arms nothing.
 */
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';
import { TELEMETRY_RETENTION_RANGES } from '../../../constants/nodeDisplayDefaults';
import SettingGroup from '../kit/SettingGroup';
import { AutoNumber, AutosavePage } from './autosave';

/** Today's read (SettingsContext): a stored positive number, else the default. */
const orDefault = (fallback: number) => (raw?: string) => {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function TelemetryCategory() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <AutosavePage>
      <SettingGroup>
        <AutoNumber
          k="telemetryVisualizationHours"
          id="telemetry.telemetryVisualizationHours"
          label={t('settings.telemetry_hours_label')}
          help={t('settings.telemetry_hours_description')}
          {...TELEMETRY_RETENTION_RANGES.telemetryVisualizationHours}
          parse={orDefault(s.telemetryVisualizationHours)}
          onSaved={s.setTelemetryVisualizationHours}
        />
        <AutoNumber
          k="favoriteTelemetryStorageDays"
          id="telemetry.favoriteTelemetryStorageDays"
          label={t('settings.fav_telemetry_label')}
          help={t('settings.fav_telemetry_description')}
          {...TELEMETRY_RETENTION_RANGES.favoriteTelemetryStorageDays}
          parse={orDefault(s.favoriteTelemetryStorageDays)}
          onSaved={s.setFavoriteTelemetryStorageDays}
        />
      </SettingGroup>
    </AutosavePage>
  );
}
