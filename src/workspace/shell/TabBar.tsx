/**
 * The phone tab bar (boards a-chat-D-phone, s1-you): Home, DMs, Activity, You.
 *
 * - Home: the device open in the URL, else the last one opened this session,
 *   else the Overview.
 * - DMs: that device's DMs, as the desktop sidebar's Direct messages link
 *   (Meshtastic family: the Workspace inbox `dms`, Task 2.6; MeshCore and
 *   Reticulum: today's `dms` view). Badge: its DM unread.
 * - Activity: `/source/:id/activity`, the Workspace feed (Task 2.8), on a
 *   Meshtastic-family device the viewer can read messages on. Badge: its
 *   unseen items (`useActivity`).
 * - With no device, DMs and Activity are shown disabled; so is DMs for a
 *   viewer the sidebar would not show Direct messages to, and Activity on a
 *   MeshCore or Reticulum device (their chat is Phase 7) or without read.
 * - A guest (i6, Task 6.7): Home, and today's Login, which opens the sign-in
 *   dialog (Task 6.2); DMs, Activity and You need an account.
 */
import { useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useActivity } from '../activity/useActivity';
import { SignInDialog } from '../auth/SignInCard';
import { canReadMessages, isMeshtasticFamily, useDeviceTab } from './deviceTabs';
import type { WorkspaceSource } from './useWorkspaceSources';
import styles from './TabBar.module.css';

export type PhoneTab = 'home' | 'dms' | 'activity' | 'you';

interface TabBarProps {
  /** The device Home, DMs and Activity lead to; null: none yet. */
  home: WorkspaceSource | null;
  active: PhoneTab;
}

export default function TabBar({ home, active }: TabBarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const base = home && `/source/${encodeURIComponent(home.id)}`;
  // Gated as the desktop sidebar's Direct messages entry (messages:read, type).
  const dms = useDeviceTab(home)('dms');
  const { authStatus, hasPermission } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const guest = authStatus?.authenticated !== true;
  const hasActivity = !guest && !!home && isMeshtasticFamily(home.type) && canReadMessages(hasPermission, home.id);
  const { unseenCount } = useActivity(home?.id, { enabled: hasActivity });
  const tabs: Array<{ key: PhoneTab; to: string | null; icon: UiIconName; badge?: number }> = [
    { key: 'home', to: base ?? '/overview', icon: 'home' },
    ...(guest
      ? []
      : [
          { key: 'dms' as const, to: dms, icon: 'messages' as const, badge: home?.dmUnread },
          { key: 'activity' as const, to: hasActivity ? `${base}/activity` : null, icon: 'notifications' as const, badge: unseenCount },
          { key: 'you' as const, to: '/you', icon: 'user' as const },
        ]),
  ];

  return (
    <nav className={styles.bar} aria-label={t('workspace.tabs.label')}>
      {tabs.map(({ key, to, icon, badge }) => {
        const label = t(`workspace.tabs.${key}`);
        const content = (
          <>
            <span className={styles.icon}>
              <UiIcon name={icon} size={22} />
              {!!badge && (
                <span className={styles.badge} aria-hidden="true">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span>{label}</span>
          </>
        );
        if (!to) {
          return (
            <span key={key} className={styles.tab} role="link" aria-disabled="true">
              {content}
            </span>
          );
        }
        const current = active === key && (key === 'you' || pathname === '/' || matchPath({ path: base ?? '/overview', end: false }, pathname));
        return (
          <Link
            key={key}
            to={to}
            className={`${styles.tab} ${current ? styles.on : ''}`}
            aria-current={current ? 'page' : undefined}
            aria-label={badge ? t('workspace.shell.device_unread', { name: label, count: badge }) : undefined}
          >
            {content}
          </Link>
        );
      })}
      {guest && (
        <>
          <button type="button" className={`${styles.tab} ${styles.tabButton}`} onClick={() => setLoginOpen(true)}>
            <span className={styles.icon}>
              <UiIcon name="user" size={22} />
            </span>
            <span>{t('auth.login')}</span>
          </button>
          <SignInDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
        </>
      )}
    </nav>
  );
}
