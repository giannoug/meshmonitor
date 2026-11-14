/**
 * The outgoing-translation state behind `TranslateModal` (languages, the two
 * texts, byte counts, translate and swap), moved out unchanged so the
 * Workspace's translate sheet runs the same code (#6365 Task 2.5, Rule X).
 * Translating calls the server's provider (POST /api/translate); nothing is
 * sent on the mesh.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { getUtf8ByteLength } from '../../utils/text';
import {
  getPreferredOutboundLanguage,
  setPreferredOutboundLanguage,
  extractTranslationError,
} from '../../utils/translationStorage';

export const LORA_PACKET_MAX_BYTES = 200;

export interface OutgoingTranslationOptions {
  isOpen: boolean;
  initialText: string;
  defaultTargetLanguage?: string;
  defaultSourceLanguage?: string;
  maxBytes?: number;
}

export function useOutgoingTranslation({
  isOpen,
  initialText,
  defaultTargetLanguage = 'ja',
  defaultSourceLanguage = 'auto',
  maxBytes = LORA_PACKET_MAX_BYTES,
}: OutgoingTranslationOptions) {
  const { t } = useTranslation();
  const [sourceText, setSourceText] = useState(initialText);
  const [sourceLang, setSourceLang] = useState(defaultSourceLanguage);
  const [targetLang, setTargetLang] = useState(() => getPreferredOutboundLanguage() || defaultTargetLanguage);
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialText when modal opens
  useEffect(() => {
    if (isOpen) {
      setSourceText(initialText);
      setTranslatedText('');
      setError(null);
      const preferred = getPreferredOutboundLanguage();
      setTargetLang(preferred || defaultTargetLanguage || 'ja');
    }
  }, [isOpen, initialText, defaultTargetLanguage]);

  // Byte calculations
  const sourceBytes = useMemo(() => getUtf8ByteLength(sourceText), [sourceText]);
  const sourceChars = sourceText.length;

  const translatedBytes = useMemo(() => getUtf8ByteLength(translatedText), [translatedText]);
  const translatedChars = translatedText.length;

  const isTranslatedOverLimit = translatedBytes > maxBytes;

  const translate = async () => {
    if (!sourceText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiService.translateMessage({
        text: sourceText,
        sourceLang: sourceLang === 'auto' ? undefined : sourceLang,
        targetLang,
      });

      const errorMsg = extractTranslationError(res, t);
      if (errorMsg) {
        setError(errorMsg);
      } else {
        setTranslatedText(res.translatedText);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('messages.failed_to_translate', 'Translation failed'));
    } finally {
      setLoading(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLang !== 'auto') {
      const oldSource = sourceLang;
      const oldTarget = targetLang;
      setSourceLang(oldTarget);
      setTargetLang(oldSource);
      if (translatedText) {
        setSourceText(translatedText);
        setTranslatedText(sourceText);
      }
    }
  };

  /** Picks the target and remembers it as the preferred outbound language. */
  const chooseTargetLang = (val: string) => {
    setTargetLang(val);
    setPreferredOutboundLanguage(val);
  };

  return {
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
    maxBytes,
    translate,
    swapLanguages,
  };
}
