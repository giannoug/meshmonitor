/**
 * The Analyzer Observer's error words and key pre-check, moved as is out of
 * MeshCoreObserverSection (Rule X, Task 7.4) so the Workspace's Observer page
 * says the same thing.
 */
import type { ObserverKeyError, ObserverKeyAction } from './hooks/useObserverKey';

const ERROR_CODE_MAP: Record<string, { key: string; fallback: string }> = {
  SOURCE_NOT_CONNECTED: {
    key: 'meshcore.observer.err_not_connected',
    fallback: 'Not connected to the device. Connect the source, then fetch the key again.',
  },
  EXPORT_FAILED: {
    key: 'meshcore.observer.err_export_failed',
    fallback:
      'The device refused to export its key. Check that it is a Companion (not a repeater) and still connected, then retry.',
  },
  INVALID_KEY_LENGTH: {
    key: 'meshcore.observer.err_key_length',
    fallback: 'The key must be exactly 128 hex characters (64 bytes).',
  },
  INVALID_KEY_MATERIAL: {
    key: 'meshcore.observer.err_key_material',
    fallback: 'That is 128 hex characters, but not a valid MeshCore signing key.',
  },
  CREDENTIAL_PERSISTENCE_DISABLED: {
    key: 'meshcore.observer.err_no_persistence',
    fallback: 'MeshMonitor cannot store credentials — set a fixed SESSION_SECRET and restart.',
  },
  INVALID_PARAMETER_TYPE: {
    key: 'meshcore.observer.err_bad_request',
    fallback: 'The key could not be read from the request.',
  },
  SOURCE_NOT_FOUND: {
    key: 'meshcore.observer.err_source_missing',
    fallback: 'This source no longer exists.',
  },
  INVALID_PARAMETER: {
    key: 'meshcore.observer.err_not_meshcore',
    fallback: 'The Analyzer Observer applies to MeshCore sources only.',
  },
  INTERNAL_ERROR: {
    key: 'meshcore.observer.err_internal',
    fallback: 'Something went wrong on the server. Check the MeshMonitor logs.',
  },
};

/** Codes returned with a device-fault flavor on the IMPORT path only — the
 *  paste-path message ("that is 128 hex chars but...") assumes the user just
 *  typed it, which is wrong when the device supplied it (§7). */
const DEVICE_FAULT_CODES = new Set(['INVALID_KEY_LENGTH', 'INVALID_KEY_MATERIAL']);

// Overloads, not `opts?`: i18next 26.5's TFunction has no 3-argument form
// that takes `undefined` options, so an optional third parameter won't accept it.
type TFunc = {
  (key: string, fallback: string): string;
  (key: string, fallback: string, opts: Record<string, unknown>): string;
};

/**
 * Resolve one `ObserverKeyError` to display text. `action` is the mutation
 * that produced it (null for the initial GET) — used only to prefix the two
 * device-fault codes when they came back from the import path (§7).
 *
 * A `code: null` error covers two real shapes from the hook: an actual
 * transport failure (no body, `message: null`) and a non-JSON/uncoded error
 * response that still carried a message (e.g. the device rate limiter, which
 * replies `{error: '...', retryAfter: '1 minute'}` with no `code` field at
 * all). We can't distinguish these by HTTP status — the hook doesn't surface
 * it — so a present message is shown verbatim and only a truly empty one
 * falls back to the generic network-error copy.
 */
export function describeObserverError(t: TFunc, error: ObserverKeyError, action: ObserverKeyAction | null): string {
  if (error.code === null) {
    if (error.message) return error.message;
    return t('meshcore.observer.err_network', 'Could not reach MeshMonitor. Check your connection and retry.');
  }
  const mapped = ERROR_CODE_MAP[error.code];
  if (!mapped) {
    return (
      error.message ??
      t('meshcore.observer.err_internal', 'Something went wrong on the server. Check the MeshMonitor logs.')
    );
  }
  const text = t(mapped.key, mapped.fallback);
  if (action === 'import' && DEVICE_FAULT_CODES.has(error.code)) {
    return `${t('meshcore.observer.err_from_device', 'The device returned an unusable key: ')}${text}`;
  }
  return text;
}

/** Client pre-check mirroring the server's 128-hex validation, applied to the
 *  trimmed, `0x`-stripped value for fast feedback (§6.2 [C]). The RAW draft is
 *  still what gets sent to `setManualKey` — the hook/server own the actual
 *  trim/strip, so this check exists purely to give fast UI feedback. */
export function isPlausibleHexKey(raw: string): boolean {
  return /^[0-9a-fA-F]{128}$/.test(raw.trim().replace(/^0x/i, ''));
}

