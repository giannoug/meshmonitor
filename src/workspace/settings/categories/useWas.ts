/** A row's "was …" (b-set-d1): what the node holds while the shown value is an unsaved edit of `section`. */
import { useTranslation } from 'react-i18next';
import type { ConfigSaveSection } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import { changedKeys, formatValue } from '../radioSections';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useRadioSaveQueue } from '../useRadioSaveQueue';

export function useWas(section: ConfigSaveSection): (key: keyof DeviceConfigState) => string | undefined {
  const { t } = useTranslation();
  const state = useSharedDeviceConfig()?.state;
  const base = useRadioSaveQueue()?.baseline(section);
  const changed = state && base ? changedKeys(state, section, base) : [];
  return (key) => (base && changed.includes(key) ? formatValue(t, key, base[key]) : undefined);
}
