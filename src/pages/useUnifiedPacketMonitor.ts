/**
 * The state and data of the cross-source Unified Packet Monitor (#3252),
 * shared by UnifiedPacketMonitorPage and the Workspace's Overview › Packets
 * (#6365): filters (kept in this browser), the live stream, capture
 * (`packet_log_enabled`, settings:write; server-side logging only, it sends
 * nothing on the mesh), pause, and the distribution charts (30 s refresh
 * while shown and not paused).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useUnifiedPackets } from '../hooks/useUnifiedPackets';
import { getUnifiedPacketDistribution, getPacketStats } from '../services/packetApi';
import apiService from '../services/api';
import { UnifiedPacketFilters, UnifiedPacketDistribution } from '../types/packet';
import { DISTRIBUTION_COLORS, type ChartDataEntry } from '../components/PacketStatsChart';
import { getPortnumColor } from '../utils/packetFormat';
import { getSourceColor } from '../utils/sourceColors';
import { isAnyMeshCoreSourceType } from '../utils/nodeTypeCategory';

// Safe JSON parse helper (mirrors PacketMonitorPanel).
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type RangeHours = 1 | 24 | 0; // 0 = all
export const RANGE_OPTIONS: RangeHours[] = [1, 24, 0];

/**
 * `chartsShown`: the caller shows the charts somewhere other than the `showCharts` block (the
 * Workspace's phone Charts sheet), so they load without writing the shared `showCharts` key.
 */
export function useUnifiedPacketMonitor({ chartsShown = false }: { chartsShown?: boolean } = {}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  // Read time/date prefs directly (page renders outside SettingsProvider).
  const timeFormat = localStorage.getItem('timeFormat') === '12' ? '12' : '24';
  const dateFormat = (() => {
    const saved = localStorage.getItem('dateFormat');
    return saved === 'DD/MM/YYYY' || saved === 'YYYY-MM-DD' ? saved : 'MM/DD/YYYY';
  })();

  const canView = hasPermission('packetmonitor', 'read', { anySource: true });
  // `packet_log_enabled` is a global (cross-source) setting gated by
  // settings:write — the same capture the single-source panel toggles.
  const canWriteSettings = hasPermission('settings', 'write', { anySource: true });

  const [filters, setFilters] = useState<UnifiedPacketFilters>(() =>
    safeJsonParse<UnifiedPacketFilters>(localStorage.getItem('unifiedPacketMonitor.filters'), {})
  );
  const [showFilters, setShowFilters] = useState(() =>
    safeJsonParse(localStorage.getItem('unifiedPacketMonitor.showFilters'), false)
  );
  const [showCharts, setShowCharts] = useState(() =>
    safeJsonParse(localStorage.getItem('unifiedPacketMonitor.showCharts'), true)
  );
  const [paused, setPaused] = useState(false);
  const [rangeHours, setRangeHours] = useState<RangeHours>(24);

  // Server-side capture state (#4957). null until the first stats fetch so the
  // Stop/Start control doesn't flash the wrong label. This toggles the SAME
  // global `packet_log_enabled` as the single-source panel.
  const [captureEnabled, setCaptureEnabled] = useState<boolean | null>(null);
  const [togglingCapture, setTogglingCapture] = useState(false);

  useEffect(() => {
    // Fetch capture state whenever the user can either view packets or write
    // the setting — a settings:write-only admin still needs the Stop control.
    if (!canView && !canWriteSettings) return;
    let cancelled = false;
    getPacketStats()
      .then(stats => { if (!cancelled) setCaptureEnabled(stats.enabled); })
      .catch(() => { /* leave unknown; control stays hidden */ });
    return () => { cancelled = true; };
  }, [canView, canWriteSettings]);

  const handleToggleCapture = useCallback(async () => {
    const next = !captureEnabled;
    setTogglingCapture(true);
    try {
      await apiService.post('/api/settings', { packet_log_enabled: next ? '1' : '0' });
      setCaptureEnabled(next);
    } catch (error) {
      console.error('Failed to toggle packet capture:', error);
    } finally {
      setTogglingCapture(false);
    }
  }, [captureEnabled]);

  const { packets, sources, loading, loadingMore, hasMore, rateLimitError, loadMore } = useUnifiedPackets({
    canView,
    filters,
    paused,
  });

  // Stable source-id list for color assignment (sorted so colors are stable).
  const sourceIds = useMemo(() => sources.map((s) => s.id).sort(), [sources]);

  // Persist UI prefs.
  useEffect(() => { localStorage.setItem('unifiedPacketMonitor.filters', JSON.stringify(filters)); }, [filters]);
  useEffect(() => { localStorage.setItem('unifiedPacketMonitor.showFilters', JSON.stringify(showFilters)); }, [showFilters]);
  useEffect(() => { localStorage.setItem('unifiedPacketMonitor.showCharts', JSON.stringify(showCharts)); }, [showCharts]);

  // ── Distribution charts ──────────────────────────────────────────────────
  const [distribution, setDistribution] = useState<UnifiedPacketDistribution | null>(null);
  useEffect(() => {
    if (!canView || !(showCharts || chartsShown)) return;
    let cancelled = false;
    const fetchDist = async () => {
      try {
        const since = rangeHours === 0 ? undefined : Date.now() - rangeHours * 3600 * 1000;
        const data = await getUnifiedPacketDistribution(since);
        if (!cancelled) setDistribution(data);
      } catch (err) {
        console.error('Failed to fetch unified packet distribution:', err);
      }
    };
    void fetchDist();
    const iv = paused ? undefined : setInterval(fetchDist, 30000);
    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [canView, showCharts, chartsShown, rangeHours, paused]);

  const bySourceData: ChartDataEntry[] = useMemo(
    () => (distribution?.bySource ?? []).map((s) => ({
      name: s.sourceName,
      value: s.count,
      color: getSourceColor(s.sourceId, sourceIds),
    })),
    [distribution, sourceIds]
  );
  const byDeviceData: ChartDataEntry[] = useMemo(
    () => (distribution?.byDevice ?? []).map((d, i) => ({
      name: d.protocol === 'meshcore'
        ? d.from_node_longName || (d.publicKey ? d.publicKey.slice(0, 12) : t('common.na'))
        : d.from_node_longName || d.from_node_id || `!${d.from_node.toString(16).padStart(8, '0')}`,
      value: d.count,
      color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
    })),
    [distribution, t]
  );
  const byTypeData: ChartDataEntry[] = useMemo(
    () => (distribution?.byType ?? []).map((tt, i) => ({
      name: tt.portnum_name || String(tt.portnum),
      value: tt.count,
      // A MeshCore payload type shares numbers with PortNums: never colour it by portnum.
      color: tt.protocol === 'meshcore' ? DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] : getPortnumColor(tt.portnum),
    })),
    [distribution]
  );
  const distTotal = distribution?.total ?? 0;

  // MeshCore Payload/Route filters apply only when a readable source is MeshCore.
  const hasMeshCoreSource = useMemo(() => sources.some((s) => isAnyMeshCoreSourceType(s.type)), [sources]);
  const meshcoreFilterActive = filters.payload_type !== undefined || filters.route_type !== undefined;
  const meshtasticFilterActive = filters.portnum !== undefined;

  const updateFilter = useCallback(<K extends keyof UnifiedPacketFilters>(key: K, value: UnifiedPacketFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    timeFormat, dateFormat, canView, canWriteSettings, filters, setFilters, updateFilter, showFilters, setShowFilters,
    showCharts, setShowCharts, paused, setPaused, rangeHours, setRangeHours, captureEnabled, togglingCapture,
    handleToggleCapture, packets, sources, loading, loadingMore, hasMore, rateLimitError, loadMore, sourceIds,
    distribution, bySourceData, byDeviceData, byTypeData, distTotal, hasMeshCoreSource, meshcoreFilterActive,
    meshtasticFilterActive,
  };
}
