/**
 * The graphs view of the cross-source Telemetry Dashboard (#5896).
 *
 * Every favorited series across the sources the viewer may read, one chart per
 * (node, type) with one line per source, grouped into the per-source
 * dashboard's categories. Fetched once on load, on a range change and on the
 * refresh button: no polling.
 */
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemperatureUnit } from '../../utils/temperature';
import type { TimeFormat } from '../../contexts/SettingsContext';
import { TELEMETRY_RANGE_PRESETS } from '../../utils/telemetryRangePresets';
import { TELEMETRY_CATEGORY_LABELS } from '../../utils/telemetryCategory';
import CombinedTelemetryChart from '../CombinedTelemetryChart/CombinedTelemetryChart';
import { UiIcon } from '../icons';
import { useUnifiedTelemetrySeries } from './useUnifiedTelemetrySeries';
import styles from './UnifiedTelemetryGraphs.module.css';
import '../../styles/unified.css';

interface UnifiedTelemetryGraphsProps {
  /** Back button, title and view tabs, rendered at the top of the sticky header. */
  header: ReactNode;
  temperatureUnit: TemperatureUnit;
  timeFormat: TimeFormat;
  /** Bumped by the parent to force a refetch (a favorite changed elsewhere). */
  reloadToken?: number;
}

export default function UnifiedTelemetryGraphs({ header, temperatureUnit, timeFormat, reloadToken = 0 }: UnifiedTelemetryGraphsProps) {
  const { t } = useTranslation();
  const {
    hours, chooseHours, series, loading, error, sourceFilter, setSourceFilter, busyKey, yRanges, changeYRange,
    fetchSeries, sources, colorFor, sections, timeRange, removeFavorite,
  } = useUnifiedTelemetrySeries(reloadToken);

  return (
    <>
      <div className="unified-header unified-header--sticky">
        {header}
        <div className="unified-controls">
          <div className="unified-btn-group" role="group" aria-label={t('unified.telemetry.range_aria')}>
            {TELEMETRY_RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={hours === p.hours ? 'active' : ''}
                aria-pressed={hours === p.hours}
                onClick={() => chooseHours(p.hours)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <select
            className="unified-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label={t('unified.telemetry.filter_source_aria')}
          >
            <option value="">{t('unified.telemetry.all_sources')}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            type="button"
            className={styles.refresh}
            onClick={() => void fetchSeries()}
            disabled={loading}
            aria-label={t('unified.telemetry.refresh')}
            title={t('unified.telemetry.refresh')}
          >
            <UiIcon name="refresh" size={15} />
          </button>
        </div>
      </div>

      <div className="unified-body unified-body--wide">
        {loading && series.length === 0 && <div className="unified-empty">{t('unified.telemetry.loading')}</div>}
        {error && <div className="unified-error">{error}</div>}

        {!loading && !error && series.length === 0 && (
          <div className="unified-empty">{t('unified.telemetry.no_favorites')}</div>
        )}

        {sections.map(({ category, items }) => (
          <section key={category} className={styles.section} aria-label={t(`telemetry.category.${category}`, TELEMETRY_CATEGORY_LABELS[category])}>
            <h2 className={styles.sectionTitle}>{t(`telemetry.category.${category}`, TELEMETRY_CATEGORY_LABELS[category])}</h2>
            <div className={styles.grid}>
              {items.map((s) => {
                const canRemove = s.lines.some((l) => l.favorited && l.canEditFavorite);
                return (
                  <CombinedTelemetryChart
                    key={`${s.subjectKey}|${s.type}`}
                    series={s}
                    colorFor={colorFor}
                    temperatureUnit={temperatureUnit}
                    timeFormat={timeFormat}
                    hours={hours}
                    timeRange={timeRange}
                    onRemoveFavorite={canRemove ? () => void removeFavorite(s) : undefined}
                    favoriteBusy={busyKey === `${s.subjectKey}|${s.type}`}
                    yRange={yRanges[`${s.subjectKey}|${s.type}`] ?? null}
                    onYRangeChange={(r) => changeYRange(`${s.subjectKey}|${s.type}`, r)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
