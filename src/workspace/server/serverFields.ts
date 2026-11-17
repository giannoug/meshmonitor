/**
 * The setting rows on Server › General that settings search finds by name
 * (s13n0), mounted or not: the rows that moved here from You › Preferences
 * in Task 6.4 (the default landing page, MeshCore messaging) and the
 * Reticulum cap. A hit opens the page at the row's `#setting-<id>` anchor.
 * `serverFields.test.tsx` holds this list to the rows the page draws.
 */
import type { ServerGate } from './serverEntries';

export interface ServerField {
  id: string;
  /** The page under `/server/`. */
  page: 'general';
  labelKey: string;
  fallback?: string;
  gate: ServerGate;
}

export const SERVER_FIELDS: ServerField[] = [
  { id: 'general.defaultLandingPage', page: 'general', labelKey: 'settings.default_landing_page_label', fallback: 'Default Landing Page', gate: 'admin' },
  { id: 'general.meshcoreChannelRetryEnabled', page: 'general', labelKey: 'settings.meshcore_channel_retry_enabled', fallback: 'Auto-retry automated MeshCore channel sends', gate: 'write' },
  { id: 'general.meshcoreCliTimeoutSeconds', page: 'general', labelKey: 'settings.meshcore_cli_timeout_label', fallback: 'Remote CLI reply timeout (seconds)', gate: 'write' },
  { id: 'general.meshcoreCrossSourceHopResolution', page: 'general', labelKey: 'settings.meshcore_cross_source_hops_label', fallback: 'Use other sources to resolve unknown hops', gate: 'write' },
  { id: 'general.reticulum_destinations_max', page: 'general', labelKey: 'reticulum.settings.destinations_max_label', fallback: 'Destination retention cap', gate: 'write' },
];
