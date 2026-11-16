/**
 * The leave guard (Task 5.3, board 17-02's discard sheet): with radio edits
 * queued, a link that leaves this device's settings (another device on the
 * rail or switcher, Home, a tab) asks first, with today's words: Keep editing
 * stays put, Discard changes puts the edits back and follows the link.
 *
 * The app's router has no navigation blocker (it is not a data router), so the
 * guard catches the link click before the router sees it.
 * shortcut: browser Back and code that navigates without a link are not
 * caught; upgrade to useBlocker if the app moves to a data router.
 */
import { useEffect, useRef, useState } from 'react';
import { useHref } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import ConfirmSheet from '../patterns/ConfirmSheet';
import { categoryById } from './categories';
import { useRadioSaveQueue } from './useRadioSaveQueue';
import styles from './RadioSaveBar.module.css';

export default function LeaveGuard({ base }: { base: string }) {
  const { t, i18n } = useTranslation();
  const q = useRadioSaveQueue();
  const baseHref = useHref(base);
  const [link, setLink] = useState<HTMLAnchorElement | null>(null);
  const following = useRef(false);
  const active = !!q && q.queue.length > 0;

  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (following.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === baseHref || url.pathname.startsWith(`${baseHref}/`)) return;
      e.preventDefault();
      e.stopPropagation();
      setLink(a);
    };
    // Capture, so the router's own link handler never runs for a guarded click.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, baseHref]);

  if (!q) return null;
  const discard = () => {
    const target = link;
    setLink(null);
    q.discard();
    following.current = true;
    try {
      target?.click();
    } finally {
      following.current = false;
    }
  };

  return (
    <ConfirmSheet
      open={!!link && active}
      title={
        <span className={styles.guardTitle}>
          <UiIcon name="alert" size={22} className={styles.guardIcon} />
          {t('config_item_card.discard_title')}
        </span>
      }
      body={
        <>
          <p className={styles.guardText}>{t('config_item_card.discard_message')}</p>
          {q.queue.map((e) => (
            <div key={e.section} className={styles.guardCard}>
              <p className={styles.guardName}>
                <strong>{t(categoryById(e.categoryId)?.labelKey ?? e.categoryId)}</strong>
                <span className={styles.tag}>{t('workspace.settings.review.changes', { count: e.changes.length })}</span>
              </p>
              <p className={styles.guardFields}>
                {t('workspace.settings.review.not_saved', {
                  fields: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(e.changes.map((c) => c.label)),
                })}
              </p>
            </div>
          ))}
        </>
      }
      confirmLabel={t('config_item_card.discard_confirm')}
      cancelLabel={t('config_item_card.keep_editing')}
      danger
      onConfirm={discard}
      onCancel={() => setLink(null)}
    />
  );
}
