/**
 * Server › Analytics (13-12's right half; s13n0 draws it beside Security &
 * privacy only to fit the canvas). Admins only, as today's section and the
 * server (ADMIN_ONLY_SETTINGS_KEYS: the provider injects a script into every
 * visitor's page). The provider and its fields keep their own Save (s13n1):
 * nothing is written while they are edited, and Save writes today's two keys
 * together, the config as today's JSON string, in the request body only.
 * Changing the provider starts its fields empty, as today. Today has no Test.
 *
 * Mesh impact: none. Each visitor's browser talks to the chosen service.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { ApiError } from '../../services/api';
import SettingGroup from '../settings/kit/SettingGroup';
import { useServerSettings } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import { useSaveSettings } from './settingsWrites';
import ServerFrame from './ServerFrame';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

const PROVIDERS = ['none', 'ga4', 'cloudflare', 'posthog', 'plausible', 'umami', 'matomo', 'custom'] as const;

/** Today's fields per provider (SettingsTab): config key, label/description keys, placeholder. */
const FIELDS: Record<string, Array<{ key: string; i18n: string; placeholder?: string; area?: boolean }>> = {
  ga4: [{ key: 'measurementId', i18n: 'measurement_id', placeholder: 'G-XXXXXXXXXX' }],
  cloudflare: [{ key: 'beaconToken', i18n: 'beacon_token' }],
  posthog: [
    { key: 'apiKey', i18n: 'api_key', placeholder: 'phc_...' },
    { key: 'apiHost', i18n: 'api_host', placeholder: 'https://app.posthog.com' },
  ],
  plausible: [{ key: 'domain', i18n: 'domain', placeholder: 'example.com' }],
  umami: [
    { key: 'websiteId', i18n: 'website_id' },
    { key: 'scriptUrl', i18n: 'script_url', placeholder: 'https://analytics.example.com/script.js' },
  ],
  matomo: [
    { key: 'siteUrl', i18n: 'site_url', placeholder: 'https://matomo.example.com' },
    { key: 'siteId', i18n: 'site_id', placeholder: '1' },
  ],
  custom: [
    { key: 'script', i18n: 'custom_script', placeholder: '<script src="https://..."></script>', area: true },
    { key: 'cspDomains', i18n: 'custom_csp', placeholder: 'https://analytics.example.com https://cdn.example.com' },
  ],
};

const parseConfig = (raw?: string): Record<string, string> => {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export default function AnalyticsPage() {
  const { t } = useTranslation();
  return (
    <ServerFrame categoryId="analytics" title={t('settings.analytics')} scope={t('workspace.server.analytics_scope')} icon="reports" gate="admin">
      <AnalyticsForm />
    </ServerFrame>
  );
}

function AnalyticsForm() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { data = {} } = useServerSettings();
  const save = useSaveSettings();
  const storedProvider = data.analyticsProvider || 'none';
  const storedConfig = data.analyticsConfig ?? JSON.stringify({});
  const [draft, setDraft] = useState<{ provider: string; config: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const provider = draft?.provider ?? storedProvider;
  const config = draft?.config ?? parseConfig(storedConfig);
  const dirty = draft !== null && (draft.provider !== storedProvider || JSON.stringify(draft.config) !== JSON.stringify(parseConfig(storedConfig)));
  const edit = (next: { provider: string; config: Record<string, string> }) => {
    setStatus({ saved: false });
    setDraft(next);
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await save({ analyticsProvider: provider, analyticsConfig: JSON.stringify(config) });
      setDraft(null);
      setStatus({ saved: true });
    } catch (error) {
      setStatus({ saved: false, error: error instanceof ApiError && error.message ? error.message : t('settings.save_failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingGroup title={t('workspace.server.visitor_analytics')}>
        <div className={styles.form} data-phone={isPhone || undefined}>
          <label className={styles.field}>
            <span className={pages.infoLabel}>{t('settings.analytics_provider_label')}</span>
            <span className={pages.infoHelp}>{t('settings.analytics_provider_description')}</span>
            <select
              className={pages.keyInput}
              aria-label={t('settings.analytics_provider_label')}
              value={provider}
              // Today: a new provider starts with an empty config.
              onChange={(e) => edit({ provider: e.target.value, config: {} })}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {t(`settings.analytics_provider_${p}`)}
                </option>
              ))}
            </select>
          </label>
          {(FIELDS[provider] ?? []).map((f) => (
            <label key={f.key} className={styles.field}>
              <span className={pages.infoLabel}>{t(`settings.analytics_${f.i18n}_label`)}</span>
              <span className={pages.infoHelp}>{t(`settings.analytics_${f.i18n}_description`)}</span>
              {f.area ? (
                <textarea
                  className={styles.textarea}
                  aria-label={t(`settings.analytics_${f.i18n}_label`)}
                  rows={6}
                  spellCheck={false}
                  placeholder={f.placeholder}
                  value={config[f.key] || ''}
                  onChange={(e) => edit({ provider, config: { ...config, [f.key]: e.target.value } })}
                />
              ) : (
                <input
                  type="text"
                  className={pages.keyInput}
                  aria-label={t(`settings.analytics_${f.i18n}_label`)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={f.placeholder}
                  value={config[f.key] || ''}
                  onChange={(e) => edit({ provider, config: { ...config, [f.key]: e.target.value } })}
                />
              )}
            </label>
          ))}
          <div className={styles.formActions}>
            {status.error && (
              <span className={pages.error} role="alert">
                <UiIcon name="alert" size={14} />
                {status.error}
              </span>
            )}
            {status.saved && <span className={pages.infoHelp} role="status">{t('workspace.settings.saved')}</span>}
            <button type="button" className={`${pages.button} ${pages.primary}`} disabled={busy || !dirty} onClick={() => void onSave()}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </SettingGroup>
      <p className={styles.notice}>
        <UiIcon name="alert" size={16} />
        <span>{t('settings.analytics_warning')}</span>
      </p>
    </>
  );
}
