/**
 * Which rooms this browser logged in to, per device, for the signed-in user.
 * Today's Rooms view keeps the same set in its own state; the Workspace keeps
 * it here so the sidebar's room dots and the room page agree. In memory only:
 * a reload forgets it, as leaving today's Rooms view does. Another user (a
 * sign-out, or a different sign-in) never sees it: the set is dropped as soon
 * as the owner changes. Logging in sends; this store never does.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY: ReadonlySet<string> = new Set();
let owner: string | null = null;
let sessions = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const l of listeners) l();
};

/** The store's owner: the signed-in user's id, or null for a guest. */
export function ownerOf(user: { id?: number | string } | null | undefined): string | null {
  return user?.id !== undefined ? String(user.id) : null;
}

/** Drops every room login when the owner changes (sign-out or another user). */
function claim(next: string | null): void {
  if (next === owner) return;
  owner = next;
  sessions = new Map();
}

/** The rooms `who` is logged in to on a device (empty for anyone else). */
export function roomSessionsFor(who: string | null, sourceId: string): ReadonlySet<string> {
  return who === owner ? sessions.get(sourceId) ?? EMPTY : EMPTY;
}

export function setRoomLoggedIn(who: string | null, sourceId: string, roomKey: string, on: boolean): void {
  claim(who);
  const next = new Set(sessions.get(sourceId) ?? EMPTY);
  if (on) next.add(roomKey);
  else next.delete(roomKey);
  sessions.set(sourceId, next);
  notify();
}

/** Called when the signed-in user is known: another owner clears the store. */
export function syncRoomSessionsOwner(who: string | null): void {
  if (who === owner) return;
  claim(who);
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function useRoomSessions(sourceId: string): ReadonlySet<string> {
  const who = ownerOf(useAuth().authStatus?.user);
  useEffect(() => syncRoomSessionsOwner(who), [who]);
  return useSyncExternalStore(subscribe, () => roomSessionsFor(who, sourceId), () => EMPTY);
}
