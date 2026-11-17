/**
 * What the settings frame shares with its pages besides the config (Task 5.5):
 *
 * - The one save dock (D9c): a page that brings its own dock (Channels'
 *   reorder mode, a channel's edit page) claims it, and the radio save bar
 *   yields while any claim is held.
 * - A page's own unsaved edits (a channel's draft), which the leave guard
 *   lists and asks about before a link leaves `scope`.
 */
import { createContext, useContext, useEffect, useRef } from 'react';

export interface PendingEdit {
  /** The router path the edits belong to: a link inside it never asks. */
  scope: string;
  /** "Slot 1 · Athens". */
  title: string;
  /** Today's label of each changed value. */
  changes: string[];
  /** Said instead of a count and the field list (a new channel has no "before"). */
  note?: string;
  discard(): void;
}

export interface SettingsDock {
  claim(): () => void;
  setPending(edit: PendingEdit | null): void;
}

export const SettingsDockContext = createContext<SettingsDock | null>(null);

/** Holds the dock while `active`, so the radio save bar yields. */
export function useClaimDock(active: boolean): void {
  const dock = useContext(SettingsDockContext);
  useEffect(() => (active && dock ? dock.claim() : undefined), [active, dock]);
}

/** Reports this page's unsaved edits to the leave guard while it is mounted. */
export function usePendingEdit(edit: PendingEdit | null): void {
  const dock = useContext(SettingsDockContext);
  const latest = useRef(edit);
  latest.current = edit;
  const key = edit ? JSON.stringify([edit.scope, edit.title, edit.changes, edit.note]) : '';
  useEffect(() => {
    if (!dock || !key) return;
    const e = latest.current!;
    dock.setPending({ ...e, discard: () => latest.current?.discard() });
    return () => dock.setPending(null);
  }, [dock, key]);
}

/** A category's deeper page names itself in the page header: "Channels ›" over "Slot 1 · Athens". */
export interface SubHeader {
  title?: string;
  /** The phone bar's title, when shorter than `title`. */
  phoneTitle?: string;
  /** The page above: the desktop crumb and the phone bar's Back. */
  back?: { to: string; label: string };
  /** Words after the scope line's "On the radio". */
  scope?: string;
}

export const SettingsHeaderContext = createContext<(header: SubHeader | null) => void>(() => {});

/** Sets the page header while the calling page is mounted. */
export function useSettingsHeader(header: SubHeader | null): void {
  const set = useContext(SettingsHeaderContext);
  const key = header ? JSON.stringify(header) : '';
  useEffect(() => {
    if (!key) return;
    set(JSON.parse(key) as SubHeader);
    return () => set(null);
  }, [set, key]);
}

/**
 * Where a page puts its own header actions (a MeshCore remote target's Read
 * again / Import / Export, Log out / Forget, Task 7.3): CategoryPage draws the
 * slot only for those pages, and a page portals into it.
 */
export const SettingsHeaderSlotContext = createContext<HTMLElement | null>(null);
