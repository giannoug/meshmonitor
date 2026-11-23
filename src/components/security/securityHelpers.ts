/**
 * SecurityTab's pure helpers, moved out (#6365, Rule X) so the Workspace
 * Security page groups shared keys and names mismatch states exactly as today.
 */
import type { TFunction } from 'i18next';
import type { SecurityIssueView } from './securityTypes';

export interface DuplicateKeyGroup {
  publicKey: string;
  nodes: SecurityIssueView[];
}

/** Nodes flagged with a duplicate key, grouped by that key; only keys two or more nodes share. */
export function groupDuplicateKeyNodes(nodes: SecurityIssueView[]): DuplicateKeyGroup[] {
  const duplicateNodes = nodes.filter(node => node.duplicateKeyDetected && node.publicKey);
  const groups = new Map<string, SecurityIssueView[]>();

  duplicateNodes.forEach(node => {
    if (node.publicKey) {
      const existing = groups.get(node.publicKey) || [];
      existing.push(node);
      groups.set(node.publicKey, existing);
    }
  });

  return Array.from(groups.entries())
    .filter(([_, nodeList]) => nodeList.length > 1) // Only show groups with multiple nodes
    .map(([publicKey, nodeList]) => ({ publicKey, nodes: nodeList }));
}

/** A key-mismatch event's state in today's words. */
export function mismatchStatusLabel(action: string, t: TFunction): string {
  switch (action) {
    case 'mismatch': return t('security.key_mismatch_status_pending');
    case 'purge': return t('security.key_mismatch_status_purged');
    case 'fixed': return t('security.key_mismatch_status_fixed');
    case 'exhausted': return t('security.key_mismatch_status_exhausted');
    default: return action;
  }
}
