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
 *   Rows that come and go with data (a broker's fields, the filter editor, a
 *   stored key) use another prefix and are found by their page's name.
 */
import type { TFunction } from 'i18next';
import { meshcoreConfigurationNavItems } from '../../../components/search/configSections';

export const MESHCORE_SECTION_TO_CATEGORY: Readonly<Record<string, string>> = {
  'meshcore-config-name': 'name',
  'meshcore-config-location': 'location',
  'meshcore-config-repeater-adverts': 'adverts',
  'meshcore-config-repeater-access': 'access',
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
  /** Today's code default, where the key has no en.json string. */
  fallback?: string;
}

export const MESHCORE_FIELDS: MeshCoreField[] = [
  { id: 'meshcore.name', categoryId: 'name', labelKey: 'meshcore.config.name_label' },
  { id: 'meshcore.lat', categoryId: 'location', labelKey: 'meshcore.config.latitude', fallback: 'Latitude' },
  { id: 'meshcore.lon', categoryId: 'location', labelKey: 'meshcore.config.longitude', fallback: 'Longitude' },
  { id: 'meshcore.advLoc', categoryId: 'location', labelKey: 'meshcore.config.advert_loc_policy' },
  { id: 'meshcore.preset', categoryId: 'radio', labelKey: 'meshcore.config.preset', fallback: 'Preset' },
  { id: 'meshcore.freq', categoryId: 'radio', labelKey: 'meshcore.config.frequency' },
  { id: 'meshcore.bw', categoryId: 'radio', labelKey: 'meshcore.config.bandwidth' },
  { id: 'meshcore.sf', categoryId: 'radio', labelKey: 'meshcore.config.sf' },
  { id: 'meshcore.cr', categoryId: 'radio', labelKey: 'meshcore.config.cr' },
  { id: 'meshcore.multiAcks', categoryId: 'radio', labelKey: 'meshcore.multi_acks.title' },
  { id: 'meshcore.blePin', categoryId: 'radio', labelKey: 'workspace.meshcore.settings.ble_pin' },
  { id: 'meshcore.txPower', categoryId: 'tx-power', labelKey: 'meshcore.config.tx_power_label', fallback: 'Power (dBm)' },
  { id: 'meshcore.telBase', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_base' },
  { id: 'meshcore.telLoc', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_loc' },
  { id: 'meshcore.telEnv', categoryId: 'telemetry', labelKey: 'meshcore.config.telemetry_env' },
  { id: 'meshcore.receiveOnly', categoryId: 'receive-only', labelKey: 'meshcore.receive_only.toggle_label' },
  { id: 'meshcore.discoverable', categoryId: 'connection', labelKey: 'meshcore.discover.responder_title' },
  { id: 'meshcore.pathHash', categoryId: 'path-scope', labelKey: 'meshcore.path_hash.title', fallback: 'Default path hash size' },
  { id: 'meshcore.defaultScope', categoryId: 'path-scope', labelKey: 'meshcore.scope.title', fallback: 'Default region / scope' },
  { id: 'meshcore.senderNamesEnabled', categoryId: 'sender-names', labelKey: 'meshcore.sender_names.enable' },
  { id: 'meshcore.senderNames', categoryId: 'sender-names', labelKey: 'meshcore.sender_names.names_label' },
  { id: 'meshcore.observer.enabled', categoryId: 'observer', labelKey: 'meshcore.form.observer_enable' },
  { id: 'meshcore.observer.iataCode', categoryId: 'observer', labelKey: 'meshcore.form.observer_iata' },
  { id: 'meshcore.observer.add', categoryId: 'observer', labelKey: 'meshcore.observer.add_broker' },
  { id: 'meshcore.meshcoreReactionsInboundEnabled', categoryId: 'reactions', labelKey: 'meshcore.reactions.settings.inbound_label' },
  { id: 'meshcore.meshcoreReactionsOutboundEnabled', categoryId: 'reactions', labelKey: 'meshcore.reactions.settings.outbound_label' },
  { id: 'meshcore.meshcoreReactionsAckOnReceive', categoryId: 'reactions', labelKey: 'meshcore.reactions.settings.ack_label' },
  { id: 'meshcore.requiredRepeaterMode', categoryId: 'required-repeaters', labelKey: 'meshcore.required_repeater.mode_label' },
  { id: 'meshcore.display.maxNodeAgeHours', categoryId: 'display', labelKey: 'settings.node_window_label' },
  { id: 'meshcore.display.maxInfraNodeAgeHours', categoryId: 'display', labelKey: 'meshcore.settings.node_display.max_infra_age_label', fallback: 'Maximum Age of Infrastructure Nodes (hours)' },
  { id: 'meshcore.display.hideIncompleteNodes', categoryId: 'display', labelKey: 'settings.hide_incomplete_nodes' },
  { id: 'meshcore.display.nodeDimmingEnabled', categoryId: 'display', labelKey: 'settings.node_dimming_enabled' },
  { id: 'meshcore.display.nodeDimmingStartHours', categoryId: 'display', labelKey: 'settings.node_dimming_start_hours' },
  { id: 'meshcore.display.nodeDimmingMinOpacity', categoryId: 'display', labelKey: 'settings.node_dimming_min_opacity' },
  { id: 'meshcore.display.inactiveNodeThresholdHours', categoryId: 'display', labelKey: 'settings.inactive_node_threshold_label' },
  { id: 'meshcore.display.inactiveNodeCheckIntervalMinutes', categoryId: 'display', labelKey: 'settings.inactive_node_check_interval_label' },
  { id: 'meshcore.display.inactiveNodeCooldownHours', categoryId: 'display', labelKey: 'settings.inactive_node_cooldown_label' },
  { id: 'meshcore.display.signFlipCorrectionEnabled', categoryId: 'display', labelKey: 'settings.sign_flip.enabled' },
  { id: 'meshcore.display.signFlipCorrectionRangeKm', categoryId: 'display', labelKey: 'settings.sign_flip.range_label' },
  { id: 'meshcore.display.signFlipReferenceLatitude', categoryId: 'display', labelKey: 'settings.sign_flip.latitude_placeholder' },
  { id: 'meshcore.display.signFlipReferenceLongitude', categoryId: 'display', labelKey: 'settings.sign_flip.longitude_placeholder' },
  { id: 'meshcore.display.telemetryVisualizationHours', categoryId: 'display', labelKey: 'settings.telemetry_hours_label' },
  { id: 'meshcore.display.favoriteTelemetryStorageDays', categoryId: 'display', labelKey: 'settings.fav_telemetry_label' },
  { id: 'meshcore.audio', categoryId: 'notifications', labelKey: 'settings.enable_audio_notifications' },
  // A local repeater's pages (role Repeater).
  { id: 'meshcore.repeater.advertInterval', categoryId: 'adverts', labelKey: 'meshcore.repeater.advert_interval' },
  { id: 'meshcore.repeater.floodAdvertInterval', categoryId: 'adverts', labelKey: 'meshcore.repeater.flood_advert_interval' },
  { id: 'meshcore.repeater.floodMax', categoryId: 'adverts', labelKey: 'meshcore.repeater.flood_max' },
  { id: 'meshcore.repeater.repeat', categoryId: 'adverts', labelKey: 'meshcore.repeater.repeat' },
  { id: 'meshcore.repeater.af', categoryId: 'adverts', labelKey: 'meshcore.repeater.af' },
  { id: 'meshcore.repeater.rxDelay', categoryId: 'adverts', labelKey: 'meshcore.repeater.rx_delay' },
  { id: 'meshcore.repeater.txDelay', categoryId: 'adverts', labelKey: 'meshcore.repeater.tx_delay' },
  { id: 'meshcore.repeater.directTxDelay', categoryId: 'adverts', labelKey: 'meshcore.repeater.direct_tx_delay' },
  { id: 'meshcore.repeater.guestPassword', categoryId: 'access', labelKey: 'meshcore.repeater.guest_password' },
  { id: 'meshcore.repeater.allowReadOnly', categoryId: 'access', labelKey: 'meshcore.repeater.allow_read_only' },
  { id: 'meshcore.repeater.adminPassword', categoryId: 'access', labelKey: 'meshcore.repeater.admin_password' },
  { id: 'meshcore.repeater.clock', categoryId: 'clock', labelKey: 'meshcore.repeater.sync_clock' },
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
