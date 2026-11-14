/**
 * Translate outgoing message (board 10-09): today's TranslateModal content in
 * a Sheet, through the same state (`useOutgoingTranslation`). From / To with
 * Swap, the original, the translated preview with its byte count, today's
 * LoRa payload warning, Translate and Replace in Draft. It changes the draft
 * only: translating is a server call (POST /api/translate), and nothing is
 * sent on the mesh until Send. Mounted only while open.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useOutgoingTranslation } from '../../components/translation/useOutgoingTranslation';
import { STANDARD_LANGUAGES } from '../../types/translation';
import Sheet from '../patterns/Sheet';
import styles from './TranslateComposerSheet.module.css';

export interface TranslateComposerSheetProps {
  initialText: string;
  defaultTargetLanguage?: string;
  defaultSourceLanguage?: string;
  onApply(text: string): void;
  onClose(): void;
}

export default function TranslateComposerSheet({ initialText, defaultTargetLanguage, defaultSourceLanguage, onApply, onClose }: TranslateComposerSheetProps) {
  const { t } = useTranslation();
  const id = useId();
  const tr = useOutgoingTranslation({ isOpen: true, initialText, defaultTargetLanguage, defaultSourceLanguage });
  const counter = (chars: number, bytes: number) => (
    <span className={styles.counter} data-level={bytes > tr.maxBytes ? 'over' : bytes > tr.maxBytes * 0.9 ? 'warn' : undefined}>
      {chars} chars • {bytes} / {tr.maxBytes} bytes
    </span>
  );
  const translated = tr.translatedText.trim();
  const apply = () => {
    if (!translated) return;
    onApply(tr.translatedText);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('messages.translate_modal_title', 'Translate Outgoing Message')}
      footer={
        <>
          <div className={styles.buttons}>
            <button type="button" className={styles.translate} onClick={() => void tr.translate()} disabled={tr.loading || !tr.sourceText.trim()}>
              <UiIcon name="translate" size={16} />
              {tr.loading ? t('messages.translating', 'Translating...') : t('messages.translate_btn', 'Translate')}
            </button>
            <button
              type="button"
              className={styles.apply}
              onClick={apply}
              disabled={tr.loading || !translated}
              title={translated ? undefined : t('messages.translate_first_tooltip', 'Translate message first to replace in draft')}
            >
              {t('messages.replace_in_draft', 'Replace in Draft')}
            </button>
          </div>
          <p className={styles.note}>{t('workspace.chat.translate_note')}</p>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.langs}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('messages.source_language', 'Source Language')}</span>
            <select className={styles.select} value={tr.sourceLang} onChange={(e) => tr.setSourceLang(e.target.value)}>
              <option value="auto">{t('messages.auto_detect', 'Auto-detect')}</option>
              {STANDARD_LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            className={styles.swap}
            onClick={tr.swapLanguages}
            disabled={tr.sourceLang === 'auto'}
            title={t('messages.swap_languages', 'Swap languages')}
            aria-label={t('messages.swap_languages', 'Swap languages')}
          >
            <UiIcon name="bidirectional" size={18} />
          </button>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('messages.target_language', 'Target Language')}</span>
            <select className={styles.select} value={tr.targetLang} onChange={(e) => tr.chooseTargetLang(e.target.value)}>
              {STANDARD_LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <label htmlFor={`${id}-original`} className={styles.sectionLabel}>{t('messages.original_text', 'Original Text')}</label>
            {counter(tr.sourceChars, tr.sourceBytes)}
          </div>
          <textarea
            id={`${id}-original`}
            className={styles.textarea}
            value={tr.sourceText}
            onChange={(e) => tr.setSourceText(e.target.value)}
            placeholder={t('messages.enter_text_placeholder', 'Enter text to translate...')}
            rows={3}
          />
        </div>

        {tr.error && <p className={styles.error} role="alert">{tr.error}</p>}

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>{t('messages.translated_text', 'Translated Text')}</span>
            {tr.translatedText ? counter(tr.translatedChars, tr.translatedBytes) : null}
          </div>
          <div className={styles.preview} aria-live="polite">
            {tr.translatedText || <span className={styles.empty}>{t('messages.preview_empty', 'Click Translate to generate translation...')}</span>}
          </div>
        </div>

        {tr.isTranslatedOverLimit && (
          <div className={styles.warning} role="alert">
            <strong>{t('messages.packet_limit_warning_title', 'LoRa Packet Payload Warning')}</strong>
            <span>{t('messages.bytes_warning', { bytes: tr.translatedBytes })}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
