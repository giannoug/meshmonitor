/**
 * Today's one-radio-sweep-at-a-time guard (MeshCoreConfigurationView's
 * `otherSweepRunning`, Ruling HN N3): node discovery (Contacts) and region
 * discovery (Path hash & scope) each hold the other while they run. Kept per
 * source outside the pages, so leaving and reopening a page, or moving
 * between the two, never starts a second zero-hop sweep while one is in flight.
 */
import { useSyncExternalStore } from 'react';

export type SweepKind = 'nodes' | 'regions';

const running = new Map<string, SweepKind>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The sweep running on this source, or null. */
export function useSweep(sourceId: string): SweepKind | null {
  return useSyncExternalStore(subscribe, () => running.get(sourceId) ?? null);
}

/**
 * Runs `sweep` unless one is already running on this source (then it sends
 * nothing and resolves null). The guard clears when the sweep settles.
 */
export async function runSweep<T>(sourceId: string, kind: SweepKind, sweep: () => Promise<T>): Promise<T | null> {
  if (running.has(sourceId)) return null;
  running.set(sourceId, kind);
  notify();
  try {
    return await sweep();
  } finally {
    running.delete(sourceId);
    notify();
  }
}
