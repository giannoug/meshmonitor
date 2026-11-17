/**
 * You › Preferences and Help & about (Task 6.3, boards 13-01 … 13-04, 13-14,
 * 13-15, 13-19 … 13-21, 13-29): the install's display settings as the boards
 * draw them, three custom themes, five tapbacks, the news feed and the system
 * status. `prefsFixtures(log)` records every write and read the pages make.
 */
import { athensFixture as A } from './athens';
import type { FixtureHandler } from './fixtureApi';

/** A complete role-keyed theme (REQUIRED_THEME_COLORS), dark or light. */
function themeColors(dark: boolean, accent: string, alt: string) {
  return dark
    ? {
        bg: '#1e1e2e', bgRaised: '#181825', bgSunken: '#11111b',
        surface: '#313244', surfaceHover: '#45475a', surfaceActive: '#585b70', surfaceInactive: '#6c7086',
        text: '#cdd6f4', textMuted: '#bac2de', textSubtle: '#a6adc8', textDisabled: '#7f849c', textFaint: '#6c7086',
        border: '#45475a', borderStrong: '#585b70', borderSubtle: '#313244',
        accent, accentHover: alt, accentAlt: alt, accentMuted: '#45475a', accentText: '#11111b',
        success: '#a6e3a1', error: '#f38ba8', warning: '#f9e2af', caution: '#fab387', info: '#89dceb', danger: '#f38ba8',
      }
    : {
        bg: '#eff1f5', bgRaised: '#e6e9ef', bgSunken: '#dce0e8',
        surface: '#ccd0da', surfaceHover: '#bcc0cc', surfaceActive: '#acb0be', surfaceInactive: '#9ca0b0',
        text: '#4c4f69', textMuted: '#5c5f77', textSubtle: '#6c6f85', textDisabled: '#8c8fa1', textFaint: '#9ca0b0',
        border: '#bcc0cc', borderStrong: '#acb0be', borderSubtle: '#ccd0da',
        accent, accentHover: alt, accentAlt: alt, accentMuted: '#bcc0cc', accentText: '#eff1f5',
        success: '#40a02b', error: '#d20f39', warning: '#df8e1d', caution: '#fe640b', info: '#04a5e5', danger: '#d20f39',
      };
}

export const CUSTOM_THEMES = [
  { id: 1, name: 'Athens Night', slug: 'custom-athens-night', definition: JSON.stringify(themeColors(true, '#89b4fa', '#74c7ec')), is_builtin: 0, created_at: 1, updated_at: 1 },
  { id: 2, name: 'Field high contrast', slug: 'custom-field-high-contrast', definition: JSON.stringify(themeColors(false, '#1e66f5', '#209fb5')), is_builtin: 0, created_at: 2, updated_at: 2 },
  { id: 3, name: 'Mesh green', slug: 'custom-mesh-green', definition: JSON.stringify(themeColors(true, '#a6e3a1', '#94e2d5')), is_builtin: 0, created_at: 3, updated_at: 3 },
];

export const TAPBACKS = [
  { emoji: '👍', title: 'Thumbs up' },
  { emoji: '❤️', title: 'Heart' },
  { emoji: '😂', title: 'Laugh' },
  { emoji: '😮', title: 'Wow' },
  { emoji: '👋', title: 'Wave' },
];

/** The install's display settings as 13-01 / 13-03 / 13-04 draw them. */
export const PREF_SETTINGS: Record<string, string> = {
  ...A.settings,
  appearanceMode: 'dark',
  darkTheme: 'custom-athens-night',
  lightTheme: 'latte',
  mapPinStyle: 'official',
  mapPinColorMode: 'node',
  nodeListStyle: 'monochrome',
  iconStyle: 'lucide',
  preferredSortField: 'lastHeard',
  preferredSortDirection: 'desc',
  preferredDashboardSortOption: 'custom',
  linkPreviewsEnabled: '1',
  mapTilesetDark: 'cartoDarkMatter',
  mapTilesetLight: 'osm',
  positionHistoryLineStyle: 'spline',
  neighborInfoMinZoom: '10',
  mapCenterTargetZoom: '15',
  mapZoomGateThreshold: '13',
  mapClusteringEnabled: 'true',
  discardInvalidPositions: '1',
  customTapbackEmojis: JSON.stringify(TAPBACKS),
};

export const NEWS_FEED = {
  version: '1',
  lastUpdated: '2026-11-10T00:00:00Z',
  items: [
    { id: 'n3', title: 'Server › Embed profiles', content: 'Embed profiles moved to **Server**.', date: '2026-11-10T09:00:00Z', category: 'feature', priority: 'normal' },
    { id: 'n2', title: 'Security fix in 4.15.2', content: 'Upgrade now.', date: '2026-11-06T09:00:00Z', category: 'release', priority: 'important' },
    { id: 'n1', title: 'MeshCore room servers', content: 'Room servers are here.', date: '2026-10-28T09:00:00Z', category: 'feature', priority: 'normal' },
    { id: 'n0', title: 'An older note', content: 'Old.', date: '2026-09-01T09:00:00Z', category: 'maintenance', priority: 'normal' },
  ],
};

export const SYSTEM_STATUS = {
  version: '4.15.2',
  nodeVersion: 'v24.11.0',
  platform: 'linux',
  architecture: 'x64',
  uptime: '6d 4h 12m 3s',
  uptimeSeconds: 533523,
  environment: 'production',
  isDocker: true,
  memoryUsage: { heapUsed: '212 MB', heapTotal: '260 MB', rss: '318 MB' },
  database: { type: 'Sqlite', version: '3.46.1' },
};

export interface PrefsLog {
  /** Each `POST /api/settings` body. */
  settings: Array<Record<string, string>>;
  mapPrefs: Array<Record<string, string>>;
  themes: Array<{ method: string; path: string; body?: unknown }>;
  /** Paths read, in order. */
  reads: string[];
}

export const newPrefsLog = (): PrefsLog => ({ settings: [], mapPrefs: [], themes: [], reads: [] });

export function prefsFixtures(log: PrefsLog = newPrefsLog(), settings: Record<string, string> = PREF_SETTINGS): Record<string, FixtureHandler> {
  const body = (init?: RequestInit) => (init?.body ? JSON.parse(String(init.body)) : undefined);
  const read = (path: string, reply: unknown): FixtureHandler => () => {
    log.reads.push(path);
    return typeof reply === 'function' ? reply() : reply;
  };
  // A deleted theme leaves the list, as on the server.
  let themes = [...CUSTOM_THEMES];
  return {
    'GET /api/settings': read('/api/settings', settings),
    'POST /api/settings': (_u, init) => {
      log.settings.push(body(init));
      return { success: true };
    },
    'POST /api/user/map-preferences': (_u, init) => {
      log.mapPrefs.push(body(init));
      return { success: true };
    },
    'GET /api/themes': read('/api/themes', () => ({ themes })),
    'POST /api/themes': (u, init) => {
      log.themes.push({ method: 'POST', path: u.pathname, body: body(init) });
      return { success: true };
    },
    'PUT /api/themes/:slug': (u, init) => {
      log.themes.push({ method: 'PUT', path: u.pathname, body: body(init) });
      return { success: true };
    },
    'DELETE /api/themes/:slug': (u) => {
      log.themes.push({ method: 'DELETE', path: u.pathname });
      themes = themes.filter((th) => u.pathname !== `/api/themes/${th.slug}`);
      return { success: true };
    },
    'GET /api/news': read('/api/news', NEWS_FEED),
    'GET /api/news/user/status': read('/api/news/user/status', { lastSeenNewsId: 'n1', dismissedNewsIds: ['n2'] }),
    'GET /api/system/status': read('/api/system/status', SYSTEM_STATUS),
  };
}
