/**
 * Overview › Telemetry (boards 7-03, 7-04, 7-07; s7n0–s7n3): today's
 * cross-source Telemetry Dashboard on its shared hooks.
 *
 * - Graphs: every favorited series by category, one card per (node, type)
 *   with Split by source, a device tag per legend entry and a menu holding
 *   Y-axis range, Export CSV and Remove from favorites. Fetched on load, on a
 *   range change and on Refresh (no polling, as today).
 * - Latest: the latest reading per node per device, grouped by device, with
 *   Jump to chips and a star per reading the viewer may favorite (today's 60 s
 *   poll, Ruling BF).
 * - Phone: the page's own header with Refresh, Graphs / Latest as a segmented
 *   control, range and source chips, and the rest of the filters in a sheet.
 *
 * Every line, section, chip and option keeps to the devices the viewer can
 * read (Review Focus 2, `readableSources`). Nothing here sends on the mesh.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import CombinedTelemetryChart, { type CombinedChartActions } from '../../components/CombinedTelemetryChart/CombinedTelemetryChart';
import { useUnifiedTelemetrySeries } from '../../components/unifiedTelemetry/useUnifiedTelemetrySeries';
import {
  HOURS_LABELS,
  HOURS_OPTIONS,
  SORT_I18N_KEY,
  SORT_KEYS,
  TYPE_LABELS,
  formatAge,
  readingDisplay,
  useUnifiedTelemetryLatest,
  type HoursOption,
  type SortKey,
} from '../../components/unifiedTelemetry/useUnifiedTelemetryLatest';
import { useSettings } from '../../contexts/SettingsContext';
import { TELEMETRY_RANGE_PRESETS } from '../../utils/telemetryRangePresets';
import { TELEMETRY_CATEGORY_LABELS } from '../../utils/telemetryCategory';
import DeviceTag from '../patterns/DeviceTag';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { useReadableSourceIds } from './readableSources';
import styles from './OverviewTelemetry.module.css';

type View = 'graphs' | 'latest';

/** "15m" → "15 m", as the boards write a range. */
const spaced = (label: string) => label.replace(/^(\d+)([a-z]+)$/, '$1 $2');

interface RangeProps<T extends number> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange(value: T): void;
}

function RangeGroup<T extends number>({ options, value, onChange }: RangeProps<T>) {
  const { t } = useTranslation();
  return (
    <div className={styles.segmented} role="group" aria-label={t('unified.telemetry.range_aria')}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RangeSelect<T extends number>({ options, value, onChange }: RangeProps<T>) {
  const { t } = useTranslation();
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as T)}
      aria-label={t('unified.telemetry.range_aria')}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SourceSelect({ value, onChange, sources }: { value: string; onChange(v: string): void; sources: Array<{ id: string; name: string }> }) {
  const { t } = useTranslation();
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('unified.telemetry.filter_source_aria')}>
      <option value="">{t('unified.telemetry.all_sources')}</option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

interface FrameProps {
  view: View;
  onView(view: View): void;
  subtitle: string;
  onRefresh?(): void;
  refreshing?: boolean;
  /** Desktop: the controls row(s) under the head. */
  controls: ReactNode;
  /** Phone: the chips beside Filters. */
  chips: ReactNode;
  /** Phone: the filter sheet's body. */
  sheet: ReactNode;
  children: ReactNode;
}

/** The page frame both views share: title, Graphs / Latest, controls, and on the phone the header, chips and filter sheet. */
function Frame({ view, onView, subtitle, onRefresh, refreshing, controls, chips, sheet, children }: FrameProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const title = t('unified.telemetry.title');
  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label={t('unified.telemetry.view_aria')}>
      {(['graphs', 'latest'] as const).map((v) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => onView(v)}>
          {t(v === 'graphs' ? 'unified.telemetry.view_graphs' : 'unified.telemetry.view_latest')}
        </button>
      ))}
    </div>
  );
  const refresh = onRefresh && (
    <button type="button" className={styles.button} onClick={onRefresh} disabled={refreshing}>
      <UiIcon name="refresh" size={16} />
      {t('unified.telemetry.refresh')}
    </button>
  );

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <header className={styles.phoneHead}>
          <Link to="/overview" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.shell.overview')}
          </Link>
        </header>
        <div className={styles.titleRow}>
          <div className={styles.headText}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          {refresh}
        </div>
        {tabs}
        <div className={styles.chips}>
          {chips}
          <button type="button" className={styles.button} onClick={() => setFiltersOpen(true)}>
            <UiIcon name="filter" size={16} />
            {t('common.filters')}
          </button>
        </div>
        {children}
        <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
          <div className={styles.sheetBody}>{sheet}</div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {tabs}
      </header>
      {controls}
      {children}
    </div>
  );
}

/** A card's actions: Split by source, and a menu with Split, Y-axis range, Export CSV and Remove from favorites. */
function ChartActions({ actions }: { actions: CombinedChartActions }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const item = (icon: Parameters<typeof UiIcon>[0]['name'], label: string, run: () => void, disabled = false) => (
    <button
      type="button"
      role="menuitem"
      className={styles.menuItem}
      disabled={disabled}
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      <UiIcon name={icon} size={16} />
      {label}
    </button>
  );

  return (
    <div className={styles.cardActions} ref={ref}>
      {actions.split && (
        <button
          type="button"
          className={styles.splitButton}
          aria-pressed={actions.split.on}
          title={t('unified.telemetry.split_hint')}
          onClick={actions.split.toggle}
        >
          {t('unified.telemetry.split_by_source')}
        </button>
      )}
      <button
        type="button"
        className={styles.moreButton}
        aria-label={t('workspace.overview.telemetry.chart_menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" id={menuId} aria-label={actions.title}>
          <p className={styles.menuTitle}>{actions.title}</p>
          {actions.split && item('list', t('unified.telemetry.split_by_source'), actions.split.toggle)}
          {actions.yRange && item('ruler', `${t('chart_y_range.title')}…`, actions.yRange.toggleEditor)}
          {item('downloadData', t('telemetry.export_csv'), actions.exportCsv.run, actions.exportCsv.disabled)}
          {actions.removeFavorite &&
            item('favoriteOff', t('telemetry.remove_favorite'), actions.removeFavorite.run, actions.removeFavorite.busy)}
        </div>
      )}
    </div>
  );
}

const tagFor = (sourceId: string) => <DeviceTag sourceId={sourceId} />;
const renderActions = (actions: CombinedChartActions) => <ChartActions actions={actions} />;

function GraphsView({ view, onView }: { view: View; onView(v: View): void }) {
  const { t } = useTranslation();
  const { temperatureUnit, timeFormat } = useSettings();
  const readable = useReadableSourceIds();
  const g = useUnifiedTelemetrySeries();

  // Only lines from readable devices; a series or section left empty goes.
  const sections = useMemo(
    () =>
      g.sections.flatMap((s) => {
        const items = s.items.flatMap((it) => {
          const lines = it.lines.filter((l) => readable.has(l.sourceId));
          return lines.length ? [lines.length === it.lines.length ? it : { ...it, lines }] : [];
        });
        return items.length ? [{ ...s, items }] : [];
      }),
    [g.sections, readable],
  );
  const sources = g.sources.filter((s) => readable.has(s.id));
  const ranges = TELEMETRY_RANGE_PRESETS.map((p) => ({ value: p.hours, label: spaced(p.label) }));
  const range = { options: ranges, value: g.hours, onChange: g.chooseHours };
  const source = <SourceSelect value={g.sourceFilter} onChange={g.setSourceFilter} sources={sources} />;

  return (
    <Frame
      view={view}
      onView={onView}
      subtitle={t('unified.telemetry.subtitle_graphs')}
      onRefresh={() => void g.fetchSeries()}
      refreshing={g.loading}
      controls={
        <div className={styles.controls}>
          <span className={styles.label}>{t('workspace.overview.telemetry.range')}</span>
          <RangeGroup {...range} />
          {source}
          <button type="button" className={styles.button} onClick={() => void g.fetchSeries()} disabled={g.loading}>
            <UiIcon name="refresh" size={16} />
            {t('unified.telemetry.refresh')}
          </button>
        </div>
      }
      chips={
        <>
          <RangeSelect {...range} />
          {source}
        </>
      }
      sheet={
        <>
          <RangeGroup {...range} />
          {source}
        </>
      }
    >
      <div className={styles.body}>
        {g.loading && g.series.length === 0 && <p className={styles.state}>{t('unified.telemetry.loading')}</p>}
        {g.error && <p className={styles.error}>{g.error}</p>}
        {!g.loading && !g.error && sections.length === 0 && <p className={styles.state}>{t('unified.telemetry.no_favorites')}</p>}
        {sections.map(({ category, items }) => {
          const label = t(`telemetry.category.${category}`, TELEMETRY_CATEGORY_LABELS[category]);
          return (
            <section key={category} className={styles.section} aria-label={label}>
              <h2 className={styles.sectionTitle}>{label}</h2>
              <div className={styles.grid}>
                {items.map((s) => {
                  const key = `${s.subjectKey}|${s.type}`;
                  const canRemove = s.lines.some((l) => l.favorited && l.canEditFavorite);
                  return (
                    <CombinedTelemetryChart
                      key={key}
                      series={s}
                      colorFor={g.colorFor}
                      temperatureUnit={temperatureUnit}
                      timeFormat={timeFormat}
                      hours={g.hours}
                      timeRange={g.timeRange}
                      onRemoveFavorite={canRemove ? () => void g.removeFavorite(s) : undefined}
                      favoriteBusy={g.busyKey === key}
                      yRange={g.yRanges[key] ?? null}
                      onYRangeChange={(r) => g.changeYRange(key, r)}
                      tagFor={tagFor}
                      renderActions={renderActions}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Frame>
  );
}

function LatestView({ view, onView }: { view: View; onView(v: View): void }) {
  const { t } = useTranslation();
  const readable = useReadableSourceIds();
  const l = useUnifiedTelemetryLatest();
  const jumpId = useId();

  const sources = l.allSources.filter((s) => readable.has(s.id));
  const types = useMemo(
    () => [...new Set(l.entries.filter((e) => readable.has(e.sourceId)).map((e) => e.telemetryType))].sort(),
    [l.entries, readable],
  );
  const groups = Object.entries(l.bySource).filter(([sid]) => readable.has(sid));
  const counts = new Map(groups.map(([sid, nodes]) => [sid, Object.keys(nodes).length]));
  const sectionId = (sid: string) => `${jumpId}-${sid}`;
  const jumpTo = (sid: string) => document.getElementById(sectionId(sid))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });

  const range = {
    options: HOURS_OPTIONS.map((h) => ({ value: h, label: spaced(HOURS_LABELS[h]) })),
    value: l.hours,
    onChange: (h: HoursOption) => l.setHours(h),
  };
  const source = <SourceSelect value={l.sourceFilter} onChange={l.setSourceFilter} sources={sources} />;
  const search = (
    <input
      className={styles.search}
      type="search"
      placeholder={t('unified.telemetry.search_placeholder')}
      value={l.search}
      onChange={(e) => l.setSearch(e.target.value)}
      aria-label={t('unified.telemetry.search_aria')}
    />
  );
  const type = (
    <select className={styles.select} value={l.typeFilter} onChange={(e) => l.setTypeFilter(e.target.value)} aria-label={t('unified.telemetry.filter_type_aria')}>
      <option value="">{t('unified.telemetry.all_types')}</option>
      {types.map((tt) => (
        <option key={tt} value={tt}>{TYPE_LABELS[tt] ?? tt}</option>
      ))}
    </select>
  );
  const sort = (
    <select className={styles.select} value={l.sortKey} onChange={(e) => l.setSortKey(e.target.value as SortKey)} aria-label={t('unified.telemetry.sort_aria')}>
      {SORT_KEYS.map((k) => (
        <option key={k} value={k}>{t(SORT_I18N_KEY[k])}</option>
      ))}
    </select>
  );
  const jump = sources.length > 0 && (
    <div className={styles.jumpRow}>
      <span className={styles.label} id={`${jumpId}-label`}>{t('workspace.overview.telemetry.jump_to')}</span>
      <div className={styles.jump} role="group" aria-labelledby={`${jumpId}-label`}>
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            className={styles.jumpChip}
            disabled={!counts.get(s.id)}
            title={t('unified.telemetry.jump_to_source', { name: s.name })}
            onClick={() => jumpTo(s.id)}
          >
            <DeviceTag sourceId={s.id} />
            <span>{s.name}</span>
            <span className={styles.count}>{counts.get(s.id) ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Frame
      view={view}
      onView={onView}
      subtitle={t('unified.telemetry.subtitle')}
      onRefresh={() => void l.fetchTelemetry()}
      controls={
        <>
          <div className={styles.controls}>
            <span className={styles.label}>{t('workspace.overview.telemetry.range')}</span>
            <RangeGroup {...range} />
            {search}
            {source}
            {type}
            {sort}
          </div>
          {jump}
          <p className={styles.note}>
            <UiIcon name="favoriteOff" size={16} />
            {t('workspace.overview.telemetry.star_note')}
          </p>
        </>
      }
      chips={
        <>
          <RangeSelect {...range} />
          {source}
        </>
      }
      sheet={
        <>
          <RangeGroup {...range} />
          {search}
          {source}
          {type}
          {sort}
          {jump}
        </>
      }
    >
      <div className={styles.body}>
        {l.loading && <p className={styles.state}>{t('unified.telemetry.loading')}</p>}
        {l.error && <p className={styles.error}>{l.error}</p>}
        {!l.loading && !l.error && groups.length === 0 && (
          <p className={styles.state}>
            {t(l.entries.some((e) => readable.has(e.sourceId)) ? 'unified.telemetry.empty_filters' : 'unified.telemetry.empty_range')}
          </p>
        )}
        {groups.map(([sid, nodeMap]) => {
          const name = sources.find((s) => s.id === sid)?.name ?? sid;
          const nodes = l.sortNodes(nodeMap);
          return (
            <section key={sid} id={sectionId(sid)} className={styles.section} aria-label={name}>
              <h2 className={styles.deviceTitle}>
                <DeviceTag sourceId={sid} />
                <span>{name}</span>
                <span className={styles.count}>
                  {t(nodes.length === 1 ? 'unified.telemetry.node_count_one' : 'unified.telemetry.node_count_other', { count: nodes.length })}
                </span>
              </h2>
              <div className={styles.cards}>
                {nodes.map(([nodeId, typeMap]) => {
                  const readings = Object.values(typeMap).sort((a, b) =>
                    (TYPE_LABELS[a.telemetryType] ?? a.telemetryType).localeCompare(TYPE_LABELS[b.telemetryType] ?? b.telemetryType));
                  const first = readings[0];
                  const latest = Math.max(...readings.map((r) => r.timestamp));
                  return (
                    <article key={nodeId} className={styles.nodeCard} data-testid="node-card">
                      <header className={styles.nodeHead}>
                        <span className={styles.nodeName} title={nodeId}>{first?.nodeLongName || first?.nodeShortName || nodeId}</span>
                        <span className={styles.age}>{formatAge(latest, t)}</span>
                      </header>
                      {readings.map((r) => {
                        const { label, text, unit } = readingDisplay(r, l.temperatureUnit);
                        const busy = l.busyKey === `${r.sourceId}|${r.nodeId}|${r.telemetryType}`;
                        const starLabel = t(r.favorited ? 'telemetry.remove_favorite' : 'telemetry.add_favorite');
                        return (
                          <div key={r.telemetryType} className={styles.reading}>
                            <span className={styles.readingLabel} title={r.telemetryType}>{label}</span>
                            <span className={styles.readingValue}>
                              <span>{text}</span>
                              {unit && <span className={styles.unit}>{unit}</span>}
                            </span>
                            {r.canEditFavorite && (
                              <button
                                type="button"
                                className={styles.star}
                                aria-pressed={!!r.favorited}
                                aria-label={starLabel}
                                title={starLabel}
                                disabled={busy}
                                onClick={() => void l.toggleFavorite(r)}
                              >
                                <UiIcon name={r.favorited ? 'favorite' : 'favoriteOff'} size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Frame>
  );
}

export default function OverviewTelemetry() {
  const [view, setView] = useState<View>('graphs');
  // One view at a time, as today: each fetches on mount, so switching back refetches.
  return view === 'graphs' ? <GraphsView view={view} onView={setView} /> : <LatestView view={view} onView={setView} />;
}
