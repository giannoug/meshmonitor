/**
 * Which rooms this browser logged in to, per device. Today's Rooms view keeps
 * the same set in its own state; the Workspace keeps it here so the sidebar's
 * room dots and the room page agree. In memory only: a reload forgets it, as
 * leaving today's Rooms view does. Logging in sends; this store never does.
 */
import { useSyncExternalStore } from 'react';

const sessions = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

export function setRoomLoggedIn(sourceId: string, roomKey: string, on: boolean): void {
  const next = new Set(sessions.get(sourceId) ?? EMPTY);
  if (on) next.add(roomKey);
  else next.delete(roomKey);
  sessions.set(sourceId, next);
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function useRoomSessions(sourceId: string): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => sessions.get(sourceId) ?? EMPTY, () => EMPTY);
}
