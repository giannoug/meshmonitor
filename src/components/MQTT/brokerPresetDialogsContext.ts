/**
 * Which Save as preset / Manage saved presets dialogs BrokerPresetSelector
 * opens (#6365). Without a provider it opens today's dialogs, so Classic is
 * unchanged; the Workspace's re-hosted Modules › MQTT provides its own sheets
 * (BrokerPresetsSheet) with the same props.
 */
import { createContext, type ComponentType } from 'react';
import type { SavedBrokerPreset } from '../../hooks/useMqttBrokerPresets';
import type { BrokerPresetDraft } from './useSavedBrokerPresetEditor';

export interface BrokerPresetDialogsProps {
  /** Save as preset: the form's broker values; null keeps it shut. */
  saveDraft: BrokerPresetDraft | null;
  onCloseSave(): void;
  /** The form cannot show its stored password, so a draft never includes it. */
  passwordNotIncluded?: boolean;
  manageOpen: boolean;
  onCloseManage(): void;
  presets: SavedBrokerPreset[];
}

export const BrokerPresetDialogsContext = createContext<ComponentType<BrokerPresetDialogsProps> | null>(null);
