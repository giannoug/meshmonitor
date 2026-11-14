/**
 * Merging a renumbered node's history (NodeIdentityMergeDialog's logic, shared
 * with the Workspace's MergeIdentitySheet, issue #5032): the dry run on open,
 * the acknowledgement a merge too large to undo needs, and the merge itself.
 * Nothing is written until `merge()`; it sends nothing on the mesh.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import apiService from '../services/api';
import type { MergePreview, MergeResult } from '../types/nodeIdentityChange';

export interface UseNodeIdentityMergeOptions {
  sourceId: string;
  /** The node being retired — the old, pre-2.8 number. */
  fromNodeNum: number;
  /** The node that survives — the new, key-derived number. */
  toNodeNum: number;
  onClose: () => void;
  /** Called after a successful merge, with the server's result. */
  onMerged?: (result: MergeResult) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useNodeIdentityMerge({ sourceId, fromNodeNum, toNodeNum, onClose, onMerged }: UseNodeIdentityMergeOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService
      .previewNodeIdentityMerge(sourceId, fromNodeNum, toNodeNum)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(errorMessage(err, t('nodes.merge_preview_failed', 'Could not preview the merge.')));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, fromNodeNum, toNodeNum, t]);

  const handleMerge = useCallback(async () => {
    setMerging(true);
    setError(null);
    try {
      const result = await apiService.mergeNodeIdentities(sourceId, fromNodeNum, toNodeNum, {
        acknowledgeNoUndo: acknowledged,
      });
      // The node list, the detection report and the merge history are all stale
      // now — a node row has just disappeared.
      await queryClient.invalidateQueries({ queryKey: ['nodeIdentityChanges', sourceId] });
      await queryClient.invalidateQueries({ queryKey: ['nodeIdentityMerges', sourceId] });
      await queryClient.invalidateQueries({ queryKey: ['nodes'] });
      onMerged?.(result);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t('nodes.merge_failed', 'The merge failed. Nothing was changed.')));
    } finally {
      setMerging(false);
    }
  }, [sourceId, fromNodeNum, toNodeNum, acknowledged, queryClient, onMerged, onClose, t]);

  const needsAcknowledgement = preview !== null && !preview.undoable;
  const canMerge = preview !== null && !merging && (!needsAcknowledgement || acknowledged);

  return { preview, loading, merging, error, acknowledged, setAcknowledged, needsAcknowledgement, canMerge, handleMerge };
}

type MergeAction = MergePreview['entries'][number]['action'];

/** Rows this action removes rather than moves (shown in the drop colour). */
export function isMergeDropAction(action: MergeAction): boolean {
  return action === 'dropCollision' || action === 'dropSelfLoop' || action === 'dropRow' || action === 'deleteNodeRow';
}

/** Plain-language label for a plan action. Machine names never reach the operator. */
export function mergeActionLabel(action: MergeAction, t: ReturnType<typeof useTranslation>['t']): string {
  switch (action) {
    case 'rekey':
      return t('nodes.merge_action_rekey', 'Move to new node number');
    case 'moveRow':
      return t('nodes.merge_action_move_row', 'Move to new node number');
    case 'dropCollision':
      return t('nodes.merge_action_drop_collision', 'Remove duplicate');
    case 'dropSelfLoop':
      return t('nodes.merge_action_drop_self', 'Remove (node would be its own neighbour)');
    case 'dropRow':
      return t('nodes.merge_action_drop_row', 'Remove (the surviving node already has one)');
    case 'deleteNodeRow':
      return t('nodes.merge_action_delete_node', 'Remove the retired node entry');
    case 'patchNodeRow':
      return t('nodes.merge_action_patch_node', 'Carry over to the surviving node');
    default:
      return action;
  }
}
