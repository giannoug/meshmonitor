/**
 * The You sidebar on desktop (boards r1-you-security, r2-you-layout): the
 * account head (user menu's name, role and account kind), the You rows of
 * `useYouRows` in Account and Preferences groups, then Logout at the foot.
 * Rows link to their pages; following one closes the drawer (`onNavigate`).
 */
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { abbrevOf } from '../shell/useWorkspaceSources';
import { useYouRows, type YouRow } from './useYouRows';
import shell from '../shell/DeviceSidebar.module.css';
import styles from './YouSidebar.module.css';

export default function YouSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user, account, prefs, more, helpRow, signOut } = useYouRows();
  const name = user ? user.displayName || user.username : t('workspace.tabs.you');
  const provider = user?.authProvider === 'oidc' ? t('user_menu.oidc_account') : t('user_menu.local_account');

  const list = (rows: Array<YouRow | null>, title?: string) => {
    const shown = rows.filter((r): r is YouRow => !!r?.to);
    if (shown.length === 0) return null;
    return (
      <section className={styles.group}>
        {title && <h3 className={styles.groupTitle}>{title}</h3>}
        <ul className={shell.list}>
          {shown.map((r) => (
            <li key={r.key}>
              <NavLink to={r.to!} className={({ isActive }) => `${shell.row} ${isActive ? shell.on : ''}`} onClick={onNavigate}>
                <span className={shell.label}>{r.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <aside className={shell.sidebar} aria-label={t('workspace.tabs.you')}>
      <div className={`${shell.head} ${styles.head}`}>
        <span className={styles.avatar} aria-hidden="true">{abbrevOf(name)}</span>
        <div className={shell.headText}>
          <h2 className={shell.title} title={name}>{name}</h2>
          {user && <p className={shell.status}>{user.isAdmin ? `${t('user_menu.administrator')} · ${provider}` : provider}</p>}
        </div>
      </div>
      <div className={shell.body}>
        {list(account, t('workspace.you.account'))}
        {list(prefs, t('workspace.shell.preferences'))}
        {list([...more, helpRow])}
      </div>
      {user && (
        <button type="button" className={styles.signOut} onClick={() => void signOut()}>
          <UiIcon name="forward" size={16} />
          {t('user_menu.logout')}
        </button>
      )}
    </aside>
  );
}
