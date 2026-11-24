/**
 * The Classic "Try the Workspace layout" banner (board r3-classic-banner,
 * D18, spec §5.2). Rendered while `WORKSPACE_ENTRY_ENABLED` (on since Task 9.3);
 * with it off it renders nothing and asks the server nothing.
 *
 * Shown to a signed-in user while the admin offers it (`offerWorkspaceBanner`,
 * Server › General) and the user has neither a `layout` preference nor
 * `workspace.bannerDismissed`. Try it saves `layout=workspace`, and the layout
 * gate, which reads the same preference, moves the user to the Workspace.
 * Not now (and the close button) saves `layout=classic`, so a later
 * Workspace default does not move the user, and the dismissal.
 */
import { useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useShellEmbedded } from '../../contexts/ShellContext';
import { logger } from '../../utils/logger';
import { UiIcon } from '../icons';
import { installSettingsQuery, useLayout } from '../../workspace/layout/useLayout';
import { WORKSPACE_ENTRY_ENABLED } from '../../workspace/layout/workspaceEntry';
import { useUserPreferences } from '../../workspace/prefs/useUserPreferences';
import styles from './WorkspaceBanner.module.css';

const HEADER_VAR = '--app-header-height';

/**
 * `inline`: the page has no `.app-header` (the `.dashboard-topbar` pages and the
 * unified pages), so the banner sits in the page's flow where it is mounted and
 * moves the content below it down; it measures and sets nothing.
 */
export default function WorkspaceBanner({ inline = false }: { inline?: boolean }) {
  // Inside the Workspace (a re-hosted Classic page) there is nothing to offer; nor without an AuthProvider
  // (the app always has one; a page rendered alone, as in its own tests, gets no banner).
  const embedded = useShellEmbedded();
  const auth = useAuthIfProvided();
  return WORKSPACE_ENTRY_ENABLED && !embedded && auth ? <Offer inline={inline} /> : null;
}

/** useAuth, or null outside an AuthProvider (useAuth throws there; the hook is called either way). */
function useAuthIfProvided() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

function Offer({ inline }: { inline: boolean }) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true && !!authStatus.user;
  const { prefs, isSuccess, setPref } = useUserPreferences({ enabled: signedIn });
  const settings = useQuery({ ...installSettingsQuery, enabled: signedIn });
  const { setLayout } = useLayout();
  const shown =
    signedIn &&
    isSuccess &&
    settings.data?.offerWorkspaceBanner === 'true' &&
    prefs.layout === undefined &&
    prefs['workspace.bannerDismissed'] !== true;
  const ref = useRef<HTMLElement>(null);

  // Part of Classic's fixed top chrome while shown: sit right below the header
  // and extend `--app-header-height` (the offset every Classic surface below the
  // header reads: page padding, the Nodes view, section nav, AppBanners) by the
  // banner's height, on the shell element only. Hidden, it sets nothing.
  useLayoutEffect(() => {
    const banner = ref.current;
    const shell = banner?.parentElement;
    const header = document.querySelector('.app-header');
    if (inline || !shown || !banner || !shell || !header || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const bar = Math.ceil(header.getBoundingClientRect().bottom);
      // A zero bar is not a measurement (useAppHeaderHeightVar): leave the CSS offset alone.
      if (bar <= 0) {
        shell.style.removeProperty(HEADER_VAR);
        return;
      }
      banner.style.top = `${bar}px`;
      shell.style.setProperty(HEADER_VAR, `${bar + Math.ceil(banner.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(banner);
    measure();
    return () => {
      observer.disconnect();
      shell.style.removeProperty(HEADER_VAR);
    };
  }, [shown, inline]);

  if (!shown) return null;

  const failed = (error: unknown) => logger.error('Failed to save the layout choice:', error);
  const notNow = async () => {
    try {
      await setPref('layout', 'classic');
      await setPref('workspace.bannerDismissed', true);
    } catch (error) {
      failed(error);
    }
  };

  return (
    <section ref={ref} className={inline ? `${styles.banner} ${styles.inline}` : styles.banner} aria-label={t('workspace.entry.menu_item')}>
      <UiIcon name="monitor" size={22} className={styles.icon} />
      <p className={styles.text}>
        <strong>{t('workspace.entry.title')}</strong> {t('workspace.entry.body')}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void setLayout('workspace').catch(failed)}>
          {t('workspace.entry.try')}
        </button>
        <button type="button" className={styles.secondary} onClick={() => void notNow()}>
          {t('workspace.entry.not_now')}
        </button>
        <button type="button" className={styles.close} aria-label={t('common.dismiss')} onClick={() => void notNow()}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
    </section>
  );
}
