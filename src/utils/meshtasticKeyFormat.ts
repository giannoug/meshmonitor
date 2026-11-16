/**
 * Meshtastic key FORMAT helpers, safe in both the browser and Node (#4632).
 *
 * Validation and normalization live here, shared by the client (the Security
 * section's save gate) and the server (`server/utils/meshtasticKeys.ts`, which
 * adds Node-crypto derivation on top). They used to be two hand-copied regexes;
 * a divergence would silently accept a key on one side and reject it on the
 * other, so there is exactly one implementation.
 *
 * `atob` is a global in Node 18+ and every browser, so nothing here needs
 * `Buffer` — that keeps it importable from frontend bundles.
 */

/** Raw key length for X25519, in bytes. */
export const MESHTASTIC_KEY_BYTES = 32;

/** Strip a `base64:` prefix and surrounding whitespace, for comparison/decoding. */
export function normalizeMeshtasticKey(value: string): string {
  return typeof value === 'string' ? value.trim().replace(/^base64:/, '') : '';
}

/**
 * True when `value` is base64 that decodes to exactly 32 bytes — the shape of a
 * Meshtastic private (or public) key. Rejects hex, wrong-length, and non-base64
 * input. A `base64:` prefix is accepted and ignored.
 */
export function isValidMeshtasticKey(value: string): boolean {
  const trimmed = normalizeMeshtasticKey(value);
  // Base64 for 32 bytes is 43 chars + one '=' pad. Pin the exact length so a
  // shorter/longer string can't slip past a lenient decoder.
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) return false;
  try {
    return atob(trimmed).length === MESHTASTIC_KEY_BYTES;
  } catch {
    return false;
  }
}

/**
 * The Security section's admin-key check: empty (an unused row) or well-formed
 * base64. Shared by Classic's section and the Workspace Security page (#6365).
 */
export function isValidBase64(str: string): boolean {
  if (!str || !str.trim()) return true; // Empty is valid (optional)
  const trimmed = str.trim();
  // Check for valid base64 characters and proper padding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(trimmed)) return false;
  // Check length is multiple of 4 (valid base64)
  if (trimmed.length % 4 !== 0) return false;
  // Try to decode to verify
  try {
    atob(trimmed);
    return true;
  } catch {
    return false;
  }
}
