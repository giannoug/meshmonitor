/**
 * The state and data of the single-source Packet Monitor (#3962), shared by
 * PacketMonitorPanel and the Workspace's pop-out window (#6365): filters and
 * the time window (kept in this browser), the packet stream for the source in
 * context, Hide Own Packets, the node and last-hop filter options, capture
 * (`packet_log_enabled`, settings:write; server-side logging only, it sends
 * nothing on the mesh) and the JSONL export.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PacketFilters, RelayNodeOption } from '../types/packet';
import { exportPackets, getRelayNodes, getPacketStats } from '../services/packetApi';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSource } from '../contexts/SourceContext';
import { useDeviceConfig, useNodes } from '../hooks/useServerData';
import { usePackets } from '../hooks/usePackets';
import { windowToSince, type TimeWindowKey } from './packets/timeWindow';
import { PORTNUM_NAMES } from '../utils/packetFormat';
import type { SearchableSelectOption } from './common/SearchableSelect';
import type { DeviceInfo } from '../types/device';

/** Direct-neighbour stats by node number, as `/api/direct-neighbors` returns them. */
export type DirectNeighborStats = Record<number, { avgRssi: number; packetCount: number; lastHeard: number }>;

/** Nodes in the shape RelayNodeModal reads, with each node's direct-hearing stats. */
export function relayModalNodes(nodes: DeviceInfo[], directNeighborStats: DirectNeighborStats) {
  return nodes.map(node => {
    const stats = directNeighborStats[node.nodeNum];
    return {
      nodeNum: node.nodeNum,
      nodeId: node.user?.id || `!${node.nodeNum.toString(16).padStart(8, '0')}`,
      longName: node.user?.longName || `Node ${node.nodeNum}`,
      shortName: node.user?.shortName || node.nodeNum.toString(16).padStart(8, '0').slice(-4),
      hopsAway: node.hopsAway,
      role: typeof node.user?.role === 'string' ? parseInt(node.user.role, 10) : node.user?.role,
      avgDirectRssi: stats?.avgRssi,
      heardDirectly: stats !== undefined,
    };
  });
}

// Full portnum filter list, derived from the shared PORTNUM_NAMES map so the
// dropdown covers every known type (incl. NODE_STATUS and MESH_BEACON) rather
// than a hardcoded subset (#4958). Sorted by portnum; UNKNOWN(0) and MAX(511)
// are dropped as they aren't meaningful capture filters.
export const PORTNUM_FILTER_OPTIONS: Array<{ value: number; label: string }> = Object.entries(PORTNUM_NAMES)
  .map(([num, name]) => ({ value: Number(num), label: name }))
  .filter(o => o.value !== 0 && o.value !== 511)
  .sort((a, b) => a.value - b.value);

// Safe JSON parse helper
const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from localStorage:', error);
    return fallback;
  }
};

export function usePacketMonitor() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { sourceId } = useSource();
  // `packet_log_enabled` is a global (not per-source) setting, gated by
  // settings:write. anySource mirrors the unscoped write it toggles.
  const canWriteSettings = hasPermission('settings', 'write', { anySource: true });
  const { config: deviceInfo } = useDeviceConfig();
  const { nodes } = useNodes();

  // UI state (not data-related)
  const [autoScroll, setAutoScroll] = useState(() =>
    safeJsonParse(localStorage.getItem('packetMonitor.autoScroll'), true)
  );
  const [filters, setFilters] = useState<PacketFilters>(() =>
    safeJsonParse<PacketFilters>(localStorage.getItem('packetMonitor.filters'), {})
  );
  // Time window (#6262). Kept as a key, not a stored `since`, so a reload does
  // not resurrect a stale absolute timestamp.
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>(() => {
    const saved = safeJsonParse<string>(localStorage.getItem('packetMonitor.timeWindow'), 'all');
    return (['1h', '6h', '24h', '7d'] as const).includes(saved as '1h') ? (saved as TimeWindowKey) : 'all';
  });
  useEffect(() => {
    localStorage.setItem('packetMonitor.timeWindow', JSON.stringify(timeWindow));
  }, [timeWindow]);
  const [showFilters, setShowFilters] = useState(() =>
    safeJsonParse(localStorage.getItem('packetMonitor.showFilters'), false)
  );
  const [hideOwnPackets, setHideOwnPackets] = useState(() =>
    safeJsonParse(localStorage.getItem('packetMonitor.hideOwnPackets'), true)
  );

  // Relay node filter options (distinct values from packet_log)
  const [relayNodeOptions, setRelayNodeOptions] = useState<RelayNodeOption[]>([]);

  // Server-side capture state (`packet_log_enabled`). null while unknown so the
  // Stop/Start control doesn't flash the wrong state before the first fetch.
  // #4957: this control is the only way to stop a persisted server-side capture
  // — "Pause" below is client-side auto-scroll only.
  const [captureEnabled, setCaptureEnabled] = useState<boolean | null>(null);
  const [togglingCapture, setTogglingCapture] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPacketStats(sourceId ?? undefined)
      .then(stats => { if (!cancelled) setCaptureEnabled(stats.enabled); })
      .catch(() => { /* leave unknown; button stays hidden */ });
    return () => { cancelled = true; };
  }, [sourceId]);

  const handleToggleCapture = useCallback(async () => {
    const next = !captureEnabled;
    setTogglingCapture(true);
    try {
      // `packet_log_enabled` is global — POST with no sourceId query param.
      // Commit local state only after the POST resolves, so a failed request
      // doesn't leave the button showing a state the server never accepted.
      await apiService.post('/api/settings', { packet_log_enabled: next ? '1' : '0' });
      setCaptureEnabled(next);
    } catch (error) {
      console.error('Failed to toggle packet capture:', error);
    } finally {
      setTogglingCapture(false);
    }
  }, [captureEnabled]);

  /**
   * Filter options for the two node comboboxes (#4512). `keywords` carries the
   * text a user is likely to type but which the label does not show — the hex
   * id and short name — so `!a4c1382c` finds a node listed as "Base Station".
   *
   * Both sort on a copy: `relayNodeOptions` is state, and the previous
   * `.sort()` on it mutated that array in place.
   */
  const fromNodeOptions = useMemo<SearchableSelectOption[]>(() => (
    nodes
      .filter(node => node.user?.id)
      .map(node => {
        const hex = `!${node.nodeNum.toString(16).padStart(8, '0')}`;
        return {
          value: String(node.nodeNum),
          label: node.user?.longName || node.user?.shortName || hex,
          keywords: [node.user?.shortName, node.user?.longName, node.user?.id, hex]
            .filter(Boolean)
            .join(' '),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [nodes]);

  const relayFilterOptions = useMemo<SearchableSelectOption[]>(() => [
    { value: 'unknown', label: t('packet_monitor.filter.unknown_hop') },
    ...relayNodeOptions
      .map(rn => {
        const hex = `!..${rn.relay_node.toString(16).padStart(2, '0')}`;
        const names = rn.matching_nodes.map(n => n.longName || n.shortName).filter(Boolean);
        return {
          value: String(rn.relay_node),
          label: names.length > 0 ? names.join(', ') : hex,
          // Always searchable by the relay byte, even when named nodes match it.
          keywords: [hex, ...rn.matching_nodes.flatMap(n => [n.longName, n.shortName])]
            .filter(Boolean)
            .join(' '),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
  ], [relayNodeOptions, t]);

  // Check permissions - user needs packetmonitor:read permission
  const canView = hasPermission('packetmonitor', 'read');

  // Get own node number for filtering
  // Convert nodeId (hex string like "!43588558") to number
  const ownNodeNum = useMemo(() => {
    const nodeId = deviceInfo?.localNodeInfo?.nodeId;
    if (!nodeId || !nodeId.startsWith('!')) return undefined;
    return parseInt(nodeId.substring(1), 16);
  }, [deviceInfo?.localNodeInfo?.nodeId]);

  const queryFilters = useMemo<PacketFilters>(
    () => ({ ...filters, since: windowToSince(timeWindow) }),
    // `since` is fixed when the window changes: re-deriving it per render would refetch forever.
    [filters, timeWindow],
  );

  // Use the packets hook for all data fetching
  const {
    packets,
    hiddenCount,
    total,
    loading,
    loadingMore,
    hasMore,
    rateLimitError,
    loadMore,
    refresh: fetchPackets,
  } = usePackets({
    canView,
    filters: queryFilters,
    hideOwnPackets,
    ownNodeNum,
    sourceId,
  });

  // Persist filter settings to localStorage
  useEffect(() => {
    localStorage.setItem('packetMonitor.filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('packetMonitor.hideOwnPackets', JSON.stringify(hideOwnPackets));
  }, [hideOwnPackets]);

  useEffect(() => {
    localStorage.setItem('packetMonitor.showFilters', JSON.stringify(showFilters));
  }, [showFilters]);

  useEffect(() => {
    localStorage.setItem('packetMonitor.autoScroll', JSON.stringify(autoScroll));
  }, [autoScroll]);

  // Fetch distinct relay nodes for filter dropdown
  useEffect(() => {
    if (!canView) return;
    getRelayNodes(sourceId ?? undefined)
      .then(setRelayNodeOptions)
      .catch(() => setRelayNodeOptions([]));
  }, [canView, sourceId]);

  // Export packets to JSONL (server-side)
  const handleExport = () => {
    try {
      // Use backend export endpoint with current filters
      // Note: hideOwnPackets is a client-side filter and not passed to backend
      void exportPackets(sourceId ? { ...queryFilters, sourceId } : queryFilters);
    } catch (error) {
      console.error('Failed to export packets:', error);
      alert(t('packet_monitor.export_failed'));
    }
  };

  return {
    sourceId, canView, canWriteSettings, deviceInfo, nodes, autoScroll, setAutoScroll, filters, setFilters, timeWindow,
    setTimeWindow, showFilters, setShowFilters, hideOwnPackets, setHideOwnPackets, captureEnabled, togglingCapture,
    handleToggleCapture, fromNodeOptions, relayFilterOptions, packets, hiddenCount, total, loading, loadingMore, hasMore,
    rateLimitError, loadMore, fetchPackets, handleExport,
  };
}
