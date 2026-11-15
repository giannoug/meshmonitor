/**
 * Overview › Reports › Traceroute Explorer (boards 6-04, 6-11; notes s6n0,
 * s6n2, s6n3). Today's explorer (`useTracerouteExplorer` and its parts, as
 * they are): the filters with the Through chip, the summary tiles, the
 * layout / rows / full-screen toolbar, the linked map (BaseMap) and table,
 * and the selected run's detail with Pair history and the paths used, in a
 * column beside the map and table (Ruling CN). Refresh re-reads the window.
 * The phone gets a one-line summary, the filters with Group by pair / Every
 * run in a sheet, one ≥52 px row per pair (or per run) that opens its run in
 * a sheet, and the map behind Show map. Reads only: nothing here sends to any
 * node.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { formatDateTime } from '../../utils/datetime';
import {
  ExplorerBanners,
  ExplorerDetailPanel,
  ExplorerFilterBar,
  ExplorerSummaryBar,
  ExplorerToolbar,
  ExplorerWork,
  Segmented,
} from '../../components/Analysis/tracerouteExplorer/TracerouteExplorerReport';
import { useTracerouteExplorer, type TracerouteExplorerState } from '../../components/Analysis/tracerouteExplorer/useTracerouteExplorer';
import { ExplorerMap } from '../../components/Analysis/tracerouteExplorer/ExplorerMap';
import { DEFAULT_FILTERS, nodeLongLabel, type ExplorerRun } from '../../components/Analysis/tracerouteExplorer/explorerModel';
import type { GroupMode } from '../../components/Analysis/tracerouteExplorer/ExplorerTable';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import parts from './reportParts.module.css';
import styles from './TracerouteExplorerPage.module.css';

/** Filter dimensions moved off today's defaults, the range included (the phone Filters button's count, Ruling CP). */
function filterCount(x: TracerouteExplorerState): number {
  const f = x.filters;
  return [
    x.rangeId !== '24h',
    x.sourceFilter !== '',
    x.bothProtocols && x.prefs.protocol !== 'all',
    f.result !== DEFAULT_FILTERS.result,
    f.transports.length !== DEFAULT_FILTERS.transports.length,
    f.search.trim() !== '',
    f.maxHops != null,
    f.nodeKey != null,
  ].filter(Boolean).length;
}

export default function TracerouteExplorerPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const x = useTracerouteExplorer();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const pairDetail = useRef<HTMLDivElement>(null);

  const refresh = (
    <button type="button" className={parts.ghost} onClick={() => void x.query.refetch()} disabled={x.query.isFetching}>
      <UiIcon name="refresh" size={16} />
      {t('common.refresh')}
    </button>
  );

  if (!isPhone) {
    return (
      <ReportFrame
        back="reports"
        title={t('analysis.traceroute_explorer.title', 'Traceroute Explorer')}
        subtitle={t('workspace.reports.coverage_live')}
        actions={refresh}
      >
        <div className={styles.desktop}>
          <ExplorerFilterBar x={x} />
          <ExplorerBanners x={x} />
          <ExplorerSummaryBar x={x} />
          <ExplorerToolbar x={x} />
          <div className={styles.main}>
            <div className={styles.workColumn}>
              <ExplorerWork x={x} />
            </div>
            <aside className={styles.detailColumn} data-testid="explorer-detail-column">
              <ExplorerDetailPanel x={x} />
            </aside>
          </div>
        </div>
      </ReportFrame>
    );
  }

  const { summary, pairs, nodes, timeFormat, dateFormat } = x;
  /** One ≥52 px row: the run's endpoints, its time and `meta`, its tags; a tap opens `run` in the pair sheet. */
  const row = (key: string, testId: string, run: ExplorerRun, meta: ReactNode) => (
    <li key={key} className={parts.item} data-testid={testId}>
      <button type="button" className={parts.rowButton} onClick={() => x.setSelectedKey(run.key)}>
        <span className={parts.rowTitle}>
          {nodeLongLabel(nodes, run.fromKey)}
          <UiIcon name="forward" size={14} />
          {nodeLongLabel(nodes, run.toKey)}
        </span>
        <span className={parts.rowMeta}>
          {formatDateTime(new Date(run.timestamp), timeFormat, dateFormat)} · {meta}
          {run.routeChanged && (
            <span className={parts.tag} data-tone="warn">{t('analysis.traceroute_explorer.route_changed', 'Route changed')}</span>
          )}
          {run.asymmetric && <span className={parts.tag}>{t('analysis.traceroute_explorer.asymmetric', 'Asymmetric')}</span>}
        </span>
      </button>
      <UiIcon name="chevronRight" size={18} className={parts.chevron} />
    </li>
  );
  const count = filterCount(x);
  const answered = summary.answeredPct == null ? '—' : `${summary.answeredPct}%`;

  return (
    <ReportFrame
      back="reports"
      title={t('analysis.traceroute_explorer.title', 'Traceroute Explorer')}
      subtitle={t('workspace.reports.explorer_line', { runs: summary.total, pairs: summary.pairs, answered })}
    >
      <div className={parts.toolbar}>
        <button type="button" className={parts.ghost} onClick={() => setShowMap((v) => !v)} aria-pressed={showMap}>
          <UiIcon name="map" size={16} />
          {showMap
            ? t('analysis.traceroute_explorer.collapse_map', 'Collapse map')
            : t('analysis.traceroute_explorer.show_map', 'Show map')}
        </button>
        <button type="button" className={parts.ghost} onClick={() => setFiltersOpen(true)}>
          <UiIcon name="filter" size={16} />
          {count > 0 ? t('workspace.reports.filters_count', { count }) : t('common.filters')}
        </button>
      </div>

      <ExplorerBanners x={x} />

      {showMap && (
        <div className={styles.phoneMap}>
          <ExplorerMap
            runs={x.mapRuns}
            nodes={nodes}
            focusRun={x.selectedRun}
            selectedRun={x.selectedRun}
            nodeFilter={x.filters.nodeKey}
            lineMode={x.prefs.lines}
            fitKey={x.fitKey}
            onNodeClick={x.onNodeClick}
            onBackgroundClick={() => x.setSelectedKey(null)}
          />
        </div>
      )}

      {x.query.isLoading ? (
        <p className={parts.banner}>{t('analysis.traceroute_explorer.loading', 'Loading traceroutes…')}</p>
      ) : x.tableRuns.length === 0 ? (
        <p className={parts.banner}>
          {t('analysis.traceroute_explorer.empty', 'No traceroutes match these filters. Try a wider time range or clear a filter.')}
        </p>
      ) : (
        <ul className={parts.list}>
          {x.prefs.group === 'pair'
            ? pairs.map((pair) => {
                const newest = pair.runs[0];
                const pct = Math.round((pair.answeredCount / pair.runs.length) * 100);
                return row(
                  pair.key,
                  'explorer-pair-item',
                  newest,
                  t('analysis.traceroute_explorer.answer_pct', '{{pct}}% answered', { pct }),
                );
              })
            : x.tableRuns.map((run) =>
                row(
                  run.key,
                  'explorer-run-item',
                  run,
                  [
                    run.answered
                      ? t('analysis.traceroute_explorer.answered', 'Answered')
                      : t('analysis.traceroute_explorer.no_response', 'No response'),
                    run.hops != null && `${t('analysis.traceroute_explorer.col_hops', 'Hops')} ${run.hops}`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ),
              )}
        </ul>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
        <div className={`${parts.targets} ${styles.sheetFilters}`}>
          <ExplorerFilterBar x={x} />
          <div className={`${parts.sheetPad} ${styles.rows}`}>
            <span>{t('analysis.traceroute_explorer.rows', 'Rows')}</span>
            <Segmented<GroupMode>
              label={t('analysis.traceroute_explorer.rows', 'Rows')}
              value={x.prefs.group}
              onChange={(group) => x.updatePrefs({ group })}
              options={[
                { id: 'pair', label: t('analysis.traceroute_explorer.group_pair', 'Group by pair') },
                { id: 'flat', label: t('analysis.traceroute_explorer.group_flat', 'Every run') },
              ]}
            />
          </div>
        </div>
      </Sheet>

      <Sheet
        open={!filtersOpen && x.selectedRun != null}
        onClose={() => {
          // Escape reaches every open dialog; while Pair history (today's Modal, inside this sheet) is open, only it closes (Ruling CR).
          if (pairDetail.current?.querySelector('[role="dialog"]')) return;
          x.setSelectedKey(null);
        }}
        title={t('analysis.traceroute_explorer.col_pair', 'Pair')}
      >
        <div className={parts.targets} ref={pairDetail}>
          <ExplorerDetailPanel x={x} />
        </div>
      </Sheet>
    </ReportFrame>
  );
}
