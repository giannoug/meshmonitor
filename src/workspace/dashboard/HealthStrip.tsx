/**
 * The Mesh health strip (boards j1, k1, note ds8): the tiles the user picked
 * (six of the nine by default), each opening the filtered view behind it.
 * Values come from `healthValues` (the page's own reads); a value this device
 * does not report shows "—". Channel utilisation goes amber above 25 %.
 * In edit mode (j2) the tiles are drawn but do not navigate.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { formatDuration } from '../../utils/telemetryFormat';
import { CHANNEL_UTIL_AMBER, LOW_BATTERY_PCT, tileTitle, type HealthTileId, type HealthValues } from './healthTiles';
import styles from './Dashboard.module.css';

export interface HealthStripProps {
  values: HealthValues;
  tiles: readonly HealthTileId[];
  deviceName: string;
  /** `/source/<id>`. */
  base: string;
  /** This device's own node id, for the tiles that open its telemetry. */
  localId: string | null;
  /** Edit mode: drawn, not links. */
  inert?: boolean;
}

interface Tile {
  title: string;
  value: string;
  sub: string;
  to: string;
  amber?: boolean;
}

const pct = (v: number | null) => (v === null ? null : `${Math.round(v * 10) / 10}%`);

export default function HealthStrip({ values: v, tiles, deviceName, base, localId, inert = false }: HealthStripProps) {
  const { t } = useTranslation();
  const none = t('workspace.dashboard.tile.not_reported');
  const ownTelemetry = localId ? `${base}/node/${encodeURIComponent(localId)}/telemetry` : `${base}/nodes`;
  const low = [...v.lowBattery].map((n) => n.user?.longName || n.user?.shortName || n.user?.id || '').sort((a, b) => a.localeCompare(b));
  const amber = v.channelUtil !== null && v.channelUtil > CHANNEL_UTIL_AMBER;

  const all: Record<HealthTileId, Tile> = {
    nodesOnline: { title: tileTitle(t, 'nodesOnline'), value: String(v.online), sub: t('workspace.dashboard.tile.of_total', { total: v.total }), to: `${base}/nodes?show=online` },
    channelUtil: {
      title: tileTitle(t, 'channelUtil'),
      value: pct(v.channelUtil) ?? '—',
      sub: v.channelUtil === null ? none : amber ? t('workspace.dashboard.tile.above', { device: deviceName, pct: CHANNEL_UTIL_AMBER }) : deviceName,
      to: ownTelemetry,
      amber,
    },
    airtimeTx: { title: tileTitle(t, 'airtimeTx'), value: pct(v.airtimeTx) ?? '—', sub: v.airtimeTx === null ? none : deviceName, to: ownTelemetry },
    lowBattery: {
      title: tileTitle(t, 'lowBattery'),
      value: String(low.length),
      sub: low.length === 0
        ? t('workspace.dashboard.tile.none_below', { pct: LOW_BATTERY_PCT })
        : low.length > 2 ? t('workspace.dashboard.tile.names_more', { names: low.slice(0, 2).join(', '), count: low.length - 2 }) : low.join(', '),
      to: `${base}/nodes?show=low-battery`,
    },
    newToday: { title: tileTitle(t, 'newToday'), value: v.newToday === null ? '—' : String(v.newToday), sub: v.newToday === null ? none : t('workspace.dashboard.tile.first_seen'), to: `${base}/nodes?show=new-today` },
    direct: { title: tileTitle(t, 'direct'), value: String(v.direct), sub: t('workspace.dashboard.tile.no_hops'), to: `${base}/nodes?show=direct` },
    favorites: { title: tileTitle(t, 'favorites'), value: String(v.favorites), sub: t('workspace.dashboard.tile.favorite_nodes'), to: `${base}/nodes?show=favorites` },
    battery: {
      title: tileTitle(t, 'battery'),
      value: v.battery === null ? '—' : v.battery > 100 ? t('workspace.dashboard.tile.powered') : `${v.battery}%`,
      sub: v.battery === null ? none : deviceName,
      to: ownTelemetry,
    },
    uptime: { title: tileTitle(t, 'uptime'), value: v.uptime === null ? '—' : formatDuration(v.uptime), sub: v.uptime === null ? none : deviceName, to: `${base}/info` },
  };

  return (
    <ul className={styles.strip} aria-label={t('workspace.dashboard.health')}>
      {tiles.map((id) => {
        const tile = all[id];
        const body = (
          <>
            <span className={styles.tileTitle}>
              {tile.title}
              {!inert && <UiIcon name="chevronRight" size={16} />}
            </span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileSub}>{tile.sub}</span>
          </>
        );
        return (
          <li key={id} className={styles.tileItem}>
            {inert ? (
              <div className={styles.tile} data-amber={tile.amber || undefined}>{body}</div>
            ) : (
              <Link className={`${styles.tile} ${styles.tileLink}`} to={tile.to} data-amber={tile.amber || undefined}>{body}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
