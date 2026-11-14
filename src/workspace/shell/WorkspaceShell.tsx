/**
 * The Workspace frame (spec §5.3, D8).
 *
 * - Desktop (≥1024 px): device rail + sidebar + the page.
 * - 768–1023 px: the sidebar is an overlay drawer, opened from a button at the
 *   top of the rail and closed by Esc, the backdrop, or following a link.
 * - Phone (<768 px): PhoneShell's header, the page, and the tab bar.
 *
 * Rail and sidebar are fixed on the left; the page column starts after them,
 * and re-hosted Classic pages read that width as `--sidebar-width`, the offset
 * their own (hidden) sidebar used to set. So the window stays the scroller, as
 * in Classic.
 *
 * Message search (Task 2.6, note s10n5) belongs to the shell: the device
 * sidebar's field, the phone Home's pill and ⌘K / Ctrl+K open it for the open
 * Meshtastic-family device, as a dialog on desktop and a page on the phone.
 *
 * Also here: the open device going away (Review Focus 4), the hashchange
 * that Classic's SectionNav needs after a client-side move to a `#section`,
 * and the forced password change after a recovery-code sign-in (Classic shows
 * it from UserMenu, which the Workspace does not mount).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import { useDashboardSources } from '../../hooks/useDashboardData';
import type { ResourceType } from '../../types/permission';
import SearchMessages from '../chat/SearchMessages';
import { isMeshtasticFamily } from './deviceTabs';
import DeviceRail from './DeviceRail';
import DeviceSidebar, { type SidebarMode } from './DeviceSidebar';
import PhoneShell from './PhoneShell';
import { useIsNarrowDesktop, useIsPhone } from './useIsPhone';
import { ShellDevicesContext } from './shellDevices';
import { useWorkspaceSources } from './useWorkspaceSources';
import styles from './WorkspaceShell.module.css';

const RAIL = 72;
const SIDEBAR = 270;

function modeOf(pathname: string, sourceType: string | undefined): SidebarMode {
  if (matchPath('/source/:id/settings/*', pathname) && !['meshcore', 'reticulum', 'meshcore_mqtt'].includes(sourceType ?? '')) {
    return 'settings';
  }
  if (pathname.startsWith('/source/')) return 'device';
  if (/^\/server(\/|$)/.test(pathname)) return 'server';
  if (/^\/(you|preferences)(\/|$)/.test(pathname)) return 'you';
  return 'overview';
}

/**
 * SectionNav scrolls on mount and on `hashchange`, but router navigation
 * (pushState/replaceState) never fires `hashchange`. Fire it after a
 * client-side move whose hash changed, so a sidebar category link scrolls.
 */
function useHashChangeOnNavigate(hash: string) {
  const prev = useRef(hash);
  useEffect(() => {
    if (prev.current === hash) return;
    prev.current = hash;
    if (hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, [hash]);
}

/** The open device was removed (it was in the list, now it is not): go to the Overview and say so. */
function useLeaveRemovedSource(openId: string | null) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data } = useDashboardSources();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !openId) return;
    if (data.some((s) => s.id === openId)) {
      seen.current = openId;
    } else if (seen.current === openId) {
      seen.current = null;
      showToast(t('workspace.shell.device_removed'), 'warning');
      void navigate('/overview', { replace: true });
    }
  }, [data, openId, navigate, showToast, t]);
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { authStatus, refreshAuth, hasPermission } = useAuth();
  const isPhone = useIsPhone();
  const narrow = useIsNarrowDesktop();
  const { sources } = useWorkspaceSources();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const openId = matchPath('/source/:sourceId/*', location.pathname)?.params.sourceId ?? null;
  const source = sources.find((s) => s.id === openId);
  const mode = modeOf(location.pathname, source?.type);
  const home = sources.find((s) => s.id === (openId ?? lastId)) ?? null;

  useEffect(() => {
    if (openId) setLastId(openId);
  }, [openId]);

  // App's gate (App.tsx canSearch), on the open device: messages:read or any channel_N:read.
  const searchable = !!source && isMeshtasticFamily(source.type);
  const canSearch =
    !!source &&
    searchable &&
    ['messages', ...Array.from({ length: 8 }, (_, i) => `channel_${i}`)].some((r) =>
      hasPermission(r as ResourceType, 'read', { sourceId: source.id }),
    );
  const [searchOpen, setSearchOpen] = useState(false);
  // Any navigation closes search: picking a result, switching device, or a tab (even the one under the phone page).
  useEffect(() => setSearchOpen(false), [location.key]);
  // App's ⌘K / Ctrl+K, with the same semantics (also from a text field). Caught on the window
  // before it reaches the document, so a re-hosted App does not open its own modal as well.
  useEffect(() => {
    if (!searchable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        if (canSearch) setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [searchable, canSearch]);
  const openSearch = canSearch ? () => setSearchOpen(true) : null;
  // Kept mounted per device, so the search survives close and reopen (today's SearchModal is always mounted).
  const search = canSearch && source && (
    <SearchMessages key={source.id} source={source} phone={isPhone} open={searchOpen} onClose={() => setSearchOpen(false)} />
  );

  useHashChangeOnNavigate(location.hash);
  useLeaveRemovedSource(openId);
  // Any navigation closes the drawer, and so does Esc.
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Same component and props as UserMenu; portaled, so no shell stacking context traps it.
  const forcedPasswordChange =
    authStatus?.passwordChangeRequired === true &&
    createPortal(<ChangePasswordModal isOpen forced onClose={() => void refreshAuth()} />, document.body);

  if (isPhone) {
    return (
      <ShellDevicesContext.Provider value={{ sources, home, openSearch }}>
        <div className={styles.shell} data-workspace-shell="">
          <div className={styles.main}>
            <PhoneShell sources={sources} openId={openId} home={home} mode={mode}>
              {children}
            </PhoneShell>
          </div>
        </div>
        {search}
        {forcedPasswordChange}
      </ShellDevicesContext.Provider>
    );
  }

  const showSidebar = !narrow || drawerOpen;
  const frame = { '--ws-frame-width': `${narrow ? RAIL : RAIL + SIDEBAR}px` } as CSSProperties;

  return (
    <ShellDevicesContext.Provider value={{ sources, home, openSearch }}>
      <div className={styles.shell} data-workspace-shell="" style={frame}>
        <DeviceRail
          sources={sources}
          openId={openId}
          overviewActive={mode === 'overview'}
          drawerToggle={
            narrow && (
              <button
                type="button"
                className={styles.drawerButton}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((o) => !o)}
              >
                <UiIcon name={drawerOpen ? 'close' : 'menu'} size={20} />
                <span className={styles.srOnly}>
                  {t(drawerOpen ? 'workspace.shell.hide_sidebar' : 'workspace.shell.show_sidebar')}
                </span>
              </button>
            )
          }
        />
        {showSidebar && (
          <DeviceSidebar
            mode={mode}
            sourceId={openId}
            source={source}
            onNavigate={() => setDrawerOpen(false)}
            onSearch={openSearch}
          />
        )}
        {narrow && drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        {/* A div, not <main>: re-hosted pages bring their own <main>. */}
        <div className={`${styles.main} ${styles.framed}`}>{children}</div>
      </div>
      {search}
      {forcedPasswordChange}
    </ShellDevicesContext.Provider>
  );
}
