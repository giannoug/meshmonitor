/** Allowed per-user preference keys and value validation (#6365). */
export const MAX_PREFERENCE_BYTES = 65536;

const KEY_PATTERNS = [/^workspace\.[a-z0-9.-]{1,64}$/i, /^dashboard\.(overview|[A-Za-z0-9_-]{1,64})$/];

export function isAllowedUserPreferenceKey(key: string): boolean {
  return key === 'layout' || key === 'settings.pins' || KEY_PATTERNS.some(p => p.test(key));
}

/** Returns an error message, or null when valid. The message 'too large' means HTTP 413. */
export function validateUserPreferenceValue(key: string, value: unknown): string | null {
  if (key === 'layout' && value !== 'classic' && value !== 'workspace') {
    return "layout must be 'classic' or 'workspace'";
  }
  const json = JSON.stringify(value);
  if (json === undefined) return 'value must be JSON-serializable';
  if (Buffer.byteLength(json, 'utf8') > MAX_PREFERENCE_BYTES) return 'too large';
  return null;
}
