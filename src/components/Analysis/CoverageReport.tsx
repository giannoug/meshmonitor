/**
 * CoverageReport — Coverage Report landing view for the RF reception epic
 * (#5277, Phase 1 WP4; gaps/summary/grid/export/deep-link wired in P4a
 * WP4, COVERAGE_P4_SPEC.md §2a.7). Filters (sender, receivers, hops, time
 * range, colour metric, dots/grid view) apply immediately — this is a live
 * view over recently-recorded receptions, not a deferred multi-source scan
 * like MqttViolationsReport, so there is no "Run report" gate. A manual
 * Refresh button re-runs the current window instead of polling (spec
 * §2.11).
 *
 * Data flow: `useCoverageReceivers` (the receiver checkbox list + names),
 * `useCoverageSenders` (the sender picker), `useCoverageReceptions` (the
 * paginated reception rows for the map). Reception rows are grouped into
 * fixes with `groupReceptionsIntoFixes` (`src/utils/coverage.ts`, shared with
 * the server) and handed to `CoverageMap`, plus the P4a pure analysis
 * functions (`coverageGaps`/`coverageSummary`/`coverageGrid`, WP1) that turn
 * those same fixes/items into gap lines, the summary panel and the grid
 * view. `initialLink` seeds the sender + range once at mount from a
 * `/reports?report=coverage&…` deep link (AnalysisTab, WP4 + ShowCoverageLink,
 * WP5) — never re-applied after mount, same rule as the query-stability fix
 * on `timeWindow` below.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { formatCoverageNodeId, COVERAGE_GRID_CELL_SIZES_M } from '../../utils/coverage';
import type { CoverageMetric } from '../../utils/coverage';
import type { CoverageDeepLink, CoverageGridCellSizeM } from '../../types/coverageAnalysis';
import { CoverageMap } from './CoverageMap';
import { CoverageReceiverFilter } from './CoverageReceiverFilter';
import { CoverageSummaryPanel } from './CoverageSummaryPanel';
import { CoverageDistanceChart } from './CoverageDistanceChart';
import { CoverageExportButtons } from './CoverageExportButtons';
import { CoverageSurveyBar } from './CoverageSurveyBar';
import { CoverageCrossSourceSummary } from './CoverageCrossSourceSummary';
import { CoverageSetupGuidance } from './CoverageSetupGuidance';
import SearchableSelect from '../common/SearchableSelect';
import { HOPS_OPTIONS, RANGE_PRESETS, useCoverageReport } from './useCoverageReport';
import styles from './CoverageReport.module.css';

export interface CoverageReportProps {
  /**
   * Seeds the sender filter and time-range preset once at mount from a
   * `/reports?report=coverage&sender=…&range=…` deep link (AnalysisTab's
   * `useSearchParams` + `parseCoverageDeepLink`, WP4; `ShowCoverageLink`,
   * WP5). Read ONLY in the lazy `useState` initializers below — never
   * re-applied on a prop change after mount. Same rule as `timeWindow`
   * (see its comment): re-deriving from a prop on every render is exactly
   * the shape of the #5277 query-stability regression, just one hop
   * removed (a prop that changes identity every render would be just as
   * bad as `Date.now()` computed inline).
   */
  initialLink?: CoverageDeepLink;
}

export const CoverageReport: React.FC<CoverageReportProps> = ({ initialLink }) => {
  const { t } = useTranslation();
  const {
    distanceUnit,
    preset,
    selectPreset,
    selectCustomPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    applyCustomRange,
    senderId,
    handleSenderChange,
    senderOptions,
    senderNames,
    hops,
    setHops,
    hopsMode,
    setHopsMode,
    hasOwnSourceSenders,
    crossSourceOnly,
    setCrossSourceOnly,
    metric,
    setMetric,
    view,
    setView,
    cellSize,
    setCellSize,
    handleRefresh,
    isLoading,
    isEmpty,
    items,
    fixes,
    gapResult,
    exportCtx,
    sinceMs,
    untilMs,
    rangeInvalid,
    currentReceiversEncoded,
    selectedSurveyId,
    handleSelectSurvey,
    receivers,
    deselectedReceiverIds,
    setDeselectedReceiverIds,
    mqttSources,
    hasMqttReceivers,
    retentionDays,
    noReceiversSelected,
    receptionsQuery,
    receptionsEnabled,
    fitKey,
    gridCells,
    summary,
    crossSourceRows,
    sourceNames,
    receiverNames,
  } = useCoverageReport(initialLink);

  return (
    <>
      <div>
        <h2 className="reports-section__title">
          <UiIcon name="radioSignal" size={22} />
          {t('analysis.coverage.title', 'Coverage Report')}
        </h2>
        <p className="reports-section__subtitle">
          {t(
            'analysis.coverage.description',
            'Map RF receptions of position packets — how far your mesh actually reaches, and how well each receiver hears it. Built from a survey node driving your coverage area, not sent by MeshMonitor.',
          )}
        </p>
      </div>

      <div className="reports-panel">
        <div className="reports-controls">
          <div className="reports-controls__field">
            <span>{t('analysis.coverage.time_range', 'Time range')}</span>
            <div>
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`reports-btn reports-btn--ghost${preset === p.id ? ` ${styles.activePreset}` : ''}`}
                  onClick={() => selectPreset(p.id)}
                >
                  {t(`analysis.coverage.${p.key}`, p.label)}
                </button>
              ))}
              <button
                type="button"
                className={`reports-btn reports-btn--ghost${preset === 'custom' ? ` ${styles.activePreset}` : ''}`}
                onClick={selectCustomPreset}
              >
                {t('analysis.coverage.range_custom', 'Custom')}
              </button>
            </div>
          </div>

          {preset === 'custom' && (
            <>
              <label className="reports-controls__field">
                <span>{t('analysis.coverage.from', 'From')}</span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="reports-controls__field">
                <span>{t('analysis.coverage.to', 'To')}</span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
              <button type="button" className="reports-btn reports-btn--ghost" onClick={applyCustomRange}>
                {t('analysis.coverage.range_apply', 'Apply')}
              </button>
            </>
          )}

          <label className={`reports-controls__field ${styles.senderField}`}>
            <span>{t('analysis.coverage.sender', 'Sender')}</span>
            <SearchableSelect
              value={senderId}
              onChange={handleSenderChange}
              options={senderOptions}
              emptyLabel={t('analysis.coverage.sender_all', 'All')}
              placeholder={t('analysis.coverage.sender_search_placeholder', 'Search senders')}
              noMatchesText={t('analysis.coverage.sender_no_matches', 'No matching senders')}
              ariaLabel={t('analysis.coverage.sender', 'Sender')}
            />
          </label>

          <label className="reports-controls__field">
            <span>{t('analysis.coverage.hops', 'Hops')}</span>
            <select
              value={hops}
              onChange={(e) => setHops(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{t('analysis.coverage.hops_any', 'Any')}</option>
              {HOPS_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          {hops !== '' && (
            <label className="reports-controls__field">
              <input
                type="checkbox"
                checked={hopsMode === 'max'}
                onChange={(e) => setHopsMode(e.target.checked ? 'max' : 'exact')}
              />
              {t('analysis.coverage.hops_up_to', 'Up to this many hops')}
            </label>
          )}

          {hasOwnSourceSenders && (
            <label
              className="reports-controls__field"
              title={t(
                'analysis.coverage.cross_source_only_hint',
                'Show only fixes sent by one of your own sources and heard by another of them.',
              )}
            >
              <input
                type="checkbox"
                checked={crossSourceOnly}
                onChange={(e) => setCrossSourceOnly(e.target.checked)}
              />
              {t('analysis.coverage.cross_source_only', 'Cross-source only')}
            </label>
          )}

          <label className="reports-controls__field">
            <span>{t('analysis.coverage.metric', 'Colour by')}</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as CoverageMetric)}>
              <option value="snr">{t('analysis.coverage.metric_snr', 'SNR')}</option>
              <option value="rssi">{t('analysis.coverage.metric_rssi', 'RSSI')}</option>
            </select>
          </label>

          <div className="reports-controls__field">
            <span>{t('analysis.coverage.view', 'View')}</span>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`reports-btn reports-btn--ghost${view === 'dots' ? ` ${styles.activePreset}` : ''}`}
                aria-pressed={view === 'dots'}
                onClick={() => setView('dots')}
              >
                {t('analysis.coverage.view_dots', 'Dots')}
              </button>
              <button
                type="button"
                className={`reports-btn reports-btn--ghost${view === 'grid' ? ` ${styles.activePreset}` : ''}`}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                {t('analysis.coverage.view_grid', 'Grid')}
              </button>
            </div>
          </div>

          {view === 'grid' && (
            <label className="reports-controls__field">
              <span>{t('analysis.coverage.cell_size', 'Cell size')}</span>
              <select
                value={cellSize}
                onChange={(e) => setCellSize(Number(e.target.value) as CoverageGridCellSizeM)}
              >
                {COVERAGE_GRID_CELL_SIZES_M.map((size) => (
                  <option key={size} value={size}>
                    {size} m
                  </option>
                ))}
              </select>
            </label>
          )}

          <button type="button" className="reports-btn" onClick={handleRefresh} disabled={isLoading}>
            <UiIcon name="refresh" size={14} />
            {t('analysis.coverage.refresh', 'Refresh')}
          </button>

          <CoverageExportButtons
            items={items}
            gaps={gapResult?.gaps ?? []}
            ctx={exportCtx}
            senderId={senderId || null}
            sinceMs={sinceMs}
            untilMs={untilMs}
            disabled={items.length === 0}
          />
        </div>

        <CoverageSurveyBar
          senderId={senderId}
          senderLabel={senderId ? (senderNames.get(senderId) ?? formatCoverageNodeId(senderId)) : ''}
          currentSinceMs={sinceMs}
          currentUntilMs={untilMs}
          currentReceiversEncoded={currentReceiversEncoded}
          selectedSurveyId={selectedSurveyId}
          onSelectSurvey={handleSelectSurvey}
        />

        <CoverageReceiverFilter
          receivers={receivers}
          deselected={deselectedReceiverIds}
          onChange={setDeselectedReceiverIds}
          mqttSources={mqttSources}
        />

        {hasMqttReceivers && (
          <div className={styles.mqttNote}>
            {t(
              'analysis.coverage.mqtt_note',
              "Gateway receptions come from what each gateway itself reports over MQTT — nodes with \"OK to MQTT\" turned off won't appear.",
            )}
          </div>
        )}

        {retentionDays != null && (
          <div className={styles.retentionNote}>
            {t('analysis.coverage.retention_note', 'Data kept {{days}} days.', { days: retentionDays })}
          </div>
        )}
      </div>

      {rangeInvalid && (
        <div className="reports-banner reports-banner--error">
          {t('analysis.coverage.range_error', 'The start time must be on or before the end time.')}
        </div>
      )}

      {noReceiversSelected && (
        <div className="reports-banner reports-banner--error">
          {t('analysis.coverage.no_receivers_selected', 'Select at least one receiver.')}
        </div>
      )}

      {receptionsQuery.data?.truncated && (
        <div className="reports-banner reports-banner--warning">
          {t(
            'analysis.coverage.truncated',
            'Showing the first {{count}} receptions in this window — narrow the time range or pick a sender to see the rest.',
            { count: items.length },
          )}
        </div>
      )}

      {isEmpty && (
        <div className="reports-banner reports-banner--empty">
          <div>
            {t(
              'analysis.coverage.empty',
              'No RF receptions in this window.',
            )}
          </div>
          <div className="reports-banner__hint">
            {t(
              'analysis.coverage.empty_hint',
              'Only live RF receptions recorded since this feature shipped appear here — there is no backfill from before the upgrade. Drive a route with a survey node broadcasting position while your mesh node is running to populate this report. MQTT gateway sources only start recording once their per-source Coverage recording toggle is turned on.',
            )}
          </div>
          <div className="reports-banner__hint">
            {t(
              'analysis.coverage.empty_hint_meshcore',
              'MeshCore companions record signed adverts that carry a position.',
            )}
          </div>
        </div>
      )}

      {receptionsEnabled && !isLoading && !isEmpty && items.length > 0 && (
        <>
          <CoverageMap
            fixes={fixes}
            receivers={receivers}
            metric={metric}
            senderNames={senderNames}
            fitKey={fitKey}
            gaps={gapResult?.gaps}
            view={view}
            gridCells={gridCells}
          />
          <CoverageSummaryPanel
            summary={summary}
            gapResult={gapResult}
            receivers={receivers}
            distanceUnit={distanceUnit}
            truncated={receptionsQuery.data?.truncated ?? false}
          />
          <CoverageCrossSourceSummary
            rows={crossSourceRows}
            sourceNames={sourceNames}
            receiverNames={receiverNames}
            sinceMs={sinceMs}
            untilMs={untilMs}
          />
          <CoverageDistanceChart
            points={summary.distancePoints}
            receiverNames={receiverNames}
            distanceUnit={distanceUnit}
          />
        </>
      )}

      <CoverageSetupGuidance />
    </>
  );
};

export default CoverageReport;
