/**
 * Finding a Reticulum device's settings (Task 7.6), mounted or not: every
 * setting row the LXMF identity and RNode radio pages draw on the row kit,
 * for settings search (as `MESHCORE_FIELDS`); a hit opens the page at the
 * row's `#setting-<id>`. `__tests__/9-06-settings.test.tsx` holds this list to the
 * rows the pages draw.
 */
export interface ReticulumField {
  id: string;
  categoryId: 'lxmf-identity' | 'rnode';
  labelKey: string;
  /** Today's code default, where the key has no en.json string. */
  fallback: string;
}

export const RETICULUM_FIELDS: ReticulumField[] = [
  { id: 'reticulum.destinationHash', categoryId: 'lxmf-identity', labelKey: 'reticulum.identity.destinationHash', fallback: 'Destination hash' },
  { id: 'reticulum.displayName', categoryId: 'lxmf-identity', labelKey: 'reticulum.identity.displayName', fallback: 'Display name' },
  { id: 'reticulum.announceInterval', categoryId: 'lxmf-identity', labelKey: 'reticulum.identity.interval', fallback: 'Periodic announce' },
  { id: 'reticulum.frequency', categoryId: 'rnode', labelKey: 'reticulum.config.frequency', fallback: 'Frequency (Hz)' },
  { id: 'reticulum.bandwidth', categoryId: 'rnode', labelKey: 'reticulum.config.bandwidth', fallback: 'Bandwidth (Hz)' },
  { id: 'reticulum.spreadingFactor', categoryId: 'rnode', labelKey: 'reticulum.config.sf', fallback: 'Spreading Factor' },
  { id: 'reticulum.codingRate', categoryId: 'rnode', labelKey: 'reticulum.config.cr', fallback: 'Coding Rate' },
  { id: 'reticulum.txPower', categoryId: 'rnode', labelKey: 'reticulum.config.txPower', fallback: 'TX Power (dBm)' },
  { id: 'reticulum.stAlock', categoryId: 'rnode', labelKey: 'reticulum.config.stAlock', fallback: 'Short Airtime Lock (%)' },
  { id: 'reticulum.ltAlock', categoryId: 'rnode', labelKey: 'reticulum.config.ltAlock', fallback: 'Long Airtime Lock (%)' },
  { id: 'reticulum.radioState', categoryId: 'rnode', labelKey: 'reticulum.config.radioOn', fallback: 'Radio on' },
];
