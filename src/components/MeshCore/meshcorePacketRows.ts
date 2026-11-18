/**
 * A MeshCore packet-monitor row's display fields, shared by today's
 * MeshCorePacketMonitorView and the Workspace monitor (Task 7.5, Rule X: moved
 * here as is). Pure.
 */
import type { MeshCorePacketRow } from '../../hooks/useMeshCorePackets';
import { deriveMeshCorePacketFields } from '../../utils/meshcorePacketDerived';
import { resolveHop, type RepeaterOption } from '../../utils/meshcorePath';
import {
  MESHCORE_PAYLOAD_TYPES as PAYLOAD_TYPES,
  MESHCORE_ROUTE_TYPES as ROUTE_TYPES,
} from '../../utils/meshcorePacketDecode';

type Packet = MeshCorePacketRow;

const HEX_HASH = /^[0-9a-f]{2,6}$/i;
export const validHash = (v: string): boolean => HEX_HASH.test(v) && v.length % 2 === 0;

/**
 * Render an observer count for display.
 *
 * `0` does NOT mean "nobody heard this" — it means OUR radio heard it, because
 * a local reception carries a NULL observerId and COUNT(DISTINCT) skips NULLs
 * (#5040 Phase 2). Showing the digit would invert the meaning for every
 * locally-heard packet, so the local case gets a word instead.
 */
export function observerLabel(count: number, localText: string): string {
  return count > 0 ? String(count) : localText;
}

export function payloadLabel(p: Packet): string {
  if (p.payloadTypeName) return p.payloadTypeName;
  const match = PAYLOAD_TYPES.find(t => t.value === p.payloadType);
  return match ? match.label : `0x${p.payloadType.toString(16).padStart(2, '0')}`;
}

export function routeLabel(p: Packet): string {
  if (p.routeTypeName) return p.routeTypeName;
  if (typeof p.routeType !== 'number') return '—';
  const match = ROUTE_TYPES.find(t => t.value === p.routeType);
  return match ? match.label : `0x${p.routeType.toString(16).padStart(2, '0')}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export interface PacketFromContext {
  /** Names come from the node list, so they follow the same `nodes:read` rule as that list. */
  canSeeNames: boolean;
  contactByKey: Map<string, RepeaterOption>;
  contactOptions: RepeaterOption[];
}

/**
 * The From cell. A full sender key (ADVERT / ANON_REQ) names the node; a bare
 * 1-byte hash names it only when exactly one known contact owns that hash.
 * An ambiguous hash shows `0x2f?` and an unknown one `0x2f`: never a guess.
 */
export function resolvePacketFrom(
  p: Packet,
  { canSeeNames, contactByKey, contactOptions }: PacketFromContext,
): { label: string | null; publicKey: string | null; title?: string } {
  const derived = p.srcHash !== undefined || p.senderPubKey !== undefined || p.advertName !== undefined
    ? { srcHash: p.srcHash ?? null, senderPubKey: p.senderPubKey ?? null, advertName: p.advertName ?? null }
    : deriveMeshCorePacketFields(p.rawHex);
  if (derived.senderPubKey) {
    const key = derived.senderPubKey.toLowerCase();
    const short = `${key.slice(0, 8)}…`;
    if (!canSeeNames) return { label: short, publicKey: null, title: key };
    const exact = contactByKey.get(key);
    if (exact) return { label: derived.advertName || exact.name, publicKey: exact.publicKey, title: key };
    return { label: derived.advertName || short, publicKey: null, title: key };
  }
  if (!derived.srcHash) return { label: null, publicKey: null };
  const hash = derived.srcHash.toLowerCase();
  if (!canSeeNames) return { label: `0x${hash}`, publicKey: null };
  const r = resolveHop(hash as RepeaterOption['hopByte'], contactOptions);
  if (r.matches.length === 1) {
    return { label: r.matches[0].name, publicKey: r.matches[0].publicKey, title: r.matches[0].publicKey };
  }
  return { label: r.matches.length > 1 ? `0x${hash}?` : `0x${hash}`, publicKey: null };
}
