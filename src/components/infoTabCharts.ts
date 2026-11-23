/**
 * The Info tab's data shaping, moved out of InfoTab (#6365, Rule X) so the
 * Workspace Info page draws exactly today's numbers and colours: the
 * hardware-model mix (top 10 + Other), the RX/TX breakdowns, packets by
 * device (+ Other) and by type, the per-type node chart, the last message,
 * the most recently heard node, and App's active-channel count.
 */
import type { TFunction } from 'i18next';
import type { Channel, DeviceInfo } from '../types/device';
import type { MeshMessage } from '../types/message';
import type { PacketDistributionStats } from '../types/packet';
import { getHardwareModelName } from '../utils/hardwareModel';
import { DISTRIBUTION_COLORS, type ChartDataEntry } from './packetStatsChartData';

/** Nodes by hardware model: the top 10, then "Other"; null when no node reports one. */
export function hardwareModelChart(nodes: DeviceInfo[], otherLabel: string): { data: ChartDataEntry[]; total: number } | null {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const hw = n.user?.hwModel;
    if (hw === undefined || hw === 0) continue;
    const name = getHardwareModelName(hw);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const TOP_N = 10;
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);

  const hwData: ChartDataEntry[] = top.map(([name, value], i) => ({
    name,
    value,
    color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
  }));
  const otherCount = rest.reduce((sum, [, v]) => sum + v, 0);
  if (otherCount > 0) {
    hwData.push({
      name: otherLabel,
      value: otherCount,
      color: DISTRIBUTION_COLORS[10],
    });
  }

  const total = sorted.reduce((sum, [, v]) => sum + v, 0);
  return { data: hwData, total };
}

/** The local node's LocalStats counters as today's RX and TX breakdowns. */
export function radioStatsCharts(localStats: Record<string, number> | null | undefined, t: TFunction) {
  const rxTotal = localStats?.numPacketsRx || 0;
  const rxBad = localStats?.numPacketsRxBad || 0;
  const rxDupe = localStats?.numRxDupe || 0;
  const rxGood = Math.max(0, rxTotal - rxBad - rxDupe);
  // Today's chart colours, moved verbatim from InfoTab (#6365): data colours for the recharts fills.
  const rxData: ChartDataEntry[] = [
    { name: t('info.rx_good'), value: rxGood, color: '#a6e3a1' },
    { name: t('info.rx_bad_short'), value: rxBad, color: '#f38ba8' },
    { name: t('info.rx_dupe_short'), value: rxDupe, color: '#fab387' },
  ];

  const txTotal = localStats?.numPacketsTx || 0;
  const txDropped = localStats?.numTxDropped || 0;
  const txRelay = localStats?.numTxRelay || 0;
  // Note: numTxRelayCanceled is NOT part of numPacketsTx - it counts packets
  // that were never transmitted because another node relayed first
  const txDirect = Math.max(0, txTotal - txDropped - txRelay);
  const txData: ChartDataEntry[] = [
    { name: t('info.tx_direct'), value: txDirect, color: '#89b4fa' },
    { name: t('info.tx_relay_short'), value: txRelay, color: '#a6e3a1' },
    { name: t('info.tx_dropped_short'), value: txDropped, color: '#f38ba8' },
  ];
  return { rxTotal, rxData, txTotal, txData };
}

/** Packets by device (today's top list from the server, then "Other" for the rest of the total). */
export function packetsByDeviceChart(dist: PacketDistributionStats, otherLabel: string): ChartDataEntry[] {
  const deviceData: ChartDataEntry[] = dist.byDevice.map((d, i) => ({
    name: d.from_node_longName || d.from_node_id || `Node ${d.from_node}`,
    value: d.count,
    color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]
  }));

  // Calculate "Other" if there are more devices beyond top 10
  const deviceTotal = deviceData.reduce((sum, d) => sum + d.value, 0);
  const otherCount = dist.total - deviceTotal;
  if (otherCount > 0) {
    deviceData.push({
      name: otherLabel,
      value: otherCount,
      color: DISTRIBUTION_COLORS[10] // Use the gray color for "Other"
    });
  }
  return deviceData;
}

/** A port name as today's charts print it: "NODEINFO_APP" → "NODEINFO". */
export const portLabel = (name: string) => name.replace(/_APP$/, '').replace(/_/g, ' ');

/** Packets by type. */
export function packetsByTypeChart(dist: PacketDistributionStats): ChartDataEntry[] {
  return dist.byType.map((p, i) => ({
    name: portLabel(p.portnum_name),
    value: p.count,
    color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]
  }));
}

/** The selected type's name in the per-type node chart's title. */
export function portnumTypeName(dist: PacketDistributionStats, portnum: number | null): string {
  return dist.byType.find((p) => p.portnum === portnum)?.portnum_name.replace(/_APP$/, '').replace(/_/g, ' ') ?? `Port ${portnum}`;
}

/** Last message time across DMs and every channel; null when there is none. */
export function lastMessageTime(messages: MeshMessage[], channelMessages: { [key: number]: MeshMessage[] }): Date | null {
  // Combine all messages from DMs and all channels
  const allMessages = [
    ...messages,
    ...Object.values(channelMessages).flat()
  ];
  if (allMessages.length === 0) return null;
  const mostRecent = allMessages.reduce((latest, msg) =>
    msg.timestamp.getTime() > latest.timestamp.getTime() ? msg : latest
  );
  return mostRecent.timestamp;
}

/** The most recently heard node (undefined name → `unknown`), or null with no nodes. */
export function mostRecentlyHeardName(nodes: DeviceInfo[], unknown: string): string | null {
  return nodes.length > 0 ?
    nodes.reduce((prev, current) =>
      (prev.lastHeard || 0) > (current.lastHeard || 0) ? prev : current
    ).user?.longName || unknown : null;
}

/**
 * App's getAvailableChannels: configured channels and those messages arrived
 * on, without the DM channel (-1), disabled slots (role 0) and channels the
 * viewer may not read.
 */
export function availableChannels(channels: Channel[], messages: MeshMessage[], canReadChannel: (ch: number) => boolean): number[] {
  const channelSet = new Set<number>();

  // Add channels from channel configurations first (these are authoritative)
  channels.forEach(ch => channelSet.add(ch.id));

  // Add channels from messages
  messages.forEach(msg => {
    channelSet.add(msg.channel);
  });

  // Filter out channel -1 (used for direct messages), disabled channels (role = 0),
  // and channels the user doesn't have permission to read
  return Array.from(channelSet)
    .filter(ch => {
      if (ch === -1) return false; // Exclude DM channel

      // Check if channel has a configuration
      const channelConfig = channels.find(c => c.id === ch);

      // If channel has config and role is Disabled (0), exclude it
      if (channelConfig && channelConfig.role === 0) {
        return false;
      }

      // Check if user has permission to read this channel
      if (!canReadChannel(ch)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a - b);
}
