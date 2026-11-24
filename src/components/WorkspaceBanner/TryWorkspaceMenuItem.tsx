/**
 * Classic's user-menu item "Try the Workspace layout" (D18): saves
 * `layout=workspace`, and the layout gate moves the user there. UserMenu
 * renders it while `WORKSPACE_ENTRY_ENABLED` (on since Task 9.3).
 * The menu closes only once the save worked; a failed save leaves it open with the error,
 * since not every UserMenu mount point sits inside a ToastProvider.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { useLayout } from '../../workspace/layout/useLayout';
import styles from './WorkspaceBanner.module.css';

export default function TryWorkspaceMenuItem({ onSelect }: { onSelect: () => void }) {
  const { t } = useTranslation();
  const { setLayout } = useLayout();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const choose = () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setFailed(false);
    setLayout('workspace').then(onSelect, (error: unknown) => {
      logger.error('Failed to save the layout choice:', error);
      setFailed(true);
    }).finally(() => {
      inflight.current = false;
      setBusy(false);
    });
  };
  return (
    <>
      <button type="button" className="user-menu-item" aria-busy={busy || undefined} onClick={choose}>
        {t('workspace.entry.menu_item')}
      </button>
      {failed && (
        <p role="alert" className={styles.menuError}>
          {t('workspace.entry.save_failed')}
        </p>
      )}
    </>
  );
}
