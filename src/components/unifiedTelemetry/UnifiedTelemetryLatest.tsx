/**
 * The "Latest" tab of the cross-source Telemetry Dashboard (#5896).
 *
 * The latest telemetry reading per node across all accessible sources,
 * grouped by source, with colour-coded source tags: the fleet overview the
 * Unified Telemetry page used to be. One request per poll (60 s); each reading
 * carries a star that adds it to (or removes it from) its own source's
 * favorites, shown only where the caller may change that source's settings.
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getSourceColor } from '../../utils/sourceColors';
import { UiIcon } from '../icons';
import styles from './UnifiedTelemetryLatest.module.css';
import '../../styles/unified.css';
import {
  HOURS_OPTIONS,
  HOURS_LABELS,
  SORT_KEYS,
  SORT_I18N_KEY,
  TYPE_LABELS,
  formatAge,
  readingDisplay,
  useUnifiedTelemetryLatest,
  type SortKey,
} from './useUnifiedTelemetryLatest';

export { LATEST_POLL_MS } from './useUnifiedTelemetryLatest';

interface UnifiedTelemetryLatestProps {
  /** Back button, title and view tabs, rendered at the top of the sticky header. */
  header: ReactNode;
  /** Called after a favorite changes, so the graphs view can refetch. */
  onFavoritesChanged?: () => void;
}

export default function UnifiedTelemetryLatest({ header, onFavoritesChanged }: UnifiedTelemetryLatestProps) {
  const { t } = useTranslation();
  const {
    entries, loading, error, hours, setHours, typeFilter, setTypeFilter, sourceFilter, setSourceFilter, search, setSearch,
    sortKey, setSortKey, busyKey, allSources, sourceIds, allTypes, bySource, sortNodes, toggleFavorite, temperatureUnit,
  } = useUnifiedTelemetryLatest(onFavoritesChanged);
  // Source the legend pills jump to. `activeSource` highlights the pill for the
  // section nearest the top of the viewport (tracked via IntersectionObserver).
  const [activeSource, setActiveSource] = useState<string>('');
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Source sections currently rendered (after filters). Drives the legend's
  // jump targets + active-state tracking. Joined into a string for a stable
  // effect dependency.
  const renderedSourceIds = Object.keys(bySource);
  const renderedKey = renderedSourceIds.join('|');

  const setSectionRef = useCallback(
    (sid: string) => (el: HTMLDivElement | null) => {
      if (el) sectionRefs.current.set(sid, el);
      else sectionRefs.current.delete(sid);
    },
    [],
  );

  // Smooth-scroll a source section to just below the sticky header. We compute
  // the offset manually (rather than CSS scroll-margin) because the header
  // height changes as the controls wrap on narrow viewports.
  const scrollToSource = useCallback((sid: string) => {
    const el = sectionRefs.current.get(sid);
    if (!el) return;
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveSource(sid);
  }, []);

  // Highlight the legend pill for the section nearest the top of the viewport.
  // The negative top rootMargin keeps the active section under the sticky header
  // from counting as "at the top"; the -70% bottom margin biases toward the
  // section whose header has just scrolled into the upper band.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const observer = new IntersectionObserver(
      (obsEntries) => {
        const visible = obsEntries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const sid = visible[0]?.target.getAttribute('data-source-id');
        if (sid) setActiveSource(sid);
      },
      { rootMargin: `-${headerH + 8}px 0px -70% 0px`, threshold: 0 },
    );
    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [renderedKey]);

  return (
    <>
      <div className="unified-header unified-header--sticky" ref={headerRef}>
        {header}

        <div className="unified-controls">
          <div className="unified-btn-group">
            {HOURS_OPTIONS.map(h => (
              <button
                key={h}
                className={hours === h ? 'active' : ''}
                onClick={() => setHours(h)}
              >
                {HOURS_LABELS[h]}
              </button>
            ))}
          </div>

          <input
            className="unified-select unified-search"
            type="search"
            placeholder={t('unified.telemetry.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label={t('unified.telemetry.search_aria')}
          />

          <select
            className="unified-select"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            aria-label={t('unified.telemetry.filter_source_aria')}
          >
            <option value="">{t('unified.telemetry.all_sources')}</option>
            {allSources.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            className="unified-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            aria-label={t('unified.telemetry.filter_type_aria')}
          >
            <option value="">{t('unified.telemetry.all_types')}</option>
            {allTypes.map(tt => (
              <option key={tt} value={tt}>{TYPE_LABELS[tt] ?? tt}</option>
            ))}
          </select>

          <select
            className="unified-select"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            aria-label={t('unified.telemetry.sort_aria')}
          >
            {SORT_KEYS.map(k => (
              <option key={k} value={k}>{t(SORT_I18N_KEY[k])}</option>
            ))}
          </select>
        </div>

        {sourceIds.length > 0 && (
          <div className="unified-source-legend">
            {sourceIds.map(sid => {
              const name = entries.find(e => e.sourceId === sid)?.sourceName ?? sid;
              const color = getSourceColor(sid, sourceIds);
              // A pill can only jump if its section is currently rendered (it
              // gets filtered out by the source/type/search controls otherwise).
              const hasSection = Object.prototype.hasOwnProperty.call(bySource, sid);
              const isActive = hasSection && sid === activeSource;
              return (
                <button
                  key={sid}
                  type="button"
                  className={`unified-source-pill${isActive ? ' is-active' : ''}`}
                  style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
                  disabled={!hasSection}
                  aria-current={isActive ? 'true' : undefined}
                  title={t('unified.telemetry.jump_to_source', { name })}
                  onClick={() => scrollToSource(sid)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="unified-body unified-body--wide">
        {loading && <div className="unified-empty">{t('unified.telemetry.loading')}</div>}
        {error && <div className="unified-error">{error}</div>}

        {!loading && !error && Object.keys(bySource).length === 0 && (
          <div className="unified-empty">{t('unified.telemetry.empty_range')}</div>
        )}

        {!loading && !error && Object.keys(bySource).length === 0 && entries.length > 0 && (
          <div className="unified-empty">{t('unified.telemetry.empty_filters')}</div>
        )}

        {Object.entries(bySource).map(([sourceId, nodeMap]) => {
          const color = getSourceColor(sourceId, sourceIds);
          const sourceName = allSources.find(s => s.id === sourceId)?.name ?? sourceId;
          const nodeEntries = sortNodes(nodeMap);

          return (
            <div
              key={sourceId}
              className="unified-telem-source"
              ref={setSectionRef(sourceId)}
              data-source-id={sourceId}
            >
              <div className="unified-telem-source__header">
                <div className="unified-telem-source__bar" style={{ background: color }} />
                <span className="unified-telem-source__name" style={{ color }}>{sourceName}</span>
                <span className="unified-telem-source__count">
                  {t(nodeEntries.length === 1 ? 'unified.telemetry.node_count_one' : 'unified.telemetry.node_count_other', { count: nodeEntries.length })}
                </span>
              </div>

              <div className="unified-telem-grid">
                {nodeEntries.map(([nodeId, typeMap]) => {
                  const first = Object.values(typeMap)[0];
                  const nodeName = first?.nodeLongName || first?.nodeShortName || nodeId;
                  const readings = Object.values(typeMap).sort((a, b) => {
                    const la = TYPE_LABELS[a.telemetryType] ?? a.telemetryType;
                    const lb = TYPE_LABELS[b.telemetryType] ?? b.telemetryType;
                    return la.localeCompare(lb);
                  });
                  const latestTs = Math.max(...readings.map(r => r.timestamp));

                  return (
                    <div
                      key={nodeId}
                      className="unified-node-card"
                      style={{ borderTopColor: color }}
                    >
                      <div className="unified-node-card__header">
                        <span className="unified-node-card__name" title={nodeId}>{nodeName}</span>
                        <span className="unified-node-card__age">{formatAge(latestTs, t)}</span>
                      </div>
                      <div className="unified-node-card__readings">
                        {readings.map(r => {
                          const { label, text, unit } = readingDisplay(r, temperatureUnit);
                          return (
                            <div key={r.telemetryType} className="unified-reading">
                              <div className="unified-reading__label" title={r.telemetryType}>
                                {label}
                                {r.canEditFavorite && (
                                  <button
                                    type="button"
                                    className={`${styles.star}${r.favorited ? ` ${styles.starOn}` : ''}`}
                                    onClick={() => void toggleFavorite(r)}
                                    disabled={busyKey === `${r.sourceId}|${r.nodeId}|${r.telemetryType}`}
                                    aria-pressed={!!r.favorited}
                                    aria-label={r.favorited ? t('telemetry.remove_favorite') : t('telemetry.add_favorite')}
                                    title={r.favorited ? t('telemetry.remove_favorite') : t('telemetry.add_favorite')}
                                  >
                                    <UiIcon name={r.favorited ? 'favorite' : 'favoriteOff'} size={12} />
                                  </button>
                                )}
                              </div>
                              <div className="unified-reading__value">
                                {text}
                                {unit && <span className="unified-reading__unit">{unit}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
