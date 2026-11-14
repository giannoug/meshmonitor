/**
 * React with an emoji (boards 18-05, 18-06): today's EmojiPickerModal set
 * (the saved set from Appearance, else the defaults) and its custom input
 * (up to 10 characters) in a Sheet, with the Sends line. Picking one sends
 * 1 tapback, then closes. Mounted only while open, so the input starts closed.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useSettings } from '../../contexts/SettingsContext';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import { CUSTOM_EMOJI_MAX_LENGTH, tapbackSet } from './messageActions';
import styles from './EmojiPickerSheet.module.css';

export interface EmojiPickerSheetProps {
  /** "Sends 1 tapback to …" */
  sends: string;
  onPick(emoji: string): void;
  onClose(): void;
}

export default function EmojiPickerSheet({ sends, onPick, onClose }: EmojiPickerSheetProps) {
  const { t } = useTranslation();
  const { tapbackEmojis } = useSettings();
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = custom.trim();

  useEffect(() => {
    if (showCustom) inputRef.current?.focus();
  }, [showCustom]);

  const pick = (emoji: string) => {
    onClose();
    onPick(emoji);
  };

  return (
    <Sheet open onClose={onClose} title={t('emoji_picker.title', 'React with an emoji')}>
      <div className={styles.grid}>
        {tapbackSet(tapbackEmojis).map(({ emoji, title }) => (
          <button key={emoji} type="button" className={styles.emoji} title={title} onClick={() => pick(emoji)}>
            {emoji}
          </button>
        ))}
        <button
          type="button"
          className={styles.custom}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((s) => !s)}
        >
          <UiIcon name="edit" size={16} /> {t('emoji_picker.custom', 'Custom emoji')}
        </button>
      </div>
      {showCustom && (
        <form
          className={styles.customRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) pick(trimmed);
          }}
        >
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              // As today: Escape closes the input, not the picker.
              if (e.key === 'Escape') {
                e.stopPropagation();
                setShowCustom(false);
                setCustom('');
              }
            }}
            placeholder={t('emoji_picker.custom_placeholder', 'Type or paste emoji...')}
            aria-label={t('emoji_picker.custom', 'Custom emoji')}
            maxLength={CUSTOM_EMOJI_MAX_LENGTH}
          />
          <button type="submit" className={styles.send} disabled={!trimmed}>
            <UiIcon name="send" size={16} /> {t('common.send', 'Send')}
          </button>
        </form>
      )}
      <div className={styles.sends}>
        <SendsLine>{sends}</SendsLine>
      </div>
    </Sheet>
  );
}
