/**
 * The Info tab's reads, moved out of InfoTab (#6365, Rule X) so the Workspace
 * Info page runs the same calls at the same cadence: route-segment records,
 * the virtual node, server info, the local node's LocalStats/HostMetrics, the
 * security keys (once), the packet distribution and per-type nodes, and the
 * message counts, each refreshed every minute as today; and Clear record.
 * Everything here reads MeshMonitor's server; nothing transmits on the mesh.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { type MessageCounts, type RouteSegmentRecords } from '../services/api';
import { logger } from '../utils/logger';
import { useToast } from './ToastContainer';
import { getPacketDistributionStats } from '../services/packetApi';
import type { PacketDistributionStats } from '../types/packet';
import type { ConnectionStatus } from '../types/ui';
import { useSource } from '../contexts/SourceContext';
import { useAuth } from '../contexts/AuthContext';
import type { NodeTransportClass } from '../utils/nodeTransport';

/** Uptime as "1d 2h 3m 4s". */
export function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

export interface InfoTabDataInput {
  connectionStatus: ConnectionStatus;
  currentNodeId: string;
  isAuthenticated: boolean;
  isMqttOnlySource: boolean;
}

export function useInfoTabData({ connectionStatus, currentNodeId, isAuthenticated, isMqttOnlySource }: InfoTabDataInput) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId: activeSourceId } = useSource();
  const { hasPermission } = useAuth();
  const canReadTraceroute = hasPermission('traceroute', 'read');
  const [longestActiveSegment, setLongestActiveSegment] = useState<RouteSegmentRecords | null>(null);
  const [recordHolderSegment, setRecordHolderSegment] = useState<RouteSegmentRecords | null>(null);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [clearTarget, setClearTarget] = useState<NodeTransportClass | 'all' | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim from InfoTab
  const [virtualNodeStatus, setVirtualNodeStatus] = useState<any>(null);
  const [loadingVirtualNode, setLoadingVirtualNode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim from InfoTab
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [loadingServerInfo, setLoadingServerInfo] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim from InfoTab
  const [localStats, setLocalStats] = useState<any>(null);
  const [securityKeys, setSecurityKeys] = useState<{ publicKey: string | null; privateKey: string | null } | null>(null);
  const [loadingSecurityKeys, setLoadingSecurityKeys] = useState(false);
  const [packetDistribution, setPacketDistribution] = useState<PacketDistributionStats | null>(null);
  const [distributionTimeRange, setDistributionTimeRange] = useState<'hour' | '24h' | 'all'>('24h');
  const [distributionTransport, setDistributionTransport] = useState<'all' | NodeTransportClass>('all');
  const [loadingDistribution, setLoadingDistribution] = useState(false);
  const [selectedPortnum, setSelectedPortnum] = useState<number | null>(4); // Default to NODEINFO_APP
  const [portnumNodeDistribution, setPortnumNodeDistribution] = useState<PacketDistributionStats | null>(null);
  const [loadingPortnumNodes, setLoadingPortnumNodes] = useState(false);
  const [messageCounts, setMessageCounts] = useState<MessageCounts | null>(null);
  const fetchVirtualNodeStatus = async () => {
    if (connectionStatus !== 'connected') return;

    setLoadingVirtualNode(true);
    try {
      const status = await apiService.getVirtualNodeStatus();
      setVirtualNodeStatus(status);
    } catch (error) {
      logger.error('Error fetching virtual node status:', error);
    } finally {
      setLoadingVirtualNode(false);
    }
  };

  const fetchServerInfo = async () => {
    if (connectionStatus !== 'connected') return;

    setLoadingServerInfo(true);
    try {
      const info = await apiService.getServerInfo();
      setServerInfo(info);
    } catch (error) {
      logger.error('Error fetching server info:', error);
    } finally {
      setLoadingServerInfo(false);
    }
  };

  const fetchLocalStats = async () => {
    if (connectionStatus !== 'connected' || !currentNodeId) return;

    try {
      const srcQs = activeSourceId ? `&sourceId=${encodeURIComponent(activeSourceId)}` : '';
      const data = await apiService.get<Array<{ telemetryType: string; timestamp: number; value: number }>>(
        `/api/telemetry/${currentNodeId}?hours=1${srcQs}`,
      );

      // Extract the latest value for each LocalStats and HostMetrics metric
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim from InfoTab
      const stats: any = {};
      const metrics = [
        // LocalStats metrics
        'uptimeSeconds', 'channelUtilization', 'airUtilTx',
        'numPacketsTx', 'numPacketsRx', 'numPacketsRxBad',
        'numOnlineNodes', 'numTotalNodes', 'numRxDupe',
        'numTxRelay', 'numTxRelayCanceled', 'heapTotalBytes',
        'heapFreeBytes', 'numTxDropped', 'noiseFloor',
        // HostMetrics metrics (for Linux devices)
        'hostUptimeSeconds', 'hostFreememBytes', 'hostDiskfree1Bytes',
        'hostDiskfree2Bytes', 'hostDiskfree3Bytes', 'hostLoad1',
        'hostLoad5', 'hostLoad15'
      ];

      metrics.forEach(metric => {
        const entries = data.filter((item) => item.telemetryType === metric);
        if (entries.length > 0) {
          // Get the most recent value
          const latest = entries.reduce((prev, current) =>
            current.timestamp > prev.timestamp ? current : prev
          );
          stats[metric] = latest.value;
        }
      });

      setLocalStats(stats);
    } catch (error) {
      logger.error('Error fetching local stats:', error);
    }
  };

  const fetchRouteSegments = async () => {
    if (connectionStatus !== 'connected' || !canReadTraceroute) return;

    setLoadingSegments(true);
    try {
      const [longest, recordHolder] = await Promise.all([
        apiService.getLongestActiveRouteSegment(activeSourceId),
        apiService.getRecordHolderRouteSegment(activeSourceId)
      ]);
      setLongestActiveSegment(longest);
      setRecordHolderSegment(recordHolder);
    } catch (error) {
      logger.error('Error fetching route segments:', error);
    } finally {
      setLoadingSegments(false);
    }
  };

  const fetchSecurityKeys = async () => {
    if (connectionStatus !== 'connected' || !isAuthenticated || isMqttOnlySource) return;

    setLoadingSecurityKeys(true);
    try {
      const keys = await apiService.getSecurityKeys(activeSourceId);
      setSecurityKeys(keys);
    } catch (error) {
      logger.error('Error fetching security keys:', error);
    } finally {
      setLoadingSecurityKeys(false);
    }
  };

  const fetchPacketDistribution = useCallback(async () => {
    if (connectionStatus !== 'connected') return;

    setLoadingDistribution(true);
    try {
      // Calculate 'since' timestamp based on time range
      let since: number | undefined;
      const now = Math.floor(Date.now() / 1000);
      if (distributionTimeRange === 'hour') {
        since = now - 3600; // 1 hour ago
      } else if (distributionTimeRange === '24h') {
        since = now - 86400; // 24 hours ago
      }
      // 'all' = undefined (no since filter)

      const transport = distributionTransport === 'all' ? undefined : distributionTransport;
      const distribution = await getPacketDistributionStats(since, undefined, undefined, activeSourceId ?? undefined, transport);
      setPacketDistribution(distribution);
    } catch (error) {
      logger.error('Error fetching packet distribution:', error);
    } finally {
      setLoadingDistribution(false);
    }
  }, [connectionStatus, distributionTimeRange, activeSourceId, distributionTransport]);

  const fetchPortnumNodeDistribution = useCallback(async () => {
    if (connectionStatus !== 'connected' || selectedPortnum === null) return;

    setLoadingPortnumNodes(true);
    try {
      let since: number | undefined;
      const now = Math.floor(Date.now() / 1000);
      if (distributionTimeRange === 'hour') {
        since = now - 3600;
      } else if (distributionTimeRange === '24h') {
        since = now - 86400;
      }

      const transport = distributionTransport === 'all' ? undefined : distributionTransport;
      const distribution = await getPacketDistributionStats(since, undefined, selectedPortnum, activeSourceId ?? undefined, transport);
      setPortnumNodeDistribution(distribution);
    } catch (error) {
      logger.error('Error fetching portnum node distribution:', error);
    } finally {
      setLoadingPortnumNodes(false);
    }
  }, [connectionStatus, selectedPortnum, distributionTimeRange, activeSourceId, distributionTransport]);

  const fetchMessageCounts = useCallback(async () => {
    if (connectionStatus !== 'connected' || !activeSourceId) {
      setMessageCounts(null);
      return;
    }
    try {
      const counts = await apiService.getMessageCounts(activeSourceId);
      setMessageCounts(counts);
    } catch (error) {
      logger.error('Error fetching message counts:', error);
    }
  }, [connectionStatus, activeSourceId]);

  const handleClearRecordHolder = async (target: NodeTransportClass | 'all') => {
    setClearTarget(target);
  };

  const confirmClearRecordHolder = async () => {
    const target = clearTarget;
    setClearTarget(null);
    if (!target) return;
    try {
      await apiService.clearRecordHolderSegment(activeSourceId, target === 'all' ? undefined : target);
      // Re-fetch rather than clearing local state: clearing one class must
      // leave the other classes' records on screen (§4.6).
      await fetchRouteSegments();
      showToast(
        target === 'all' ? t('info.record_cleared') : t('info.record_cleared_transport', { transport: t(`transport.${target}`) }),
        'success'
      );
    } catch (error) {
      logger.error('Error clearing record holder:', error);
      if (error instanceof Error && error.message.includes('403')) {
        showToast(t('info.record_clear_permission'), 'error');
      } else {
        showToast(t('info.record_clear_failed'), 'error');
      }
    }
  };

  useEffect(() => {
    void fetchRouteSegments();
    const interval = setInterval(fetchRouteSegments, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [connectionStatus, activeSourceId, canReadTraceroute]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from InfoTab

  useEffect(() => {
    void fetchVirtualNodeStatus();
    const interval = setInterval(fetchVirtualNodeStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from InfoTab

  useEffect(() => {
    void fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from InfoTab

  useEffect(() => {
    void fetchLocalStats();
    const interval = setInterval(fetchLocalStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [connectionStatus, currentNodeId, activeSourceId]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from InfoTab

  useEffect(() => {
    void fetchSecurityKeys();
    // Only fetch once when connected and authenticated - keys don't change frequently
  }, [connectionStatus, isAuthenticated, activeSourceId]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from InfoTab

  useEffect(() => {
    void fetchPacketDistribution();
    const interval = setInterval(fetchPacketDistribution, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchPacketDistribution]);

  useEffect(() => {
    if (selectedPortnum !== null) {
      void fetchPortnumNodeDistribution();
      const interval = setInterval(fetchPortnumNodeDistribution, 60000);
      return () => clearInterval(interval);
    }
  }, [fetchPortnumNodeDistribution, selectedPortnum]);

  useEffect(() => {
    void fetchMessageCounts();
    const interval = setInterval(fetchMessageCounts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchMessageCounts]);

  return {
    longestActiveSegment, recordHolderSegment, loadingSegments, clearTarget, setClearTarget, virtualNodeStatus, loadingVirtualNode,
    serverInfo, loadingServerInfo, localStats, securityKeys, loadingSecurityKeys, packetDistribution, distributionTimeRange,
    setDistributionTimeRange, distributionTransport, setDistributionTransport, loadingDistribution, selectedPortnum, setSelectedPortnum,
    portnumNodeDistribution, setPortnumNodeDistribution, loadingPortnumNodes, messageCounts, handleClearRecordHolder,
    confirmClearRecordHolder,
  };
}
