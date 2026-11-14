/**
 * The neighbour link peek (board 15-09, s15n3): A ↔ B or A → B, bidirectional
 * or one-way, the transport, the distance, and the SNR each way with when it
 * was heard. The data is today's DashboardNeighborPopup's: the server keeps
 * one row per node pair and puts the reverse direction on it
 * (`reverseSnr` / `reverseTimestamp`). On phone it is a bottom sheet (15-21).
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { EnrichedNeighborInfo } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatRelativeTime } from '../../utils/datetime';
import { calculateDistance, formatDistance } from '../../utils/distance';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './NodePeek.module.css';

export type NeighbourLink = EnrichedNeighborInfo & { reverseSnr?: number | null; reverseTimestamp?: number | null };

const TRANSPORT: Record<string, string> = { rf: 'RF', udp: 'UDP', mqtt: 'MQTT' };

/** "+4.5" / "-2.0", as the board. */
const signed = (snr: number) => `${snr > 0 ? '+' : ''}${snr.toFixed(1)}`;

export default function NeighbourPeek({ link, onClose }: { link: NeighbourLink; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { distanceUnit, timeFormat, dateFormat } = useSettings();
  const from = link.nodeName ?? link.nodeId ?? '';
  const to = link.neighborName ?? link.neighborNodeId ?? '';
  const both = link.bidirectional === true;
  const hasReverse = both || link.reverseSnr != null;
  const km =
    link.nodeLatitude != null && link.nodeLongitude != null && link.neighborLatitude != null && link.neighborLongitude != null
      ? calculateDistance(link.nodeLatitude, link.nodeLongitude, link.neighborLatitude, link.neighborLongitude)
      : null;

  const direction = (a: string, b: string, snr: number | null | undefined, heard: number | null | undefined, last: boolean) => (
    <li className={styles.direction}>
      <span className={styles.path}>
        {a} <UiIcon name="forward" size={14} /> {b}
      </span>
      <span>
        <strong>{snr != null ? t('workspace.map.link_snr', { snr: signed(snr) }) : t('workspace.map.link_snr', { snr: '—' })}</strong>
        {heard ? ` · ${t('workspace.map.heard', { time: formatRelativeTime(heard, timeFormat, dateFormat) })}` : ''}
        {last && !hasReverse ? ` · ${t('workspace.map.no_report_back')}` : ''}
      </span>
    </li>
  );

  const names = (
    <>
      {from} <UiIcon name={both ? 'bidirectional' : 'forward'} size={18} /> {to}
    </>
  );
  const details = (
    <>
      <dl className={styles.stats}>
        <div>
          <dt>{t('workspace.map.link')}</dt>
          <dd>{both ? t('direct_links.bidirectional', 'Bidirectional') : t('workspace.map.one_way')}</dd>
        </div>
        <div>
          <dt>{t('workspace.map.transport')}</dt>
          <dd>{TRANSPORT[link.transportClass ?? 'rf'] ?? link.transportClass}</dd>
        </div>
        {km != null && (
          <div>
            <dt>{t('direct_links.distance', 'Distance')}</dt>
            <dd>{formatDistance(km, distanceUnit)}</dd>
          </div>
        )}
      </dl>
      <ul className={styles.directions}>
        {direction(from, to, link.snr, link.timestamp, true)}
        {hasReverse && direction(to, from, link.reverseSnr, link.reverseTimestamp, false)}
      </ul>
    </>
  );

  if (isPhone) {
    return (
      <Sheet
        open
        onClose={onClose}
        side="bottom"
        title={
          <span className={styles.sheetTitle}>
            <span className={styles.eyebrow}>{t('workspace.map.neighbour_link')}</span>
            <span className={styles.path}>{names}</span>
          </span>
        }
      >
        <div className={styles.phone}>{details}</div>
      </Sheet>
    );
  }
  return (
    <aside className={styles.peek} aria-labelledby="neighbour-peek-title">
      <div className={styles.head}>
        <div className={styles.titles}>
          <p id="neighbour-peek-title" className={styles.eyebrow}>{t('workspace.map.neighbour_link')}</p>
          <h2 className={styles.name}>{names}</h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {details}
    </aside>
  );
}
