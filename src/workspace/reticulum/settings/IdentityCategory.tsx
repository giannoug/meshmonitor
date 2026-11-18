/**
 * Settings › LXMF identity (boards 9-06, 9-15; notes s9n1, s9n3), on the row
 * kit, from today's ReticulumIdentitySection (`useReticulumIdentity`):
 *
 * - Identity: the destination hash with Copy, the display name and the
 *   periodic announce (Off, or every 1–24 h, today's choices and warning),
 *   the last announce and, when one is due, the next periodic announce.
 *   Save sends only what changed, once per press; saving never announces.
 * - Announce: Announce now, one announce per press on every interface. The
 *   server allows one every 60 s and answers early presses with the time
 *   left; the button counts that down once a second (display only, nothing
 *   is sent while it counts).
 *
 * Without today's `configuration:write` the page says so and every input is
 * off. There is no key here to export or import: today's routes expose only
 * the public destination hash.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsPhone } from '../../shell/useIsPhone';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { UiIcon } from '../../../components/icons';
import { ANNOUNCE_INTERVAL_CHOICES, useReticulumIdentity } from '../../../components/Reticulum/hooks/useReticulumIdentity';
import { formatRelativeTime, formatTimeOrDate } from '../../../utils/datetime';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import { Warn } from '../../settings/categories/RowParts';
import LeaveGuard from '../../settings/LeaveGuard';
import { useSettingsHeader } from '../../settings/settingsDock';
import { McPage } from '../../meshcore/settings/mcShared';
import mc from '../../meshcore/settings/McSettings.module.css';
import styles from '../Reticulum.module.css';

export default function IdentityCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const canWrite = hasPermission('configuration', 'write', { sourceId });
  const id = useReticulumIdentity(sourceId);
  const { settings } = id;
  const [copied, setCopied] = useState(false);
  // Desktop only: on the phone the long line squeezed "On this node" into a column (9-15 draws none).
  useSettingsHeader(isPhone ? null : { scope: t('workspace.reticulum.settings.identity_scope') });
  const base = `/source/${encodeURIComponent(sourceId)}/settings`;

  const when = (ms: number | null) =>
    ms ? `${formatTimeOrDate(new Date(ms), timeFormat, dateFormat)} · ${formatRelativeTime(ms, timeFormat, dateFormat)}` : t('reticulum.identity.never', 'Never');
  const intervalLabel = (h: number) =>
    h === 0 ? t('reticulum.identity.intervalOff', 'Off') : t('reticulum.identity.intervalHours', 'Every {{count}} h', { count: h });
  const changes = [
    ...(id.nameChanged ? [t('reticulum.identity.displayName', 'Display name')] : []),
    ...(id.intervalChanged ? [t('reticulum.identity.interval', 'Periodic announce')] : []),
  ];
  const discard = () => {
    id.setNameDraft(settings?.displayName ?? '');
    id.setIntervalDraft(settings?.announceIntervalHours ?? 0);
  };
  const copy = async () => {
    if (!settings?.destinationHash) return;
    try {
      await navigator.clipboard.writeText(settings.destinationHash);
    } catch {
      window.prompt(t('reticulum.destinations.copy_fallback', 'Copy this destination hash:'), settings.destinationHash);
    }
    setCopied(true);
  };
  const off = !canWrite || id.saving;

  return (
    <McPage>
      {!canWrite && (
        <p className={styles.readOnly} role="status">
          <UiIcon name="encrypted" size={16} />
          {t('reticulum.config.readOnlyAll', 'You have read-only access — this configuration cannot be changed.')}
        </p>
      )}
      {id.error && <p className={styles.errorText} role="alert">{id.error}</p>}
      {id.message && <p className={mc.lead} aria-live="polite">{id.message}</p>}

      <SettingGroup title={t('workspace.reticulum.settings.identity_group')}>
        <SettingRow id="reticulum.destinationHash" label={t('reticulum.identity.destinationHash', 'Destination hash')} help={t('workspace.reticulum.settings.hash_help')}>
          {settings?.destinationHash ? (
            <span className={styles.hashValue}>
              <code className={styles.mono} title={settings.destinationHash}>{settings.destinationHash}</code>
              <button type="button" className={mc.button} onClick={() => void copy()}>
                <UiIcon name="copy" size={16} /> {copied ? t('common.copied') : t('common.copy')}
              </button>
            </span>
          ) : (
            <span className={mc.muted}>{t('reticulum.identity.notConnected', 'Not connected')}</span>
          )}
        </SettingRow>
        <SettingRow
          id="reticulum.displayName"
          label={t('reticulum.identity.displayName', 'Display name')}
          help={t('reticulum.identity.displayNameHelp', 'Up to {{max}} characters. Leave empty to stay anonymous. Saving does not announce.', { max: id.maxName })}
          was={id.nameChanged ? settings?.displayName || t('reticulum.identity.anonymous', 'Anonymous') : undefined}
        >
          <SettingText value={id.nameDraft} maxLength={id.maxName} readOnly={off} placeholder={t('reticulum.identity.anonymous', 'Anonymous')} onChange={id.setNameDraft} />
        </SettingRow>
        <SettingRow
          id="reticulum.announceInterval"
          label={t('reticulum.identity.interval', 'Periodic announce')}
          help={
            <>
              {t('workspace.reticulum.settings.interval_help')}
              {id.intervalDraft > 0 && (
                <Warn>
                  {t(
                    'reticulum.identity.intervalWarning',
                    'Each announce goes out on every interface, LoRa included, and transport nodes repeat it. Keep the interval long on a busy or slow network.',
                  )}
                </Warn>
              )}
            </>
          }
          was={id.intervalChanged ? intervalLabel(settings?.announceIntervalHours ?? 0) : undefined}
        >
          <SettingSelect
            value={String(id.intervalDraft)}
            readOnly={off}
            options={ANNOUNCE_INTERVAL_CHOICES.map((h) => ({ value: String(h), label: intervalLabel(h) }))}
            onChange={(v) => id.setIntervalDraft(Number(v))}
          />
        </SettingRow>
        <div className={styles.infoRow}>
          <span>{t('reticulum.identity.lastAnnounce', 'Last announce')}</span>
          <span>{when(settings?.lastAnnounceAt ?? null)}</span>
        </div>
        {settings?.nextPeriodicAnnounceAt ? (
          <div className={styles.infoRow}>
            <span>{t('reticulum.identity.nextAnnounce', 'Next periodic announce')}</span>
            <span>{formatTimeOrDate(new Date(settings.nextPeriodicAnnounceAt), timeFormat, dateFormat)}</span>
          </div>
        ) : null}
      </SettingGroup>
      <div className={styles.saveRow}>
        <button
          type="button"
          className={mc.primary}
          disabled={off || id.nameTooLong || changes.length === 0}
          onClick={() => void id.save()}
        >
          {id.saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </button>
      </div>

      <SettingGroup title={t('workspace.reticulum.settings.announce_group')}>
        <div className={styles.announce}>
          <button
            type="button"
            className={mc.button}
            onClick={() => void id.announce()}
            disabled={!canWrite || !id.connected || id.announcing || id.cooldownLeft > 0}
            title={!id.connected ? t('reticulum.identity.announceOffline', 'Connect the source to announce') : undefined}
          >
            <UiIcon name="radio" size={16} />
            {id.cooldownLeft > 0
              ? t('reticulum.identity.announceCooldown', 'Announce now ({{seconds}} s)', { seconds: id.cooldownLeft })
              : t('reticulum.identity.announceNow', 'Announce now')}
          </button>
          <p className={mc.muted}>
            {settings?.lastAnnounceAt
              ? t('workspace.reticulum.settings.announced', { ago: formatRelativeTime(settings.lastAnnounceAt, timeFormat, dateFormat) })
              : null}
            {t('workspace.reticulum.settings.cooldown_help')}
          </p>
          <SendsLine>{t('workspace.reticulum.sends_announce')}</SendsLine>
        </div>
      </SettingGroup>
      <LeaveGuard base={base} pending={changes.length > 0 ? { scope: `${base}/lxmf-identity`, title: t('workspace.reticulum.settings.identity'), changes, discard } : null} />
    </McPage>
  );
}
