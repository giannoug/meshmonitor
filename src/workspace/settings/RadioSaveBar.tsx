/**
 * The radio save bar (boards b-set-d1, b-set-p2, b-set-p1): the device's
 * queued radio edits (useRadioSaveQueue) with Discard, Review and a Save whose
 * words say what saving does (configRebootRules for the device's firmware).
 *
 * - Desktop: "3 changes in LoRa and Device · Node restarts", with how soon the
 *   node restarts, at the bottom of the page.
 * - Phone: docked above the tab bar, with "Sends nothing on the mesh"; on the
 *   settings list it is one line, "3 unsaved changes", and Review.
 *
 * Saving writes admin packets to this device only, over its connection.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import { categoryById } from './categories';
import ReviewSheet from './ReviewSheet';
import { SAVE_LABEL_KEY, useRadioSaveQueue } from './useRadioSaveQueue';
import type { ConfigSaveSection } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import styles from './RadioSaveBar.module.css';

export interface RadioSaveBarProps {
  deviceName: string;
  /** The phone settings list: one line and Review. */
  compact?: boolean;
}

export default function RadioSaveBar({ deviceName, compact }: RadioSaveBarProps) {
  const { t, i18n } = useTranslation();
  const isPhone = useIsPhone();
  const q = useRadioSaveQueue();
  const [review, setReview] = useState(false);
  const [failed, setFailed] = useState<ConfigSaveSection[]>([]);
  // An empty queue closes Review (its last category discarded), so it never reopens by itself on the next edit.
  if (review && (!q || q.queue.length === 0)) setReview(false);
  if (!q || q.queue.length === 0) return null;

  const names = (sections: Array<{ categoryId: string }>) => sections.map((e) => t(categoryById(e.categoryId)?.labelKey ?? e.categoryId));
  const count = q.queue.reduce((n, e) => n + e.changes.length, 0);
  const restart = q.label === 'saveAndRestart' ? 'restarts' : q.label === 'saveMayRestart' ? 'may_restart' : null;
  const save = async () => {
    setReview(false);
    setFailed((await q.saveAll()).failed);
  };
  // A failed section stays queued; once it is saved or discarded its notice goes.
  const failedNames = names(q.queue.filter((e) => failed.includes(e.section)));
  const saveDisabled = q.saving || q.invalid;

  const saveButton = (
    <button
      type="button"
      className={styles.save}
      data-restart={restart ?? undefined}
      onClick={() => void save()}
      disabled={saveDisabled}
      aria-busy={q.saving || undefined}
    >
      {t(SAVE_LABEL_KEY[q.label])}
    </button>
  );
  const reviewButton = (
    <button type="button" className={styles.secondary} onClick={() => setReview(true)}>
      {t('workspace.settings.savebar.review')}
    </button>
  );
  const notes = (
    <>
      {failedNames.length > 0 && (
        <p className={styles.error} role="alert">{t('workspace.settings.savebar.not_saved', { names: failedNames.join(', ') })}</p>
      )}
      {q.invalid && <p className={styles.error}>{t('savebar.fix_invalid_fields')}</p>}
    </>
  );

  let body;
  if (compact) {
    body = (
      <div className={styles.row}>
        <UiIcon name="refresh" size={22} className={styles.icon} />
        <span className={styles.title}>{t('workspace.settings.savebar.unsaved', { count })}</span>
        <button type="button" className={styles.save} data-restart={restart ?? undefined} onClick={() => setReview(true)}>
          {t('workspace.settings.savebar.review')}
        </button>
      </div>
    );
  } else if (isPhone) {
    body = (
      <>
        <div className={styles.row}>
          <UiIcon name="refresh" size={22} className={styles.icon} />
          <span className={styles.title}>{t('workspace.settings.savebar.changes_short', { count, names: names(q.queue).join(', ') })}</span>
          {restart && <span className={styles.restart}>{t(`workspace.settings.savebar.node_${restart}`)}</span>}
        </div>
        <div className={styles.buttons}>
          {reviewButton}
          {saveButton}
        </div>
        <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
      </>
    );
  } else {
    const list = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(names(q.queue));
    body = (
      <div className={styles.row}>
        <UiIcon name="refresh" size={24} className={styles.icon} />
        <div className={styles.text}>
          <span className={styles.title}>
            {t('workspace.settings.savebar.changes_in', { count, names: list })}
            {restart && ` · ${t(`workspace.settings.savebar.node_${restart}`)}`}
          </span>
          {restart && <span className={styles.sub}>{t(`workspace.settings.savebar.${restart}_after`, { device: deviceName })}</span>}
        </div>
        <button type="button" className={styles.plain} onClick={() => q.discard()} disabled={q.saving}>
          {t('workspace.settings.savebar.discard')}
        </button>
        {reviewButton}
        {saveButton}
      </div>
    );
  }

  return (
    <>
      {isPhone && <div className={styles.spacer} data-compact={compact || undefined} aria-hidden="true" />}
      <section className={styles.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.savebar.label')}>
        {body}
        {notes}
      </section>
      <ReviewSheet open={review} deviceName={deviceName} onClose={() => setReview(false)} onSave={() => void save()} />
    </>
  );
}
