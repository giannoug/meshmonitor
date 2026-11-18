/**
 * The one Reticulum runtime a native screen runs (ReticulumScreen): today's
 * `useReticulum` for the device, polled about every 30 s as today, once per
 * screen however many views the viewer opens. Its parts read it here; the
 * shell's sidebar, which sits outside the screen, reads the lists the screen
 * publishes (`rnsKeys.lists`).
 */
import { createContext, useContext } from 'react';
import type { TFunction } from 'i18next';
import type { UseReticulumState } from '../../components/Reticulum/hooks/useReticulum';
import type { ReticulumConversation, ReticulumDestinationRow, ReticulumPathRow } from '../../types/reticulum';

export interface ReticulumRuntime {
  sourceId: string;
  deviceName: string;
  rns: UseReticulumState;
}

export const RnsRuntimeContext = createContext<ReticulumRuntime | null>(null);

export function useRnsRuntime(): ReticulumRuntime {
  const runtime = useContext(RnsRuntimeContext);
  if (!runtime) throw new Error('useRnsRuntime outside ReticulumScreen');
  return runtime;
}

/** What the screen hands the sidebar (no request of its own). */
export interface RnsLists {
  conversations: ReticulumConversation[];
  destinations: ReticulumDestinationRow[];
  destinationCount: number | null;
}

export const rnsKeys = {
  lists: (sourceId: string) => ['workspace', 'reticulum', 'lists', sourceId] as const,
};

/** `<a91c…2f07>`: a hash with no announced name (s9n0). */
export function shortHash(hash: string): string {
  return hash.length > 8 ? `<${hash.slice(0, 4)}…${hash.slice(-4)}>` : `<${hash}>`;
}

/** A peer's name from its announce, else its short hash (s9n0). */
export function peerName(hash: string, destinations: ReticulumDestinationRow[]): string {
  return destinations.find((d) => d.destinationHash === hash)?.displayName || shortHash(hash);
}

/** Two letters for a peer's square: its name's initials, or "?" for a bare hash. */
export function peerMark(name: string): string {
  if (name.startsWith('<')) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** A stable colour (1–8, the device palette) for a name's square. */
export function peerTone(name: string): number {
  let sum = 0;
  for (const ch of name) sum = (sum * 31 + ch.charCodeAt(0)) % 9973;
  return (sum % 8) + 1;
}

/** "2 hops via Halandri Transport", "direct", or null with no path. */
export function routeLine(
  t: TFunction,
  hash: string,
  paths: ReticulumPathRow[],
  destinations: ReticulumDestinationRow[],
): string | null {
  const path = paths.find((p) => p.destinationHash === hash);
  if (!path) return null;
  const hops = path.hops ?? null;
  if (!path.viaHash) return hops === null ? null : t('workspace.reticulum.route_direct', { count: hops });
  return t('workspace.reticulum.route_via', { count: hops ?? 0, via: peerName(path.viaHash, destinations) });
}
