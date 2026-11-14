/**
 * The desktop hover bar on a message (board 10-01): Reply, React and
 * Translate, then ⋯ for Resend (ours), Details, Copy text and Delete. It
 * shows on hover and on keyboard focus (the row's `.actions` slot), so Tab
 * reaches every action. An item the viewer may not use is off, with the
 * reason as its tooltip (and as a line in the ⋯ menu); Resend carries its
 * Sends line there. React opens the picker, whose Sends line covers the pick.
 */
import { useState } from 'react';
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
  const run = (i: MessageActionItem) => {
    setMenu(false);
    onAction(i.kind, message);
  };
  const moreLabel = t('workspace.chat.more_actions');

  return (
    <div
      className={styles.bar}
      data-open={menu || undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && menu) {
          e.stopPropagation();
          setMenu(false);
        }
      }}
    >
      {items.filter((i) => ON_BAR.has(i.kind)).map((i) => (
        <button
          key={i.kind}
          type="button"
          className={styles.action}
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
        type="button"
        className={`${styles.action} ${styles.more}`}
        aria-label={moreLabel}
        title={moreLabel}
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {menu && (
        <div className={styles.menu} role="group" aria-label={moreLabel}>
          {items.filter((i) => !ON_BAR.has(i.kind)).map((i) => (
            <div key={i.kind} className={styles.item} data-danger={i.kind === 'delete' || undefined}>
              <button type="button" className={styles.itemButton} disabled={!!i.reason} title={title(i)} onClick={() => run(i)}>
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
