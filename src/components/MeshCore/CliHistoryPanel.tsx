/**
 * CliHistoryPanel — the stored history of one console's target (#5892).
 *
 * Collapsed by default; opening it loads the newest commands this target got
 * through MeshMonitor (from any user, and from Virtual Node apps), then pages
 * back with "Load more". The console's own in-session transcript is separate.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { CliHistoryList } from './CliHistoryList';
import { useCliHistory } from './hooks/useCliHistory';
import styles from './CliHistory.module.css';

export interface CliHistoryTarget {
  sourceId: string;
  /** 'local' for the Local Console, else the remote node's public key. */
  target: 'local' | string;
}

export const CliHistoryPanel: React.FC<CliHistoryTarget> = ({ sourceId, target }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { entries, nextCursor, loading, error, load } = useCliHistory(sourceId, target, open);

  // A new target starts closed.
  useEffect(() => {
    setOpen(false);
  }, [sourceId, target]);

  return (
    <section className={styles.panel} aria-label={t('meshcore.cliHistory.title', 'Command history')}>
      <div className={styles.panelHeader}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <UiIcon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          {t('meshcore.cliHistory.title', 'Command history')}
        </button>
        {open && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => void load(null)}
            disabled={loading}
            title={t('meshcore.cliHistory.refresh', 'Refresh')}
            aria-label={t('meshcore.cliHistory.refresh', 'Refresh')}
          >
            <UiIcon name="refresh" size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className={styles.panelBody}>
          <p className={styles.hint}>
            {t('meshcore.cliHistory.hint', 'Commands sent to this node through MeshMonitor, by every user. Passwords and keys are masked.')}
          </p>
          {error && <p className={styles.error}>{error}</p>}
          {!error && entries.length === 0 && !loading && (
            <p className={styles.empty}>{t('meshcore.cliHistory.empty', 'No commands recorded yet.')}</p>
          )}
          {entries.length > 0 && <CliHistoryList entries={entries} />}
          {nextCursor !== null && (
            <button type="button" className={styles.more} onClick={() => void load(nextCursor)} disabled={loading}>
              {t('meshcore.cliHistory.load_more', 'Load more')}
            </button>
          )}
          {loading && <p className={styles.empty}>{t('meshcore.cliHistory.loading', 'Loading…')}</p>}
        </div>
      )}
    </section>
  );
};
