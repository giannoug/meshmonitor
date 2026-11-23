/**
 * The Dead nodes section's two writes and its "last heard" wording, moved out
 * of DeadNodesSection (#6365, Rule X) for the Workspace's Quiet nodes page.
 * Both writes go to MeshMonitor's server; neither transmits on the mesh (the
 * delete removes a node from the radio's node list over the local link).
 */
import api from '../../services/api';

/** The threshold is a per-source setting (settings:write). */
export async function saveDeadNodeDays(sourceId: string, days: number): Promise<void> {
  await api.post(`/api/settings?sourceId=${encodeURIComponent(sourceId)}`, { securityDeadNodeDays: String(days) });
}

/** One bulk delete for exactly these keys; resolves to how many the server kept (local node or favourite). */
export async function bulkDeleteDeadNodes(sourceId: string, nodeKeys: string[]): Promise<number> {
  const res = await api.post<{ results?: Array<{ deleted: boolean; error?: string }> }>(
    '/api/security/dead-nodes/bulk-delete',
    { sourceId, nodeKeys },
  );
  return (res?.results ?? []).filter(r => r.error === 'PROTECTED').length;
}

export function formatLastHeard(t: (k: string, d: string, o?: Record<string, unknown>) => string, lastHeard: number | null): string {
  if (!lastHeard) return t('security.dead_nodes_never', 'Never');
  const days = Math.floor((Math.floor(Date.now() / 1000) - lastHeard) / 86400);
  if (days > 30) {
    return t('security.dead_nodes_months_ago', '{{count}} month(s) ago', { count: Math.floor(days / 30) });
  }
  return t('security.dead_nodes_days_ago', '{{count}} day(s) ago', { count: days });
}
