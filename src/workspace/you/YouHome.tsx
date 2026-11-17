/**
 * You (boards s1-you, b-set-p5-you, note ds15): the account head and the You
 * rows (`useYouRows`). Sign-in & security and API Token are Workspace pages
 * (Task 6.1); Layout is `/you/layout`; the other preferences lead to today's
 * global Settings sections until Task 6.3, under the note that they apply to
 * everyone. A guest gets Login instead of the account rows.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { version } from '../../../package.json';
import { SignInDialog } from '../auth/SignInCard';
import { UiIcon } from '../../components/icons';
import TwoLineRow from '../patterns/TwoLineRow';
import { abbrevOf } from '../shell/useWorkspaceSources';
import { useYouRows, type YouRow } from './useYouRows';
import styles from './YouHome.module.css';

export default function YouHome() {
  const { t } = useTranslation();
  const { user, account, prefs, more, helpRow: help, signOut } = useYouRows();
  const [loginOpen, setLoginOpen] = useState(false);

  const group = (rows: Array<YouRow | null>, title?: string, note?: ReactNode) => {
    const shown = rows.filter((r): r is YouRow => !!r);
    if (shown.length === 0) return null;
    return (
      <section className={styles.group}>
        {note}
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

  const helpRow = help && { ...help, value: version };

  let body: ReactNode;
  if (!user) {
    body = (
      <>
        {group([{ key: 'login', icon: 'user', tone: 'account', label: t('auth.login'), onClick: () => setLoginOpen(true) }])}
        {group([helpRow])}
        <SignInDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  } else {
    const name = user.displayName || user.username;
    const provider = user.authProvider === 'oidc' ? t('user_menu.oidc_account') : t('user_menu.local_account');
    body = (
      <>
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">{abbrevOf(name)}</span>
          <span className={styles.who}>
            <span className={styles.name}>{name}</span>
            <span className={styles.sub}>{user.isAdmin ? `${t('user_menu.administrator')} · ${provider}` : provider}</span>
          </span>
        </header>
        {group(account, t('workspace.you.account'))}
        {group(
          prefs,
          t('workspace.shell.preferences'),
          <p className={styles.note}>
            <UiIcon name="info" size={20} />
            <span>{t('workspace.you.prefs_note')}</span>
          </p>,
        )}
        {group([...more, helpRow])}
        {group([{ key: 'logout', icon: 'forward', tone: 'plain', label: t('user_menu.logout'), onClick: () => void signOut() }])}
      </>
    );
  }

  return <div className={styles.page}>{body}</div>;
}
