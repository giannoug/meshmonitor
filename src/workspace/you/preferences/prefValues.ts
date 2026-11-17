/**
 * The stored forms the Preferences rows read (Task 6.3). An unset key reads
 * as SettingsContext's value, which already applied today's defaults, so a
 * row and the context never disagree before the first write. Also the
 * pages' settings:write gate.
 */
import type { TFunction } from 'i18next';
import { useAuth } from '../../../contexts/AuthContext';
import type { CustomTheme } from '../../../contexts/SettingsContext';

/** Today's gate on `POST /api/settings` (requirePermission settings:write, no source). */
export function useCanWriteSettings(): boolean {
  return useAuth().hasPermission('settings', 'write', { anySource: true });
}

export const text = (fallback: string) => (raw?: string) => raw || fallback;

export const int = (fallback: number) => (raw?: string) => {
  const n = parseInt(raw ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

/** Only '1' / 'true' is on, as SettingsTab reads the MeshCore keys; written as '1' / '0'. */
export const on01 = (fallback: boolean) => ({
  parse: (raw?: string) => (raw === undefined ? fallback : raw === '1' || raw === 'true'),
  serialize: (v: boolean) => (v ? '1' : '0'),
});

/** Anything but '0' / 'false' is on (on by default), as SettingsTab reads link previews and discard-invalid; written as '1' / '0'. */
export const notOff01 = (fallback: boolean) => ({
  parse: (raw?: string) => (raw === undefined ? fallback : !(raw === '0' || raw === 'false')),
  serialize: (v: boolean) => (v ? '1' : '0'),
});

/** As `notOff01`, written as 'true' / 'false' (mapClusteringEnabled, as SettingsContext reads it). */
export const onText = (fallback: boolean) => ({
  parse: notOff01(fallback).parse,
  serialize: (v: boolean) => (v ? 'true' : 'false'),
});

/** SettingsTab's theme list (its optgroups flattened), then the custom themes. */
export function themeOptions(t: TFunction, custom: CustomTheme[]) {
  const builtIn: Array<[string, string]> = [
    ['mocha', 'settings.theme_mocha'],
    ['macchiato', 'settings.theme_macchiato'],
    ['frappe', 'settings.theme_frappe'],
    ['latte', 'settings.theme_latte'],
    ['nord', 'settings.theme_nord'],
    ['dracula', 'settings.theme_dracula'],
    ['solarized-dark', 'settings.theme_solarized_dark'],
    ['solarized-light', 'settings.theme_solarized_light'],
    ['gruvbox-dark', 'settings.theme_gruvbox_dark'],
    ['gruvbox-light', 'settings.theme_gruvbox_light'],
    ['high-contrast-dark', 'settings.theme_hc_dark'],
    ['high-contrast-light', 'settings.theme_hc_light'],
    ['protanopia', 'settings.theme_protanopia'],
    ['deuteranopia', 'settings.theme_deuteranopia'],
    ['tritanopia', 'settings.theme_tritanopia'],
  ];
  return [
    ...builtIn.map(([value, key]) => ({ value, label: t(key) })),
    ...custom.map((c) => ({ value: c.slug, label: c.name })),
  ];
}

/** A theme's swatches: background, surface, text, accent (role keys). */
export function swatchesOf(definition: string): string[] {
  try {
    const d = JSON.parse(definition) as Record<string, string>;
    return [d.bg, d.surface, d.text, d.accent].filter(Boolean);
  } catch {
    return [];
  }
}
