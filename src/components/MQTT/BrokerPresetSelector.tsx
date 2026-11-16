/**
 * The broker preset chooser (shared PresetPicker chips, #5831) that sits above the broker address in the three
 * Meshtastic MQTT forms (#5689). Presets live in `./brokerPresets`; each form
 * passes the preset its stored values already match and an `onApplyPreset`
 * that maps the chosen preset onto its own fields.
 *
 * Choosing an entry only edits the form: nothing is saved or sent from here.
 * "Custom…" changes no field; it is shown whenever the fields match no preset.
 *
 * Saved presets (#5794) appear as a second row, "My saved presets". Admins
 * also get "Save as preset" (from the form's current values) and "Manage
 * saved presets". A non-admin is never shown a saved preset's login: picking
 * one leaves those fields blank and the form sends the preset's id on save,
 * where the server fills them in (`KeptCredentials.serverFill`).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { PresetPicker } from '../shared/config/PresetPicker';
import { BROKER_DISCOVERY_LINKS, type BrokerPreset, type KeptCredentials } from './brokerPresets';
import { ManageBrokerPresetsDialog, SaveBrokerPresetDialog, type BrokerPresetDraft } from './SavedBrokerPresetDialogs';
import { useBrokerPresetChoice } from './useBrokerPresetChoice';
import styles from './BrokerPresetSelector.module.css';

interface BrokerPresetSelectorProps {
  /** id of the wrapper element. */
  id: string;
  /** The first of `candidates` the form's current values describe, or null. */
  matchPreset: (candidates: readonly BrokerPreset[]) => BrokerPreset | null;
  /** Fill the form from `preset`; return which credentials were left alone. */
  onApplyPreset: (preset: BrokerPreset) => KeptCredentials;
  disabled?: boolean;
  /** `settings`: the device config pages. `dashboard`: the bridge source form. */
  layout: 'settings' | 'dashboard';
  /** The form's broker values for "Save as preset", or null when they name no broker. */
  getDraft?: () => BrokerPresetDraft | null;
  /** The form cannot show its stored password, so a draft never includes it. */
  draftPasswordNotIncluded?: boolean;
}

export const BrokerPresetSelector: React.FC<BrokerPresetSelectorProps> = ({
  id,
  matchPreset,
  onApplyPreset,
  disabled = false,
  layout,
  getDraft,
  draftPasswordNotIncluded = false,
}) => {
  const { t } = useTranslation();
  // The choice, kept-credential note, options and dialogs' state live in useBrokerPresetChoice (Rule X).
  const {
    canManage,
    savedRows,
    value,
    handleChange,
    keptKey,
    keptPreset,
    keptFallbacks,
    options,
    savedOptions,
    valueIsSaved,
    currentDraft,
    saveDraft,
    setSaveDraft,
    manageOpen,
    setManageOpen,
  } = useBrokerPresetChoice({ matchPreset, onApplyPreset, getDraft });

  const notes = (
    <>
      {keptKey && keptPreset && (
        <p className={styles.kept} role="status" data-testid="broker-preset-kept">
          {t(keptKey, keptFallbacks[keptKey], {
            username: keptPreset.username,
            password: keptPreset.password,
            name: keptPreset.label ?? keptPreset.labelFallback,
          })}
        </p>
      )}
      <p className={styles.note} data-testid="broker-preset-discovery">
        {t('mqtt_presets.discovery', 'Want a regional broker? Local groups publish their own. Find yours:')}{' '}
        <a href={BROKER_DISCOVERY_LINKS.localGroups} target="_blank" rel="noopener noreferrer">
          {t('mqtt_presets.discovery_local_groups', 'Meshtastic Local Groups')}
        </a>
        {' · '}
        <a href={BROKER_DISCOVERY_LINKS.siteGallery} target="_blank" rel="noopener noreferrer">
          {t('mqtt_presets.discovery_site_gallery', 'MeshMonitor Site Gallery')}
        </a>
      </p>
      <p className={`${styles.note} ${styles.privacy}`} data-testid="broker-preset-privacy">
        <UiIcon name="info" />
        <span>
          {t(
            'mqtt_presets.privacy',
            'Channels with uplink on publish their traffic to this broker. On a public broker, anyone on the internet can read it.',
          )}
        </span>
      </p>
    </>
  );

  return (
    <div
      className={layout === 'dashboard' ? 'dashboard-form-field' : `setting-item ${styles.settings}`}
      data-testid="broker-preset-selector"
      id={id}
    >
      <PresetPicker
        label={t('mqtt_presets.label', 'Broker preset')}
        description={
          layout === 'settings'
            ? t('mqtt_presets.description', 'Fills in the broker address, TLS and login. Nothing is sent until you save.')
            : undefined
        }
        options={options}
        selectedId={valueIsSaved ? null : value}
        onPick={handleChange}
        disabled={disabled}
        data-testid="broker-preset-picker"
      >
        {savedOptions.length === 0 && notes}
      </PresetPicker>
      {savedOptions.length > 0 && (
        <PresetPicker
          label={t('mqtt_presets.saved.label', 'My saved presets')}
          options={savedOptions}
          selectedId={valueIsSaved ? value : null}
          onPick={handleChange}
          disabled={disabled}
          data-testid="broker-preset-saved-picker"
          className={styles.savedPicker}
        >
          {notes}
        </PresetPicker>
      )}
      {canManage && (
        <div className={styles.manageRow}>
          {getDraft && (
            <button
              type="button"
              className="btn-secondary"
              disabled={disabled || currentDraft === null}
              title={
                currentDraft === null
                  ? t('mqtt_presets.saved.save_needs_host', 'Enter a broker address first.')
                  : undefined
              }
              onClick={() => setSaveDraft(currentDraft)}
              data-testid="broker-preset-save-as"
            >
              {t('mqtt_presets.saved.save_as', 'Save as preset')}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={() => setManageOpen(true)}
            data-testid="broker-preset-manage"
          >
            {t('mqtt_presets.saved.manage', 'Manage saved presets')}
          </button>
        </div>
      )}
      {canManage && (
        <>
          <SaveBrokerPresetDialog
            isOpen={saveDraft !== null}
            onClose={() => setSaveDraft(null)}
            draft={saveDraft}
            passwordNotIncluded={draftPasswordNotIncluded}
          />
          <ManageBrokerPresetsDialog isOpen={manageOpen} onClose={() => setManageOpen(false)} presets={savedRows} />
        </>
      )}
    </div>
  );
};

export default BrokerPresetSelector;
