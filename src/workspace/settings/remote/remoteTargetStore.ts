/**
 * The remote target of each device's settings (Task 5.9), shared by the parts
 * that draw it: the frame that reads and sends (RemoteTarget), the settings
 * list in the shell's sidebar ("Configuring Remote: …", each category's Sent /
 * Acknowledged) and settings search. They are not under one provider, so this
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
}

/** Today's passkey status (AdminCommandsTab): `remainingSeconds` counts down locally. */
export interface PasskeyState {
  hasPasskey: boolean;
  remainingSeconds: number | null;
}

/** A category's last Send to node: sent and waiting, then the node's answer. */
export type SendStatus = 'sending' | 'acknowledged' | 'noReply';

export interface RemoteEntry {
  /** The node settings configure; null for this device's own radio. */
  node: RemoteNode | null;
  pickerOpen: boolean;
  passkey: PasskeyState | null;
  /** When each category was last read from the node (ms). */
  lastRead: Record<string, number>;
  sent: Record<string, SendStatus>;
}

const EMPTY: RemoteEntry = { node: null, pickerOpen: false, passkey: null, lastRead: {}, sent: {} };
const entries = new Map<string, RemoteEntry>();
const listeners = new Set<() => void>();

export function remoteEntry(sourceId: string): RemoteEntry {
  return entries.get(sourceId) ?? EMPTY;
}

export function updateRemote(sourceId: string, patch: Partial<RemoteEntry> | ((e: RemoteEntry) => Partial<RemoteEntry>)): void {
  const prev = remoteEntry(sourceId);
  entries.set(sourceId, { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) });
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
