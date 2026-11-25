/**
 * The desktop hover bar on a message (board 10-01): Reply, React and
 * Translate, then ⋯ for Resend (ours), Details, Copy text and Delete. It
 * shows on hover and on keyboard focus (the row's `.actions` slot), so Tab
 * reaches every action. An item the viewer may not use is off, with the
 * reason as its tooltip (and as a line in the ⋯ menu); Resend carries its
 * Sends line there. React opens the picker, whose Sends line covers the pick.
 *
 * The row is one Tab stop (its text button); the bar's buttons are reached
 * with the arrow keys (roving, C11) and Esc goes back to the row. Esc and a
 * chosen ⋯ item return focus to ⋯. The menu opens upward when it would pass
 * the bottom of the message list (measured once, on open; C12).
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { MeshMessage } from '../../types/message';
import SendsLine from '../patterns/SendsLine';
import { ACTION_ICON, ACTION_LABEL, ACTION_TITLE, type MessageActionItem, type MessageActionKind } from './messageActions';
import styles from './MessageHoverBar.module.css';

const ON_BAR: ReadonlySet<MessageActionKind> = new Set(['reply', 'react', 'translate']);

export interface MessageHoverBarProps {
  message: MeshMessage;
  items: MessageActionItem[];
  onAction(kind: MessageActionKind, message: MeshMessage): void;
}

export default function MessageHoverBar({ message, items, onAction }: MessageHoverBarProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(false);
  const title = (i: MessageActionItem) => i.reason ?? (ACTION_TITLE[i.kind] ? t(ACTION_TITLE[i.kind]!) : undefined);
  const [up, setUp] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);
  const run = (i: MessageActionItem, fromMenu = false) => {
    setMenu(false);
    // Before the action, so Details remembers ⋯ (the item itself is about to unmount).
    if (fromMenu && more.current?.isConnected) more.current.focus();
    onAction(i.kind, message);
  };

  useLayoutEffect(() => {
    if (!menu || !bar.current || !menuEl.current) return;
    const row = bar.current.closest('[data-message-id]') as HTMLElement | null;
    const list = bar.current.closest('[role="log"]') ?? row?.parentElement;
    if (!row || !list) return;
    const r = row.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    const h = menuEl.current.offsetHeight;
    // Up only when it passes the bottom and fits above (a short list keeps it below).
    setUp(r.bottom + h > l.bottom && r.top - h >= l.top);
  }, [menu]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (menu) {
        e.stopPropagation();
        setMenu(false);
        more.current?.focus();
      } else if (bar.current?.contains(document.activeElement)) {
        // Back to the row's Tab stop.
        const target = bar.current.closest('[data-message-id]')?.querySelector<HTMLElement>('[data-row-target]');
        if (target) {
          e.stopPropagation();
          target.focus();
        }
      }
      return;
    }
    const list = Array.from(bar.current?.querySelectorAll<HTMLButtonElement>('[data-bar-item]:not(:disabled)') ?? []);
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    list[(to + list.length) % list.length].focus();
  };
  const moreLabel = t('workspace.chat.more_actions');

  return (
    <div
      ref={bar}
      className={styles.bar}
      data-open={menu || undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false);
      }}
      onKeyDown={onKeyDown}
    >
      {items.filter((i) => ON_BAR.has(i.kind)).map((i) => (
        <button
          key={i.kind}
          type="button"
          className={styles.action}
          data-bar-item=""
          tabIndex={-1}
          disabled={!!i.reason}
          title={title(i)}
          // The composer has a "Translate" chip too; this one keeps today's name.
          aria-label={i.kind === 'translate' ? t('messages.translate') : undefined}
          onClick={() => run(i)}
        >
          <UiIcon name={ACTION_ICON[i.kind]} size={16} />
          <span>{t(ACTION_LABEL[i.kind])}</span>
        </button>
      ))}
      <button
        ref={more}
        type="button"
        className={`${styles.action} ${styles.more}`}
        data-bar-item=""
        tabIndex={-1}
        aria-label={moreLabel}
        title={moreLabel}
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {menu && (
        <div className={styles.menu} role="group" aria-label={moreLabel} ref={menuEl} data-placement={up ? 'up' : undefined}>
          {items.filter((i) => !ON_BAR.has(i.kind)).map((i) => (
            <div key={i.kind} className={styles.item} data-danger={i.kind === 'delete' || undefined}>
              <button type="button" className={styles.itemButton} disabled={!!i.reason} title={title(i)} onClick={() => run(i, true)}>
                <UiIcon name={ACTION_ICON[i.kind]} size={16} />
                <span>{t(ACTION_LABEL[i.kind])}</span>
              </button>
              {i.reason && <p className={styles.reason}>{i.reason}</p>}
              {i.sends && <div className={styles.sends}><SendsLine>{i.sends}</SendsLine></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
