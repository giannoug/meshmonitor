/**
 * The broker preset choice of a Meshtastic MQTT form (#5689, #5794): which
 * preset the fields match, picking one (or "Custom…"), the note on which
 * credentials a pick left alone, the built-in and saved options, and the
 * Save as preset / Manage dialogs' state. Shared by BrokerPresetSelector and
 * the Workspace MQTT bridge page (Task 5.8, Rule X); moved unchanged.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BROKER_PRESETS,
  CUSTOM_PRESET_ID,
  savedPresetToBroker,
  type BrokerPreset,
  type KeptCredentials,
} from './brokerPresets';
import { useMqttBrokerPresets } from '../../hooks/useMqttBrokerPresets';
import type { BrokerPresetDraft } from './SavedBrokerPresetDialogs';

export interface BrokerPresetChoiceOptions {
  /** The first of `candidates` the form's current values describe, or null. */
  matchPreset: (candidates: readonly BrokerPreset[]) => BrokerPreset | null;
  /** Fill the form from `preset`; return which credentials were left alone. */
  onApplyPreset: (preset: BrokerPreset) => KeptCredentials;
  /** The form's broker values for "Save as preset", or null when they name no broker. */
  getDraft?: () => BrokerPresetDraft | null;
}

export function useBrokerPresetChoice({ matchPreset, onApplyPreset, getDraft }: BrokerPresetChoiceOptions) {
  const { t } = useTranslation();
  const { canManage, presets: savedRows } = useMqttBrokerPresets();
  const savedPresets = useMemo(() => savedRows.map(savedPresetToBroker), [savedRows]);
  const allPresets = useMemo(() => [...BROKER_PRESETS, ...savedPresets], [savedPresets]);
  const findPreset = (presetId: string) => allPresets.find((p) => p.id === presetId);
  const [lastApplied, setLastApplied] = useState<{ presetId: string; kept: KeptCredentials } | null>(null);
  const [saveDraft, setSaveDraft] = useState<BrokerPresetDraft | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  // Two saved presets can share an endpoint; the one just picked wins while
  // the fields still reach it.
  const lastPreset = lastApplied ? findPreset(lastApplied.presetId) : undefined;
  const matchedPresetId =
    (lastPreset && matchPreset([lastPreset]) ? lastPreset.id : matchPreset(allPresets)?.id) ?? null;

  // "Custom…" picked while the fields still match a preset: keep showing it
  // while the fields stay as they were. Any change to what the fields match
  // (an edit, or the save bar's Dismiss putting them back) ends it, so the
  // chooser never shows "Custom…" next to fields it does not describe.
  const [customAt, setCustomAt] = useState<{ matched: string | null } | null>(null);
  if (customAt !== null && customAt.matched !== matchedPresetId) setCustomAt(null);
  const forceCustom = customAt !== null && customAt.matched === matchedPresetId;

  const value = forceCustom ? CUSTOM_PRESET_ID : matchedPresetId ?? CUSTOM_PRESET_ID;

  const handleChange = (next: string) => {
    if (next === CUSTOM_PRESET_ID) {
      setCustomAt({ matched: matchedPresetId });
      setLastApplied(null);
      return;
    }
    const preset = findPreset(next);
    if (!preset) return;
    setCustomAt(null);
    setLastApplied({ presetId: preset.id, kept: onApplyPreset(preset) });
  };

  // Name kept credentials only while the form still shows that preset.
  const keptPreset =
    lastApplied && !forceCustom && lastApplied.presetId === matchedPresetId
      ? findPreset(lastApplied.presetId)
      : undefined;
  const kept = keptPreset && lastApplied ? lastApplied.kept : null;
  const loginHidden = !!keptPreset && (keptPreset.usernameHidden === true || keptPreset.passwordHidden === true);
  let keptKey: string | null = null;
  if (kept && loginHidden) {
    // Never name a login this user is not shown.
    if (kept.username || kept.password || kept.storedPassword) keptKey = 'mqtt_presets.kept_hidden';
    else if (kept.serverFill) keptKey = 'mqtt_presets.server_fill';
  } else if (kept?.storedPassword) keptKey = 'mqtt_presets.kept_stored_password';
  else if (kept?.username && kept.password) keptKey = 'mqtt_presets.kept_both';
  else if (kept?.username) keptKey = 'mqtt_presets.kept_username';
  else if (kept?.password) keptKey = 'mqtt_presets.kept_password';
  const keptFallbacks: Record<string, string> = {
    'mqtt_presets.kept_stored_password':
      'A password is saved for this bridge, so the preset left the password field blank. This broker’s login is {{username}} / {{password}}; type the password in to use it.',
    'mqtt_presets.kept_both':
      'Your username and password were left as they were. This broker’s login is {{username}} / {{password}}; type it in to use it.',
    'mqtt_presets.kept_username':
      'Your username was left as it was. This broker’s username is {{username}}; type it in to use it.',
    'mqtt_presets.kept_password':
      'Your password was left as it was. This broker’s password is {{password}}; type it in to use it.',
    'mqtt_presets.kept_hidden':
      'Your login was left as it was. To use the saved login of {{name}}, clear the username and password, then pick it again.',
    'mqtt_presets.server_fill':
      'The saved login of {{name}} is added when you save. Only admins can see it.',
  };

  const options = [
    ...BROKER_PRESETS.map((p) => ({
      id: p.id,
      label: t(p.labelKey, p.labelFallback),
      title: `${p.tls ? 'mqtts' : 'mqtt'}://${p.host}:${p.port}`,
    })),
    { id: CUSTOM_PRESET_ID, label: t('mqtt_presets.custom', 'Custom…') },
  ];
  const savedOptions = savedPresets.map((p) => ({
    id: p.id,
    label: p.label ?? p.labelFallback,
    title: `${p.tls ? 'mqtts' : 'mqtt'}://${p.host}:${p.port}${p.rootTopic ? ` · ${p.rootTopic}` : ''}`,
  }));
  const valueIsSaved = savedPresets.some((p) => p.id === value);
  const currentDraft = canManage && getDraft ? getDraft() : null;

  return {
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
  };
}
