/**
 * Message Translation's Test Connection (#5518), moved out of
 * TranslationConfigSection (#6365 Rule X) so Server › Integrations runs the
 * same check: the active provider's fields as typed, required fields first,
 * then one `POST` through `apiService.testTranslationConfig`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import type { TranslationProvider } from '../../types/translation';
import {
  buildTranslationProviderConfig,
  missingRequiredTranslationFields,
  type TranslationProviderFieldValues,
} from '../../types/translationProviders';

export function useTranslationTest(
  provider: TranslationProvider,
  values: TranslationProviderFieldValues,
  defaultLanguage: string,
  defaultOutgoingLanguage: string,
) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; sample?: string } | null>(null);

  const handleTest = async () => {
    setTestResult(null);

    // The active provider's fields only, under the names the provider reads.
    const providerConfig = buildTranslationProviderConfig(provider, (key) => values[key] ?? '');
    const missing = missingRequiredTranslationFields(provider, providerConfig);
    if (missing.length > 0) {
      setTestResult({
        success: false,
        message: t('settings.translation_required_field', '{{field}} is required', {
          field: t(missing[0].labelKey),
        }),
      });
      return;
    }

    setTesting(true);
    try {
      const res = await apiService.testTranslationConfig({
        provider,
        ...providerConfig,
        targetLanguage: defaultOutgoingLanguage || 'ja',
        sourceLanguage: defaultLanguage || 'en',
      });

      setTestResult({
        success: true,
        message: t('settings.translation_test_sample', 'Success! Sample translation: "{{text}}"', {
          text: res.translatedText,
        }),
        sample: res.translatedText,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: msg || t('settings.translation_test_failed_generic', 'Translation test failed. Check settings and API key.'),
      });
    } finally {
      setTesting(false);
    }
  };

  return { testing, testResult, handleTest };
}
