/**
 * One destination's details (boards 9-02, 9-05; the phone's sheet, 9-11,
 * 9-14): what today's table row and map popup (ReticulumDestinationDetail)
 * show, as one panel. Hash with Copy (today's clipboard, a prompt where the
 * clipboard is refused), Favourite (today's POST, once per press;
 * `nodes:write`, as the route), app and aspects, hops, the next hop and
 * interface from the path table, RSSI, SNR, quality, last heard, today's
 * derived announce rate, first heard, and a shared position's altitude and
 * speed. Nothing here sends on the network.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { UiIcon } from '../../components/icons';
import { formatAnnounceRate } from '../../components/Reticulum/ReticulumDestinationsView';
import type { ReticulumDestinationRow } from '../../types/reticulum';
import { formatRelativeTime, formatTimeOrDate } from '../../utils/datetime';
import { peerMark, peerTone, peerName, useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

export interface DestinationPanelProps {
  destination: ReticulumDestinationRow;
  /** Overrides the name (a relay's label on the map). */
  name?: string;
  onClose?(): void;
  /** In a sheet that draws its own title and Close. */
  embedded?: boolean;
}

export default function DestinationPanel({ destination: d, name: nameProp, onClose, embedded }: DestinationPanelProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const { sourceId, rns } = useRnsRuntime();
  const [copied, setCopied] = useState(false);
  const name = nameProp || peerName(d.destinationHash, rns.destinations);
  const path = rns.paths.find((p) => p.destinationHash === d.destinationHash);
  const nextHop = path ? (path.viaHash ? peerName(path.viaHash, rns.destinations) : t('workspace.reticulum.direct')) : null;
  const iface = path?.interfaceName ?? d.nextHopInterface;
  const canFavorite = hasPermission('nodes', 'write', { sourceId });
  const app = [d.appName, d.aspects].filter(Boolean).join('.');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.destinationHash);
    } catch {
      window.prompt(t('reticulum.destinations.copy_fallback', 'Copy this destination hash:'), d.destinationHash);
    }
    setCopied(true);
  };
  const when = (ms: number) => formatTimeOrDate(new Date(ms), timeFormat, dateFormat);
  const rate = formatAnnounceRate(d);
  const rows: Array<[string, string | null]> = [
    [t('reticulum.destinations.col_app', 'App'), d.appName],
    [t('reticulum.destinations.col_aspects', 'Aspects'), d.aspects],
    [t('reticulum.destinations.col_hops', 'Hops'), d.hops != null ? String(d.hops) : null],
    [t('workspace.reticulum.next_hop'), nextHop],
    [t('reticulum.paths.col_interface', 'Interface'), iface],
    [t('reticulum.destinations.col_rssi', 'RSSI'), d.rssi != null ? `${d.rssi} dBm` : null],
    [t('reticulum.destinations.col_snr', 'SNR'), d.snr != null ? `${d.snr} dB` : null],
    [t('reticulum.destinations.col_quality', 'Quality'), d.quality != null ? `${d.quality} %` : null],
    [t('workspace.reticulum.last_heard'), `${when(d.lastSeen)} · ${formatRelativeTime(d.lastSeen, timeFormat, dateFormat)}`],
    [
      t('workspace.reticulum.announce_rate'),
      rate === '—' ? rate : `${rate} · ${t('workspace.reticulum.announces', { count: d.announceCount })}`,
    ],
    [t('workspace.reticulum.first_heard'), when(d.firstSeen)],
    [t('reticulum.map.altitude', 'Altitude'), d.altitude != null ? `${d.altitude} m` : null],
    [t('reticulum.map.speed', 'Speed'), d.speed != null ? `${d.speed} m/s` : null],
  ];

  return (
    <aside className={styles.panel} data-embedded={embedded || undefined} aria-label={name}>
      {!embedded && (
        <header className={styles.panelHead}>
          <span className={styles.avatarLarge} data-tone={peerTone(name)} data-anon={name.startsWith('<') || undefined} aria-hidden="true">{peerMark(name)}</span>
          <div className={styles.panelTitles}>
            <p className={styles.eyebrow}>{t('workspace.reticulum.destination')}</p>
            <h2 className={styles.panelName}>{name}</h2>
            <p className={styles.muted}>{[app, t('workspace.reticulum.learned')].filter(Boolean).join(' · ')}</p>
          </div>
          {onClose && (
            <button type="button" className={styles.iconButton} aria-label={t('common.close', 'Close')} onClick={onClose}>
              <UiIcon name="close" size={18} />
            </button>
          )}
        </header>
      )}
      <div className={styles.panelRow}>
        <div className={styles.panelHash}>
          <span className={styles.muted}>{t('reticulum.destinations.col_hash', 'Hash')}</span>
          <code className={styles.mono}>{d.destinationHash}</code>
        </div>
        <button type="button" className={styles.button} onClick={() => void copy()}>
          <UiIcon name="copy" size={16} /> {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <div className={styles.panelRow}>
        <span>{t('workspace.reticulum.favourite')}</span>
        <button
          type="button"
          className={styles.star}
          data-on={d.isFavorite || undefined}
          aria-pressed={d.isFavorite}
          disabled={!canFavorite}
          title={canFavorite ? undefined : t('workspace.node_menu.needs', { permission: 'nodes:write' })}
          aria-label={d.isFavorite ? t('reticulum.favorite.remove', 'Remove from favorites') : t('reticulum.favorite.add', 'Add to favorites')}
          onClick={() => void rns.toggleFavorite(d.destinationHash, !d.isFavorite)}
        >
          <UiIcon name={d.isFavorite ? 'favorite' : 'favoriteOff'} size={20} />
        </button>
      </div>
      <dl className={styles.facts}>
        {rows
          .filter(([, v]) => v !== null && v !== '')
          .map(([k, v]) => (
            <div key={k} className={styles.fact}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
    </aside>
  );
}
