import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigSection } from '../shared/config/ConfigSection';
import { RepeaterSettingsForm } from './RepeaterSettingsForm';
import { MESHCORE_DOCS } from './meshcoreDocs';
import type { MeshCoreActions } from './hooks/useMeshCore';
import { useRemoteRepeaterSettings } from './hooks/useRemoteRepeaterSettings';
import type { LoraParams } from '../../utils/loraAirtime';
import styles from './RepeaterSettingsForm.module.css';

export interface MeshCoreRemoteSettingsSectionProps {
  publicKey: string;
  deviceType: 'repeater' | 'room';
  actions: Pick<MeshCoreActions, 'readRemoteSettings' | 'saveRemoteSettings'>;
  /** Hops to the target, or null when no path is known (commands flood). */
  pathHops: number | null;
  /** This source's radio: the target shares it, so it sizes the cost line. */
  radio?: Partial<LoraParams> | null;
  disabled?: boolean;
}

/**
 * Structured settings for a remote Repeater / Room Server (#6256 P10): the
 * same `RepeaterSettingsForm` as the local Repeater page in remote mode. It
 * reads nothing until the user presses a group's Read button, and saves only
 * the fields that changed.
 */
export const MeshCoreRemoteSettingsSection: React.FC<MeshCoreRemoteSettingsSectionProps> = ({
  publicKey,
  deviceType,
  actions,
  pathHops,
  radio,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { values, guestPasswordSet, firmware, loadedGroups, readingGroup, message, readGroup, save } =
    useRemoteRepeaterSettings(publicKey, actions);

  return (
    <div className="mrc-remote-settings" data-testid="remote-settings-section">
      <ConfigSection
        title={t('meshcore.repeater.remote_title', 'Settings')}
        docsUrl={`${MESHCORE_DOCS}#remote-settings`}
        description={t('meshcore.repeater.remote_hint', 'Read and change this node\'s settings without typing commands. Nothing is read until you press Read; every value costs radio time.')}
        canWrite={!disabled}
        collapsible
        defaultCollapsed
      >
        {message && (
          <p className={styles.err} role="alert" data-testid="remote-settings-message">{message}</p>
        )}
        <RepeaterSettingsForm
          mode="remote"
          deviceType={deviceType}
          values={values}
          guestPasswordSet={guestPasswordSet}
          firmwareVersion={firmware}
          radio={radio}
          canWrite={!disabled}
          disabled={disabled}
          loadedGroups={loadedGroups}
          readingGroup={readingGroup}
          onReadGroup={(g) => void readGroup(g)}
          pathHops={pathHops}
          onSave={save}
        />
      </ConfigSection>
    </div>
  );
};
