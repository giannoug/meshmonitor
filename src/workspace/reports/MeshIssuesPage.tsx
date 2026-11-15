/**
 * Overview › Reports › Mesh Issues (boards 6-02-mesh-issues, 6-09-mesh-issues,
 * 6-15-mesh-issues-filters; notes s6n0, s6n2, s6n3). Today's report parts,
 * as they are, on today's data and actions (`useMeshIssuesReport`): Run with
 * "Last run … · from storage", the evidence preface, the summary tiles, the
 * filter bar, By issue / By node, and the sections with their tables, bulk
 * menus and Mute rule. On the phone the filter bar moves into a Filters
 * sheet (6-15). Run is a server-side analysis of stored data; nothing here
 * sends on the mesh.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useMeshIssuesReport } from '../../components/Analysis/meshIssues/useMeshIssuesReport';
import { CoveragePreface } from '../../components/Analysis/meshIssues/CoveragePreface';
import SummaryTiles from '../../components/Analysis/meshIssues/SummaryTiles';
import FilterBar from '../../components/Analysis/meshIssues/FilterBar';
import ByIssueView from '../../components/Analysis/meshIssues/ByIssueView';
import ByNodeView from '../../components/Analysis/meshIssues/ByNodeView';
import type { MeshIssuesFilters } from '../../components/Analysis/meshIssueTypes';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import styles from './MeshIssuesPage.module.css';

/** Filter dimensions in use (the Filters button's count, 6-09). The tile selection is not a filter (FilterBar's Clear keeps it). */
function activeFilterCount(f: MeshIssuesFilters): number {
  return [f.severities.length > 0, f.tiers.length > 0, f.sources.length > 0, f.q.trim() !== '', f.includeClosed, f.includeDismissed]
    .filter(Boolean).length;
}

export default function MeshIssuesPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const m = useMeshIssuesReport();
  const status = m.statusQuery.data;
  const filterCount = activeFilterCount(m.filters);

  const subtitle = status?.lastRunTime != null && (
    <>
      {t('workspace.reports.last_run_line', { time: new Date(status.lastRunTime).toLocaleString() })}
      {m.lastRunResult && ` · ${t('workspace.reports.took', { seconds: Math.round(m.lastRunResult.durationMs / 1000) })}`}
      {status.lastRunResultFromStorage && ` ${t('analysis.mesh_issues.from_storage', '(from the last completed run before restart)')}`}
    </>
  );

  const filterBar = (
    <FilterBar filters={m.filters} sourceNames={m.summary?.sourceNames ?? {}} onChange={m.handleFiltersChange} />
  );

  return (
    <ReportFrame
      back="reports"
      title={t('analysis.mesh_issues.title', 'Mesh Issues')}
      subtitle={subtitle}
      actions={
        m.canRunNow && (
          <button type="button" className={styles.run} onClick={m.handleRunNow} disabled={m.running}>
            <UiIcon name="play" size={16} />
            {m.running ? t('analysis.mesh_issues.running', 'Running…') : t('analysis.mesh_issues.run_now', 'Run analysis now')}
          </button>
        )
      }
    >
      {m.runError && <p className={styles.error} role="alert">{m.runError}</p>}

      {m.lastRunResult && (
        <section className={styles.evidence} aria-label={t('workspace.reports.evidence')}>
          <h2 className={styles.label}>{t('workspace.reports.evidence')}</h2>
          <CoveragePreface result={m.lastRunResult} />
        </section>
      )}

      {m.summaryQuery.isLoading && <p className={styles.banner}>{t('analysis.mesh_issues.loading', 'Loading mesh issues…')}</p>}
      {m.summaryQuery.error && (
        <p className={styles.error} role="alert">
          {m.summaryQuery.error instanceof Error ? m.summaryQuery.error.message : t('analysis.mesh_issues.error', 'Error loading mesh issues')}
        </p>
      )}

      {m.summary && !m.summaryQuery.error && (
        <>
          <SummaryTiles
            byType={m.summary.byType}
            total={m.total}
            activeIssueTypes={m.filters.issueTypes}
            newByType={m.lastRunResult?.newByType}
            reopenedByType={m.lastRunResult?.reopenedByType}
            disabledRules={m.disabledRules}
            onSelect={m.handleTileSelect}
          />

          {!isPhone && filterBar}

          <div className={styles.toolbar}>
            {m.total > 0 && (
              <div className={styles.segments} role="group" aria-label={t('workspace.reports.view')}>
                {(['byIssue', 'byNode'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={m.viewState.view === view}
                    onClick={() => m.setViewState((vs) => ({ ...vs, view }))}
                  >
                    {view === 'byIssue'
                      ? t('analysis.mesh_issues.view.by_issue', 'By issue')
                      : t('analysis.mesh_issues.view.by_node', 'By node')}
                  </button>
                ))}
              </div>
            )}
            {m.total > 0 && !isPhone && <span className={styles.hint}>{t('workspace.reports.by_node_hint')}</span>}
            {isPhone && (
              <button type="button" className={styles.filters} onClick={() => setFiltersOpen(true)}>
                <UiIcon name="filter" size={16} />
                {filterCount > 0 ? t('workspace.reports.filters_count', { count: filterCount }) : t('common.filters')}
              </button>
            )}
          </div>

          {m.total === 0 ? (
            <p className={styles.banner}>{t('analysis.mesh_issues.empty', 'No mesh issues detected.')}</p>
          ) : m.viewState.view === 'byIssue' ? (
            <ByIssueView
              summary={m.summary}
              filters={m.filters}
              viewState={m.viewState}
              setViewState={m.setViewState}
              sourceNames={m.summary.sourceNames}
              lastRunTime={m.lastRunTime}
              newByType={m.lastRunResult?.newByType}
              reopenedByType={m.lastRunResult?.reopenedByType}
              canAct={m.canAct}
              onDismiss={m.handleDismiss}
              onRestore={m.handleRestore}
              dismissPendingId={m.dismissMutation.isPending ? (m.dismissMutation.variables ?? null) : null}
              restorePendingId={m.restoreMutation.isPending ? (m.restoreMutation.variables ?? null) : null}
              disabledRules={m.disabledRules}
              autoCloseCleanRuns={m.autoCloseCleanRuns}
              frequencyHours={m.frequencyHours}
              onBulkDismiss={m.handleBulkDismiss}
              onBulkRestore={m.handleBulkRestore}
              bulkPending={m.bulkPending}
              onForbidden={m.handleForbidden}
            />
          ) : (
            <ByNodeView
              summary={m.summary}
              filters={m.filters}
              viewState={m.viewState}
              setViewState={m.setViewState}
              sourceNames={m.summary.sourceNames}
              lastRunTime={m.lastRunTime}
              canAct={m.canAct}
              onDismiss={m.handleDismiss}
              onRestore={m.handleRestore}
              dismissPendingId={m.dismissMutation.isPending ? (m.dismissMutation.variables ?? null) : null}
              restorePendingId={m.restoreMutation.isPending ? (m.restoreMutation.variables ?? null) : null}
              onBulkDismiss={m.handleBulkDismiss}
              onBulkRestore={m.handleBulkRestore}
              bulkPending={m.bulkPending}
            />
          )}
        </>
      )}

      <Sheet
        open={isPhone && filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('common.filters')}
        footer={
          <button type="button" className={styles.show} onClick={() => setFiltersOpen(false)}>
            {t('workspace.reports.show_issues', { count: m.total })}
          </button>
        }
      >
        {filterBar}
      </Sheet>
    </ReportFrame>
  );
}
