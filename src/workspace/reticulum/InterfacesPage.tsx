/**
 * Interfaces (boards 9-03, 9-12; notes s9n3, s9n4), native at
 * `/source/:id/interfaces`, on the screen's one poll: today's cards (name,
 * Online/Offline, type and state, bitrate, TX and RX totals) with today's
 * live rate from the last two polls ("Rate pending next poll…" until there is
 * a second). Under them, the rate history (B/s, 24 h): today's persisted
 * `reticulum_iface_rx_rate` / `_tx_rate` series of each interface, read with
 * today's telemetry request, one chart per direction. "Add to Dashboard"
 * puts that chart's series of every interface on the device's Dashboard
 * (today's telemetry favourites, settings:write; nothing on the network).
 *
 * The phone shows the cards stacked under the Interfaces / Paths segment.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites, useToggleFavorite } from '../../hooks/useFavorites';
import { useTelemetry, type TelemetryData } from '../../hooks/useTelemetry';
import { appBasename } from '../../init';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { formatBytes, formatRate, useDerivedRates } from '../../components/Reticulum/interfaceRates';
import type { ReticulumInterfaceRow } from '../../types/reticulum';
import { logger } from '../../utils/logger';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import PhoneToolsHead from './PhoneToolsHead';
import { useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

const RX = 'reticulum_iface_rx_rate';
const TX = 'reticulum_iface_tx_rate';
const HOURS = 24;
/** Today's Dashboard node id for an interface (`reticulumDashboardSource`). */
const ifaceNodeId = (name: string) => `rns:iface:${name}`;

const NO_POINTS: TelemetryData[] = [];
const NO_FAVORITES = new Set<string>();

interface Series {
  points: TelemetryData[];
  favorites: Set<string>;
}

export default function InterfacesPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sourceId, rns } = useRnsRuntime();
  const { interfaces, loading } = rns;
  const rates = useDerivedRates(interfaces);
  const online = interfaces.filter((i) => i.online).length;

  const cards =
    interfaces.length === 0 ? (
      <p className={styles.empty} role="status">
        {loading ? t('reticulum.interfaces.loading', 'Loading interfaces…') : t('reticulum.interfaces.empty', 'No interfaces reported yet.')}
      </p>
    ) : (
      <div className={styles.cardGrid}>
        {interfaces.map((iface, idx) => {
          const rate = rates.get(iface.interfaceName);
          const detail = [iface.status, iface.frequency != null ? `${(iface.frequency / 1e6).toFixed(3)} MHz` : null].filter(Boolean).join(' · ');
          return (
            <section key={iface.interfaceName} className={styles.card} aria-label={iface.interfaceName}>
              <header className={styles.cardHead}>
                <span className={styles.swatch} data-tone={idx % 6} data-off={!iface.online || undefined} aria-hidden="true" />
                <h2 className={styles.cardTitle}>{iface.interfaceName}</h2>
                <span className={styles.pill} data-on={iface.online || undefined}>
                  {iface.online ? t('reticulum.interfaces.online', 'Online') : t('reticulum.interfaces.offline', 'Offline')}
                </span>
              </header>
              <p className={styles.cardMeta}>
                <code className={styles.mono}>{iface.interfaceType ?? t('reticulum.interfaces.unknown_type', 'Unknown type')}</code>
                {detail && <span>{` · ${detail}`}</span>}
              </p>
              <dl className={styles.stats}>
                <div>
                  <dt>{t('reticulum.interfaces.bitrate', 'Bitrate')}</dt>
                  <dd>
                    {iface.bitrate != null
                      ? t('reticulum.interfaces.bitrate_value', '{{value}} bps', { value: iface.bitrate.toLocaleString() })
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>{t('reticulum.interfaces.tx_total', 'TX total')}</dt>
                  <dd>{formatBytes(iface.txBytes)}</dd>
                </div>
                <div>
                  <dt>{t('reticulum.interfaces.rx_total', 'RX total')}</dt>
                  <dd>{formatBytes(iface.rxBytes)}</dd>
                </div>
              </dl>
              <p className={styles.rateLine}>
                {rate ? (
                  <>
                    <span>
                      <UiIcon name="chevronUp" size={14} /> {t('workspace.reticulum.tx_rate_value', { value: formatRate(rate.txRate) })}
                    </span>
                    <span>
                      <UiIcon name="chevronDown" size={14} /> {t('workspace.reticulum.rx_rate_value', { value: formatRate(rate.rxRate) })}
                    </span>
                  </>
                ) : (
                  <span className={styles.muted}>{t('reticulum.interfaces.rate_pending', 'Rate pending next poll…')}</span>
                )}
              </p>
            </section>
          );
        })}
      </div>
    );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <PhoneToolsHead sourceId={sourceId} />
      ) : (
        <ToolHead
          title={t('reticulum.nav.interfaces', 'Interfaces')}
          subtitle={t('workspace.reticulum.interfaces_subtitle', { count: interfaces.length, online })}
          back={{ label: '', to: '' }}
        />
      )}
      {cards}
      {interfaces.length > 0 && <RateHistory interfaces={interfaces} sourceId={sourceId} />}
    </div>
  );
}

/** One interface's series (today's telemetry read) and its Dashboard favourites, reported up. */
function SeriesSource({ name, sourceId, canFavorite, onData }: { name: string; sourceId: string; canFavorite: boolean; onData(name: string, s: Series): void }) {
  const nodeId = ifaceNodeId(name);
  const { data: points } = useTelemetry({ nodeId, sourceId, hours: HOURS, baseUrl: appBasename });
  const { data: favorites } = useFavorites({ nodeId, baseUrl: appBasename, enabled: canFavorite });
  useEffect(() => onData(name, { points: points ?? NO_POINTS, favorites: favorites ?? NO_FAVORITES }), [name, points, favorites, onData]);
  return null;
}

function RateHistory({ interfaces, sourceId }: { interfaces: ReticulumInterfaceRow[]; sourceId: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  // Today's favourite gate (MeshCore Info's): saving the Dashboard's charts writes settings.
  const canFavorite = hasPermission('settings', 'write', { sourceId });
  const [series, setSeries] = useState<Record<string, Series>>({});
  const onData = useCallback((name: string, s: Series) => {
    setSeries((prev) => (prev[name]?.points === s.points && prev[name]?.favorites === s.favorites ? prev : { ...prev, [name]: s }));
  }, []);
  const toggle = useToggleFavorite({
    baseUrl: appBasename,
    onError: (message) => {
      logger.error('Error saving favorite:', message);
      showToast(t('telemetry.favorite_save_failed'), 'error');
    },
  });
  const [busy, setBusy] = useState(false);
  const names = interfaces.map((i) => i.interfaceName);

  const addToDashboard = async (type: string) => {
    const on = names.every((n) => series[n]?.favorites.has(type));
    setBusy(true);
    try {
      // One settings write per interface whose chart changes; each reads the stored list first (today's mutation).
      for (const n of names) {
        const favorites = series[n]?.favorites ?? new Set<string>();
        if (favorites.has(type) === !on) continue;
        await toggle.mutateAsync({ nodeId: ifaceNodeId(n), telemetryType: type, currentFavorites: favorites });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section}>
      {names.map((n) => (
        <SeriesSource key={n} name={n} sourceId={sourceId} canFavorite={canFavorite} onData={onData} />
      ))}
      <h2 className={styles.sectionTitle}>{t('workspace.reticulum.rate_history')}</h2>
      <div className={styles.cardGrid}>
        {([RX, TX] as const).map((type) => {
          const on = names.length > 0 && names.every((n) => series[n]?.favorites.has(type));
          return (
            <RateChart
              key={type}
              title={type === RX ? t('workspace.reticulum.rx_rate') : t('workspace.reticulum.tx_rate')}
              lines={names.map((n, idx) => ({ name: n, tone: idx % 6, points: (series[n]?.points ?? []).filter((p) => p.telemetryType === type) }))}
              action={
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={on}
                  disabled={!canFavorite || busy}
                  title={canFavorite ? undefined : t('workspace.node_menu.needs', { permission: 'settings:write' })}
                  onClick={() => void addToDashboard(type)}
                >
                  <UiIcon name={on ? 'favorite' : 'favoriteOff'} size={16} /> {t('workspace.reticulum.add_to_dashboard')}
                </button>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

interface Line {
  name: string;
  tone: number;
  points: TelemetryData[];
}

/** A line per interface over the last 24 h, 0 to the largest rate. */
function RateChart({ title, lines, action }: { title: string; lines: Line[]; action: ReactNode }) {
  const { t } = useTranslation();
  const now = Date.now();
  const start = now - HOURS * 3_600_000;
  const max = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.value)));
  const top = niceCeil(max);
  const x = (ts: number) => ((ts - start) / (now - start)) * 300;
  const y = (v: number) => 110 - (v / top) * 100;
  const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const empty = lines.every((l) => l.points.length === 0);
  return (
    <section className={styles.card} aria-label={title}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {action}
      </header>
      <ul className={styles.legend}>
        {lines.map((l) => (
          <li key={l.name}>
            <span className={styles.legendSwatch} data-tone={l.tone} aria-hidden="true" />
            {l.name}
          </li>
        ))}
      </ul>
      {empty ? (
        <p className={styles.muted}>{t('workspace.reticulum.no_history')}</p>
      ) : (
        <div className={styles.chart}>
          <svg viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label={title} className={styles.chartSvg}>
            {[10, 60, 110].map((gy) => (
              <line key={gy} x1={0} x2={300} y1={gy} y2={gy} className={styles.grid} />
            ))}
            {lines.map((l) => {
              const pts = [...l.points].sort((a, b) => a.timestamp - b.timestamp);
              if (pts.length === 0) return null;
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.timestamp).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
              return <path key={l.name} d={d} className={styles.series} data-tone={l.tone} />;
            })}
          </svg>
          <span className={styles.axisY}>
            <span>{top}</span>
            <span>{top / 2}</span>
            <span>0</span>
          </span>
          <span className={styles.axisX}>
            <span>{clock(start)}</span>
            <span>{clock(start + (now - start) / 2)}</span>
            <span>{t('workspace.reticulum.now')}</span>
          </span>
        </div>
      )}
    </section>
  );
}

/** The axis top: the next 1, 2 or 5 × 10ⁿ at or above `v`. */
function niceCeil(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((n) => n >= v) ?? 10 * p;
}
