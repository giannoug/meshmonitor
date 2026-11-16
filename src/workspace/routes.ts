/**
 * Workspace URL rules (spec §5.5): the redirects from Classic URLs, and, while
 * pages are re-hosted (phase 1), which Classic location or view a Workspace URL
 * shows. Pure, so the whole table is testable without rendering. Paths are
 * router-relative (basename already stripped).
 */
import { GLOBAL_SETTINGS_SECTIONS } from '../components/search/configSections';
import { MESHCORE_VIEWS, type MeshCoreView } from '../components/MeshCore/meshCoreViewAccess';
import { RETICULUM_VIEWS, type ReticulumView } from '../types/reticulum';
import { classicFallback } from './layout/classicFallback';
import { SECTION_TO_CATEGORY } from './settings/categories';

type Loc = { pathname: string; hash: string; search: string };

/** `/settings#settings-<x>` categories that are per-user preferences; the rest are Server categories. */
export const PREFERENCE_CATEGORIES = ['language', 'units', 'sorting', 'appearance', 'link-previews', 'map', 'meshcore-messaging'];

const RETIRED_SOURCE_TAB = /^\/source\/([^/]+)\/(configuration|settings|admin|notifications)\/?$/;

/** The `#section` id; '' when absent or malformed (a bad escape must not throw on every render). */
function sectionOf(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

/** Where a Classic URL lives in the Workspace, or null when the Workspace serves it as is. */
export function workspaceRedirect(loc: Loc, { isAdmin = false }: { isAdmin?: boolean } = {}): string | null {
  const m = loc.pathname.match(RETIRED_SOURCE_TAB);
  if (m) {
    const section = sectionOf(loc.hash);
    const settings = `/source/${m[1]}/settings`;
    switch (m[2]) {
      case 'configuration':
      case 'settings': {
        // Each of today's sections has one category (settings/categories.ts).
        const category = SECTION_TO_CATEGORY[section];
        if (category) return `${settings}/${category}`;
        return m[2] === 'configuration' ? settings : null;
      }
      case 'admin':
        return `${settings}?node=`;
      default:
        return `${settings}/notifications`;
    }
  }
  if (/^\/settings\/?$/.test(loc.pathname)) {
    const section = sectionOf(loc.hash);
    if (!section.startsWith('settings-')) return isAdmin ? '/server/general' : '/preferences/appearance';
    const category = section.slice('settings-'.length);
    return PREFERENCE_CATEGORIES.includes(category) ? `/preferences/${category}` : `/server/${category}`;
  }
  return null;
}

/** The `#settings-<x>` section a `/preferences/<x>` or `/server/<x>` URL scrolls to, or '' for none. */
export function globalSettingsHash(category: string): string {
  return GLOBAL_SETTINGS_SECTIONS.has(`settings-${category}`) ? `#settings-${category}` : '';
}

/**
 * The location the re-hosted Meshtastic `App` sees for a Workspace source URL
 * (App picks its tab from the last path segment): Workspace-only paths go
 * where `classicFallback` sends Classic users. Device settings, the remote
 * target (`?node=`) included, are the Workspace's own (Tasks 5.2, 5.9).
 */
export function classicSourceLocation(loc: Loc): { pathname: string; hash: string } {
  return { pathname: classicFallback(loc.pathname) ?? loc.pathname, hash: loc.hash };
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

/** Destinations: the Reticulum page's default view. */
export const RETICULUM_DEFAULT_VIEW: ReticulumView = 'destinations';

/** The Reticulum view a source URL asks for, or null for a segment Reticulum has no view for. */
export function reticulumViewForPath(splat: string): ReticulumView | null {
  const segment = splat.split('/')[0];
  if (!segment) return RETICULUM_DEFAULT_VIEW;
  if (segment === 'dm') return 'dms';
  return (RETICULUM_VIEWS as readonly string[]).includes(segment) ? (segment as ReticulumView) : null;
}
