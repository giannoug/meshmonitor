/**
 * The Classic "Try the Workspace layout" banner (board r3-classic-banner,
 * D18, spec §5.2). Inert until Task 9.3 sets `WORKSPACE_ENTRY_ENABLED`; until
 * then it renders nothing and asks the server nothing.
 *
 * Shown to a signed-in user while the admin offers it (`offerWorkspaceBanner`,
 * Server › General) and the user has neither a `layout` preference nor
 * `workspace.bannerDismissed`. Try it saves `layout=workspace`, and the layout
 * gate, which reads the same preference, moves the user to the Workspace.
 * Not now (and the close button) saves `layout=classic`, so a later
 * Workspace default does not move the user, and the dismissal.
 */
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

export default function WorkspaceBanner() {
  // Inside the Workspace (a re-hosted Classic page) there is nothing to offer.
  const embedded = useShellEmbedded();
  return WORKSPACE_ENTRY_ENABLED && !embedded ? <Offer /> : null;
}

function Offer() {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true && !!authStatus.user;
  const { prefs, isSuccess, setPref } = useUserPreferences({ enabled: signedIn });
  const settings = useQuery({ ...installSettingsQuery, enabled: signedIn });
  const { setLayout } = useLayout();

  if (!signedIn || !isSuccess || settings.data?.offerWorkspaceBanner !== 'true') return null;
  if (prefs.layout !== undefined || prefs['workspace.bannerDismissed'] === true) return null;

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
    <section className={styles.banner} aria-label={t('workspace.entry.menu_item')}>
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
