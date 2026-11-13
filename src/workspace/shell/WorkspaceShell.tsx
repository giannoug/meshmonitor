/**
 * The Workspace frame (spec §5.3, D8).
 *
 * - Desktop (≥1024 px): device rail + sidebar + the page.
 * - 768–1023 px: the sidebar is an overlay drawer, opened from a button at the
 *   top of the rail and closed by Esc, the backdrop, or following a link.
 * - Phone (<768 px): the page alone until Task 1.7's phone shell.
 *
 * Rail and sidebar are fixed on the left; the page column starts after them,
 * and re-hosted Classic pages read that width as `--sidebar-width`, the offset
 * their own (hidden) sidebar used to set. So the window stays the scroller, as
 * in Classic.
 *
 * Also here: the open device going away (Review Focus 4), and the hashchange
 * that Classic's SectionNav needs after a client-side move to a `#section`.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import { useDashboardSources } from '../../hooks/useDashboardData';
import DeviceRail from './DeviceRail';
import DeviceSidebar, { type SidebarMode } from './DeviceSidebar';
import { useIsNarrowDesktop, useIsPhone } from './useIsPhone';
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
  const isPhone = useIsPhone();
  const narrow = useIsNarrowDesktop();
  const { sources } = useWorkspaceSources();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openId = matchPath('/source/:sourceId/*', location.pathname)?.params.sourceId ?? null;
  const source = sources.find((s) => s.id === openId);
  const mode = modeOf(location.pathname, source?.type);

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

  if (isPhone) {
    return (
      <div className={styles.shell} data-workspace-shell="">
        <div className={styles.main}>{children}</div>
      </div>
    );
  }

  const showSidebar = !narrow || drawerOpen;
  const frame = { '--ws-frame-width': `${narrow ? RAIL : RAIL + SIDEBAR}px` } as CSSProperties;

  return (
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
        <DeviceSidebar mode={mode} sourceId={openId} source={source} onNavigate={() => setDrawerOpen(false)} />
      )}
      {narrow && drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      {/* A div, not <main>: re-hosted pages bring their own <main>. */}
      <div className={`${styles.main} ${styles.framed}`}>{children}</div>
    </div>
  );
}
