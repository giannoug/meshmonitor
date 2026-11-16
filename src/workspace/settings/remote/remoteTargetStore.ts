/**
 * The remote target of each device's settings (Task 5.9), shared by the parts
 * that draw it: the frame that reads and sends (RemoteTarget), the settings
 * list in the shell's sidebar ("Configuring Remote: …", each category's
 * Sending… / Sent / No reply) and settings search. They are not under one provider, so this
 * is a small store per source. It holds nothing durable: the frame clears its
 * source's entry when the device's settings close, and the read values
 * themselves live in the frame (Ruling DG).
 */
import { useSyncExternalStore } from 'react';

export interface RemoteNode {
  nodeNum: number;
  /** `!xxxxxxxx`. */
  nodeId: string;
  longName: string;
  shortName: string;
  hopsAway?: number | null;
  /** Today's node list carries it (nodeOptionsUtils); false for every remote target. */
  isLocal: boolean;
  /** What MeshMonitor already holds for the node (its node row), read with no request. */
  firmwareVersion?: string | null;
  role?: number | null;
}

/** Today's passkey status (AdminCommandsTab): `remainingSeconds` counts down locally. */
export interface PasskeyState {
  hasPasskey: boolean;
  remainingSeconds: number | null;
}

/**
 * A category's last Send to node. 'sent' is the server's word that the packet went out: today's
 * server awaits no routing ACK for a config write, so nothing here claims the node took it (Ruling GA).
 */
export type SendStatus = 'sending' | 'sent' | 'noReply';

export interface RemoteEntry {
  /** The node settings configure; null for this device's own radio. */
  node: RemoteNode | null;
  pickerOpen: boolean;
  passkey: PasskeyState | null;
  /** When each category was last read from the node (ms). */
  lastRead: Record<string, number>;
  sent: Record<string, SendStatus>;
  /** The node's unsent edits, for the picker to ask before a switch drops them (I3). */
  unsent: Array<{ key: string; title: string; changes: string[] }>;
}

const EMPTY: RemoteEntry = { node: null, pickerOpen: false, passkey: null, lastRead: {}, sent: {}, unsent: [] };
const entries = new Map<string, RemoteEntry>();
const listeners = new Set<() => void>();

export function remoteEntry(sourceId: string): RemoteEntry {
  return entries.get(sourceId) ?? EMPTY;
}

export function updateRemote(sourceId: string, patch: Partial<RemoteEntry> | ((e: RemoteEntry) => Partial<RemoteEntry>)): void {
  const prev = remoteEntry(sourceId);
  const next = typeof patch === 'function' ? patch(prev) : patch;
  if (Object.keys(next).length === 0) return;
  entries.set(sourceId, { ...prev, ...next });
  for (const l of listeners) l();
}

export function clearRemote(sourceId: string): void {
  if (!entries.delete(sourceId)) return;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useRemoteEntry(sourceId: string): RemoteEntry {
  return useSyncExternalStore(subscribe, () => remoteEntry(sourceId));
}
