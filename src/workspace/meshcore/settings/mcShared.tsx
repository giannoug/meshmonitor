/**
 * What a MeshCore device's settings pages share (Task 7.4): the device as the
 * screen's one useMeshCore holds it, today's grants for it, and the page's
 * own save dock (s8n4: each page saves with its own bar, as Radio on 8-08).
 */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SendsLine from '../../patterns/SendsLine';
import LeaveGuard from '../../settings/LeaveGuard';
import { useIsPhone } from '../../shell/useIsPhone';
import { useMeshCoreRuntime } from '../runtime';
import { useMcDevice } from './useMcDevice';
import bar from '../../settings/RadioSaveBar.module.css';
import styles from './McSettings.module.css';

/** A page's column; `data-phone` gives its controls the phone's 44 px targets. */
export function McPage({ children }: { children: ReactNode }) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {children}
    </div>
  );
}

/** Today's notes at the top of a Device Configuration page: not connected, no write grant. */
export function DeviceNotes() {
  const { t } = useTranslation();
  const d = useMcDevice();
  return (
    <>
      {!d.connected && <p className={styles.note} role="status">{t('meshcore.config.not_connected')}</p>}
      {!d.canWriteConfig && <p className={styles.note} role="status">{t('meshcore.config.permission_denied')}</p>}
    </>
  );
}

export interface McDockProps {
  /** The changed fields, by today's labels; the dock shows while there are any. */
  changes: string[];
  /** The page's name: "3 changes in Radio". */
  page: string;
  sends: ReactNode;
  saveLabel: string;
  saving: boolean;
  /** Save stays off (an invalid field, no grant, not connected). */
  blocked: boolean;
  error?: string | null;
  onSave(): void;
  onDiscard(): void;
}

/**
 * A page's save dock (8-08): "N changes in <page>", what saving does with its
 * Sends line, Discard and the page's own Save. One press, one save. While it
 * holds changes, a link out of the page asks first (LeaveGuard).
 */
export function McDock({ changes, page, sends, saveLabel, saving, blocked, error, onSave, onDiscard }: McDockProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sourceId } = useMeshCoreRuntime();
  const { pathname } = useLocation();
  const count = changes.length;
  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  if (count === 0 && !error) return null;
  const title = t('workspace.settings.savebar.changes_in', { count, names: page });
  const save = (
    <button type="button" className={bar.save} disabled={blocked || saving || count === 0} aria-busy={saving || undefined} onClick={onSave}>
      {saving ? t('meshcore.config.saving') : saveLabel}
    </button>
  );
  const discard = (
    <button type="button" className={isPhone ? bar.secondary : bar.plain} disabled={saving || count === 0} onClick={onDiscard}>
      {t('workspace.settings.savebar.discard')}
    </button>
  );
  return (
    <>
      {isPhone && <div className={bar.spacer} aria-hidden="true" />}
      <section className={bar.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.savebar.label')}>
        {isPhone ? (
          <>
            {count > 0 && <span className={bar.title}>{title}</span>}
            <SendsLine>{sends}</SendsLine>
            <div className={bar.buttons}>
              {discard}
              {save}
            </div>
          </>
        ) : (
          <div className={bar.row}>
            <div className={bar.text}>
              {count > 0 && <span className={bar.title}>{title}</span>}
              <SendsLine>{sends}</SendsLine>
            </div>
            {discard}
            {save}
          </div>
        )}
        {error && <p className={bar.error} role="alert">{error}</p>}
      </section>
      <LeaveGuard base={base} pending={count > 0 ? { scope: pathname, title: page, changes, discard: onDiscard } : null} />
    </>
  );
}
