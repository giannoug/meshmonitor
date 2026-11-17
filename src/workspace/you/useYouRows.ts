/**
 * The You rows (ds15), shared by the phone/landing list (YouHome, s1-you,
 * b-set-p5-you) and the desktop You sidebar (YouSidebar, r1/r2):
 *
 * - Account: Sign-in & security (local accounts, as the user menu's Two-Factor
 *   and Passkeys) and API Token.
 * - Preferences: Layout (signed in), then the Preferences pages (Task 6.3):
 *   Language & units (today's Language, Units & Formats, Sorting and Link
 *   Previews), Appearance, Map, and today's MeshCore Messaging. Today's
 *   global Settings lists them to everyone, so guests get them too.
 * - Notifications (while some device has a Notifications page), Global
 *   Settings (admins), Help & about (everyone).
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { UiIconName } from '../../components/icons';
import { globalSettingsNav } from '../../components/nav/sourceNavEntries';
import { logger } from '../../utils/logger';
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

export function useYouRows() {
  const { t } = useTranslation();
  const { authStatus, logout } = useAuth();
  const { sources } = useShellDevices();

  const user = authStatus?.authenticated ? authStatus.user : null;
  const isAdmin = user?.isAdmin === true;
  const notifications = sources.some((s) => s.status !== 'disabled' && hasNotifications(s));

  const account: YouRow[] = user
    ? [
        ...(user.authProvider === 'local'
          ? [{ key: 'security', icon: 'security' as const, tone: 'account' as const, label: t('workspace.you.sign_in_security'), to: '/you/security' }]
          : []),
        { key: 'token', icon: 'key', tone: 'account', label: t('user_menu.api_token'), to: '/you/token' },
      ]
    : [];

  // The categories show to guests too, as DeviceSidebar's list did; Layout is per user.
  const prefs: YouRow[] = [
    ...(user ? [{ key: 'layout', icon: 'monitor' as const, tone: 'prefs' as const, label: t('workspace.you.layout'), to: '/you/layout' }] : []),
    { key: 'language', icon: 'languages', tone: 'prefs', label: t('workspace.you.language_units'), to: '/preferences/language' },
    { key: 'appearance', icon: 'sun', tone: 'prefs', label: t('settings.appearance'), to: '/preferences/appearance' },
    { key: 'map', icon: 'map', tone: 'prefs', label: t('settings.map'), to: '/preferences/map' },
    { key: 'meshcore-messaging', icon: 'messages', tone: 'prefs', label: t('settings.meshcore_messaging', 'MeshCore Messaging'), to: '/preferences/meshcore-messaging' },
  ];

  const more: YouRow[] = [
    ...(user && notifications ? [{ key: 'notifications', icon: 'notifications' as const, tone: 'notify' as const, label: t('nav.notifications'), to: '/you/notifications' }] : []),
    ...(isAdmin ? [{ key: 'server', icon: 'server' as const, tone: 'server' as const, label: globalSettingsNav(t).label, to: '/server/general' }] : []),
  ];
  const helpRow: YouRow = { key: 'help', icon: 'help', tone: 'plain', label: t('workspace.you.help_about'), to: '/you/help' };

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  return { user, account, prefs, more, helpRow, signOut };
}
