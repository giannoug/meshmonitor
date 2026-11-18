/**
 * What an LXMF message row shows besides its text (#3960 Phase 2 WP5), shared
 * by today's `ReticulumDmsView` and the Workspace conversation (#6365): the
 * sanitized `fields` bag, attachment placeholders (name, type, size; the
 * bridge never sends the bytes, R3) and the delivery-state chip.
 */
import type { UiIconName } from '../icons';
import type { ReticulumMessageRow } from '../../types/reticulum';

/** `fields` is stored as a JSON string (or null) — parse defensively, never throw on malformed data. */
export function parseFields(fields: string | null): Record<string, unknown> | null {
  if (!fields) return null;
  try {
    const parsed: unknown = JSON.parse(fields);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export interface AttachmentMeta {
  name: string;
  type: string;
  size: number | null;
}

/** Best-effort size extraction from a sanitized field value — either the bridge's `{bytesLength}` placeholder (long payloads) or a hex-encoded short byte string (see `_sanitize_lxmf_fields`/`_jsonify_field_value`). */
function sizeOfSanitizedValue(value: unknown): number | null {
  if (value && typeof value === 'object' && 'bytesLength' in (value as Record<string, unknown>)) {
    const n = (value as Record<string, unknown>).bytesLength;
    return typeof n === 'number' ? n : null;
  }
  if (typeof value === 'string') return Math.floor(value.length / 2);
  return null;
}

/** Extracts attachment metadata placeholders from a parsed `fields` bag (`fileAttachments`/`image`/`audio` — see `_FIELD_NAMES` in the bridge). Never surfaces raw bytes — only name/type/size, per R3. */
export function extractAttachments(fields: Record<string, unknown> | null): AttachmentMeta[] {
  if (!fields) return [];
  const out: AttachmentMeta[] = [];
  const fileAttachments = fields.fileAttachments;
  if (Array.isArray(fileAttachments)) {
    for (const entry of fileAttachments) {
      if (Array.isArray(entry) && entry.length >= 1) {
        const [name, payload] = entry;
        out.push({
          name: typeof name === 'string' && name.length > 0 ? name : 'file',
          type: 'file',
          size: sizeOfSanitizedValue(payload),
        });
      }
    }
  }
  for (const [key, type] of [['image', 'image'], ['audio', 'audio']] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    const payload = Array.isArray(value) ? value[value.length - 1] : value;
    out.push({ name: type, type, size: sizeOfSanitizedValue(payload) });
  }
  return out;
}

export function formatAttachmentBytes(size: number | null): string {
  if (size === null) return '';
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

/** Delivery-state -> {icon, labelKey, fallback} for the chip shown on outgoing messages. */
export function deliveryChipFor(state: ReticulumMessageRow['state']): { icon: UiIconName; labelKey: string; fallback: string } {
  switch (state) {
    case 'delivered':
      return { icon: 'checkAll', labelKey: 'reticulum.dms.delivered', fallback: 'Delivered' };
    case 'sent':
      return { icon: 'check', labelKey: 'reticulum.dms.sent', fallback: 'Sent' };
    case 'failed':
      return { icon: 'error', labelKey: 'reticulum.dms.failed', fallback: 'Failed' };
    default:
      return { icon: 'time', labelKey: 'reticulum.dms.sending', fallback: 'Sending…' };
  }
}
