import React from 'react';
import { useTranslation } from 'react-i18next';
import { STANDARD_LANGUAGES } from '../../types/translation';
import { UiIcon } from '../icons/index';
import { LORA_PACKET_MAX_BYTES, useOutgoingTranslation } from './useOutgoingTranslation';
import styles from './TranslateModal.module.css';

export { LORA_PACKET_MAX_BYTES };

export interface TranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onApply: (translatedText: string) => void;
  defaultTargetLanguage?: string;
  defaultSourceLanguage?: string;
  /** Byte budget for the translated text (default: one LoRa packet). */
  maxBytes?: number;
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  isOpen,
  onClose,
  initialText,
  onApply,
  defaultTargetLanguage = 'ja',
  defaultSourceLanguage = 'auto',
  maxBytes = LORA_PACKET_MAX_BYTES,
}) => {
  const { t } = useTranslation();
  const {
    sourceText,
    setSourceText,
    sourceLang,
    setSourceLang,
    targetLang,
    chooseTargetLang,
    translatedText,
    loading,
    error,
    sourceBytes,
    sourceChars,
    translatedBytes,
    translatedChars,
    isTranslatedOverLimit,
    translate: handleTranslate,
    swapLanguages: handleSwapLanguages,
  } = useOutgoingTranslation({ isOpen, initialText, defaultTargetLanguage, defaultSourceLanguage, maxBytes });

  if (!isOpen) return null;

  const handleApply = () => {
    if (translatedText.trim()) {
      onApply(translatedText);
      onClose();
    }
  };

  const getByteCounterClass = (bytes: number) => {
    if (bytes > maxBytes) return `${styles.byteCounter} ${styles.byteCounterOver}`;
    if (bytes > maxBytes * 0.9) return `${styles.byteCounter} ${styles.byteCounterWarning}`;
    return styles.byteCounter;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>
            <UiIcon name="translate" size={18} />
            {t('messages.translate_modal_title', 'Translate Outgoing Message')}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <UiIcon name="close" size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.langControlsRow}>
            <div className={styles.langSelectorGroup}>
              <label htmlFor="source-lang-select">{t('messages.source_language', 'Source Language')}</label>
              <select
                id="source-lang-select"
                className={styles.langSelect}
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                <option value="auto">{t('messages.auto_detect', 'Auto-detect')}</option>
                {STANDARD_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={styles.swapButton}
              onClick={handleSwapLanguages}
              disabled={sourceLang === 'auto'}
              title={t('messages.swap_languages', 'Swap languages')}
              aria-label={t('messages.swap_languages', 'Swap languages')}
            >
              <UiIcon name="bidirectional" size={14} />
            </button>

            <div className={styles.langSelectorGroup}>
              <label htmlFor="target-lang-select">{t('messages.target_language', 'Target Language')}</label>
              <select
                id="target-lang-select"
                className={styles.langSelect}
                value={targetLang}
                onChange={(e) => chooseTargetLang(e.target.value)}
              >
                {STANDARD_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Source Text Area */}
          <div className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{t('messages.original_text', 'Original Text')}</span>
              <span className={getByteCounterClass(sourceBytes)}>
                {sourceChars} chars • {sourceBytes} / {maxBytes} bytes
              </span>
            </div>
            <textarea
              className={styles.textarea}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t('messages.enter_text_placeholder', 'Enter text to translate...')}
              rows={3}
            />
          </div>

          <div className={styles.translateActionRow}>
            <button
              type="button"
              className={styles.translateButton}
              onClick={handleTranslate}
              disabled={loading || !sourceText.trim()}
            >
              <UiIcon name="translate" size={14} />
              {loading ? t('messages.translating', 'Translating...') : t('messages.translate_btn', 'Translate')}
            </button>
          </div>

          {/* Error Message */}
          {error && <div className={styles.errorMessage}>{error}</div>}

          {/* Translated Text Box */}
          <div className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{t('messages.translated_text', 'Translated Text')}</span>
              {translatedText ? (
                <span className={getByteCounterClass(translatedBytes)}>
                  {translatedChars} chars • {translatedBytes} / {maxBytes} bytes
                </span>
              ) : null}
            </div>
            <div className={styles.translatedBox}>
              {translatedText || (
                <span className={styles.translatedEmpty}>
                  {t('messages.preview_empty', 'Click Translate to generate translation...')}
                </span>
              )}
            </div>
          </div>

          {/* Packet Size Warning */}
          {isTranslatedOverLimit && (
            <div className={styles.packetWarning}>
              <UiIcon name="alert" size={16} />
              <div>
                <strong>{t('messages.packet_limit_warning_title', 'LoRa Packet Payload Warning')}:</strong>{' '}
                {t(
                  'messages.bytes_warning',
                  'Warning: Translated message is {{bytes}} bytes (LoRa limit is ~200-220 bytes)',
                  { bytes: translatedBytes }
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={loading || !translatedText.trim()}
            title={
              !translatedText.trim()
                ? t('messages.translate_first_tooltip', 'Translate message first to replace in draft')
                : t('messages.replace_in_draft', 'Replace in Draft')
            }
            aria-label={t('messages.replace_in_draft', 'Replace in Draft')}
          >
            {t('messages.replace_in_draft', 'Replace in Draft')}
          </button>
        </div>
      </div>
    </div>
  );
};
