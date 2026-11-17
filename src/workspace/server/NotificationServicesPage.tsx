/**
 * Server › Notification services (boards 18-11 desktop, 18-12 phone; s18n6):
 * admins only, as today.
 *
 * - Apprise API Server URL with Test Connection, and External URL: today's
 *   Global Settings rows. Each keeps its own Save (s13n1), stored trimmed.
 *   Test Connection is today's: one `POST /api/settings/test-apprise` with
 *   the URL as typed, only when pressed, no retry; its result shows below.
 * - The VAPID block, moved here from the admin part of each device's
 *   Notifications (s18n6): status, active subscriptions, the public key's
 *   first 50 characters, and the contact email with Update Contact Email
 *   (`PUT /api/push/vapid-subject`, then today's status re-read). Today has no
 *   generate or regenerate.
 *
 * Mesh impact: none. Apprise and Web Push run on the MeshMonitor server.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { logger } from '../../utils/logger';
import StateView from '../patterns/StateView';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingRow from '../settings/kit/SettingRow';
import { SavedLine } from '../settings/categories/autosave';
import { useIsPhone } from '../shell/useIsPhone';
import ServerFrame from './ServerFrame';
import SaveField from './SaveField';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

interface VapidStatus {
  configured: boolean;
  publicKey: string | null;
  subject: string | null;
  subscriptionCount: number;
}

const VAPID_KEY = ['workspace', 'vapidStatus'];

export default function NotificationServicesPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <ServerFrame
      categoryId="notification-services"
      title={t('workspace.server.nav.notification_services')}
      scope={t('workspace.server.scope_admins')}
      icon="notifications"
      gate="admin"
    >
      <div className={prefs.columns} data-phone={isPhone || undefined}>
        <div className={prefs.column}>
          <AppriseGroup />
          <SettingGroup title={t('workspace.server.links_in_notifications')}>
            <SaveField
              k="externalUrl"
              id="notification-services.externalUrl"
              type="url"
              label={t('settings.external_url_label', 'External URL')}
              help={t('settings.external_url_description')}
              placeholder="https://mesh.example.com"
            />
          </SettingGroup>
        </div>
        <div className={prefs.column}>
          <VapidGroup />
        </div>
      </div>
    </ServerFrame>
  );
}

function AppriseGroup() {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Today's handleTestAppriseConnection (SettingsTab): the URL as typed, one request.
  const test = async (url: string) => {
    setTesting(true);
    setResult(null);
    try {
      const response = await csrfFetch(`${appBasename}/api/settings/test-apprise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() || undefined }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        setResult({ ok: false, message: errBody.error || `HTTP ${response.status}` });
        return;
      }
      const data: { ok: boolean; error?: string; latencyMs?: number } = await response.json();
      setResult(
        data.ok
          ? { ok: true, message: t('settings.apprise_server_test_success', 'Connected successfully ({{latency}}ms)', { latency: data.latencyMs ?? 0 }) }
          : { ok: false, message: t('settings.apprise_server_test_failure', 'Connection failed: {{error}}', { error: data.error || 'Unknown error' }) },
      );
    } catch (error) {
      logger.error('Failed to test Apprise connection:', error);
      setResult({
        ok: false,
        message: t('settings.apprise_server_test_failure', 'Connection failed: {{error}}', { error: error instanceof Error ? error.message : String(error) }),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingGroup title={t('settings.apprise_server_section', 'Apprise API Server')}>
      <p className={styles.cardPara}>{t('settings.apprise_server_description')}</p>
      <SaveField
        k="appriseApiServerUrl"
        id="notification-services.appriseApiServerUrl"
        type="url"
        label={t('settings.apprise_server_url_label', 'Apprise API Server URL')}
        help={t('settings.apprise_server_url_description')}
        placeholder="http://localhost:8000"
        extra={(url) => (
          <button type="button" className={pages.button} disabled={testing} onClick={() => void test(url)}>
            {testing ? t('settings.apprise_server_testing', 'Testing…') : t('settings.apprise_server_test', 'Test Connection')}
          </button>
        )}
        below={
          result && (
            <p className={styles.result} data-ok={result.ok || undefined} role="status">
              <UiIcon name={result.ok ? 'check' : 'error'} size={14} />
              {result.message}
            </p>
          )
        }
      />
    </SettingGroup>
  );
}

function VapidGroup() {
  const { t } = useTranslation();
  const vapid = useQuery({
    queryKey: VAPID_KEY,
    queryFn: () => apiService.get<VapidStatus>('/api/push/status'),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const [subject, setSubject] = useState<string | null>(null);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const [busy, setBusy] = useState(false);
  const data = vapid.data;

  const update = async () => {
    setBusy(true);
    try {
      await apiService.put('/api/push/vapid-subject', { subject: subject ?? data?.subject ?? '' });
      setState({ saved: true });
      setSubject(null);
      await vapid.refetch();
    } catch (error) {
      logger.error('Failed to update VAPID subject:', error);
      setState({ saved: false, error: t('notifications.alert_update_email_failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingGroup title={t('workspace.server.web_push')}>
        {vapid.isLoading && <StateView kind="loading" />}
        {vapid.isError && <StateView kind="error" onRetry={() => void vapid.refetch()} />}
        {data && (
          <>
            <SettingRow id="notification-services.vapidStatus" label={t('common.status')}>
              <span className={styles.status} data-ok={data.configured || undefined}>
                <UiIcon name={data.configured ? 'check' : 'error'} size={14} />
                {data.configured ? t('notifications.configured') : t('notifications.not_configured')}
              </span>
            </SettingRow>
            <SettingRow id="notification-services.subscriptions" label={t('notifications.active_subscriptions')}>
              <span className={styles.value}>{data.subscriptionCount}</span>
            </SettingRow>
            <SettingRow id="notification-services.publicKey" label={t('notifications.public_key')} stacked>
              <code className={styles.code}>{data.publicKey ? data.publicKey.substring(0, 50) + '...' : t('notifications.not_set')}</code>
            </SettingRow>
            <SettingRow id="notification-services.vapidSubject" label={t('notifications.contact_email')} help={t('workspace.server.contact_email_help')} stacked>
              <div className={styles.fieldLine}>
                <input
                  type="text"
                  className={pages.keyInput}
                  aria-label={t('notifications.contact_email')}
                  value={subject ?? data.subject ?? ''}
                  placeholder="mailto:admin@example.com"
                  onChange={(e) => {
                    setState({ saved: false });
                    setSubject(e.target.value);
                  }}
                />
                <button type="button" className={`${pages.button} ${pages.primary}`} disabled={busy} onClick={() => void update()}>
                  {busy ? t('common.updating') : t('notifications.update_contact_email')}
                </button>
              </div>
              <SavedLine status={state} />
            </SettingRow>
          </>
        )}
      </SettingGroup>
      <p className={prefs.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.server.web_push_note')}</span>
      </p>
      <p className={prefs.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.settings.savebar.sends_nothing')}</span>
      </p>
    </>
  );
}
