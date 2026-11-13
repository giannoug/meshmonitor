/**
 * Workspace URL rules (spec §5.5): the redirects from Classic URLs, and, while
 * pages are re-hosted (phase 1), which Classic location or view a Workspace URL
 * shows. Pure, so the whole table is testable without rendering. Paths are
 * router-relative (basename already stripped).
 */
import type { TFunction } from 'i18next';
import {
  configurationNavItems,
  GLOBAL_SETTINGS_SECTIONS,
  hasDeviceConfigurationPage,
  SOURCE_SETTINGS_SECTIONS,
} from '../components/search/configSections';
import { MESHCORE_VIEWS, type MeshCoreView } from '../components/MeshCore/meshCoreViewAccess';
import type { ReticulumView } from '../types/reticulum';
import { classicFallback } from './layout/classicFallback';

type Loc = { pathname: string; hash: string; search: string };

/** `/settings#settings-<x>` categories that are per-user preferences; the rest are Server categories. */
export const PREFERENCE_CATEGORIES = ['language', 'units', 'sorting', 'appearance', 'link-previews', 'map', 'meshcore-messaging'];

const RETIRED_SOURCE_TAB = /^\/source\/([^/]+)\/(configuration|settings|admin|notifications)\/?$/;

/** Where a Classic URL lives in the Workspace, or null when the Workspace serves it as is. */
export function workspaceRedirect(loc: Loc, { isAdmin = false }: { isAdmin?: boolean } = {}): string | null {
  const section = decodeURIComponent(loc.hash.replace(/^#/, ''));
  const m = loc.pathname.match(RETIRED_SOURCE_TAB);
  if (m) {
    const settings = `/source/${m[1]}/settings`;
    switch (m[2]) {
      case 'configuration':
        return section.startsWith('config-') ? `${settings}/${section.slice('config-'.length)}` : settings;
      case 'settings':
        return section.startsWith('settings-') ? `${settings}/${section.slice('settings-'.length)}` : null;
      case 'admin':
        return `${settings}?node=`;
      default:
        return `${settings}/notifications`;
    }
  }
  if (/^\/settings\/?$/.test(loc.pathname)) {
    if (!section.startsWith('settings-')) return isAdmin ? '/server/general' : '/preferences/appearance';
    const category = section.slice('settings-'.length);
    return PREFERENCE_CATEGORIES.includes(category) ? `/preferences/${category}` : `/server/${category}`;
  }
  return null;
}

// Only the ids are read, so the labels need no translation.
const CONFIG_SECTIONS = new Set(
  configurationNavItems(((key: string) => key) as unknown as TFunction, { showFirmware: true }).map((i) => i.id),
);

/** The `#settings-<x>` section a `/preferences/<x>` or `/server/<x>` URL scrolls to, or '' for none. */
export function globalSettingsHash(category: string): string {
  return GLOBAL_SETTINGS_SECTIONS.has(`settings-${category}`) ? `#settings-${category}` : '';
}

/**
 * The location the re-hosted Meshtastic `App` sees for a Workspace source URL
 * (App picks its tab from the last path segment). `/settings[/<category>]`
 * goes to the Classic tab that holds the category, with its `#section`; other
 * Workspace-only paths go where `classicFallback` sends Classic users.
 *
 * shortcut: a category id both tabs use (telemetry, danger) opens the
 * Configuration one; Phase 5 replaces this with the Workspace settings frame.
 */
export function classicSourceLocation(loc: Loc, sourceType: string | null | undefined): { pathname: string; hash: string } {
  const m = loc.pathname.match(/^\/source\/([^/]+)\/settings(?:\/([^/]+))?/);
  if (!m) return { pathname: classicFallback(loc.pathname) ?? loc.pathname, hash: loc.hash };
  const base = `/source/${m[1]}`;
  const category = m[2];
  const device = hasDeviceConfigurationPage(sourceType);
  if (new URLSearchParams(loc.search).has('node')) return { pathname: `${base}/admin`, hash: '' };
  if (category === 'notifications') return { pathname: `${base}/notifications`, hash: '' };
  if (device && CONFIG_SECTIONS.has(`config-${category}`)) {
    return { pathname: `${base}/configuration`, hash: `#config-${category}` };
  }
  if (SOURCE_SETTINGS_SECTIONS.has(`settings-${category}`)) {
    return { pathname: `${base}/settings`, hash: `#settings-${category}` };
  }
  return { pathname: device ? `${base}/configuration` : `${base}/settings`, hash: '' };
}

const MESHCORE_ALIASES: Record<string, MeshCoreView> = { channel: 'channels', dm: 'dms', room: 'rooms', node: 'nodes' };

/**
 * The MeshCore view a source URL asks for (`splat` is the path after
 * `/source/:id/`), or null for a segment MeshCore has no view for. A bare
 * source URL with `#configuration` (the source form's link, #5831) asks for
 * Configuration.
 */
export function meshcoreViewForPath(splat: string, hash: string): MeshCoreView | null {
  const segment = splat.split('/')[0];
  if (!segment) return hash === '#configuration' ? 'configuration' : 'nodes';
  if ((MESHCORE_VIEWS as readonly string[]).includes(segment)) return segment as MeshCoreView;
  return MESHCORE_ALIASES[segment] ?? null;
}

const RETICULUM_VIEWS: readonly ReticulumView[] = ['destinations', 'interfaces', 'map', 'dms', 'info', 'configuration', 'settings', 'paths'];

/** The Reticulum view a source URL asks for; anything else shows Destinations, the page's default. */
export function reticulumViewForPath(splat: string): ReticulumView {
  const segment = splat.split('/')[0];
  if (segment === 'dm') return 'dms';
  return (RETICULUM_VIEWS as readonly string[]).includes(segment) ? (segment as ReticulumView) : 'destinations';
}
