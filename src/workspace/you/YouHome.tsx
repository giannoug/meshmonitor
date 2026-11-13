/**
 * You (board s1-you, note ds15), frame: the account head and the You rows.
 * Until Phase 6 rebuilds them, each row leads to today's page or dialog:
 *
 * - Sign-in & security: today's Change Password, Two-Factor Auth and Passkeys
 *   in one sheet (local accounts only, as in the user menu).
 * - API Token: today's token panel in a sheet.
 * - Layout: `/you/layout` (Task 1.8). Language & units, Appearance, Map: the
 *   preference categories.
 * - Notifications and Help & about: the per-device Notifications page and Info
 *   tab of the device Home leads to, else of the first device.
 * - Global Settings (admins), Logout. A guest gets Login instead of the
 *   account rows.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { version } from '../../../package.json';
import { useAuth } from '../../contexts/AuthContext';
import APITokenManagement from '../../components/APITokenManagement';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import LoginModal from '../../components/LoginModal';
import MFAManagement from '../../components/MFAManagement';
import PasskeyManagement from '../../components/PasskeyManagement';
import { UiIcon, type UiIconName } from '../../components/icons';
import { globalSettingsNav } from '../../components/nav/sourceNavEntries';
import { logger } from '../../utils/logger';
import Sheet from '../patterns/Sheet';
import TwoLineRow from '../patterns/TwoLineRow';
import { familyOf } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import { abbrevOf, type WorkspaceSource } from '../shell/useWorkspaceSources';
import styles from './YouHome.module.css';

type Tone = 'account' | 'prefs' | 'notify' | 'server' | 'plain';

interface Row {
  key: string;
  icon: UiIconName;
  tone: Tone;
  label: string;
  to?: string;
  onClick?: () => void;
  value?: string;
}

/** Today's per-device Notifications page, or null where the type has none. */
function notificationsPath(s: WorkspaceSource): string | null {
  const base = `/source/${encodeURIComponent(s.id)}`;
  if (s.type === 'meshcore') return `${base}/notifications`;
  return familyOf(s.type) === 'meshtastic' ? `${base}/settings/notifications` : null;
}

export default function YouHome() {
  const { t } = useTranslation();
  const { authStatus, logout } = useAuth();
  const { sources, home } = useShellDevices();
  const [sheet, setSheet] = useState<'security' | 'token' | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const user = authStatus?.authenticated ? authStatus.user : null;
  const isLocal = user?.authProvider === 'local';
  // As the user menu: a passkey-only or locked account has no password to change (#5841).
  const canChangePassword = isLocal && !user?.passwordLocked && !user?.passwordLoginDisabled;
  const device = home ?? sources.find((s) => s.status !== 'disabled') ?? null;
  const notifications = device ? notificationsPath(device) : null;
  const help = device && device.type !== 'meshcore_mqtt' ? `/source/${encodeURIComponent(device.id)}/info` : null;

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const group = (rows: Array<Row | false | null>, title?: string) => {
    const shown = rows.filter((r): r is Row => !!r);
    if (shown.length === 0) return null;
    return (
      <section className={styles.group}>
        {title && <h2 className={styles.groupTitle}>{title}</h2>}
        <div className={styles.card}>
          {shown.map((r) => (
            <TwoLineRow
              key={r.key}
              data-testid="you-row"
              to={r.to}
              onClick={r.onClick}
              leading={
                <span className={styles.icon} data-tone={r.tone}>
                  <UiIcon name={r.icon} size={20} />
                </span>
              }
              title={r.label}
              trailing={
                r.key === 'logout' || r.key === 'login' ? undefined : (
                  <>
                    {r.value}
                    <UiIcon name="chevronRight" size={18} />
                  </>
                )
              }
            />
          ))}
        </div>
      </section>
    );
  };

  const helpRow: Row | null = help === null ? null : { key: 'help', icon: 'help', tone: 'plain', label: t('workspace.you.help_about'), to: help, value: version };

  let body: ReactNode;
  if (!user) {
    body = (
      <>
        {group([{ key: 'login', icon: 'user', tone: 'account', label: t('auth.login'), onClick: () => setLoginOpen(true) }])}
        {group([helpRow])}
        {createPortal(<LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />, document.body)}
      </>
    );
  } else {
    const name = user.displayName || user.username;
    const provider = user.authProvider === 'oidc' ? t('user_menu.oidc_account') : t('user_menu.local_account');
    const settingsNav = globalSettingsNav(t);
    body = (
      <>
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">{abbrevOf(name)}</span>
          <span className={styles.who}>
            <span className={styles.name}>{name}</span>
            <span className={styles.sub}>{user.isAdmin ? `${t('user_menu.administrator')} · ${provider}` : provider}</span>
          </span>
        </header>
        {group(
          [
            isLocal && { key: 'security', icon: 'security', tone: 'account', label: t('workspace.you.sign_in_security'), onClick: () => setSheet('security') },
            { key: 'token', icon: 'key', tone: 'account', label: t('user_menu.api_token'), onClick: () => setSheet('token') },
          ],
          t('workspace.you.account'),
        )}
        {group(
          [
            { key: 'layout', icon: 'monitor', tone: 'prefs', label: t('workspace.you.layout'), to: '/you/layout' },
            { key: 'language', icon: 'languages', tone: 'prefs', label: t('workspace.you.language_units'), to: '/preferences/language' },
            { key: 'appearance', icon: 'sun', tone: 'prefs', label: t('settings.appearance'), to: '/preferences/appearance' },
            { key: 'map', icon: 'map', tone: 'prefs', label: t('settings.map'), to: '/preferences/map' },
          ],
          t('workspace.shell.preferences'),
        )}
        {group([
          notifications !== null && { key: 'notifications', icon: 'notifications', tone: 'notify', label: t('nav.notifications'), to: notifications },
          user.isAdmin && { key: 'server', icon: 'server', tone: 'server', label: settingsNav.label, to: '/server/general' },
          helpRow,
        ])}
        {group([{ key: 'logout', icon: 'forward', tone: 'plain', label: t('user_menu.logout'), onClick: () => void signOut() }])}

        <Sheet open={sheet === 'token'} onClose={() => setSheet(null)} title={t('user_menu.api_token_management')}>
          <div className={styles.sheetBody}>
            <APITokenManagement />
          </div>
        </Sheet>
        <Sheet open={sheet === 'security'} onClose={() => setSheet(null)} title={t('workspace.you.sign_in_security')}>
          {canChangePassword && (
            <TwoLineRow
              onClick={() => {
                setSheet(null);
                setChangePassword(true);
              }}
              title={t('user_menu.change_password')}
              trailing={<UiIcon name="chevronRight" size={18} />}
            />
          )}
          <div className={styles.sheetBody}>
            <MFAManagement />
            <PasskeyManagement />
          </div>
        </Sheet>
        <ChangePasswordModal isOpen={changePassword} onClose={() => setChangePassword(false)} />
      </>
    );
  }

  return <div className={styles.page}>{body}</div>;
}
