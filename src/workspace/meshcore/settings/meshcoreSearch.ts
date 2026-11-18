/**
 * Finding a MeshCore device's settings (Task 7.4), mounted or not:
 *
 * - `MESHCORE_SECTION_TO_CATEGORY`: each of today's Device Configuration
 *   sections (`meshcoreConfigurationNavItems`, and the anchors of the
 *   sections that have none in the nav) and the page that holds it now, so an
 *   old `/source/:id/configuration#<section>` link opens that page.
 * - `MESHCORE_FIELDS`: every setting row the MeshCore pages draw on the row
 *   kit, for settings search (as `SERVER_FIELDS` and `PREF_FIELDS`); a hit
 *   opens the page at the row's `#setting-<id>`. `meshcoreFields.test.tsx`
 *   holds this list to the rows the pages draw. Pages that keep today's
 *   sections have no rows here: they are found by name and today's keywords.
 */
import type { TFunction } from 'i18next';
import { meshcoreConfigurationNavItems } from '../../../components/search/configSections';

export const MESHCORE_SECTION_TO_CATEGORY: Readonly<Record<string, string>> = {
  'meshcore-config-name': 'name',
  'meshcore-config-location': 'location',
  'meshcore-config-repeater-adverts': 'adverts',
  // Today's one repeater form holds Adverts & forwarding and Access, saved together (Ruling 7.4).
  'meshcore-config-repeater-access': 'adverts',
  'meshcore-config-repeater-clock': 'clock',
  'meshcore-config-radio': 'radio',
  'meshcore-multi-acks': 'radio',
  'meshcore-ble-pin': 'radio',
  'meshcore-config-tx-power': 'tx-power',
  'meshcore-config-telemetry': 'telemetry',
  'meshcore-path-hash': 'path-scope',
  'meshcore-default-scope': 'path-scope',
  'meshcore-sender-names': 'sender-names',
  'meshcore-channels': 'channels',
  'meshcore-contact-sync': 'maintenance',
  'meshcore-device-actions': 'contacts',
  'meshcore-local-console': 'console',
  'meshcore-observer': 'observer',
  'meshcore-node-purge': 'maintenance',
  'meshcore-config-backup': 'maintenance',
  'meshcore-device-management': 'maintenance',
};

export interface MeshCoreField {
  id: string;
  categoryId: string;
  labelKey: string;
}

export const MESHCORE_FIELDS: MeshCoreField[] = [
  { id: 'meshcore.name', categoryId: 'name', labelKey: 'meshcore.config.name_label' },
  { id: 'meshcore.lat', categoryId: 'location', labelKey: 'meshcore.config.latitude' },
  { id: 'meshcore.lon', categoryId: 'location', labelKey: 'meshcore.config.longitude' },
  { id: 'meshcore.advLoc', categoryId: 'location', labelKey: 'meshcore.config.advert_loc_policy' },
  { id: 'meshcore.preset', categoryId: 'radio', labelKey: 'meshcore.config.preset' },
  { id: 'meshcore.freq', categoryId: 'radio', labelKey: 'meshcore.config.frequency' },
  { id: 'meshcore.bw', categoryId: 'radio', labelKey: 'meshcore.config.bandwidth' },
  { id: 'meshcore.sf', categoryId: 'radio', labelKey: 'meshcore.config.sf' },
  { id: 'meshcore.cr', categoryId: 'radio', labelKey: 'meshcore.config.cr' },
  { id: 'meshcore.multiAcks', categoryId: 'radio', labelKey: 'meshcore.multi_acks.title' },
  { id: 'meshcore.blePin', categoryId: 'radio', labelKey: 'workspace.meshcore.settings.ble_pin' },
  { id: 'meshcore.txPower', categoryId: 'tx-power', labelKey: 'meshcore.config.tx_power_label' },
  { id: 'meshcore.telBase', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_base' },
  { id: 'meshcore.telLoc', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_loc' },
  { id: 'meshcore.telEnv', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_env' },
  { id: 'meshcore.receiveOnly', categoryId: 'receive-only', labelKey: 'meshcore.receive_only.toggle_label' },
  { id: 'meshcore.discoverable', categoryId: 'connection', labelKey: 'meshcore.discover.responder_title' },
];

/** Today's keywords per MeshCore page (the section catalogue, every gate open), for the settings list's filter. */
export function meshcoreCategoryKeywords(): Map<string, string> {
  const keyOnly = ((key: string) => key) as unknown as TFunction;
  const words = new Map<string, string>();
  const sections = meshcoreConfigurationNavItems(keyOnly, {
    isCompanion: true,
    showChannels: true,
    showContactSync: true,
    showConsole: true,
    showObserver: true,
    showDangerZone: true,
    showBackups: true,
    showRepeaterSettings: true,
    showRepeaterClock: true,
  });
  for (const s of sections) {
    const id = MESHCORE_SECTION_TO_CATEGORY[s.id];
    if (id) words.set(id, [words.get(id), ...(s.keywords ?? [])].filter(Boolean).join(' '));
  }
  return words;
}
