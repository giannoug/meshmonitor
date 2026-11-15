/**
 * NodeInfo Enrichment's data and actions (NodeInfoEnrichmentReport's logic,
 * shared with the Workspace EnrichmentPage, #6365): the cross-source analysis,
 * the rows (one per node × target source), "Also push to device NodeDB", Fix
 * and Fix All (today's `POST /api/nodes/enrichment/apply`), and the row whose
 * copy is being previewed.
 *
 * With push on, the server sends 1 NodeInfo request per copied row from the
 * target device on that node's channel (nodeInfoCopyService); off, Fix writes
 * MeshMonitor's database only.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api, { ApiError } from '../../services/api';
import { useToast } from '../ToastContainer';

export interface EnrichmentTarget {
  targetSourceId: string;
  targetSourceName: string;
  fillableFields: string[];
  donorSourceId: string;
  donorSourceName: string;
}

export interface EnrichmentNode {
  nodeNum: number;
  nodeId: string;
  displayName: string;
  targets: EnrichmentTarget[];
}

export interface EnrichmentSummary {
  nodeCount: number;
  targetCount: number;
  fieldCount: number;
}

export interface EnrichmentAnalysis {
  nodes: EnrichmentNode[];
  summary: EnrichmentSummary;
}

export interface ApplyItem {
  nodeNum: number;
  targetSourceId: string;
  donorSourceId: string;
}

export interface ApplyResult {
  // `error` is set per item by the server when that one copy threw; the batch
  // as a whole still reports success, so the toast has to read it (#5193).
  applied: Array<ApplyItem & { copiedFields: string[]; pushedToDevice: boolean; error?: string }>;
  totalFieldsCopied: number;
}

export const ANALYSIS_KEY = ['nodeinfo-enrichment-analysis'] as const;

export interface EnrichmentRow extends EnrichmentTarget {
  nodeNum: number;
  nodeId: string;
  displayName: string;
  rowKey: string;
}

export function useNodeInfoEnrichment() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [pushToNodeDb, setPushToNodeDb] = useState(false);
  const [inFlightRowKey, setInFlightRowKey] = useState<string | null>(null);
  // Row whose copy diff is being previewed in the CopyNodeInfoModal.
  const [previewRow, setPreviewRow] = useState<EnrichmentRow | null>(null);

  const { data, isLoading, error, isFetching } = useQuery<EnrichmentAnalysis>({
    queryKey: ANALYSIS_KEY,
    queryFn: async () => {
      const body = await api.get<{ success: boolean; data: EnrichmentAnalysis }>(
        '/api/nodes/enrichment/analysis',
      );
      return body.data; // envelope not unwrapped by ApiService
    },
  });

  const applyMutation = useMutation<ApplyResult, ApiError, ApplyItem[]>({
    mutationFn: async (items) => {
      const body = await api.post<{ success: boolean; data: ApplyResult }>(
        '/api/nodes/enrichment/apply',
        { items, pushToNodeDb },
      );
      return body.data;
    },
    onSuccess: (result) => {
      // A 200 here only means the batch ran. Individual items can fail (the
      // server catches each one so a bad item never aborts the rest), and a
      // copy can legitimately land zero fields. Reporting either as a plain
      // success is what let #5193 look like "Fix All worked" while the count
      // bounced straight back.
      const failed = result.applied.filter((a) => a.error);
      if (failed.length > 0) {
        showToast(
          t(
            'analysis.enrichment.apply_partial',
            'Copied {{fields}} field(s); {{failed}} target(s) failed: {{reason}}',
            {
              fields: result.totalFieldsCopied,
              failed: failed.length,
              reason: failed[0].error,
            },
          ),
          'error',
        );
      } else if (result.totalFieldsCopied === 0) {
        showToast(
          t(
            'analysis.enrichment.apply_nothing_copied',
            'No fields were copied — the donor values are ones MeshMonitor cannot store. Check the server log.',
          ),
          'warning',
        );
      } else {
        showToast(
          t(
            'analysis.enrichment.apply_success',
            'Copied {{fields}} field(s) across {{targets}} target(s)',
            { fields: result.totalFieldsCopied, targets: result.applied.length },
          ),
          'success',
        );
      }
      void qc.invalidateQueries({ queryKey: ANALYSIS_KEY });
    },
    onError: (err) => {
      showToast(
        err?.message ?? t('analysis.enrichment.apply_error', 'Failed to apply enrichment'),
        'error',
      );
    },
    onSettled: () => {
      setInFlightRowKey(null);
    },
  });

  const rows = useMemo<EnrichmentRow[]>(
    () =>
      (data?.nodes ?? []).flatMap((n) =>
        n.targets.map((tg) => ({
          ...tg,
          nodeNum: n.nodeNum,
          nodeId: n.nodeId,
          displayName: n.displayName,
          rowKey: `${n.nodeNum}:${tg.targetSourceId}`,
        })),
      ),
    [data],
  );

  const toApplyItem = (row: EnrichmentRow): ApplyItem => ({
    nodeNum: row.nodeNum,
    targetSourceId: row.targetSourceId,
    donorSourceId: row.donorSourceId,
  });

  const handleFixRow = (row: EnrichmentRow) => {
    setInFlightRowKey(row.rowKey);
    applyMutation.mutate([toApplyItem(row)]);
  };

  const handleFixAll = () => {
    setInFlightRowKey(null);
    applyMutation.mutate(rows.map(toApplyItem));
  };

  const refresh = () => void qc.invalidateQueries({ queryKey: ANALYSIS_KEY });

  return {
    data, isLoading, error, isFetching, applyMutation, rows, pushToNodeDb, setPushToNodeDb, inFlightRowKey,
    previewRow, setPreviewRow, handleFixRow, handleFixAll, refresh,
  };
}
