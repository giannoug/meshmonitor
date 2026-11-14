/**
 * The phone's long-press sheet on a message (board 10-08): the message, React
 * (the first five of the picker's set, Custom for the full picker) with its
 * Sends line, then Reply, Translate, Resend (ours, with its Sends line),
 * Details, Copy text and Delete. Items the viewer may not use stay listed,
 * off, with the reason. Every pick closes the sheet first.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useSettings } from '../../contexts/SettingsContext';
import type { MeshMessage } from '../../types/message';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import {
  ACTION_HINT,
  ACTION_ICON,
  ACTION_LABEL,
  ACTION_TITLE,
  type MessageActionItem,
  type MessageActionKind,
  tapbackSet,
} from './messageActions';
import styles from './MessageActionsSheet.module.css';

const QUICK_EMOJIS = 5;

export interface MessageActionsSheetProps {
  message: MeshMessage;
  /** "You · 10:21" */
  title: string;
  items: MessageActionItem[];
  translateHint: string;
  onAction(kind: MessageActionKind, message: MeshMessage, emoji?: string): void;
  onClose(): void;
}

export default function MessageActionsSheet({ message, title, items, translateHint, onAction, onClose }: MessageActionsSheetProps) {
  const { t } = useTranslation();
  const { tapbackEmojis } = useSettings();
  const react = items.find((i) => i.kind === 'react');
  const run = (kind: MessageActionKind, emoji?: string) => {
    onClose();
    onAction(kind, message, emoji);
  };
  const hint = (kind: MessageActionKind) =>
    kind === 'translate' ? translateHint : ACTION_HINT[kind] ? t(ACTION_HINT[kind]!) : undefined;

  return (
    <Sheet open side="bottom" onClose={onClose} title={title}>
      {message.text && <p className={styles.quote}>{message.text}</p>}
      {react && (
        <section className={styles.react} aria-label={t('workspace.chat.react')}>
          <h3 className={styles.label}>{t('workspace.chat.react')}</h3>
          <div className={styles.quick}>
            {tapbackSet(tapbackEmojis).slice(0, QUICK_EMOJIS).map(({ emoji, title: name }) => (
              <button
                key={emoji}
                type="button"
                className={styles.emoji}
                disabled={!!react.reason}
                title={react.reason ?? name}
                onClick={() => run('react', emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className={styles.custom}
              disabled={!!react.reason}
              title={react.reason ?? t('emoji_picker.custom', 'Custom emoji')}
              onClick={() => run('react')}
            >
              <UiIcon name="plus" size={16} /> {t('workspace.chat.custom')}
            </button>
          </div>
          {react.reason && <p className={styles.reason}>{react.reason}</p>}
          {react.sends && <SendsLine>{react.sends}</SendsLine>}
        </section>
      )}
      <ul className={styles.list}>
        {items.filter((i) => i.kind !== 'react').map((i) => {
          const second = hint(i.kind);
          return (
            <li key={i.kind} className={styles.item} data-danger={i.kind === 'delete' || undefined}>
              <button
                type="button"
                className={styles.itemButton}
                disabled={!!i.reason}
                title={i.reason ?? (ACTION_TITLE[i.kind] ? t(ACTION_TITLE[i.kind]!) : undefined)}
                onClick={() => run(i.kind)}
              >
                <UiIcon name={ACTION_ICON[i.kind]} size={20} />
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{t(ACTION_LABEL[i.kind])}</span>
                  {second && <span className={styles.hint}>{second}</span>}
                </span>
              </button>
              {i.reason && <p className={styles.reason}>{i.reason}</p>}
              {i.sends && <div className={styles.sends}><SendsLine>{i.sends}</SendsLine></div>}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
