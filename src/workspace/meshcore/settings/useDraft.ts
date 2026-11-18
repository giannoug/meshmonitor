/**
 * A page's draft over values it read (Task 7.4): each field shows the edit
 * when there is one, else the value read; `changed` lists the edited fields
 * that differ; `discard` drops every edit. Nothing here saves.
 */
import { useState } from 'react';

export function useDraft<T extends Record<string, unknown>>(saved: T) {
  const [edits, setEdits] = useState<Partial<T>>({});
  const value = <K extends keyof T>(k: K): T[K] => (k in edits ? (edits[k] as T[K]) : saved[k]);
  const set = <K extends keyof T>(k: K, v: T[K]) => setEdits((e) => ({ ...e, [k]: v }));
  const changed = (Object.keys(edits) as Array<keyof T>).filter((k) => JSON.stringify(edits[k]) !== JSON.stringify(saved[k]));
  const isChanged = (k: keyof T) => changed.includes(k);
  const discard = () => setEdits({});
  /** Drops the edits of `keys` (after they saved). */
  const settle = (keys: Array<keyof T>) =>
    setEdits((e) => {
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  return { value, set, changed, isChanged, discard, settle };
}
