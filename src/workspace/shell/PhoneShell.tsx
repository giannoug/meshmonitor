/**
 * The phone frame, below 768 px (D8; boards a-chat-D-phone, c-home-e2-switcher,
 * s1-you): a header naming the open device (or the Overview) that opens the
 * device switcher, with up to two other devices as quick squares (a-chat-D-phone),
 * the page, and the tab bar. You, Preferences and Server pages, and a channel,
 * a DM or the DM inbox (their own header), have no device header. On the
 * Overview the header reads "Overview ▾" and "All devices · N of M connected"
 * (5-07); the all-devices map has none (5-08).
 *
 * On a device the status line is its own button under the name, which opens
 * the device's Connection card (ds6, Task 6.7); the square and the name open
 * the switcher. The header keeps the boards' 64 px (Ruling 6.7 HC): the
 * switcher's target includes the 44 px square, and the status line's runs from
 * under the name to the header's bottom edge (30 px), beside the square.
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
import { isMeshtasticFamily, overviewStatus, statusLabel } from './deviceTabs';
import { isMqttOnlySourceType } from '../../utils/nodeTransport';
import ConnectionCard from '../devices/ConnectionCard';
import DeviceSwitcherSheet from './DeviceSwitcherSheet';
import { ShellDevicesContext, useShellDevices } from './shellDevices';
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
  const { pathname, hash } = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const shell = useShellDevices();
  // Following a row (or any link) closes the switcher and the Connection card.
  useEffect(() => {
    setSwitcherOpen(false);
    setCardOpen(false);
  }, [pathname]);

  const source = sources.find((s) => s.id === openId);
  // A Meshtastic conversation draws its own header (boards 10-06, 10-14; DMs 10-07), and so do the inbox (c-home-e3), Activity (c-home-e4), the full-screen map (g1-map), Nodes (g3-nodes), the node page (g4-node), an MQTT device's packet monitor (18-04) and device settings (b-set-p1-list).
  // A MeshCore device's Home, channel and room draw their own (8-16 … 8-19, Task 7.1), and so do Nodes and the node page (8-20, 8-28, g6, Task 7.2).
  const meshcoreOwn =
    source?.type === 'meshcore' &&
    ((/^\/source\/[^/]+\/?$/.test(pathname) && !hash) ||
      !!matchPath('/source/:id/channel/:idx', pathname) ||
      !!matchPath('/source/:id/room/:key', pathname) ||
      !!matchPath('/source/:id/nodes', pathname) ||
      !!matchPath('/source/:id/node/*', pathname) ||
      // The settings list and pages have Back, a remote target's too (8-21, 8-22, 8-25, Tasks 7.3, 7.4).
      !!matchPath('/source/:id/settings/*', pathname));
  const ownHeader =
    meshcoreOwn ||
    (!!source &&
    isMeshtasticFamily(source.type) &&
    (!!matchPath('/source/:id/channel/*', pathname) ||
      !!matchPath('/source/:id/dm/:nodeId', pathname) ||
      !!matchPath('/source/:id/dms', pathname) ||
      !!matchPath('/source/:id/activity', pathname) ||
      !!matchPath('/source/:id/map', pathname) ||
      !!matchPath('/source/:id/nodes', pathname) ||
      !!matchPath('/source/:id/node/*', pathname) ||
      (isMqttOnlySourceType(source.type) && !!matchPath('/source/:id/packetmonitor', pathname)) ||
      // Device settings (b-set-p1-list, 12-22): the list and each page have Back, on a remote target too (Task 5.9).
      !!matchPath('/source/:id/settings/*', pathname)));
  // The all-devices map is full screen with its own Back, as the device map (5-08); Reports (6-08 … 6-10), Messages (7-06, 7-09), Users (13-18, q4) and the Audit log (16-03) draw their own header.
  const overviewMap = mode === 'overview' && (pathname === '/' || !!matchPath('/overview/map', pathname));
  const ownPageHeader = /^\/((overview\/)?(reports|users)|overview\/audit|(overview|unified)\/(messages|telemetry|packets))(\/|$)/.test(pathname);
  const quick = source ? sources.filter((s) => s.id !== source.id).slice(0, QUICK_SQUARES) : [];
  const showHeader = mode !== 'you' && mode !== 'server' && !ownHeader && !overviewMap && !ownPageHeader;
  const title = source?.name ?? t('workspace.shell.overview');
  const active = source?.live?.activeNodeCount;
  const status = !source
    ? overviewStatus(t, sources)
    : source.status === 'connected' && active !== undefined
      ? `${statusLabel(t, source.status)} · ${t('workspace.shell.online_count', { count: active })}`
      : statusLabel(t, source.status);
  const vars = {
    '--app-header-height': `${showHeader ? HEADER : 0}px`,
    '--app-nav-bar-height': `${TAB_BAR}px`,
    '--ws-tabbar-height': `${TAB_BAR}px`,
  } as CSSProperties;

  return (
    <ShellDevicesContext.Provider value={{ ...shell, openSwitcher: () => setSwitcherOpen(true) }}>
      <div style={vars}>
        {showHeader && (
          <header className={styles.header} data-device={source ? '' : undefined}>
            <div className={styles.ident}>
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
                  {!source && (
                    <span className={styles.status}>
                      <span>{status}</span>
                    </span>
                  )}
                </span>
              </button>
              {source && (
                <button
                  type="button"
                  className={`${styles.status} ${styles.statusButton}`}
                  aria-haspopup="dialog"
                  aria-label={t('workspace.connection.status_line', { name: source.name, status })}
                  onClick={() => setCardOpen(true)}
                >
                  <span className={styles.dot} data-status={source.status} />
                  <span>{status}</span>
                </button>
              )}
            </div>
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
        {source && <ConnectionCard source={source} open={cardOpen} onClose={() => setCardOpen(false)} />}
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
    </ShellDevicesContext.Provider>
  );
}
