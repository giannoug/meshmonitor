/**
 * Review changes (board b-set-d3): every queued radio edit, old → new, by
 * category, each category with its restart tag (configRebootRules) and its
 * own Discard; then what the restart means, Keep editing and the labelled Save.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { rebootExpectation } from '../../utils/configRebootRules';
import Sheet from '../patterns/Sheet';
import { categoryById } from './categories';
import { formatValue } from './radioSections';
import { useSharedDeviceConfig } from './sharedDeviceConfig';
import { SAVE_LABEL_KEY, useRadioSaveQueue } from './useRadioSaveQueue';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import SendsLine from '../patterns/SendsLine';
import styles from './RadioSaveBar.module.css';

export interface ReviewSheetProps {
  open: boolean;
  deviceName: string;
  /** Save's words when not the queue's ("Send to node" on a remote target). */
  saveLabel?: string;
  /** What Save sends, said in the sheet (a remote target: one admin packet per category). */
  sends?: string;
  onClose(): void;
  onSave(): void;
}

export default function ReviewSheet({ open, deviceName, saveLabel, sends, onClose, onSave }: ReviewSheetProps) {
  const { t } = useTranslation();
  const q = useRadioSaveQueue();
  const firmware = useSharedDeviceConfig()?.state.localFirmwareVersion;
  // Discarding the last category leaves nothing to review.
  if (!q || q.queue.length === 0) return null;
  const count = q.queue.reduce((n, e) => n + e.changes.length, 0);
  const restart = saveLabel ? null : q.label === 'saveAndRestart' ? 'restart' : q.label === 'saveMayRestart' ? 'may_restart' : null;
  const fmt = (field: string, v: unknown) => formatValue(t, field as keyof DeviceConfigState, v);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('workspace.settings.review.title')}
      footer={
        <div className={styles.buttons}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('config_item_card.keep_editing')}
          </button>
          <button type="button" className={styles.save} data-restart={restart ? '' : undefined} onClick={onSave} disabled={q.saving || q.invalid}>
            {saveLabel ?? t(SAVE_LABEL_KEY[q.label])}
          </button>
        </div>
      }
    >
      <p className={styles.summary}>
        {t('workspace.settings.review.summary', {
          changes: t('workspace.settings.review.changes', { count }),
          categories: t('workspace.settings.review.categories', { count: q.queue.length }),
          device: deviceName,
        })}
      </p>
      {q.queue.map((entry) => {
        const rule = rebootExpectation(entry.section, firmware);
        return (
          <section key={entry.section} className={styles.card} aria-labelledby={`review-${entry.section}`}>
            <header className={styles.cardHead}>
              <h3 className={styles.cardTitle} id={`review-${entry.section}`}>{t(categoryById(entry.categoryId)?.labelKey ?? entry.categoryId)}</h3>
              {/* A remote node's restart timing is not known here, as the bar says (M2). */}
              {rule !== 'never' && !saveLabel && (
                <span className={styles.tag}>{t(rule === 'always' ? 'workspace.settings.tag_restarts' : 'workspace.settings.tag_may_restart')}</span>
              )}
              <button type="button" className={styles.plain} onClick={() => q.discard(entry.section)}>
                {t('workspace.settings.savebar.discard')}
              </button>
            </header>
            <ul className={styles.changes}>
              {entry.changes.map((c) => (
                <li key={c.field} className={styles.change}>
                  <span className={styles.field}>{c.label}</span>
                  <del className={styles.from}>{fmt(c.field, c.from)}</del>
                  <UiIcon name="forward" size={18} className={styles.arrow} />
                  <span className={styles.to}>{fmt(c.field, c.to)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {restart && (
        <p className={styles.note}>
          <UiIcon name="refresh" size={20} className={styles.icon} />
          <span>
            {t(`workspace.settings.review.note_${restart}`, { device: deviceName })}
            {q.queue.length > 1 && ` ${t('workspace.settings.review.one_restart')}`}
          </span>
        </p>
      )}
      {sends && <SendsLine>{sends}</SendsLine>}
    </Sheet>
  );
}
