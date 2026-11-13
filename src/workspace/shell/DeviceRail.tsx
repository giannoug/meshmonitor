/**
 * The far-left device strip of layout D (board a-chat-D-desktop, note asD):
 * Overview, one square per device with its unread badge, Add device and
 * Global Settings for admins, and the viewer's account (or Login).
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import LoginModal from '../../components/LoginModal';
import { UiIcon } from '../../components/icons';
import { globalSettingsNav } from '../../components/nav/sourceNavEntries';
import { abbrevOf, type WorkspaceSource } from './useWorkspaceSources';
import styles from './DeviceRail.module.css';

interface DeviceRailProps {
  sources: WorkspaceSource[];
  openId: string | null;
  overviewActive: boolean;
  /** The drawer button, at 768–1023 px. */
  drawerToggle?: ReactNode;
}

const cx = (...names: Array<string | false>) => names.filter(Boolean).join(' ');

export default function DeviceRail({ sources, openId, overviewActive, drawerToggle }: DeviceRailProps) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const user = authStatus?.authenticated ? authStatus.user : null;
  const isAdmin = user?.isAdmin === true;
  const settingsNav = globalSettingsNav(t);

  return (
    <nav className={styles.rail} aria-label={t('workspace.shell.devices')} data-scroll="y">
      {drawerToggle}
      <NavLink
        to="/overview"
        className={cx(styles.square, styles.plain, overviewActive && styles.on)}
        aria-label={t('workspace.shell.overview_label')}
        aria-current={overviewActive ? 'page' : undefined}
        title={t('workspace.shell.overview')}
      >
        <UiIcon name="dashboard" size={20} />
      </NavLink>
      <span className={styles.rule} aria-hidden="true" />

      {sources
        .filter((s) => s.status !== 'disabled')
        .map((s) => {
          const on = s.id === openId;
          return (
            <NavLink
              key={s.id}
              to={`/source/${encodeURIComponent(s.id)}`}
              className={cx(styles.square, on && styles.on)}
              style={{ background: s.colorToken }}
              data-status={s.status}
              aria-current={on ? 'page' : undefined}
              aria-label={s.unread > 0 ? t('workspace.shell.device_unread', { name: s.name, count: s.unread }) : s.name}
              title={s.name}
            >
              {s.abbrev}
              {s.unread > 0 && (
                <span className={styles.badge} aria-hidden="true">
                  {s.unread > 99 ? '99+' : s.unread}
                </span>
              )}
            </NavLink>
          );
        })}

      {isAdmin && (
        <NavLink
          to="/server/devices?add=1"
          className={cx(styles.square, styles.plain)}
          aria-label={t('workspace.shell.add_device')}
          title={t('workspace.shell.add_device')}
        >
          <UiIcon name="plus" size={18} />
        </NavLink>
      )}

      <span className={styles.spacer} />

      {isAdmin && (
        <NavLink
          to="/server/general"
          className={cx(styles.square, styles.ghost)}
          aria-label={settingsNav.label}
          title={settingsNav.label}
        >
          <UiIcon name={settingsNav.icon} size={20} />
        </NavLink>
      )}
      {user ? (
        <NavLink
          to="/you"
          className={cx(styles.square, styles.avatar)}
          aria-label={t('workspace.shell.your_account')}
          title={user.displayName || user.username}
        >
          {abbrevOf(user.displayName || user.username)}
        </NavLink>
      ) : (
        <>
          <button type="button" className={cx(styles.square, styles.ghost)} onClick={() => setLoginOpen(true)} title={t('auth.login')}>
            <UiIcon name="user" size={20} />
            <span className={styles.srOnly}>{t('auth.login')}</span>
          </button>
          {/* Portaled: the rail is a fixed stacking context (z-index 20), which would cap the dialog's own z-index. */}
          {createPortal(<LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />, document.body)}
        </>
      )}
    </nav>
  );
}

