/**
 * The Security digest's state, load, Save and Send now for one source, moved
 * out of SecurityDigestCard (#6365, Rule X) for the Workspace Security page.
 * The four per-source keys save with `?sourceId=` and load through the same
 * query (which also shows a global value as the default); the enable switch
 * and send time are global, as the scheduler is. Send now posts the digest to
 * the Apprise URL from the server; nothing goes on the mesh.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

export function useSecurityDigest(sourceId: string | null | undefined) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [appriseUrl, setAppriseUrl] = useState('');
  const [time, setTime] = useState('06:00');
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');
  const [suppressEmpty, setSuppressEmpty] = useState(true);
  const [format, setFormat] = useState<'text' | 'markdown'>('text');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const q = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
        const settings = await api.get<Record<string, string>>(`/api/settings${q}`);
        if (cancelled) return;
        setEnabled(settings.securityDigestEnabled === 'true');
        setAppriseUrl(settings.securityDigestAppriseUrl || '');
        setTime(settings.securityDigestTime || '06:00');
        setReportType((settings.securityDigestReportType as 'summary' | 'detailed') || 'summary');
        setSuppressEmpty(settings.securityDigestSuppressEmpty !== 'false');
        setFormat((settings.securityDigestFormat as 'text' | 'markdown') || 'text');
      } catch {
        // Settings may not exist yet, use defaults
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sourceId]);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      // The four digest keys that belong to one source; the service falls back to the global row for each.
      const perSource = {
        securityDigestAppriseUrl: appriseUrl,
        securityDigestReportType: reportType,
        securityDigestSuppressEmpty: String(suppressEmpty),
        securityDigestFormat: format,
      };
      const q = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
      await api.post(`/api/settings${q}`, perSource);
      await api.post('/api/settings', {
        securityDigestEnabled: String(enabled),
        securityDigestTime: time,
      });
      setMessage({ type: 'success', text: t('common.saved', 'Settings saved') });
    } catch {
      setMessage({ type: 'error', text: t('common.save_failed', 'Failed to save settings') });
    } finally {
      setSaving(false);
    }
  }, [sourceId, appriseUrl, reportType, suppressEmpty, format, enabled, time, t]);

  const sendNow = useCallback(async () => {
    setSending(true);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; skipped?: boolean; message: string }>(
        '/api/security/digest/send',
        sourceId ? { sourceId } : {},
      );
      if (result.skipped) {
        setMessage({ type: 'success', text: t('security.digest_skipped', 'Skipped: no Apprise URL is set for this source.') });
      } else {
        setMessage({ type: result.success ? 'success' : 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.failed', 'Failed to send digest') });
    } finally {
      setSending(false);
    }
  }, [sourceId, t]);

  return {
    enabled, setEnabled, appriseUrl, setAppriseUrl, time, setTime, reportType, setReportType, suppressEmpty, setSuppressEmpty,
    format, setFormat, saving, sending, message, save, sendNow,
  };
}
