/**
 * ok_to_mqtt Violations' state, queries and handlers (#4114 Phase 3), shared
 * by today's MqttViolationsReport and the Workspace MqttViolationsPage
 * (#6365). Reads only: nothing is queried until Run report, and nothing here
 * sends on the mesh.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api, { ApiError } from '../../services/api';
import { useToast } from '../ToastContainer';
import {
  API_SCAN_CAP,
  DEFAULT_VIOLATION_FILTERS,
  buildViolationParams,
  formatSuspectedWindow,
  type SortDir,
  type ViolationFilters,
  type ViolationGatewayRow,
  type ViolationGatewaySortField,
  type ViolationGatewaysResponse,
  type ViolationPacketRow,
  type ViolationPacketSortField,
  type ViolationPacketsResponse,
} from './mqttViolationTypes';
import {
  buildGatewaysCsv,
  buildPacketsCsv,
  gatewaysCsvFilename,
  packetsCsvFilename,
} from './mqttViolationsCsv';
import { downloadTextFile } from '../../utils/nodeExport';

type TFn = ReturnType<typeof useTranslation>['t'];

/** Independent sort/page state for the drill-down table (PHASE3 §2(b)/§2(c)). */
interface DrillState {
  sort: ViolationPacketSortField;
  dir: SortDir;
  limit: number;
  offset: number;
}

const DEFAULT_DRILL: DrillState = { sort: 'timestamp', dir: 'desc', limit: 100, offset: 0 };

/** End-of-day normalization matching AuditLogTab (`:91-95`) / buildViolationParams. */
function endOfDayMs(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Shallow field comparison for the flat `ViolationFilters` shape. Used by
 * `onRun` to decide whether pressing Run changes the TanStack queryKey (in
 * which case its own automatic refetch does the work) or leaves it
 * unchanged (in which case an explicit `refetch()` is required, or nothing
 * would happen). Calling `refetch()` unconditionally double-fires: it uses
 * the pre-update closure and races the queryKey-driven refetch once React
 * commits the `setApplied` state change.
 */
function filtersEqual(a: ViolationFilters, b: ViolationFilters): boolean {
  return (
    a.lookbackDays === b.lookbackDays &&
    a.from === b.from &&
    a.to === b.to &&
    a.includeUnknown === b.includeUnknown &&
    a.sort === b.sort &&
    a.dir === b.dir &&
    a.limit === b.limit &&
    a.offset === b.offset
  );
}

export function mapErrorMessage(t: TFn, error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === 'INVALID_RANGE') {
    return t('analysis.mqtt_violations.error_invalid_range', 'The selected date range is invalid.');
  }
  if (code === 'INVALID_SORT_FIELD' || code === 'INVALID_SORT_DIRECTION') {
    return t('analysis.mqtt_violations.error_invalid_sort', 'That column cannot be sorted.');
  }
  if (code === 'MQTT_VIOLATIONS_FETCH_FAILED') {
    return t(
      'analysis.mqtt_violations.error_fetch_failed',
      'Failed to read ok_to_mqtt violation history.',
    );
  }
  return (error as Error)?.message ?? String(error);
}

/** `row.gatewayId`, or a synthetic fallback key when a gateway has no id (PHASE3 §2(h)). */
export function rowKeyOf(row: ViolationGatewayRow): string {
  return row.gatewayId ?? `nodenum-${row.gatewayNodeNum ?? 'unknown'}`;
}

/**
 * The CSV-export cap-honesty message, shared by both export handlers
 * (PHASE3 §2(d)). Never a silent truncation: `capped` is true whenever the
 * export hit the API's hard ceiling OR the server reports more rows exist
 * than were actually exported.
 *
 * `exportCap` is the request limit the caller actually used (the most
 * recently loaded response's `scanCap`, falling back to `API_SCAN_CAP` only
 * when nothing has loaded yet — #4332 follow-up). It must be the same value
 * used to build the export request, so the message never drifts from what
 * was actually asked for.
 */
function buildExportMessage(
  t: TFn,
  exported: number,
  total: number,
  exportCap: number,
): { message: string; capped: boolean } {
  const capped = exported >= exportCap || total > exported;
  const cap = exportCap.toLocaleString();
  const message = capped
    ? t(
        'analysis.mqtt_violations.export_capped',
        'Exported {{exported}} of {{total}} matching rows — the API caps a single scan at {{cap}} rows. Narrow the window to export the rest.',
        { exported: exported.toLocaleString(), total: total.toLocaleString(), cap },
      )
    : t('analysis.mqtt_violations.export_done', 'Exported {{count}} rows', {
        // `count` is i18next's reserved pluralization key and is typed
        // `number` — unlike `exported`/`total`/`cap` above, it cannot be a
        // pre-formatted string.
        count: exported,
      });
  return { message, capped };
}

export function useMqttViolationsReport() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ViolationFilters>(DEFAULT_VIOLATION_FILTERS);
  const [applied, setApplied] = useState<ViolationFilters>(DEFAULT_VIOLATION_FILTERS);
  const [run, setRun] = useState(false);
  const [expandedGateway, setExpandedGateway] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillState>(DEFAULT_DRILL);
  const [gatewayExportWarning, setGatewayExportWarning] = useState<string | null>(null);
  const [gatewayExportPending, setGatewayExportPending] = useState(false);
  const [drillExportWarning, setDrillExportWarning] = useState<string | null>(null);
  const [drillExportPending, setDrillExportPending] = useState(false);
  // Pure client-side render filter (#4982) — never sent to the server (not
  // part of ViolationFilters/buildViolationParams), applies immediately like
  // sort/page/page-size. Hides rows the server already annotated as
  // brokerClass 'private': relays that are EXPECTED per firmware's
  // private-broker exemption, not proven violations.
  const [hidePrivateBroker, setHidePrivateBroker] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<ViolationGatewaysResponse>({
    queryKey: ['mqtt-violations-gateways', applied],
    queryFn: async () => {
      const body = await api.get<{ success: boolean; data: ViolationGatewaysResponse }>(
        `/api/analysis/mqtt-violations/gateways?${buildViolationParams(applied)}`,
      );
      return body.data; // envelope not unwrapped by ApiService
    },
    enabled: run,
    // Sort/page/page-size refinements build a new queryKey (`applied` changes
    // identity); keep the previous page's rows on screen while the new one
    // loads instead of flashing back to the loading banner (PHASE3 §2(e)
    // "cheap, already-run refinements").
    placeholderData: keepPreviousData,
  });

  // `data?.gateways ?? []` would otherwise create a fresh array identity on
  // every render (whenever `data` is undefined), which react-hooks/exhaustive-deps
  // correctly flags as unstable when used as a dependency below.
  const gateways = useMemo(() => data?.gateways ?? [], [data]);

  // #4982: the rows actually rendered/summed — `gateways` minus any hidden by
  // hidePrivateBroker. Deliberately NOT what pagination/totals are based on
  // (those stay server-truth from `data`, unaffected by this client-only
  // filter) — see the hiddenPrivateGatewayCount hint rendered alongside it.
  const visibleGateways = useMemo(
    () => (hidePrivateBroker ? gateways.filter((g) => g.brokerClass !== 'private') : gateways),
    [gateways, hidePrivateBroker],
  );
  const hiddenPrivateGatewayCount = gateways.length - visibleGateways.length;

  // The one gateway currently expanded, if any — looked up by the same key
  // the row map uses, so the drill-down query always scopes to the actual
  // `gatewayId` rather than the synthetic fallback key.
  const expandedGatewayRow = useMemo(
    () => gateways.find((g) => rowKeyOf(g) === expandedGateway) ?? null,
    [gateways, expandedGateway],
  );
  const expandedGatewayId = expandedGatewayRow?.gatewayId ?? null;

  const packetsQuery = useQuery<ViolationPacketsResponse>({
    queryKey: ['mqtt-violations-packets', expandedGatewayId, applied, drill],
    queryFn: async () => {
      const body = await api.get<{ success: boolean; data: ViolationPacketsResponse }>(
        `/api/analysis/mqtt-violations/packets?${buildViolationParams(applied, {
          gateway: expandedGatewayId ?? undefined,
          sort: drill.sort,
          dir: drill.dir,
          limit: drill.limit,
          offset: drill.offset,
        })}`,
      );
      return body.data;
    },
    enabled: run && expandedGatewayId !== null,
    placeholderData: keepPreviousData,
  });

  const draftRangeInvalid =
    draft.from !== '' && draft.to !== '' && new Date(draft.from).getTime() > endOfDayMs(draft.to);

  const onRun = () => {
    if (draftRangeInvalid) return;
    const sameAsApplied = filtersEqual(applied, draft);
    setApplied(draft);
    if (!run) {
      setRun(true);
    } else if (sameAsApplied) {
      // Filters didn't actually change, so the queryKey won't either — an
      // explicit refetch is the only way to re-run the same window.
      void refetch();
    }
    // Otherwise: the queryKey changed, and TanStack's own effect refetches —
    // calling refetch() here too would double-fire (see filtersEqual doc).
  };

  const handleSort = (field: ViolationGatewaySortField) => {
    const dir: SortDir = applied.sort === field ? (applied.dir === 'asc' ? 'desc' : 'asc') : 'desc';
    const patch = { sort: field, dir, offset: 0 };
    setDraft((d) => ({ ...d, ...patch }));
    setApplied((a) => ({ ...a, ...patch }));
  };

  const handlePageChange = (page: number) => {
    const limit = data?.limit ?? applied.limit;
    const patch = { offset: (page - 1) * limit };
    setDraft((d) => ({ ...d, ...patch }));
    setApplied((a) => ({ ...a, ...patch }));
  };

  const handlePageSizeChange = (limit: number) => {
    const patch = { limit, offset: 0 };
    setDraft((d) => ({ ...d, ...patch }));
    setApplied((a) => ({ ...a, ...patch }));
    // The summary's own page size doesn't bound the drill-down's result set,
    // but an expanded gateway can be left pointing at a drill-down page that
    // no longer exists once the summary reloads — reset it too (#4332).
    setDrill((d) => ({ ...d, offset: 0 }));
  };

  /** Toggle expand/collapse. Always resets the drill-down's own pagination
   * (§2(b)) so re-opening — this gateway or a different one — never lands
   * on a stale page from whatever was open before. */
  const handleRowToggle = (rowKey: string) => {
    setExpandedGateway((prev) => (prev === rowKey ? null : rowKey));
    setDrill((d) => ({ ...d, offset: 0 }));
    setDrillExportWarning(null);
  };

  const handleDrillSort = (field: ViolationPacketSortField) => {
    setDrill((d) => ({
      ...d,
      sort: field,
      dir: d.sort === field ? (d.dir === 'asc' ? 'desc' : 'asc') : 'desc',
      offset: 0,
    }));
  };

  const handleDrillPageChange = (page: number) => {
    const limit = packetsQuery.data?.limit ?? drill.limit;
    setDrill((d) => ({ ...d, offset: (page - 1) * limit }));
  };

  /**
   * CSV export re-fetches the *whole* filtered result set at the API's hard
   * ceiling (`limit=scanCap, offset=0`), not just the current page (§2(d)).
   * A one-shot `fetchQuery` rather than a second live `useQuery` — this is
   * an imperative action, not a render-driven data need.
   *
   * The cap itself is a deliberate client-side choice (avoid pulling
   * unbounded rows into the browser) — only the *number* comes from the
   * server: the most recently loaded summary response's `scanCap`, falling
   * back to the local `API_SCAN_CAP` constant only if nothing has loaded
   * yet, so the request limit and the honesty message can never drift from
   * what the server actually enforces (#4332 follow-up).
   */
  const handleExportGateways = async () => {
    setGatewayExportPending(true);
    const exportCap = data?.scanCap ?? API_SCAN_CAP;
    try {
      const body = await queryClient.fetchQuery({
        queryKey: ['mqtt-violations-gateways-export', applied],
        queryFn: async () => {
          const b = await api.get<{ success: boolean; data: ViolationGatewaysResponse }>(
            `/api/analysis/mqtt-violations/gateways?${buildViolationParams(applied, {
              limit: exportCap,
              offset: 0,
            })}`,
          );
          return b.data;
        },
      });
      const csv = buildGatewaysCsv(body.gateways);
      downloadTextFile(gatewaysCsvFilename(), csv, 'text/csv');
      const { message, capped } = buildExportMessage(t, body.gateways.length, body.total, exportCap);
      setGatewayExportWarning(capped ? message : null);
      showToast(message, capped ? 'error' : 'success');
    } catch {
      setGatewayExportWarning(null);
      showToast(t('analysis.mqtt_violations.export_failed', 'Export failed'), 'error');
    } finally {
      setGatewayExportPending(false);
    }
  };

  const handleExportPackets = async (gatewayId: string) => {
    setDrillExportPending(true);
    // The drill-down's own packets response, not the summary's — the two
    // endpoints echo the same server constant today, but this stays correct
    // if that ever changes (#4332 follow-up).
    const exportCap = packetsQuery.data?.scanCap ?? API_SCAN_CAP;
    try {
      const body = await queryClient.fetchQuery({
        queryKey: ['mqtt-violations-packets-export', gatewayId, applied, drill.sort, drill.dir],
        queryFn: async () => {
          const b = await api.get<{ success: boolean; data: ViolationPacketsResponse }>(
            `/api/analysis/mqtt-violations/packets?${buildViolationParams(applied, {
              gateway: gatewayId,
              sort: drill.sort,
              dir: drill.dir,
              limit: exportCap,
              offset: 0,
            })}`,
          );
          return b.data;
        },
      });
      const csv = buildPacketsCsv(body.violations);
      downloadTextFile(packetsCsvFilename(gatewayId), csv, 'text/csv');
      const { message, capped } = buildExportMessage(t, body.violations.length, body.total, exportCap);
      setDrillExportWarning(capped ? message : null);
      showToast(message, capped ? 'error' : 'success');
    } catch {
      setDrillExportWarning(null);
      showToast(t('analysis.mqtt_violations.export_failed', 'Export failed'), 'error');
    } finally {
      setDrillExportPending(false);
    }
  };

  // MEANINGLESS unless includeUnknown was actually requested — read from the
  // response echo, never from local toggle state (PHASE3 §2(a.2)).
  const unknownRequested = data?.includeUnknown === true;
  const suspectedUnavailable = unknownRequested && data?.suspectedAvailable === false;
  const suspectedShown = unknownRequested && data?.suspectedAvailable === true;

  const hasSources = (data?.sources.length ?? 0) > 0;
  const isEmpty = hasSources && gateways.length === 0;
  const hasData = hasSources && gateways.length > 0;
  const infoBannersEligible = hasSources && (isEmpty || hasData);

  // Gate on the server's own `capApplied` echo, never on `total >= scanCap`
  // (#4330). On the default path capApplied is always false and `total` is
  // an exact COUNT with every row reachable, so a mesh with more rows than
  // the cap still pages correctly instead of being clamped/mislabeled.
  const capApplied = data?.capApplied === true;
  const scanCap = data?.scanCap ?? API_SCAN_CAP;
  const reachable = data ? (capApplied ? Math.min(data.total, scanCap) : data.total) : 0;
  const totalPages = data ? Math.max(1, Math.ceil(reachable / data.limit)) : 1;
  const currentPage = data ? Math.floor(data.offset / data.limit) + 1 : 1;
  const capLabel = scanCap.toLocaleString();

  const windowFmt = data ? formatSuspectedWindow(data.suspectedWindowMs) : null;
  const windowText =
    windowFmt?.hours != null
      ? t('analysis.mqtt_violations.window_hours', '{{hours}} h', { hours: windowFmt.hours })
      : windowFmt?.days != null
        ? t('analysis.mqtt_violations.window_days', '{{days}} days', { days: windowFmt.days })
        : '';

  // +1 for the Broker column (#4982), always present regardless of suspectedShown.
  const columnCount = 8 + (suspectedShown ? 1 : 0);

  // #4982: sums reflect what's actually visible (i.e. respect hidePrivateBroker),
  // same page-scoped-not-global-total convention this block already used before
  // brokerClass existed — only `gatewayCount` below is the server's true total.
  const stats = {
    gatewayCount: data?.total ?? 0,
    confirmed: visibleGateways.reduce((sum, g) => sum + g.violationCount, 0),
    suspected: visibleGateways.reduce((sum, g) => sum + g.suspectedCount, 0),
    originators: visibleGateways.reduce((sum, g) => sum + g.distinctOriginators, 0),
  };

  const confirmedColTitle = t(
    'analysis.mqtt_violations.col_confirmed_title',
    "Receptions where the sender's ok_to_mqtt bit was explicitly 0 and a different node published the packet to MQTT. Proven.",
  );
  const suspectedColTitle = t(
    'analysis.mqtt_violations.col_suspected_title',
    'Receptions where the ok_to_mqtt bit could not be read — usually because MeshMonitor has no key for the channel. Not proven, and not sortable.',
  );

  // Drill-down cap honesty (§2(c) rule 5 — same treatment as the summary
  // table, gated on the response's own `capApplied`/`scanCap`, not a
  // `total >= cap` inference (#4330).
  const drillTotal = packetsQuery.data?.total ?? 0;
  const drillCapApplied = packetsQuery.data?.capApplied === true;
  const drillScanCap = packetsQuery.data?.scanCap ?? API_SCAN_CAP;
  const drillCapLabel = drillScanCap.toLocaleString();
  const drillLimit = packetsQuery.data?.limit ?? drill.limit;
  const drillReachable = packetsQuery.data
    ? (drillCapApplied ? Math.min(drillTotal, drillScanCap) : drillTotal)
    : 0;
  const drillTotalPages = packetsQuery.data ? Math.max(1, Math.ceil(drillReachable / drillLimit)) : 1;
  const drillCurrentPage = packetsQuery.data
    ? Math.floor(packetsQuery.data.offset / drillLimit) + 1
    : 1;
  const drillViolations = packetsQuery.data?.violations ?? [];
  // #4982: same client-only filter as the summary table, applied to the
  // drill-down's own rows.
  const visibleDrillViolations = hidePrivateBroker
    ? drillViolations.filter((v: ViolationPacketRow) => v.brokerClass !== 'private')
    : drillViolations;
  const hiddenPrivateDrillCount = drillViolations.length - visibleDrillViolations.length;
  const drillHasData = drillViolations.length > 0;

  return {
    draft,
    setDraft,
    applied,
    setApplied,
    run,
    setRun,
    expandedGateway,
    setExpandedGateway,
    drill,
    setDrill,
    gatewayExportWarning,
    setGatewayExportWarning,
    gatewayExportPending,
    setGatewayExportPending,
    drillExportWarning,
    setDrillExportWarning,
    drillExportPending,
    setDrillExportPending,
    hidePrivateBroker,
    setHidePrivateBroker,
    data,
    isLoading,
    error,
    refetch,
    gateways,
    visibleGateways,
    hiddenPrivateGatewayCount,
    expandedGatewayRow,
    expandedGatewayId,
    packetsQuery,
    draftRangeInvalid,
    onRun,
    handleSort,
    handlePageChange,
    handlePageSizeChange,
    handleRowToggle,
    handleDrillSort,
    handleDrillPageChange,
    handleExportGateways,
    handleExportPackets,
    unknownRequested,
    suspectedUnavailable,
    suspectedShown,
    hasSources,
    isEmpty,
    hasData,
    infoBannersEligible,
    capApplied,
    scanCap,
    reachable,
    totalPages,
    currentPage,
    capLabel,
    windowFmt,
    windowText,
    columnCount,
    stats,
    confirmedColTitle,
    suspectedColTitle,
    drillTotal,
    drillCapApplied,
    drillScanCap,
    drillCapLabel,
    drillLimit,
    drillReachable,
    drillTotalPages,
    drillCurrentPage,
    drillViolations,
    visibleDrillViolations,
    hiddenPrivateDrillCount,
    drillHasData,
  };
}

export type MqttViolationsState = ReturnType<typeof useMqttViolationsReport>;
