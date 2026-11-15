/**
 * `useMeshIssuesReport` — the Mesh Issues report's data and actions, moved
 * verbatim out of `MeshIssuesReport.tsx` (Rule X, #6365) so the Workspace
 * Mesh issues page shares them: view state, the `/summary` + `/status`
 * queries, the run-now/dismiss/restore/bulk mutations, and the forbidden
 * flags that hide mutating controls after a 401/403. See
 * `MeshIssuesReport.tsx`'s header for the backend contract and gates.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../services/api';
import type {
  MeshIssueBulkScope,
  MeshIssuesBulkResult,
  MeshIssuesFilters,
  MeshIssuesRunNowResult,
  MeshIssuesStatus,
  MeshIssuesSummary,
} from '../meshIssueTypes';
import { useMeshIssuesViewState } from './useMeshIssuesViewState';
import {
  ISSUES_BASE_KEY,
  STATUS_KEY,
  SUMMARY_BASE_KEY,
  fetchStatus,
  fetchSummary,
  postBulkDismiss,
  postBulkRestore,
  postDismiss,
  postRestore,
  postRunNow,
  summaryKey,
} from './meshIssuesApi';

function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

export function useMeshIssuesReport() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [viewState, setViewState] = useMeshIssuesViewState();
  const [runNowForbidden, setRunNowForbidden] = useState(false);
  const [actionsForbidden, setActionsForbidden] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const { filters } = viewState;

  const summaryQuery = useQuery<MeshIssuesSummary>({
    queryKey: summaryKey(filters),
    queryFn: () => fetchSummary(filters),
    retry: false,
  });

  const statusQuery = useQuery<MeshIssuesStatus>({
    queryKey: STATUS_KEY,
    queryFn: fetchStatus,
    retry: false,
  });

  const invalidateIssues = useCallback(() => {
    // Partial key match — invalidates every per-type/per-node variant.
    void qc.invalidateQueries({ queryKey: [ISSUES_BASE_KEY] });
  }, [qc]);
  const invalidateSummary = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [SUMMARY_BASE_KEY] });
  }, [qc]);

  const runNowMutation = useMutation<MeshIssuesRunNowResult, unknown, void>({
    mutationFn: postRunNow,
    onSuccess: () => {
      setRunError(null);
      invalidateIssues();
      invalidateSummary();
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      if (isForbidden(err)) setRunNowForbidden(true);
      setRunError(
        err instanceof Error ? err.message : t('analysis.mesh_issues.run_failed', 'Failed to run analysis'),
      );
    },
  });

  const dismissMutation = useMutation<void, unknown, number>({
    mutationFn: postDismiss,
    onSuccess: () => {
      invalidateIssues();
      invalidateSummary();
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      if (isForbidden(err)) setActionsForbidden(true);
    },
  });

  const restoreMutation = useMutation<void, unknown, number>({
    mutationFn: postRestore,
    onSuccess: () => {
      invalidateIssues();
      invalidateSummary();
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      if (isForbidden(err)) setActionsForbidden(true);
    },
  });

  /** Bulk dismiss/restore (WP5, spec §4.4/§6.4/§7.4) — one shared mutation
   *  pair reused by every `IssueTypeSection`/`NodeGroupSection`'s
   *  `BulkActionMenu`, keyed by the declarative `MeshIssueBulkScope` each
   *  caller passes in. Refreshes tiles + sections + status on success, per
   *  the WP5 acceptance bullet. */
  const bulkDismissMutation = useMutation<MeshIssuesBulkResult, unknown, MeshIssueBulkScope>({
    mutationFn: postBulkDismiss,
    onSuccess: () => {
      invalidateIssues();
      invalidateSummary();
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      if (isForbidden(err)) setActionsForbidden(true);
    },
  });

  const bulkRestoreMutation = useMutation<MeshIssuesBulkResult, unknown, MeshIssueBulkScope>({
    mutationFn: postBulkRestore,
    onSuccess: () => {
      invalidateIssues();
      invalidateSummary();
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      if (isForbidden(err)) setActionsForbidden(true);
    },
  });

  const canRunNow = statusQuery.isSuccess && !runNowForbidden;
  const canAct = statusQuery.isSuccess && !actionsForbidden;
  const running = runNowMutation.isPending || statusQuery.data?.inProgress === true;

  const handleRunNow = useCallback(() => runNowMutation.mutate(), [runNowMutation]);
  const handleDismiss = useCallback((id: number) => dismissMutation.mutate(id), [dismissMutation]);
  const handleRestore = useCallback((id: number) => restoreMutation.mutate(id), [restoreMutation]);
  const handleBulkDismiss = useCallback(
    (scope: MeshIssueBulkScope) => bulkDismissMutation.mutate(scope),
    [bulkDismissMutation],
  );
  const handleBulkRestore = useCallback(
    (scope: MeshIssueBulkScope) => bulkRestoreMutation.mutate(scope),
    [bulkRestoreMutation],
  );
  /** Passed to `MuteRuleDialog` (self-contained mutation) so a 401/403 there
   *  hides the report's mutating controls the same as every other mutation. */
  const handleForbidden = useCallback(() => setActionsForbidden(true), []);
  const bulkPending = bulkDismissMutation.isPending || bulkRestoreMutation.isPending;

  const handleFiltersChange = useCallback(
    (next: MeshIssuesFilters) => setViewState((vs) => ({ ...vs, filters: next })),
    [setViewState],
  );

  /** Tile click (spec §6.1): sets `filters.issueTypes` to just this type
   *  (or clears it for the active tile / the "All" tile), switches to the
   *  By-issue view, and force-expands the matching section regardless of
   *  its current collapsed state. */
  const handleTileSelect = useCallback(
    (issueType: string | null) => {
      setViewState((vs) => ({
        ...vs,
        view: 'byIssue',
        filters: { ...vs.filters, issueTypes: issueType ? [issueType] : [] },
        expandedTypes:
          issueType && !vs.expandedTypes.includes(issueType) ? [...vs.expandedTypes, issueType] : vs.expandedTypes,
      }));
    },
    [setViewState],
  );

  const summary = summaryQuery.data ?? null;
  const total = summary?.total ?? 0;
  const lastRunResult = statusQuery.data?.lastRunResult ?? null;
  const lastRunTime = statusQuery.data?.lastRunTime ?? null;
  // Mute (WP5, spec §6.4) — the current mute set + the values MuteRuleDialog
  // needs for its auto-close copy. Fallbacks match the server's own defaults
  // (`DEFAULT_MESH_ISSUE_THRESHOLDS`, `thresholds.ts`) for the brief window
  // before `/status` resolves.
  const disabledRules = statusQuery.data?.thresholds.disabledRules ?? [];
  const autoCloseCleanRuns = statusQuery.data?.thresholds.autoCloseCleanRuns ?? 3;
  const frequencyHours = statusQuery.data?.frequencyHours ?? 24;

  return {
    viewState,
    setViewState,
    filters,
    summaryQuery,
    statusQuery,
    runError,
    canRunNow,
    canAct,
    running,
    handleRunNow,
    handleDismiss,
    handleRestore,
    handleBulkDismiss,
    handleBulkRestore,
    handleForbidden,
    bulkPending,
    handleFiltersChange,
    handleTileSelect,
    dismissMutation,
    restoreMutation,
    summary,
    total,
    lastRunResult,
    lastRunTime,
    disabledRules,
    autoCloseCleanRuns,
    frequencyHours,
  };
}
