/**
 * The phone frame, below 768 px (D8; boards a-chat-D-phone, c-home-e2-switcher,
 * s1-you): a header naming the open device (or the Overview) that opens the
 * device switcher, with up to two other devices as quick squares (a-chat-D-phone),
 * the page, and the tab bar. You, Preferences and Server pages, and a channel,
 * a DM or the DM inbox (their own header), have no device header.
 *
 * Re-hosted Classic pages reserve room for their own header and bottom bar
 * from `--app-header-height` and `--app-nav-bar-height`; here those carry the
 * phone header and the tab bar instead.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { SidebarMode } from './DeviceSidebar';
import { isMeshtasticFamily, statusLabel } from './deviceTabs';
import DeviceSwitcherSheet from './DeviceSwitcherSheet';
import TabBar, { type PhoneTab } from './TabBar';
import type { WorkspaceSource } from './useWorkspaceSources';
import styles from './PhoneShell.module.css';

const HEADER = 64;
const TAB_BAR = 64;
/** Other devices beside the open one; the switcher holds the rest (Review Focus 1). */
const QUICK_SQUARES = 2;

interface PhoneShellProps {
  sources: WorkspaceSource[];
  openId: string | null;
  /** The device Home leads to (Task 1.7): open, else last opened. */
  home: WorkspaceSource | null;
  mode: SidebarMode;
  children: ReactNode;
}

function activeTab(pathname: string, mode: SidebarMode): PhoneTab {
  if (mode === 'you' || mode === 'server') return 'you';
  const tab = matchPath('/source/:id/:tab/*', pathname)?.params.tab;
  if (tab === 'messages' || tab === 'dms' || tab === 'dm') return 'dms';
  return tab === 'activity' ? 'activity' : 'home';
}

export default function PhoneShell({ sources, openId, home, mode, children }: PhoneShellProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Following a row (or any link) closes the switcher.
  useEffect(() => setSwitcherOpen(false), [pathname]);

  const source = sources.find((s) => s.id === openId);
  // A Meshtastic conversation draws its own header (boards 10-06, 10-14; DMs 10-07), and so does the inbox (c-home-e3).
  const ownHeader =
    !!source &&
    isMeshtasticFamily(source.type) &&
    (!!matchPath('/source/:id/channel/*', pathname) ||
      !!matchPath('/source/:id/dm/:nodeId', pathname) ||
      !!matchPath('/source/:id/dms', pathname));
  const quick = source ? sources.filter((s) => s.id !== source.id).slice(0, QUICK_SQUARES) : [];
  const showHeader = mode !== 'you' && mode !== 'server' && !ownHeader;
  const title = source?.name ?? t('workspace.shell.overview');
  const active = source?.live?.activeNodeCount;
  const status =
    source &&
    (source.status === 'connected' && active !== undefined
      ? `${statusLabel(t, source.status)} · ${t('workspace.shell.online_count', { count: active })}`
      : statusLabel(t, source.status));
  const vars = {
    '--app-header-height': `${showHeader ? HEADER : 0}px`,
    '--app-nav-bar-height': `${TAB_BAR}px`,
    '--ws-tabbar-height': `${TAB_BAR}px`,
  } as CSSProperties;

  return (
    <div style={vars}>
      {showHeader && (
        <header className={styles.header}>
          <button
            type="button"
            className={styles.switch}
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            aria-label={t('workspace.switcher.open', { name: title })}
            onClick={() => setSwitcherOpen(true)}
          >
            {source ? (
              <span className={styles.square} style={{ background: source.colorToken }}>{source.abbrev}</span>
            ) : (
              <span className={`${styles.square} ${styles.plain}`}><UiIcon name="dashboard" size={22} /></span>
            )}
            <span className={styles.text}>
              <span className={styles.title}>
                <span className={styles.name}>{title}</span>
                <UiIcon name="chevronDown" size={18} />
              </span>
              {status && (
                <span className={styles.status}>
                  <span className={styles.dot} data-status={source.status} />
                  <span>{status}</span>
                </span>
              )}
            </span>
          </button>
          {quick.length > 0 && (
            <div className={styles.quick}>
              {quick.map((s) => (
                <Link
                  key={s.id}
                  to={`/source/${encodeURIComponent(s.id)}`}
                  className={styles.square}
                  style={{ background: s.colorToken }}
                  aria-label={s.dmUnread ? t('workspace.shell.device_unread', { name: s.name, count: s.dmUnread }) : s.name}
                >
                  {s.abbrev}
                  {!!s.dmUnread && (
                    <span className={styles.badge} aria-hidden="true">
                      {s.dmUnread > 99 ? '99+' : s.dmUnread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </header>
      )}
      {children}
      <TabBar home={home} active={activeTab(pathname, mode)} />
      <DeviceSwitcherSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        sources={sources}
        openId={openId}
        overviewActive={mode === 'overview'}
      />
    </div>
  );
}
