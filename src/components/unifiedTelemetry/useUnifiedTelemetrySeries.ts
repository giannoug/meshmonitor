/**
 * The data of the cross-source Telemetry Dashboard's graphs view (#5896),
 * shared by UnifiedTelemetryGraphs and the Workspace's Overview › Telemetry
 * (#6365): the range (kept in this browser), the favorited series, the source
 * filter, sections by category, Y-axis ranges and removing a favorite.
 * Fetched once on load, on a range change and on `fetchSeries`: no polling.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { ApiError } from '../../services/api';
import { setTelemetryFavorite } from '../../services/telemetryFavorites';
import { resolveSourceColor } from '../../utils/sourceColors';
import { TELEMETRY_RANGE_PRESETS } from '../../utils/telemetryRangePresets';
import { TELEMETRY_CATEGORY_ORDER, type TelemetryCategory } from '../../utils/telemetryCategory';
import type { CombinedSeries } from '../CombinedTelemetryChart/CombinedTelemetryChart';
import { parseChartYRangeMap, withChartYRange, type ChartYRange } from '../../utils/chartYRange';

const RANGE_STORAGE_KEY = 'unifiedTelemetryHours';
const DEFAULT_HOURS = 24;
/**
 * Fixed Y-axis ranges (#6348) for this cross-source view. It spans sources, so
 * there is no one source's dashboard config to hold them; like the range
 * choice above they live in this browser.
 */
const Y_RANGE_STORAGE_KEY = 'unifiedTelemetryYRanges';

function loadYRanges(): Record<string, ChartYRange> {
  try {
    return parseChartYRangeMap(localStorage.getItem(Y_RANGE_STORAGE_KEY));
  } catch {
    return {};
  }
}

function loadHours(): number {
  try {
    const saved = parseFloat(localStorage.getItem(RANGE_STORAGE_KEY) ?? '');
    if (TELEMETRY_RANGE_PRESETS.some((p) => p.hours === saved)) return saved;
  } catch {
    // Storage blocked: use the default.
  }
  return DEFAULT_HOURS;
}

interface SeriesResponse {
  success: boolean;
  data: { series: CombinedSeries[] };
}

/** `reloadToken`: bumped by the caller to force a refetch (a favorite changed elsewhere). */
export function useUnifiedTelemetrySeries(reloadToken = 0) {
  const { t } = useTranslation();
  const [hours, setHours] = useState<number>(loadHours);
  const [series, setSeries] = useState<CombinedSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [yRanges, setYRanges] = useState<Record<string, ChartYRange>>(loadYRanges);

  const changeYRange = useCallback((key: string, range: ChartYRange | null) => {
    setYRanges((prev) => {
      const next = withChartYRange(prev, key, range);
      try {
        localStorage.setItem(Y_RANGE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked: the range lasts for this visit only.
      }
      return next;
    });
  }, []);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get<SeriesResponse>(`/api/unified/telemetry/series?hours=${hours}`);
      setSeries(res?.data?.series ?? []);
      setFetchedAt(Date.now());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? t('unified.telemetry.failed') : t('unified.telemetry.network_error'));
    } finally {
      setLoading(false);
    }
  }, [hours, t]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries, reloadToken]);

  const chooseHours = (h: number) => {
    setHours(h);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, String(h));
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };

  // Every source with a line, in first-seen order: a stable colour per source
  // and the filter's options.
  const sources = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of series) for (const l of s.lines) if (!seen.has(l.sourceId)) seen.set(l.sourceId, l.sourceName);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [series]);
  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);
  const colorFor = useCallback((sourceId: string) => resolveSourceColor(sourceId, sourceIds), [sourceIds]);

  const visible = useMemo(() => {
    if (!sourceFilter) return series;
    return series
      .map((s) => ({ ...s, lines: s.lines.filter((l) => l.sourceId === sourceFilter) }))
      .filter((s) => s.lines.length > 0);
  }, [series, sourceFilter]);

  const sections = useMemo(() => {
    const by = new Map<TelemetryCategory, CombinedSeries[]>();
    for (const s of visible) {
      const cat = (TELEMETRY_CATEGORY_ORDER as string[]).includes(s.category) ? (s.category as TelemetryCategory) : 'other';
      let list = by.get(cat);
      if (!list) by.set(cat, (list = []));
      list.push(s);
    }
    return TELEMETRY_CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => ({ category: c, items: by.get(c)! }));
  }, [visible]);

  const timeRange = useMemo<[number, number]>(() => [fetchedAt - hours * 3600 * 1000, fetchedAt], [fetchedAt, hours]);

  // Remove a series from every favorites list the viewer may change. A list on
  // a source they cannot change keeps it, so the chart may stay.
  const removeFavorite = useCallback(async (s: CombinedSeries) => {
    const key = `${s.subjectKey}|${s.type}`;
    const editable = s.lines.filter((l) => l.favorited && l.canEditFavorite);
    setBusyKey(key);
    try {
      await Promise.all(editable.map((l) => setTelemetryFavorite(l.sourceId, s.subjectKey, s.favoriteType, false)));
    } catch {
      setError(t('unified.telemetry.favorite_failed'));
    } finally {
      setBusyKey(null);
      void fetchSeries();
    }
  }, [fetchSeries, t]);

  return {
    hours, chooseHours, series, loading, error, sourceFilter, setSourceFilter, busyKey, yRanges, changeYRange,
    fetchSeries, sources, colorFor, sections, timeRange, removeFavorite,
  };
}
