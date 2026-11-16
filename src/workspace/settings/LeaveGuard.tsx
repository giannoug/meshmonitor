/**
 * The leave guard (Task 5.3, board 17-02's discard sheet): with radio edits
 * queued, a link that leaves this device's settings (another device on the
 * rail or switcher, Home, a tab) asks first, with today's words: Keep editing
 * stays put, Discard changes puts the edits back and follows the link.
 *
 * The app's router has no navigation blocker (it is not a data router), so the
 * guard marks the link click handled before the router sees it: the router's
 * Link then skips its navigation, while the link's own onClick still runs (the
 * phone switcher closes, so one sheet shows at a time, D9c). Discard changes
 * navigates to the link's path itself, as the link may be gone by then.
 * shortcut: browser Back and code that navigates without a link are not
 * caught; upgrade to useBlocker if the app moves to a data router.
 *
 * A page's own unsaved edits (`pending`: a channel's draft, Task 5.5) ask the
 * same way before a link leaves that page, and are listed with the queue.
 */
import { useEffect, useState } from 'react';
import { useHref, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import ConfirmSheet from '../patterns/ConfirmSheet';
import { categoryById } from './categories';
import { useRadioSaveQueue } from './useRadioSaveQueue';
import type { PendingEdit } from './settingsDock';
import styles from './RadioSaveBar.module.css';

export default function LeaveGuard({ base, pending }: { base: string; pending?: PendingEdit | null }) {
  const { t, i18n } = useTranslation();
  const q = useRadioSaveQueue();
  const navigate = useNavigate();
  const baseHref = useHref(base);
  // The router's basename, which the link's href carries and navigate() adds back.
  const basename = baseHref.endsWith(base) ? baseHref.slice(0, baseHref.length - base.length) : '';
  // Where the link goes, and whether it also leaves the device's settings (which drops the queue).
  const [target, setTarget] = useState<{ path: string; out: boolean } | null>(null);
  const queued = !!q && q.queue.length > 0;
  const active = queued || !!pending;
  const pendingHref = pending ? basename + pending.scope : null;

  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      // shortcut: a link's router state (e.g. a DM row's focus) is not carried by Discard changes; carry it if a guarded link needs it.
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const inside = (href: string) => url.pathname === href || url.pathname.startsWith(`${href}/`);
      const out = !inside(baseHref);
      if (!(out && queued) && !(pendingHref && !inside(pendingHref))) return;
      e.preventDefault();
      const path = url.pathname.startsWith(basename) ? url.pathname.slice(basename.length) || '/' : url.pathname;
      setTarget({ path: path + url.search + url.hash, out });
    };
    // Capture, so the click is marked handled before the router's Link sees it.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, queued, pendingHref, baseHref, basename]);

  if (!q) return null;
  const list = (labels: string[]) => new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(labels);
  const discard = () => {
    setTarget(null);
    if (target?.out) q.discard();
    pending?.discard();
    if (target) void navigate(target.path);
  };
  const cards = [
    ...(target?.out ? q.queue.map((e) => ({ key: e.section, title: t(categoryById(e.categoryId)?.labelKey ?? e.categoryId), changes: e.changes.map((c) => c.label), note: undefined })) : []),
    ...(pending ? [{ key: 'pending', title: pending.title, changes: pending.changes, note: pending.note }] : []),
  ];

  return (
    <ConfirmSheet
      open={target !== null && active}
      title={
        <span className={styles.guardTitle}>
          <UiIcon name="alert" size={22} className={styles.guardIcon} />
          {t('config_item_card.discard_title')}
        </span>
      }
      body={
        <>
          <p className={styles.guardText}>{t('config_item_card.discard_message')}</p>
          {cards.map((c) => (
            <div key={c.key} className={styles.guardCard}>
              <p className={styles.guardName}>
                <strong>{c.title}</strong>
                {!c.note && <span className={styles.tag}>{t('workspace.settings.review.changes', { count: c.changes.length })}</span>}
              </p>
              <p className={styles.guardFields}>{c.note ?? t('workspace.settings.review.not_saved', { fields: list(c.changes) })}</p>
            </div>
          ))}
        </>
      }
      confirmLabel={t('config_item_card.discard_confirm')}
      cancelLabel={t('config_item_card.keep_editing')}
      danger
      onConfirm={discard}
      onCancel={() => setTarget(null)}
    />
  );
}
