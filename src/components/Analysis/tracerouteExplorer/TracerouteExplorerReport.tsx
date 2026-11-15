/**
 * Traceroute Explorer report (#5511).
 *
 * Every stored traceroute across the sources the user can read, on a linked
 * map and table. The server returns one window of runs (time range only);
 * every other filter runs client-side, so map clicks and filter changes
 * re-render without a round trip.
 *
 * Layout: Table | Map + Table | Map. Collapsing the map leaves a thin rail
 * (the same state as Table view); full screen pins the workspace to the
 * viewport. Read-only — this report sends nothing to any node.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../icons';
import type { NodeTransportClass } from '../../../utils/nodeTransport';
import { RANGE_PRESETS } from './explorerApi';
import { nodeLongLabel, type ProtocolFilter, type ResultFilter } from './explorerModel';
import { ExplorerMap, type LineMode } from './ExplorerMap';
import { ExplorerTable, type GroupMode } from './ExplorerTable';
import { ExplorerDetail } from './ExplorerDetail';
import { useTracerouteExplorer, type TracerouteExplorerState, type ViewMode } from './useTracerouteExplorer';
import styles from './TracerouteExplorer.module.css';

export type { ViewMode };

const TRANSPORTS: NodeTransportClass[] = ['rf', 'mqtt', 'udp'];
const HOP_CAPS = [1, 2, 3, 5];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}


/** The filter panel: time range, source, protocol (both in the window), result, transport, node search, max hops, and the Through-node chip. */
export function ExplorerFilterBar({ x }: { x: TracerouteExplorerState }) {
  const { t } = useTranslation();
  const { rangeId, setRangeId, sourceFilter, setSourceFilter, filters, prefs, setSelectedKey, updatePrefs, data, bothProtocols, setFilter, toggleTransport, filterNode } = x;
  return (
    <>
    <div className="reports-panel">
      <div className={styles.filters}>
        <div className={styles.field}>
          <span>{t('analysis.traceroute_explorer.range', 'Time range')}</span>
          <Segmented
            label={t('analysis.traceroute_explorer.range', 'Time range')}
            value={rangeId}
            onChange={id => {
              setRangeId(id);
              setSelectedKey(null);
            }}
            options={RANGE_PRESETS.map(p => ({
              id: p.id,
              label: p.hours == null ? t('analysis.traceroute_explorer.range_all', 'All') : p.id,
            }))}
          />
        </div>
        <label className={styles.field}>
          <span>{t('analysis.traceroute_explorer.source', 'Source')}</span>
          <select
            id="trx-source"
            value={sourceFilter}
            onChange={e => {
              setSourceFilter(e.target.value);
              setSelectedKey(null);
            }}
          >
            <option value="">{t('analysis.traceroute_explorer.all_sources', 'All sources')}</option>
            {(data?.sources ?? []).map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {bothProtocols && (
          <div className={styles.field}>
            <span>{t('analysis.traceroute_explorer.protocol', 'Protocol')}</span>
            <Segmented<ProtocolFilter>
              label={t('analysis.traceroute_explorer.protocol', 'Protocol')}
              value={prefs.protocol}
              onChange={v => {
                updatePrefs({ protocol: v });
                setSelectedKey(null);
              }}
              options={[
                { id: 'all', label: t('analysis.traceroute_explorer.result_all', 'All') },
                { id: 'meshtastic', label: t('analysis.traceroute_explorer.protocol_meshtastic', 'Meshtastic') },
                { id: 'meshcore', label: t('analysis.traceroute_explorer.protocol_meshcore', 'MeshCore') },
              ]}
            />
          </div>
        )}
        <div className={styles.field}>
          <span>{t('analysis.traceroute_explorer.result', 'Result')}</span>
          <Segmented<ResultFilter>
            label={t('analysis.traceroute_explorer.result', 'Result')}
            value={filters.result}
            onChange={v => setFilter('result', v)}
            options={[
              { id: 'all', label: t('analysis.traceroute_explorer.result_all', 'All') },
              { id: 'answered', label: t('analysis.traceroute_explorer.answered', 'Answered') },
              { id: 'failed', label: t('analysis.traceroute_explorer.no_response', 'No response') },
            ]}
          />
        </div>
        <div className={styles.field}>
          <span>{t('analysis.traceroute_explorer.transport', 'Transport')}</span>
          <div className={styles.chips}>
            {TRANSPORTS.map(tr => (
              <button
                key={tr}
                type="button"
                className={styles.chip}
                aria-pressed={filters.transports.includes(tr)}
                onClick={() => toggleTransport(tr)}
              >
                {tr.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          <span>{t('analysis.traceroute_explorer.node_search', 'Node (endpoint or relay)')}</span>
          <input
            id="trx-search"
            type="search"
            value={filters.search}
            placeholder={t('analysis.traceroute_explorer.node_search_placeholder', 'Name or !id')}
            onChange={e => setFilter('search', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{t('analysis.traceroute_explorer.max_hops', 'Max hops')}</span>
          <select
            id="trx-maxhops"
            value={filters.maxHops ?? ''}
            onChange={e => setFilter('maxHops', e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{t('analysis.traceroute_explorer.any', 'Any')}</option>
            {HOP_CAPS.map(n => (
              <option key={n} value={n}>
                ≤ {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filterNode && (
        <div className={styles.activeFilters}>
          <span className={styles.pill}>
            {t('analysis.traceroute_explorer.through_node', 'Through {{name}}', { name: filterNode })}
            <button
              type="button"
              aria-label={t('analysis.traceroute_explorer.clear_node', 'Clear node filter')}
              onClick={() => setFilter('nodeKey', null)}
            >
              <UiIcon name="close" size={12} />
            </button>
          </span>
        </div>
      )}
    </div>
    </>
  );
}

/** The load-failed and truncated-window banners. */
export function ExplorerBanners({ x }: { x: TracerouteExplorerState }) {
  const { t } = useTranslation();
  const { query, data } = x;
  return (
    <>
    {query.isError && (
      <div className="reports-banner reports-banner--error">
        {t('analysis.traceroute_explorer.load_failed', 'Could not load traceroutes. Check your connection and try again.')}
      </div>
    )}
    {data?.truncated && (
      <div className="reports-banner reports-banner--warning">
        {t(
          'analysis.traceroute_explorer.truncated',
          'This time range holds more than {{count}} stored rows, so only the newest are shown. Pick a shorter range to see all of it.',
          { count: data.scanLimit },
        )}
      </div>
    )}
    </>
  );
}

/** The five summary tiles and the retention note. */
export function ExplorerSummaryBar({ x }: { x: TracerouteExplorerState }) {
  const { t } = useTranslation();
  const { data, protocolsPresent, summary } = x;
  return (
    <>
    <div className={styles.summary} data-testid="traceroute-explorer-summary">
      {[
        [summary.total, t('analysis.traceroute_explorer.stat_traceroutes', 'Traceroutes')],
        [summary.pairs, t('analysis.traceroute_explorer.stat_pairs', 'Node pairs')],
        [summary.answeredPct == null ? '—' : `${summary.answeredPct}%`, t('analysis.traceroute_explorer.stat_answered', 'Answered')],
        [summary.medianHops ?? '—', t('analysis.traceroute_explorer.stat_median_hops', 'Median hops')],
        [summary.routeChanges, t('analysis.traceroute_explorer.stat_route_changes', 'Route changes')],
      ].map(([value, label]) => (
        <div key={String(label)} className={styles.stat}>
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
      {data && (
        <div className={styles.retention}>
          {t(
            'analysis.traceroute_explorer.retention',
            'The database keeps the newest {{count}} runs per node pair, so older history thins out on busy pairs.',
            { count: data.retentionPerPair },
          )}
          {data.meshcoreRetentionDays != null && protocolsPresent.has('meshcore') && (
            <>
              {' '}
              {t(
                'analysis.traceroute_explorer.retention_meshcore',
                'MeshCore traces are kept for {{count}} days.',
                { count: data.meshcoreRetentionDays },
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

/** Layout (Table / Map + Table / Map), Group by pair / Every run, Filter table by map selection, Full screen. */
export function ExplorerToolbar({ x }: { x: TracerouteExplorerState }) {
  const { t } = useTranslation();
  const { syncMap, setSyncMap, prefs, full, setFull, updatePrefs } = x;
  return (
    <>
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <Segmented<ViewMode>
          label={t('analysis.traceroute_explorer.layout', 'Layout')}
          value={prefs.view}
          onChange={v => updatePrefs({ view: v })}
          options={[
            { id: 'table', label: t('analysis.traceroute_explorer.view_table', 'Table') },
            { id: 'split', label: t('analysis.traceroute_explorer.view_split', 'Map + Table') },
            { id: 'map', label: t('analysis.traceroute_explorer.view_map', 'Map') },
          ]}
        />
        <Segmented<GroupMode>
          label={t('analysis.traceroute_explorer.rows', 'Rows')}
          value={prefs.group}
          onChange={v => updatePrefs({ group: v })}
          options={[
            { id: 'pair', label: t('analysis.traceroute_explorer.group_pair', 'Group by pair') },
            { id: 'flat', label: t('analysis.traceroute_explorer.group_flat', 'Every run') },
          ]}
        />
      </div>
      <div className={styles.toolbarGroup}>
        <label className={styles.toggle}>
          <input id="trx-sync" type="checkbox" checked={syncMap} onChange={e => setSyncMap(e.target.checked)} />
          {t('analysis.traceroute_explorer.sync_map', 'Filter table by map selection')}
        </label>
        <button type="button" className="reports-btn reports-btn--ghost" onClick={() => setFull(f => !f)}>
          <UiIcon name={full ? 'minimize' : 'maximize'} size={14} />{' '}
          {full
            ? t('analysis.traceroute_explorer.exit_full_screen', 'Exit full screen')
            : t('analysis.traceroute_explorer.full_screen', 'Full screen')}
        </button>
      </div>
    </div>
    </>
  );
}

/** The linked map and table, with the splitter, Collapse map and Map lines. */
export function ExplorerWork({ x }: { x: TracerouteExplorerState }) {
  const { t } = useTranslation();
  const { timeFormat, dateFormat, filters, prefs, selectedKey, setSelectedKey, setHoverKey, openPairs, full, setFull, workRef, updatePrefs, query, nodes, sourceNames, mapRuns, tableRuns, pairs, selectedRun, focusRun, onSelectRun, onNodeClick, onTogglePair, onDividerPointerDown, onDividerKey, fitKey, filterNode } = x;
  return (
    <>
    <div
      ref={workRef}
      className={`${styles.work} ${full ? styles.full : ''}`}
      data-view={prefs.view}
      style={{ '--trx-split': `${prefs.split}%` } as React.CSSProperties}
      data-testid="traceroute-explorer-workspace"
    >
      {prefs.view === 'table' && (
        <div className={styles.rail}>
          <button type="button" onClick={() => updatePrefs({ view: 'split' })}>
            <UiIcon name="map" size={14} /> {t('analysis.traceroute_explorer.show_map', 'Show map')}
          </button>
        </div>
      )}
      {prefs.view !== 'table' && (
        <div className={styles.mapPane}>
          <ExplorerMap
            runs={mapRuns}
            nodes={nodes}
            focusRun={focusRun}
            selectedRun={selectedRun}
            nodeFilter={filters.nodeKey}
            lineMode={prefs.lines}
            fitKey={fitKey}
            onNodeClick={onNodeClick}
            onBackgroundClick={() => setSelectedKey(null)}
          />
          <div className={styles.mapTools}>
            {full && prefs.view === 'map' && (
              <button type="button" className={styles.mapToolBtn} onClick={() => setFull(false)}>
                <UiIcon name="minimize" size={14} />
                {t('analysis.traceroute_explorer.exit_full_screen', 'Exit full screen')}
              </button>
            )}
            {prefs.view === 'split' && (
              <button type="button" className={styles.mapToolBtn} onClick={() => updatePrefs({ view: 'table' })}>
                <UiIcon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} />
                {t('analysis.traceroute_explorer.collapse_map', 'Collapse map')}
              </button>
            )}
            <Segmented<LineMode>
              label={t('analysis.traceroute_explorer.map_lines', 'Map lines')}
              value={prefs.lines}
              onChange={v => updatePrefs({ lines: v })}
              options={[
                { id: 'usage', label: t('analysis.traceroute_explorer.lines_usage', 'Link usage') },
                { id: 'snr', label: t('analysis.traceroute_explorer.lines_snr', 'Link SNR') },
              ]}
            />
          </div>
          <div className={styles.mapHint}>
            {focusRun
              ? t('analysis.traceroute_explorer.hint_run', '{{from}} to {{to}}', {
                  from: nodeLongLabel(nodes, focusRun.fromKey),
                  to: nodeLongLabel(nodes, focusRun.toKey),
                })
              : filterNode
                ? t('analysis.traceroute_explorer.hint_node', 'Showing routes through {{name}}', { name: filterNode })
                : t('analysis.traceroute_explorer.hint_default', 'Line width shows how many traceroute hops used a link. Click a node to filter.')}
          </div>
        </div>
      )}
      {prefs.view === 'split' && (
        <div
          className={styles.divider}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={prefs.split}
          aria-valuemin={25}
          aria-valuemax={75}
          aria-label={t('analysis.traceroute_explorer.resize', 'Resize map and table')}
          tabIndex={0}
          onPointerDown={onDividerPointerDown}
          onKeyDown={onDividerKey}
        />
      )}
      {prefs.view !== 'map' && (
        <div className={styles.tablePane}>
          <div className={styles.tableScroll}>
            {query.isLoading ? (
              <div className={styles.empty}>{t('analysis.traceroute_explorer.loading', 'Loading traceroutes…')}</div>
            ) : (
              <ExplorerTable
                runs={tableRuns}
                pairs={pairs}
                groupMode={prefs.group}
                selectedKey={selectedKey}
                openPairs={openPairs}
                onTogglePair={onTogglePair}
                onSelectRun={onSelectRun}
                onHoverRun={run => setHoverKey(run?.key ?? null)}
                nodes={nodes}
                sourceNames={sourceNames}
                timeFormat={timeFormat}
                dateFormat={dateFormat}
              />
            )}
          </div>
          <div className={styles.tableFoot}>
            <span>
              {prefs.group === 'pair'
                ? t('analysis.traceroute_explorer.count_pairs', '{{pairs}} pairs · {{runs}} runs', {
                    pairs: pairs.length,
                    runs: tableRuns.length,
                  })
                : t('analysis.traceroute_explorer.count_runs', '{{runs}} runs', { runs: tableRuns.length })}
            </span>
            {full && (
              <button type="button" className="reports-btn reports-btn--ghost" onClick={() => setFull(false)}>
                <UiIcon name="minimize" size={14} /> {t('analysis.traceroute_explorer.exit_full_screen', 'Exit full screen')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/** The selected run's detail panel. */
export function ExplorerDetailPanel({ x }: { x: TracerouteExplorerState }) {
  const { nodes, sourceNames, devicesByProtocol, selectedRun, pairRuns } = x;
  return (
    <>
    <div className="reports-panel">
      <ExplorerDetail run={selectedRun} pairRuns={pairRuns} nodes={nodes} devicesByProtocol={devicesByProtocol} sourceNames={sourceNames} />
    </div>
    </>
  );
}

export const TracerouteExplorerReport: React.FC = () => {
  const { t } = useTranslation();
  const x = useTracerouteExplorer();

  return (
    <>
      <div>
        <h2 className="reports-section__title">
          <UiIcon name="route" size={22} />
          {t('analysis.traceroute_explorer.title', 'Traceroute Explorer')}
        </h2>
        <p className="reports-section__subtitle">
          {t(
            'analysis.traceroute_explorer.subtitle',
            'Every stored traceroute across your sources: forward and return paths, SNR per hop, and how routes change over time.',
          )}
        </p>
      </div>

      <ExplorerFilterBar x={x} />
      <ExplorerBanners x={x} />
      <ExplorerSummaryBar x={x} />
      <ExplorerToolbar x={x} />
      <ExplorerWork x={x} />
      <ExplorerDetailPanel x={x} />
    </>
  );
};

export default TracerouteExplorerReport;
