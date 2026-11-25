/**
 * Workspace URL rules (spec §5.5): the redirects from Classic URLs, and, while
 * pages are re-hosted (phase 1), which Classic location or view a Workspace URL
 * shows. Pure, so the whole table is testable without rendering. Paths are
 * router-relative (basename already stripped).
 */
import { MESHCORE_VIEWS, type MeshCoreView } from '../components/MeshCore/meshCoreViewAccess';
import type { ReticulumView } from '../types/reticulum';
import { classicFallback } from './layout/classicFallback';
import { SECTION_TO_CATEGORY } from './settings/categories';
import { MESHCORE_SECTION_TO_CATEGORY } from './meshcore/settings/meshcoreSearch';

type Loc = { pathname: string; hash: string; search: string };

/** `/settings#settings-<x>` categories that are per-user preferences; the rest are Server categories. */
export const PREFERENCE_CATEGORIES = ['language', 'units', 'sorting', 'appearance', 'link-previews', 'map'];

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

/**
 * The location the re-hosted Meshtastic `App` sees for a Workspace source URL
 * (App picks its tab from the last path segment): Workspace-only paths go
 * where `classicFallback` sends Classic users. Device settings, the remote
 * target (`?node=`) included, are the Workspace's own (Tasks 5.2, 5.9).
 */
export function classicSourceLocation(loc: Loc): { pathname: string; hash: string } {
  const [pathname, hash] = (classicFallback(loc.pathname) ?? loc.pathname).split('#');
  return { pathname, hash: hash ? `#${hash}` : loc.hash };
}

const MESHCORE_ALIASES: Record<string, MeshCoreView> = { channel: 'channels', dm: 'dms', room: 'rooms', node: 'nodes', map: 'nodes' };

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

/**
 * A MeshCore device's settings (Tasks 7.3, 7.4), the part of a source URL
 * after `/source/:id/`: this radio's pages and a remote target's, all in the
 * Workspace settings frame.
 */
export const MESHCORE_SETTINGS = /^settings(\/|$)/;

/**
 * Where today's MeshCore settings URLs live now (Task 7.4), or null: the
 * Device Configuration view (`configuration`, each `#<section>` to the page
 * that holds it) and the source form's `#configuration` deep link.
 */
export function meshcoreSettingsRedirect(base: string, splat: string, hash: string): string | null {
  if (splat === '' && hash === '#configuration') return `${base}/settings`;
  if (!/^configuration\/?$/.test(splat)) return null;
  const page = MESHCORE_SECTION_TO_CATEGORY[sectionOf(hash)];
  return page ? `${base}/settings/${page}` : `${base}/settings`;
}

/** Destinations: the Reticulum page's default view. */
export const RETICULUM_DEFAULT_VIEW: ReticulumView = 'destinations';

/** Today's Reticulum views that are native screens now (Task 7.6), plus the Dashboard, by URL segment. */
const RNS_SCREENS = ['destinations', 'interfaces', 'paths', 'map', 'dashboard', 'dms', 'info'] as const;

/** A Reticulum device's settings (Task 7.6), the part of a source URL after `/source/:id/`. */
export const RETICULUM_SETTINGS = /^settings(\/|$)/;

/** Today's Configuration view, which the settings frame holds now (Task 7.6). */
export const RETICULUM_CONFIGURATION = /^configuration\/?$/;

export type ReticulumScreenRoute =
  | { kind: 'home' }
  | { kind: (typeof RNS_SCREENS)[number] }
  | { kind: 'dm'; peer: string };

/**
 * The native Reticulum screen a source URL asks for (Task 7.6), and the view
 * segment the URL should become when it names none or one Reticulum has no
 * view for: the bare URL is the phone's Home and, on desktop, today's default
 * view (Destinations); `dm/<peer>` is that conversation, and a bare `dm` today's
 * Messages view.
 */
export function reticulumScreenForPath(splat: string, isPhone: boolean): { screen: ReticulumScreenRoute; fix: string | null } {
  const parts = splat.split('/').filter(Boolean);
  if (parts.length === 0) return isPhone ? { screen: { kind: 'home' }, fix: null } : { screen: { kind: RETICULUM_DEFAULT_VIEW as 'destinations' }, fix: RETICULUM_DEFAULT_VIEW };
  if (parts[0] === 'dm') {
    if (!parts[1]) return { screen: { kind: 'dms' }, fix: null };
    try {
      return { screen: { kind: 'dm', peer: decodeURIComponent(parts[1]) }, fix: null };
    } catch {
      // A malformed %-escape names no peer: today's Messages view.
      return { screen: { kind: 'dms' }, fix: 'dms' };
    }
  }
  const view = (RNS_SCREENS as readonly string[]).find((v) => v === parts[0]);
  return view ? { screen: { kind: view as (typeof RNS_SCREENS)[number] }, fix: null } : { screen: { kind: 'destinations' }, fix: RETICULUM_DEFAULT_VIEW };
}
