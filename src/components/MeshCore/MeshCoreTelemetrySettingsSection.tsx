import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveBar } from '../../hooks/useSaveBar';
import { useMeshCoreTelemetrySettingsDraft } from './hooks/useMeshCoreTelemetrySettingsDraft';
import TelemetryRetentionSettings from '../settings/TelemetryRetentionSettings';
import { NumberInputScope } from '../common/NumberInputScope';
import { useNumberInputScope } from '../common/numberInputScopeContext';

interface MeshCoreTelemetrySettingsSectionProps {
  /** App base URL (appBasename). */
  baseUrl: string;
  /** Source UUID: scopes the save to /api/settings?sourceId=<id>. */
  sourceId: string;
}

/**
 * MeshCore telemetry settings (#6258 WP3).
 *
 * Both values save per source (`source:<id>:*`). The readers already prefer the
 * per-source value and fall back to the global default, so a source with no
 * override keeps following the Meshtastic setting. The MeshCore page never
 * mounts SettingsTab, so this section is the only editor for those overrides.
 */
export const MeshCoreTelemetrySettingsSection: React.FC<MeshCoreTelemetrySettingsSectionProps> = ({
  baseUrl,
  sourceId,
}) => {
  const { t } = useTranslation();
  const { canWrite, draft, hasChanges, isSaving, update, handleSave, handleDismiss } = useMeshCoreTelemetrySettingsDraft(baseUrl, sourceId);

  const numberScope = useNumberInputScope();
  useSaveBar({
    numberScope,
    id: 'meshcore-telemetry',
    sectionName: t('settings.telemetry', 'Telemetry'),
    hasChanges,
    isSaving,
    onSave: handleSave,
    onDismiss: handleDismiss,
  });

  return (
    <NumberInputScope scope={numberScope}>
      <div className="form-section">
        <h3>{t('settings.telemetry', 'Telemetry')}</h3>

        <TelemetryRetentionSettings
          visualizationHours={draft.telemetryVisualizationHours}
          favoriteStorageDays={draft.favoriteTelemetryStorageDays}
          disabled={!canWrite}
          onVisualizationHoursChange={(n) => update('telemetryVisualizationHours', n)}
          onFavoriteStorageDaysChange={(n) => update('favoriteTelemetryStorageDays', n)}
        />
      </div>
    </NumberInputScope>
  );
};

export default MeshCoreTelemetrySettingsSection;
