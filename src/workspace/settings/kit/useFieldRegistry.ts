/**
 * The settings fields on screen, for settings search (Task 5.4, ⌘,): each
 * SettingRow registers `{ id, label, keywords, categoryId }` while mounted.
 * Kept in memory only; categories that are not mounted are listed from
 * `categoryIndex()` (categories.ts).
 *
 * Also the category a row sits in: CategoryPage provides its id and whether
 * the viewer may only look (`readOnly`), which every kit control honours.
 */
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

export interface FieldEntry {
  id: string;
  label: string;
  keywords: string[];
  categoryId: string;
}

export const SettingsCategoryContext = createContext<{ categoryId: string; readOnly: boolean } | null>(null);

export const useSettingsCategory = () => useContext(SettingsCategoryContext);

export const SettingRowContext = createContext<{ inputId: string; label: string; helpId?: string } | null>(null);

/** The row a control sits in: the id its label points at, and the label (for a phone sheet's title). */
export const useSettingRow = () => useContext(SettingRowContext);

let fields: FieldEntry[] = [];
const listeners = new Set<() => void>();

function publish(next: FieldEntry[]) {
  fields = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every registered field, in mount order. */
export function useFieldRegistry(): FieldEntry[] {
  return useSyncExternalStore(subscribe, () => fields, () => fields);
}

/** Registers `entry` while the calling component is mounted. */
export function useRegisterField(entry: FieldEntry): void {
  const { id, label, categoryId } = entry;
  const keywords = entry.keywords.join('\u0000');
  useEffect(() => {
    const mine: FieldEntry = { id, label, categoryId, keywords: keywords ? keywords.split('\u0000') : [] };
    publish([...fields, mine]);
    return () => publish(fields.filter((f) => f !== mine));
  }, [id, label, categoryId, keywords]);
}

/** A control's readOnly: its own prop, else its category's. */
export function useReadOnly(readOnly?: boolean): boolean {
  const category = useContext(SettingsCategoryContext);
  return readOnly ?? category?.readOnly ?? false;
}
