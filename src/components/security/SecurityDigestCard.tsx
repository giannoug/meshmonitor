import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSecurityDigest } from './useSecurityDigest';

interface SecurityDigestCardProps {
  sourceId: string | null | undefined;
}

/**
 * Daily Apprise digest settings for one source (#6281). The four per-source keys
 * save with `?sourceId=` and load through the same query (which also shows a
 * global value as the default); the enable switch and send time are global, as
 * the scheduler is.
 */
export const SecurityDigestCard: React.FC<SecurityDigestCardProps> = ({ sourceId }) => {
  const { t } = useTranslation();
  const {
    enabled, setEnabled, appriseUrl, setAppriseUrl, time, setTime, reportType, setReportType, suppressEmpty, setSuppressEmpty,
    format, setFormat, saving, sending, message, save, sendNow,
  } = useSecurityDigest(sourceId);

  return (
    <div className="issues-section digest-section">
      <h3>{t('security.digest_title', 'Security Digest')}</h3>
      <p className="section-description">
        {t('security.digest_description', 'Schedule a daily security report delivered via Apprise.')}
      </p>
      <div className="digest-controls">
        <div className="digest-row">
          <label className="digest-label">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            {t('security.digest_enabled', 'Enable daily digest')}
          </label>
        </div>
        <div className="digest-row">
          <label className="digest-label">{t('security.digest_apprise_url', 'Apprise URL')}</label>
          <input
            type="text"
            className="digest-input"
            value={appriseUrl}
            onChange={e => setAppriseUrl(e.target.value)}
            placeholder="discord://webhook_id/webhook_token"
          />
        </div>
        <div className="digest-row">
          <label className="digest-label">{t('security.digest_time', 'Send at')}</label>
          <input
            type="time"
            className="digest-input digest-time"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
        </div>
        <div className="digest-row">
          <label className="digest-label">{t('security.digest_report_type', 'Report type')}</label>
          <select
            className="digest-input digest-select"
            value={reportType}
            onChange={e => setReportType(e.target.value as 'summary' | 'detailed')}
          >
            <option value="summary">{t('security.digest_summary', 'Summary')}</option>
            <option value="detailed">{t('security.digest_detailed', 'Detailed')}</option>
          </select>
        </div>
        <div className="digest-row">
          <label className="digest-label">{t('security.digest_format', 'Format')}</label>
          <select
            className="digest-input digest-select"
            value={format}
            onChange={e => setFormat(e.target.value as 'text' | 'markdown')}
          >
            <option value="text">{t('security.digest_format_text', 'Plain Text')}</option>
            <option value="markdown">{t('security.digest_format_markdown', 'Markdown')}</option>
          </select>
        </div>
        <div className="digest-row">
          <label className="digest-label">
            <input type="checkbox" checked={suppressEmpty} onChange={e => setSuppressEmpty(e.target.checked)} />
            {t('security.digest_suppress_empty', 'Suppress when no issues')}
          </label>
        </div>
        <div className="digest-actions">
          <button className="digest-save-btn" onClick={save} disabled={saving}>
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
          <button className="digest-send-btn" onClick={sendNow} disabled={sending || !appriseUrl}>
            {sending ? t('common.sending', 'Sending...') : t('security.digest_send_now', 'Send Now')}
          </button>
        </div>
        {message && <div className={`digest-message ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
};
