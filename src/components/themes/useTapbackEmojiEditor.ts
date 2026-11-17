/**
 * Tapback emojis: the list and its add / remove / reset, with today's checks
 * and toasts, moved out of TapbackEmojiSettings unchanged (Rule X) for the
 * Workspace Appearance page (#6365). The confirm before a reset stays with the
 * caller (Classic: `window.confirm`; Workspace: ConfirmSheet).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { DEFAULT_TAPBACK_EMOJIS, type TapbackEmoji } from '../EmojiPickerModal/EmojiPickerModal';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import { isEmoji } from '../../utils/text';

export function useTapbackEmojiEditor() {
  const { t } = useTranslation();
  const { tapbackEmojis, setTapbackEmojis } = useSettings();
  const { showToast } = useToast();

  const [newEmoji, setNewEmoji] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddEmoji = async () => {
    const trimmedEmoji = newEmoji.trim();
    const trimmedTitle = newTitle.trim() || trimmedEmoji;

    if (!trimmedEmoji) {
      showToast(t('settings.tapback_emoji_required', 'Please enter an emoji'), 'error');
      return;
    }

    // Validate that the input is actually an emoji (not regular text)
    if (!isEmoji(trimmedEmoji)) {
      showToast(t('settings.tapback_invalid_emoji', 'Please enter a valid emoji, not text'), 'error');
      return;
    }

    // Check if emoji already exists
    if (tapbackEmojis.some(e => e.emoji === trimmedEmoji)) {
      showToast(t('settings.tapback_emoji_exists', 'This emoji is already in the list'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const newEmojiEntry: TapbackEmoji = {
        emoji: trimmedEmoji,
        title: trimmedTitle
      };

      await setTapbackEmojis([...tapbackEmojis, newEmojiEntry]);
      setNewEmoji('');
      setNewTitle('');
      showToast(t('settings.tapback_emoji_added', 'Emoji added'), 'success');
    } catch (error) {
      logger.error('Failed to add emoji:', error);
      showToast(t('settings.tapback_save_failed', 'Failed to save emoji'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveEmoji = async (emojiToRemove: string) => {
    if (tapbackEmojis.length <= 1) {
      showToast(t('settings.tapback_min_emojis', 'You must have at least one emoji'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const filtered = tapbackEmojis.filter(e => e.emoji !== emojiToRemove);
      await setTapbackEmojis(filtered);
      showToast(t('settings.tapback_emoji_removed', 'Emoji removed'), 'success');
    } catch (error) {
      logger.error('Failed to remove emoji:', error);
      showToast(t('settings.tapback_save_failed', 'Failed to save changes'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** Puts back today's defaults; the caller has already asked. */
  const resetToDefaults = async () => {
    setIsSaving(true);
    try {
      await setTapbackEmojis([...DEFAULT_TAPBACK_EMOJIS]);
      showToast(t('settings.tapback_reset_success', 'Emojis reset to defaults'), 'success');
    } catch (error) {
      logger.error('Failed to reset emojis:', error);
      showToast(t('settings.tapback_save_failed', 'Failed to reset emojis'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    tapbackEmojis,
    newEmoji,
    setNewEmoji,
    newTitle,
    setNewTitle,
    isSaving,
    handleAddEmoji,
    handleRemoveEmoji,
    resetToDefaults,
  };
}
