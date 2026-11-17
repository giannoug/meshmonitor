/**
 * The Server list (s13n0 `server_sidebar`; boards b-set-d7-server, r4 and
 * 13-16): on desktop the sidebar beside a Server page, on phone the Server
 * page under You (s13n7), one row per category with its icon. Both list only
 * what the user can open (`useServerEntries`, s13n2).
 */
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import TwoLineRow from '../patterns/TwoLineRow';
import StateView from '../patterns/StateView';
import YouPageFrame from '../you/YouPageFrame';
import { useServerEntries } from './serverEntries';
import shell from '../shell/DeviceSidebar.module.css';
import you from '../you/YouHome.module.css';
import styles from './Server.module.css';

export function ServerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const entries = useServerEntries();
  return (
    <aside className={shell.sidebar} aria-label={t('workspace.server.title')}>
      <div className={shell.head}>
        <div className={shell.headText}>
          <h2 className={shell.title}>{t('workspace.server.title')}</h2>
          <p className={shell.status}>{t('workspace.server.sidebar_scope')}</p>
        </div>
      </div>
      <div className={shell.body}>
        <ul className={shell.list}>
          {entries.map((e) => (
            <li key={e.key}>
              <NavLink to={`/server/${e.path}`} className={({ isActive }) => `${shell.row} ${isActive ? shell.on : ''}`} onClick={onNavigate}>
                <span className={shell.label}>{e.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Phone: `/server` (13-16). */
export function ServerList() {
  const { t } = useTranslation();
  const entries = useServerEntries();
  return (
    <YouPageFrame title={t('workspace.server.title')} back={{ label: t('workspace.tabs.you'), to: '/you' }}>
      <p className={styles.listScope}>
        <UiIcon name="server" size={18} />
        <span>{t('workspace.server.list_scope')}</span>
      </p>
      {entries.length === 0 ? (
        <StateView kind="noPermission" />
      ) : (
        <div className={you.card}>
          {entries.map((e) => (
            <TwoLineRow
              key={e.key}
              to={`/server/${e.path}`}
              leading={
                <span className={you.icon} data-tone="server">
                  <UiIcon name={e.icon} size={20} />
                </span>
              }
              title={e.label}
              trailing={<UiIcon name="chevronRight" size={18} />}
            />
          ))}
        </div>
      )}
      <p className={styles.listNote}>{t('workspace.server.list_note')}</p>
    </YouPageFrame>
  );
}
