/**
 * Overview › Reports › Solar Monitoring (boards 6-05, 6-12; notes s6n0, s6n2,
 * s6n3). Today's report (`useSolarMonitoringReport` and its parts, as they
 * are): the lookback, Run forecast and Run analysis in the header, the
 * summary tiles, the forecast with the nodes at risk, the manual
 * classification (`settings:write`), and the node cards. Desktop puts the
 * forecast and classification beside the cards; the phone stacks them, and a
 * card's daily patterns and the classification open in sheets from ≥52 px
 * rows. Runs read stored telemetry and forecast.solar estimates; nothing here
 * sends on the mesh.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { SolarOverridesPanel } from '../../components/Analysis/SolarOverridesPanel';
import {
  ForecastResults,
  SolarDailyPatterns,
  SolarNodeCard,
  SolarSummary,
} from '../../components/Analysis/SolarMonitoringReport';
import { useSolarMonitoringReport, type SolarNode } from '../../components/Analysis/useSolarMonitoringReport';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import parts from './reportParts.module.css';
import styles from './SolarPage.module.css';

export default function SolarPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const s = useSolarMonitoringReport();
  const { data, forecast } = s;
  const [patternsOf, setPatternsOf] = useState<SolarNode | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(false);

  const actions = (
    <div className={styles.actions}>
      <label className={styles.lookback}>
        <span>{t('analysis.solar_monitoring.lookback', 'Lookback (days):')}</span>
        <NumberInput integer min={1} max={90} value={s.lookbackDays} onChange={s.setLookbackDays} />
      </label>
      <button
        type="button"
        className={parts.ghost}
        onClick={s.onRunForecast}
        disabled={s.forecastLoading}
        title={t(
          'analysis.solar_monitoring.forecast_help',
          'Project battery state across the next several days using forecast.solar production estimates.',
        )}
      >
        <UiIcon name="sun" size={16} />
        {s.forecastLoading
          ? t('analysis.solar_monitoring.forecast_loading', 'Forecasting…')
          : s.runForecast
            ? t('analysis.solar_monitoring.forecast_refresh', 'Re-run forecast')
            : t('analysis.solar_monitoring.forecast_run', 'Run forecast')}
      </button>
      <button type="button" className={parts.primary} onClick={s.onRunAnalysis} disabled={s.isLoading}>
        <UiIcon name="play" size={16} />
        {s.isLoading
          ? t('analysis.solar_monitoring.analyzing', 'Analyzing…')
          : s.run
            ? t('analysis.solar_monitoring.refresh', 'Re-run analysis')
            : t('analysis.solar_monitoring.run', 'Run analysis')}
      </button>
    </div>
  );

  const overrides = data && (
    <SolarOverridesPanel
      overrides={data.manual_overrides ?? []}
      analyzedNodes={data.analyzed_nodes ?? []}
      canWrite={s.canWriteOverrides}
      busy={s.overrideBusy}
      error={s.overrideError}
      onSet={(nodeNum, isSolar) => void s.setSolarOverride(nodeNum, isSolar)}
    />
  );

  const cards = data && data.solar_nodes.length > 0 && (
    <div className={styles.cards}>
      {data.solar_nodes.map((node) => (
        <SolarNodeCard
          key={node.node_num}
          node={node}
          solarProduction={data.solar_production}
          forecast={forecast}
          canWriteOverrides={s.canWriteOverrides}
          overrideBusy={s.overrideBusy}
          onSetOverride={(isSolar) => void s.setSolarOverride(node.node_num, isSolar)}
          renderPatterns={
            isPhone
              ? (n) => (
                  <button type="button" className={`${parts.rowButton} ${styles.patternsRow}`} onClick={() => setPatternsOf(n)}>
                    <span className={parts.rowTitle}>{t('analysis.solar_monitoring.patterns', 'Recent daily patterns')}</span>
                    <span className={parts.rowMeta}>{n.recent_patterns.length}</span>
                  </button>
                )
              : undefined
          }
        />
      ))}
    </div>
  );

  return (
    <ReportFrame
      back="reports"
      title={t('analysis.solar_monitoring.title', 'Solar Monitoring Analysis')}
      subtitle={t(
        'analysis.solar_monitoring.description',
        'Identify solar-powered nodes by analyzing battery and voltage patterns that show daytime charging and nighttime discharge.',
      )}
      actions={actions}
    >
      {s.error && (
        <p className={parts.error} role="alert">
          {t('analysis.solar_monitoring.error', 'Error analyzing data:')} {(s.error as Error).message}
        </p>
      )}
      {s.forecastError && (
        <p className={parts.error} role="alert">
          {t('analysis.solar_monitoring.forecast_error', 'Error computing forecast:')} {(s.forecastError as Error).message}
        </p>
      )}

      {data && (
        <SolarSummary
          totalAnalyzed={data.total_nodes_analyzed}
          solarCount={data.solar_nodes_count}
          avgCharging={data.avg_charging_hours_per_day}
          avgDischarge={data.avg_discharge_hours_per_day}
          lookbackDays={data.lookback_days}
          solarPointCount={data.solar_production.length}
        />
      )}

      {data && data.solar_nodes.length === 0 && !s.isLoading && (
        <p className={parts.banner}>
          {t(
            'analysis.solar_monitoring.empty',
            'No solar-powered nodes identified. Try increasing the lookback period or ensure nodes have sufficient telemetry data.',
          )}
        </p>
      )}

      {isPhone ? (
        <div className={styles.column}>
          {forecast && (
            <ForecastResults
              forecast={forecast}
              renderDays={(days) => (
                <ul className={styles.days}>
                  {days.map((d) => (
                    <li key={d.date} className={styles.day} data-low={d.is_low || undefined}>
                      <span>{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      <strong>{d.forecast_wh.toFixed(0)} Wh</strong>
                      <span className={parts.tag} data-tone={d.is_low ? 'warn' : undefined}>{d.is_low ? 'Low' : 'OK'}</span>
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
          {cards}
          {data && (
            <ul className={parts.list}>
              <li className={parts.item}>
                <button type="button" className={parts.rowButton} onClick={() => setOverridesOpen(true)}>
                  <span className={parts.rowTitle}>
                    {t('analysis.solar_monitoring.overrides_title', 'Manual solar classification')}
                  </span>
                  <span className={parts.rowMeta}>{data.manual_overrides?.length ?? 0}</span>
                </button>
                <UiIcon name="chevronRight" size={18} className={parts.chevron} />
              </li>
            </ul>
          )}
        </div>
      ) : (
        (forecast || data) && (
          <div className={styles.grid}>
            <div className={styles.column}>
              {forecast && <ForecastResults forecast={forecast} />}
              {overrides}
            </div>
            <div className={styles.column}>{cards}</div>
          </div>
        )
      )}

      <Sheet open={patternsOf != null} onClose={() => setPatternsOf(null)} title={patternsOf?.node_name}>
        {patternsOf && (
          <div className={parts.sheetPad}>
            <SolarDailyPatterns patterns={patternsOf.recent_patterns} />
          </div>
        )}
      </Sheet>
      <Sheet
        open={isPhone && overridesOpen}
        onClose={() => setOverridesOpen(false)}
        title={t('analysis.solar_monitoring.overrides_title', 'Manual solar classification')}
      >
        <div className={parts.targets}>{overrides}</div>
      </Sheet>
    </ReportFrame>
  );
}
