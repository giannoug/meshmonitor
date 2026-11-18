import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveBar } from '../../hooks/useSaveBar';
import { useMeshCoreNodeDisplayDraft } from './hooks/useMeshCoreNodeDisplayDraft';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import SignFlipCorrectionSettings from '../settings/SignFlipCorrectionSettings';
import NodeDimmingSettings from '../settings/NodeDimmingSettings';
import HideIncompleteNodesSetting from '../settings/HideIncompleteNodesSetting';
import {
  NODE_DISPLAY_RANGES,
  MAX_INFRA_NODE_AGE_HOURS_RANGE,
} from '../../constants/nodeDisplayDefaults';

interface MeshCoreNodeDisplaySectionProps {
  /** App base URL (appBasename), as every other MeshCore section takes it. */
  baseUrl: string;
  /** Source UUID — scopes GET/POST to /api/settings?sourceId=<id>. */
  sourceId: string;
}

export const MeshCoreNodeDisplaySection: React.FC<MeshCoreNodeDisplaySectionProps> = ({
  baseUrl,
  sourceId,
}) => {
  const { t } = useTranslation();
  const { canWrite, distanceUnit, draft, setDraft, isSaving, hasChanges, update, handleSave, handleDismiss } = useMeshCoreNodeDisplayDraft(baseUrl, sourceId);

  const numberScope = useNumberInputScope();
  useSaveBar({
    numberScope,
    id: 'meshcore-node-display',
    sectionName: t('settings.node_display', 'Node Display'),
    hasChanges,
    isSaving,
    onSave: handleSave,
    onDismiss: handleDismiss,
  });

  const maxNodeAgeRange = NODE_DISPLAY_RANGES.maxNodeAgeHours!;
  const infraAgeRange = MAX_INFRA_NODE_AGE_HOURS_RANGE;
  const thresholdRange = NODE_DISPLAY_RANGES.inactiveNodeThresholdHours!;
  const checkIntervalRange = NODE_DISPLAY_RANGES.inactiveNodeCheckIntervalMinutes!;
  const cooldownRange = NODE_DISPLAY_RANGES.inactiveNodeCooldownHours!;

  return (
    <NumberInputScope scope={numberScope}>
    <div className="form-section">
      <h3>{t('settings.node_display', 'Node Display')}</h3>

      <div className="setting-item">
        <label htmlFor="maxNodeAge">
          {t('settings.node_window_label', 'Node list & map window (hours)')}
          <span className="setting-description">
            {t(
              'meshcore.settings.node_display.window_description',
              "Default time window for the Nodes list and map: nodes not heard within it are hidden. Favorites and your own node always show. Use 0 to show all nodes ever heard (useful for stealthy MeshCore companions that advertise rarely). The map's age filter can narrow this window but never widen it. This does not change which nodes Auto-Pathfinding targets; see Automations > Target Filter.",
            )}
          </span>
        </label>
        <NumberInput
          id="maxNodeAge"
          min={maxNodeAgeRange.min}
          max={maxNodeAgeRange.max}
          integer
          value={draft.maxNodeAgeHours}
          onChange={(v) => update('maxNodeAgeHours', v)}
          disabled={!canWrite}
          className="setting-input"
        />
      </div>

      <div className="setting-item">
        <label htmlFor="maxInfraNodeAge">
          {t('meshcore.settings.node_display.max_infra_age_label', 'Maximum Age of Infrastructure Nodes (hours)')}
          <span className="setting-description">
            {t(
              'meshcore.settings.node_display.max_infra_age_description',
              'A separate age window for Repeaters and Room Servers, which advertise infrequently (often days apart) and never send direct messages. Set higher than the companion window above so fixed infrastructure does not vanish from the Nodes list and map between adverts. Use 0 to never hide them.',
            )}
          </span>
        </label>
        <NumberInput
          id="maxInfraNodeAge"
          min={infraAgeRange.min}
          max={infraAgeRange.max}
          integer
          value={draft.maxInfraNodeAgeHours}
          onChange={(v) => update('maxInfraNodeAgeHours', v)}
          disabled={!canWrite}
          className="setting-input"
        />
      </div>

      <div className="setting-item">
        <label htmlFor="inactiveNodeThresholdHours">
          {t('settings.inactive_node_threshold_label', "Inactive Node Notification Threshold (hours)")}
          <span className="setting-description">
            {t(
              'settings.inactive_node_threshold_description',
              "Nodes that haven't been heard from for this many hours will trigger inactive node notifications (if enabled in Notifications tab)",
            )}
          </span>
        </label>
        <NumberInput
          id="inactiveNodeThresholdHours"
          min={thresholdRange.min}
          max={thresholdRange.max}
          integer
          value={draft.inactiveNodeThresholdHours}
          onChange={(v) => update('inactiveNodeThresholdHours', v)}
          disabled={!canWrite}
          className="setting-input"
        />
      </div>

      <div className="setting-item">
        <label htmlFor="inactiveNodeCheckIntervalMinutes">
          {t('settings.inactive_node_check_interval_label', 'Inactive Node Check Interval (minutes)')}
          <span className="setting-description">
            {t(
              'settings.inactive_node_check_interval_description',
              'How often to check for inactive nodes (1-1440 minutes, default: 60)',
            )}
          </span>
        </label>
        <NumberInput
          id="inactiveNodeCheckIntervalMinutes"
          min={checkIntervalRange.min}
          max={checkIntervalRange.max}
          integer
          value={draft.inactiveNodeCheckIntervalMinutes}
          onChange={(v) => update('inactiveNodeCheckIntervalMinutes', v)}
          disabled={!canWrite}
          className="setting-input"
        />
      </div>

      <div className="setting-item">
        <label htmlFor="inactiveNodeCooldownHours">
          {t('settings.inactive_node_cooldown_label', 'Inactive Node Notification Cooldown (hours)')}
          <span className="setting-description">
            {t(
              'settings.inactive_node_cooldown_description',
              'Minimum time between notifications for the same node (prevents spam, default: 24 hours)',
            )}
          </span>
        </label>
        <NumberInput
          id="inactiveNodeCooldownHours"
          min={cooldownRange.min}
          max={cooldownRange.max}
          integer
          value={draft.inactiveNodeCooldownHours}
          onChange={(v) => update('inactiveNodeCooldownHours', v)}
          disabled={!canWrite}
          className="setting-input"
        />
      </div>

      <HideIncompleteNodesSetting
        checked={draft.hideIncompleteNodes}
        disabled={!canWrite}
        onChange={(v) => setDraft((prev) => ({ ...prev, hideIncompleteNodes: v }))}
        description={t(
          'meshcore.settings.node_display.hide_incomplete_description',
          'Hide nodes that have no advertised name or an unknown device type from the Nodes list and map. Favorites and your own node always show.',
        )}
      />

      <NodeDimmingSettings
        enabled={draft.nodeDimmingEnabled}
        startHours={draft.nodeDimmingStartHours}
        minOpacity={draft.nodeDimmingMinOpacity}
        disabled={!canWrite}
        description={t(
          'meshcore.settings.node_dimming_description',
          'Fade map markers as nodes go quiet. Nodes fade from full opacity at the start time down to the minimum opacity at the end of their age window (the infrastructure window for Repeaters and Room Servers). The Nodes list is not dimmed, and nothing dims when the window is 0 (show all).',
        )}
        onEnabledChange={(v) => setDraft((prev) => ({ ...prev, nodeDimmingEnabled: v }))}
        onStartHoursChange={(n) => update('nodeDimmingStartHours', n)}
        onMinOpacityChange={(n) => update('nodeDimmingMinOpacity', n)}
      />

      {/* Sign-flipped position correction (#5363). Display only, plus the
          geo/distance gates that follow it. */}
      <SignFlipCorrectionSettings
        enabled={draft.signFlipCorrectionEnabled}
        rangeKm={draft.signFlipCorrectionRangeKm}
        referenceLatitude={draft.signFlipReferenceLatitude}
        referenceLongitude={draft.signFlipReferenceLongitude}
        distanceUnit={distanceUnit}
        disabled={!canWrite}
        onEnabledChange={(v) => setDraft((prev) => ({ ...prev, signFlipCorrectionEnabled: v }))}
        onRangeKmChange={(v) => setDraft((prev) => ({ ...prev, signFlipCorrectionRangeKm: v }))}
        onReferenceLatitudeChange={(v) => setDraft((prev) => ({ ...prev, signFlipReferenceLatitude: v }))}
        onReferenceLongitudeChange={(v) => setDraft((prev) => ({ ...prev, signFlipReferenceLongitude: v }))}
      />
    </div>
    </NumberInputScope>
  );
};

export default MeshCoreNodeDisplaySection;
