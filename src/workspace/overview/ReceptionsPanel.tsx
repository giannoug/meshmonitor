/**
 * Reception details for one Overview › Messages entry (boards 7-01, 7-06,
 * s7n0): which devices heard it, with hops, SNR, RSSI, the time heard and
 * whether the reception carried a verified XEdDSA signature. Today's
 * receptions modal, as a side panel on desktop and a sheet on the phone.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { senderLabel } from '../../pages/unifiedSenderLabels';
import { formatTime, formatTimeWithSeconds } from '../../pages/unifiedTimeFormat';
import { hopDisplay, receptionHopCount } from '../../pages/unifiedHops';
import { channelTag, type Reception, type UnifiedMessage } from '../../pages/useUnifiedMessagesFeed';
import type { TranslateFn } from '../../types/translate';
import DeviceTag from '../patterns/DeviceTag';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './ReceptionsPanel.module.css';

/** The Hops column: a count, "direct", or today's partial text. */
function hops(r: Reception, t: TranslateFn): string {
  const n = receptionHopCount(r);
  if (n === 0) return t('unified.messages.hop_direct');
  return n != null ? String(n) : hopDisplay(r, t);
}

const snr = (r: Reception) => (r.rxSnr != null ? `${r.rxSnr.toFixed(1)} dB` : '—');
const rssi = (r: Reception) => (r.rxRssi != null ? `${r.rxRssi} dBm` : '—');

function Signed({ r }: { r: Reception }) {
  const { t } = useTranslation();
  return r.xeddsaSigned ? (
    <span className={styles.yes} title={t('messages.xeddsa_signed')}>
      <UiIcon name="check" size={14} />
      {t('common.yes')}
    </span>
  ) : (
    <span>{t('common.no')}</span>
  );
}

export default function ReceptionsPanel({ message, onClose }: { message: UnifiedMessage; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const titleId = useId();
  const title = t('unified.messages.modal.title');
  const summary = (
    <p className={styles.summary}>
      {t('workspace.overview.messages.heard_by_devices', { count: message.receptions.length })} · #{channelTag(message)} ·{' '}
      {t('unified.messages.modal.request_id')} <code>{message.requestId ?? '—'}</code>
    </p>
  );
  const note = (
    <p className={styles.note}>
      <UiIcon name="security" size={14} />
      {t('workspace.overview.messages.signed_note')}
    </p>
  );

  if (isPhone) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <div className={styles.sheetBody}>
          {summary}
          <ul className={styles.cards}>
            {message.receptions.map((r) => (
              <li key={r.sourceId} className={styles.card}>
                <DeviceTag sourceId={r.sourceId} />
                <div className={styles.cardText}>
                  <strong>{r.sourceName}</strong>
                  <span>
                    {t('unified.messages.modal.col_hops')} {hops(r, t)} · {t('unified.messages.modal.col_snr')} {snr(r)} ·{' '}
                    {t('unified.messages.modal.col_rssi')} {rssi(r)}
                  </span>
                  <span>
                    {t('unified.messages.modal.col_heard')} {formatTimeWithSeconds(r.timestamp)} ·{' '}
                    {t('workspace.overview.messages.signed')} <Signed r={r} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {note}
        </div>
      </Sheet>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {summary}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      <blockquote className={styles.quote}>
        <strong>{senderLabel(message)}</strong> · {formatTime(message.timestamp)}
        <span className={styles.quoteText}>{message.text || t('unified.no_text')}</span>
      </blockquote>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('unified.messages.modal.col_source')}</th>
            <th>{t('unified.messages.modal.col_hops')}</th>
            <th>{t('unified.messages.modal.col_snr')}</th>
            <th>{t('unified.messages.modal.col_rssi')}</th>
            <th>{t('unified.messages.modal.col_heard')}</th>
            <th>{t('workspace.overview.messages.signed')}</th>
          </tr>
        </thead>
        <tbody>
          {message.receptions.map((r) => (
            <tr key={r.sourceId}>
              <td><DeviceTag sourceId={r.sourceId} /></td>
              <td>{hops(r, t)}</td>
              <td>{snr(r)}</td>
              <td>{rssi(r)}</td>
              <td>{formatTime(r.timestamp)}</td>
              <td><Signed r={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.list}>
        {message.receptions.map((r) => (
          <li key={r.sourceId}>
            <DeviceTag sourceId={r.sourceId} />
            <span className={styles.name}>{r.sourceName}</span>
            <span className={styles.time}>{formatTimeWithSeconds(r.timestamp)}</span>
          </li>
        ))}
      </ul>
      {note}
    </aside>
  );
}
