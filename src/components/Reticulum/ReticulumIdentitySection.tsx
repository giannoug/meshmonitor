/**
 * ReticulumIdentitySection — the LXMF identity block of a Reticulum source's
 * Configuration page (#6011): destination hash, display name, "Announce now"
 * and the periodic announce interval. Shown in every mode.
 *
 * Routes (all `ok()` envelopes, so bodies are read via `.data`):
 *   GET  /api/sources/:id/reticulum/announce-settings   configuration:read
 *   PUT  /api/sources/:id/reticulum/display-name        configuration:write
 *   PUT  /api/sources/:id/reticulum/announce-interval   configuration:write
 *   POST /api/sources/:id/reticulum/announce            configuration:write
 *
 * The server enforces the 60 s "Announce now" cooldown and answers 429 with
 * `retryAfterSeconds`; this view only mirrors it, counting down from what
 * the server said. Saving the name never announces.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { ANNOUNCE_INTERVAL_CHOICES, useReticulumIdentity } from './hooks/useReticulumIdentity';
import styles from './ReticulumIdentitySection.module.css';

interface ReticulumIdentitySectionProps {
  sourceId: string;
  canWrite: boolean;
}

export const ReticulumIdentitySection: React.FC<ReticulumIdentitySectionProps> = ({ sourceId, canWrite }) => {
  const { t } = useTranslation();
  const {
    settings, nameDraft, setNameDraft, intervalDraft, setIntervalDraft, saving, announcing, error, message,
    cooldownLeft, maxName, nameTooLong, nameChanged, intervalChanged, connected, save, announce,
  } = useReticulumIdentity(sourceId);

  const formatTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : t('reticulum.identity.never', 'Never'));

  return (
    <section className={styles.section} data-testid="reticulum-identity-section">
      <h3 className={styles.heading}>{t('reticulum.identity.heading', 'LXMF Identity')}</h3>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {message && <div className={styles.success} aria-live="polite">{message}</div>}

      <dl className={styles.facts}>
        <dt>{t('reticulum.identity.destinationHash', 'Destination hash')}</dt>
        <dd>
          {settings?.destinationHash
            ? <code className={styles.hash}>{settings.destinationHash}</code>
            : <span className={styles.muted}>{t('reticulum.identity.notConnected', 'Not connected')}</span>}
        </dd>
        <dt>{t('reticulum.identity.lastAnnounce', 'Last announce')}</dt>
        <dd>{formatTime(settings?.lastAnnounceAt ?? null)}</dd>
        {settings?.nextPeriodicAnnounceAt ? (
          <>
            <dt>{t('reticulum.identity.nextAnnounce', 'Next periodic announce')}</dt>
            <dd>{formatTime(settings.nextPeriodicAnnounceAt)}</dd>
          </>
        ) : null}
      </dl>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>{t('reticulum.identity.displayName', 'Display name')}</span>
          <input
            type="text"
            value={nameDraft}
            maxLength={maxName}
            disabled={!canWrite || saving}
            placeholder={t('reticulum.identity.anonymous', 'Anonymous')}
            aria-invalid={nameTooLong || undefined}
            onChange={e => setNameDraft(e.target.value)}
          />
          <span className={styles.help}>
            {t('reticulum.identity.displayNameHelp', 'Up to {{max}} characters. Leave empty to stay anonymous. Saving does not announce.', { max: maxName })}
          </span>
        </label>

        <label className={styles.field}>
          <span>{t('reticulum.identity.interval', 'Periodic announce')}</span>
          <select
            value={intervalDraft}
            disabled={!canWrite || saving}
            onChange={e => setIntervalDraft(Number(e.target.value))}
          >
            {ANNOUNCE_INTERVAL_CHOICES.map(h => (
              <option key={h} value={h}>
                {h === 0
                  ? t('reticulum.identity.intervalOff', 'Off')
                  : t('reticulum.identity.intervalHours', 'Every {{count}} h', { count: h })}
              </option>
            ))}
          </select>
          {intervalDraft > 0 && (
            <span className={styles.warning}>
              <UiIcon name="alert" size={12} />
              {t(
                'reticulum.identity.intervalWarning',
                'Each announce goes out on every interface, LoRa included, and transport nodes repeat it. Keep the interval long on a busy or slow network.',
              )}
            </span>
          )}
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={() => void save()}
          disabled={!canWrite || saving || nameTooLong || (!nameChanged && !intervalChanged)}
        >
          {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </button>
        <button
          className={styles.secondaryBtn}
          onClick={() => void announce()}
          disabled={!canWrite || !connected || announcing || cooldownLeft > 0}
          title={!connected ? t('reticulum.identity.announceOffline', 'Connect the source to announce') : undefined}
        >
          <UiIcon name="send" size={14} />
          {cooldownLeft > 0
            ? t('reticulum.identity.announceCooldown', 'Announce now ({{seconds}} s)', { seconds: cooldownLeft })
            : t('reticulum.identity.announceNow', 'Announce now')}
        </button>
      </div>
      <p className={styles.help}>
        {t(
          'reticulum.identity.announceHelp',
          'An announce tells the network this identity exists and carries its display name. Once a minute at most.',
        )}
      </p>
    </section>
  );
};

export default ReticulumIdentitySection;
