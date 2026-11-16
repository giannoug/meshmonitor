/**
 * The You rows (ds15), shared by the phone/landing list (YouHome, s1-you,
 * b-set-p5-you) and the desktop You sidebar (YouSidebar, r1/r2):
 *
 * - Account: Sign-in & security (local accounts, as the user menu's Two-Factor
 *   and Passkeys) and API Token.
 * - Preferences: Layout, then today's preference categories of global
 *   Settings with today's labels and gates (`settingsNavItems`).
 * - Notifications (while some device has a Notifications page), Global
 *   Settings (admins), Help & about.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { UiIconName } from '../../components/icons';
import { globalSettingsNav } from '../../components/nav/sourceNavEntries';
import { settingsNavItems } from '../../components/search/configSections';
import { logger } from '../../utils/logger';
import { PREFERENCE_CATEGORIES } from '../routes';
import { familyOf } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';

export type Tone = 'account' | 'prefs' | 'notify' | 'server' | 'plain';

export interface YouRow {
  key: string;
  icon: UiIconName;
  tone: Tone;
  label: string;
  to?: string;
  onClick?: () => void;
  value?: string;
}

/** Whether the device has a Notifications page (Meshtastic and MeshCore; not Reticulum). */
const hasNotifications = (s: WorkspaceSource) => s.type === 'meshcore' || familyOf(s.type) === 'meshtastic';

const PREF_ICONS: Record<string, UiIconName> = {
  language: 'languages',
  units: 'ruler',
  sorting: 'sortAscending',
  appearance: 'sun',
  'link-previews': 'link',
  'meshcore-messaging': 'messages',
  map: 'map',
};

export function useYouRows() {
  const { t } = useTranslation();
  const { authStatus, logout, hasPermission } = useAuth();
  const { sources, home } = useShellDevices();

  const user = authStatus?.authenticated ? authStatus.user : null;
  const isAdmin = user?.isAdmin === true;
  const device = home ?? sources.find((s) => s.status !== 'disabled') ?? null;
  const notifications = sources.some((s) => s.status !== 'disabled' && hasNotifications(s));
  const help = device && device.type !== 'meshcore_mqtt' ? `/source/${encodeURIComponent(device.id)}/info` : null;

  const account: YouRow[] = user
    ? [
        ...(user.authProvider === 'local'
          ? [{ key: 'security', icon: 'security' as const, tone: 'account' as const, label: t('workspace.you.sign_in_security'), to: '/you/security' }]
          : []),
        { key: 'token', icon: 'key', tone: 'account', label: t('user_menu.api_token'), to: '/you/token' },
      ]
    : [];

  const prefs: YouRow[] = user
    ? [
        { key: 'layout', icon: 'monitor', tone: 'prefs', label: t('workspace.you.layout'), to: '/you/layout' },
        ...settingsNavItems(t, { mode: 'global', isAdmin, canWriteSettings: hasPermission('settings', 'write', { anySource: true }) })
          .map((item) => ({ cat: item.id.slice('settings-'.length), label: item.label }))
          .filter(({ cat }) => PREFERENCE_CATEGORIES.includes(cat))
          .map(({ cat, label }) => ({ key: cat, icon: PREF_ICONS[cat] ?? 'settings', tone: 'prefs' as const, label, to: `/preferences/${cat}` })),
      ]
    : [];

  const more: YouRow[] = [
    ...(user && notifications ? [{ key: 'notifications', icon: 'notifications' as const, tone: 'notify' as const, label: t('nav.notifications'), to: '/you/notifications' }] : []),
    ...(isAdmin ? [{ key: 'server', icon: 'server' as const, tone: 'server' as const, label: globalSettingsNav(t).label, to: '/server/general' }] : []),
  ];
  const helpRow: YouRow | null = help === null ? null : { key: 'help', icon: 'help', tone: 'plain', label: t('workspace.you.help_about'), to: help };

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  return { user, account, prefs, more, helpRow, signOut };
}
