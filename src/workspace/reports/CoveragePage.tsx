/**
 * Overview › Reports › Coverage (boards 6-03-coverage, 6-10-coverage; notes
 * s6n0, s6n2, s6n3). Today's Coverage Report on its own state and queries
 * (`useCoverageReport`), with today's parts as they are: Refresh, Export
 * (CSV / GeoJSON), the survey bar, the receivers list with the MQTT
 * recording status, the map, the summary and receivers table, the distance
 * chart, the cross-source table and the setup guidance. Only the filter
 * controls are drawn here, as segmented choices, bound to the same state.
 * `?report=coverage&sender=…&range=…&survey=…` seeds the report once, at
 * mount (#5277 query-stability rule). It reads stored data and sends nothing.
 */
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useCoverageReport, HOPS_OPTIONS, RANGE_PRESETS } from '../../components/Analysis/useCoverageReport';
import { CoverageMap } from '../../components/Analysis/CoverageMap';
import { CoverageReceiverFilter } from '../../components/Analysis/CoverageReceiverFilter';
import { CoverageSummaryPanel } from '../../components/Analysis/CoverageSummaryPanel';
import { CoverageDistanceChart } from '../../components/Analysis/CoverageDistanceChart';
import { CoverageExportButtons } from '../../components/Analysis/CoverageExportButtons';
import { CoverageSurveyBar } from '../../components/Analysis/CoverageSurveyBar';
import { CoverageCrossSourceSummary } from '../../components/Analysis/CoverageCrossSourceSummary';
import { CoverageSetupGuidance } from '../../components/Analysis/CoverageSetupGuidance';
import SearchableSelect from '../../components/common/SearchableSelect';
import { parseCoverageDeepLink } from '../../utils/coverageDeepLink';
import { COVERAGE_GRID_CELL_SIZES_M, formatCoverageNodeId } from '../../utils/coverage';
import type { CoverageGridCellSizeM, CoverageMapView } from '../../types/coverageAnalysis';
import type { CoverageMetric } from '../../utils/coverage';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import styles from './CoveragePage.module.css';

type Coverage = ReturnType<typeof useCoverageReport>;

function Segments<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange(id: T): void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.segments} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Today's filter controls (CoverageReport), as segmented choices where the board draws them. */
function CoverageControls({ c }: { c: Coverage }) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <Segments
        label={t('analysis.coverage.time_range', 'Time range')}
        value={c.preset}
        options={[
          ...RANGE_PRESETS.map((p) => ({ id: p.id, label: t(`analysis.coverage.${p.key}`, p.label) })),
          { id: 'custom' as const, label: t('analysis.coverage.range_custom', 'Custom') },
        ]}
        onChange={(id) => (id === 'custom' ? c.selectCustomPreset() : c.selectPreset(id))}
      />
      {c.preset === 'custom' && (
        <div className={styles.custom}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('analysis.coverage.from', 'From')}</span>
            <input type="datetime-local" value={c.customFrom} onChange={(e) => c.setCustomFrom(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('analysis.coverage.to', 'To')}</span>
            <input type="datetime-local" value={c.customTo} onChange={(e) => c.setCustomTo(e.target.value)} />
          </label>
          <button type="button" className={styles.button} onClick={c.applyCustomRange}>
            {t('analysis.coverage.range_apply', 'Apply')}
          </button>
        </div>
      )}
      <label className={`${styles.field} ${styles.sender}`}>
        <span className={styles.fieldLabel}>{t('analysis.coverage.sender', 'Sender')}</span>
        <SearchableSelect
          value={c.senderId}
          onChange={c.handleSenderChange}
          options={c.senderOptions}
          emptyLabel={t('analysis.coverage.sender_all', 'All')}
          placeholder={t('analysis.coverage.sender_search_placeholder', 'Search senders')}
          noMatchesText={t('analysis.coverage.sender_no_matches', 'No matching senders')}
          ariaLabel={t('analysis.coverage.sender', 'Sender')}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('analysis.coverage.hops', 'Hops')}</span>
        <select value={c.hops} onChange={(e) => c.setHops(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">{t('analysis.coverage.hops_any', 'Any')}</option>
          {HOPS_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      {c.hops !== '' && (
        <label className={styles.check}>
          <input type="checkbox" checked={c.hopsMode === 'max'} onChange={(e) => c.setHopsMode(e.target.checked ? 'max' : 'exact')} />
          {t('analysis.coverage.hops_up_to', 'Up to this many hops')}
        </label>
      )}
      {c.hasOwnSourceSenders && (
        <label
          className={styles.check}
          title={t('analysis.coverage.cross_source_only_hint', 'Show only fixes sent by one of your own sources and heard by another of them.')}
        >
          <input type="checkbox" checked={c.crossSourceOnly} onChange={(e) => c.setCrossSourceOnly(e.target.checked)} />
          {t('analysis.coverage.cross_source_only', 'Cross-source only')}
        </label>
      )}
      <Segments<CoverageMetric>
        label={t('analysis.coverage.metric', 'Colour by')}
        value={c.metric}
        options={[
          { id: 'snr', label: t('analysis.coverage.metric_snr', 'SNR') },
          { id: 'rssi', label: t('analysis.coverage.metric_rssi', 'RSSI') },
        ]}
        onChange={c.setMetric}
      />
      <Segments<CoverageMapView>
        label={t('analysis.coverage.view', 'View')}
        value={c.view}
        options={[
          { id: 'dots', label: t('analysis.coverage.view_dots', 'Dots') },
          { id: 'grid', label: t('analysis.coverage.view_grid', 'Grid') },
        ]}
        onChange={c.setView}
      />
      {c.view === 'grid' && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('analysis.coverage.cell_size', 'Cell size')}</span>
          <select value={c.cellSize} onChange={(e) => c.setCellSize(Number(e.target.value) as CoverageGridCellSizeM)}>
            {COVERAGE_GRID_CELL_SIZES_M.map((size) => <option key={size} value={size}>{size} m</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export default function CoveragePage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [searchParams] = useSearchParams();
  // Read once at mount: the link seeds the report, it is never re-applied (#5277).
  const [initialLink] = useState(() => parseCoverageDeepLink(searchParams) ?? undefined);
  const c = useCoverageReport(initialLink);
  const showResults = c.receptionsEnabled && !c.isLoading && !c.isEmpty && c.items.length > 0;

  const receivers = (
    <div className={styles.receivers}>
      <h2 className={styles.label}>{t('analysis.coverage.receivers_table_title', 'Receivers')}</h2>
      <CoverageReceiverFilter
        receivers={c.receivers}
        deselected={c.deselectedReceiverIds}
        onChange={c.setDeselectedReceiverIds}
        mqttSources={c.mqttSources}
      />
      {c.hasMqttReceivers && (
        <p className={styles.note}>
          {t(
            'analysis.coverage.mqtt_note',
            "Gateway receptions come from what each gateway itself reports over MQTT — nodes with \"OK to MQTT\" turned off won't appear.",
          )}
        </p>
      )}
      {c.retentionDays != null && (
        <p className={styles.note}>{t('analysis.coverage.retention_note', 'Data kept {{days}} days.', { days: c.retentionDays })}</p>
      )}
    </div>
  );

  const banners: ReactNode = (
    <>
      {c.rangeInvalid && (
        <p className={styles.error} role="alert">{t('analysis.coverage.range_error', 'The start time must be on or before the end time.')}</p>
      )}
      {c.noReceiversSelected && (
        <p className={styles.error} role="alert">{t('analysis.coverage.no_receivers_selected', 'Select at least one receiver.')}</p>
      )}
      {c.receptionsQuery.data?.truncated && (
        <p className={styles.banner}>
          {t(
            'analysis.coverage.truncated',
            'Showing the first {{count}} receptions in this window — narrow the time range or pick a sender to see the rest.',
            { count: c.items.length },
          )}
        </p>
      )}
      {c.isEmpty && (
        <div className={styles.banner}>
          <p>{t('analysis.coverage.empty', 'No RF receptions in this window.')}</p>
          <p className={styles.note}>
            {t(
              'analysis.coverage.empty_hint',
              'Only live RF receptions recorded since this feature shipped appear here — there is no backfill from before the upgrade. Drive a route with a survey node broadcasting position while your mesh node is running to populate this report. MQTT gateway sources only start recording once their per-source Coverage recording toggle is turned on.',
            )}
          </p>
          <p className={styles.note}>
            {t('analysis.coverage.empty_hint_meshcore', 'MeshCore companions record signed adverts that carry a position.')}
          </p>
        </div>
      )}
    </>
  );

  const surveyBar = (
    <CoverageSurveyBar
      senderId={c.senderId}
      senderLabel={c.senderId ? (c.senderNames.get(c.senderId) ?? formatCoverageNodeId(c.senderId)) : ''}
      currentSinceMs={c.sinceMs}
      currentUntilMs={c.untilMs}
      currentReceiversEncoded={c.currentReceiversEncoded}
      selectedSurveyId={c.selectedSurveyId}
      onSelectSurvey={c.handleSelectSurvey}
    />
  );

  const map = showResults && (
    <CoverageMap
      fixes={c.fixes}
      receivers={c.receivers}
      metric={c.metric}
      senderNames={c.senderNames}
      fitKey={c.fitKey}
      gaps={c.gapResult?.gaps}
      view={c.view}
      gridCells={c.gridCells}
    />
  );

  const summary = showResults && (
    <CoverageSummaryPanel
      summary={c.summary}
      gapResult={c.gapResult}
      receivers={c.receivers}
      distanceUnit={c.distanceUnit}
      truncated={c.receptionsQuery.data?.truncated ?? false}
    />
  );

  const below = showResults && (
    <>
      <CoverageDistanceChart points={c.summary.distancePoints} receiverNames={c.receiverNames} distanceUnit={c.distanceUnit} />
      <CoverageCrossSourceSummary
        rows={c.crossSourceRows}
        sourceNames={c.sourceNames}
        receiverNames={c.receiverNames}
        sinceMs={c.sinceMs}
        untilMs={c.untilMs}
      />
    </>
  );

  return (
    <ReportFrame
      back="reports"
      title={t('analysis.coverage.title', 'Coverage Report')}
      subtitle={t('workspace.reports.coverage_live')}
      actions={
        <>
          <button type="button" className={styles.button} onClick={c.handleRefresh} disabled={c.isLoading}>
            <UiIcon name="refresh" size={16} />
            {t('analysis.coverage.refresh', 'Refresh')}
          </button>
          <CoverageExportButtons
            items={c.items}
            gaps={c.gapResult?.gaps ?? []}
            ctx={c.exportCtx}
            senderId={c.senderId || null}
            sinceMs={c.sinceMs}
            untilMs={c.untilMs}
            disabled={c.items.length === 0}
          />
        </>
      }
    >
      {isPhone ? (
        <>
          {surveyBar}
          {banners}
          {map}
          <section className={styles.panel}>
            {summary}
            <h2 className={styles.label}>{t('common.filters')}</h2>
            <CoverageControls c={c} />
            {receivers}
          </section>
          {below}
        </>
      ) : (
        <>
          <CoverageControls c={c} />
          {surveyBar}
          {banners}
          <div className={styles.split}>
            {receivers}
            <div className={styles.main}>{map}</div>
          </div>
          {summary}
          {below}
        </>
      )}
      <CoverageSetupGuidance />
    </ReportFrame>
  );
}
