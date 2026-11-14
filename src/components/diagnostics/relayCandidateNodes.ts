/**
 * Nodes in the shape `RelayCandidateList` ranks ("who relayed this?"), with
 * each node's direct-neighbour RSSI when known. Shared by ChannelsTab,
 * MessagesTab and the Workspace's Message details (#6365 Task 2.5, Rule X).
 */
import type { DeviceInfo } from '../../types/device';
import type { RelayCandidateNode } from './RelayCandidateList';

export type DirectNeighborStats = Record<number, { avgRssi: number; packetCount: number; lastHeard: number }>;

export function toRelayCandidateNodes(nodes: DeviceInfo[], directNeighborStats: DirectNeighborStats | undefined): RelayCandidateNode[] {
  return nodes.map(node => {
    const stats = directNeighborStats?.[node.nodeNum];
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
