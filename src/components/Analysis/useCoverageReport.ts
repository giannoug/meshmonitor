/**
 * `useCoverageReport` — the Coverage Report's filter state, queries and
 * derived analysis, moved verbatim out of `CoverageReport.tsx` (Rule X,
 * #6365) so the Workspace Coverage page lays out the same parts. See
 * `CoverageReport.tsx`'s header for the data flow, and the comments below
 * for the query-stability rules (#5277) that still apply to every caller.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCoverageReceivers,
  useCoverageSenders,
  useCoverageReceptions,
} from '../../hooks/useCoverageData';
import { useCoverageSurveys } from '../../hooks/useCoverageSurveys';
import {
  groupReceptionsIntoFixes,
  formatCoverageNodeId,
  effectiveSurveyEndAt,
  COVERAGE_GRID_DEFAULT_CELL_M,
  isMeshCorePubKeyId,
} from '../../utils/coverage';
import type { CoverageMetric } from '../../utils/coverage';
import type { CoverageHopsMode, CoverageSurveyDto } from '../../types/coverage';
import {
  buildReceiverQuery,
  deselectedFromReceiverFilter,
  encodeReceiverFilter,
  receiverKey,
} from '../../utils/coverageReceiverFilter';
import {
  resolveCoverageWindow,
  type CoverageRangePreset,
  type CoverageWindow,
} from '../../utils/coverageTimeRange';
import { detectCoverageGaps } from '../../utils/coverageGaps';
import { summarizeCoverage } from '../../utils/coverageSummary';
import { summarizeCrossSourceCoverage } from '../../utils/coverageCrossSource';
import { binFixesToGrid } from '../../utils/coverageGrid';
import type {
  CoverageDeepLink,
  CoverageExportContext,
  CoverageGridCellSizeM,
  CoverageMapView,
  GapFixInput,
} from '../../types/coverageAnalysis';
import { useSettings } from '../../contexts/SettingsContext';
import type { SearchableSelectOption } from '../common/SearchableSelect';

export const RANGE_PRESETS: Array<{ id: Exclude<CoverageRangePreset, 'custom'>; key: string; label: string }> = [
  { id: '1h', key: 'range_1h', label: '1 h' },
  { id: '6h', key: 'range_6h', label: '6 h' },
  { id: '24h', key: 'range_24h', label: '24 h' },
  { id: '3d', key: 'range_3d', label: '3 days' },
  { id: '7d', key: 'range_7d', label: '7 days' },
];

// 8 = MeshCore's advert flood limit (`flood_max_advert`, COVERAGE_P3_SPEC.md
// §0.2) — one hop past Meshtastic's own max of 7, so a MeshCore multi-hop
// advert always has a value on this list (#5277 P3 WP3, spec §2.6).
export const HOPS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function useCoverageReport(initialLink?: CoverageDeepLink) {
  const { t } = useTranslation();
  const { distanceUnit } = useSettings();

  const [preset, setPreset] = useState<CoverageRangePreset>(() => initialLink?.range ?? '24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [senderId, setSenderId] = useState<string>(() => initialLink?.sender ?? '');
  const [deselectedReceiverIds, setDeselectedReceiverIds] = useState<Set<string>>(new Set());
  const [hops, setHops] = useState<number | ''>('');
  const [hopsMode, setHopsMode] = useState<CoverageHopsMode>('exact');
  // #5560: only fixes sent by another of our sources.
  const [crossSourceOnly, setCrossSourceOnly] = useState(false);
  const [metric, setMetric] = useState<CoverageMetric>('snr');
  const [view, setView] = useState<CoverageMapView>('dots');
  const [cellSize, setCellSize] = useState<CoverageGridCellSizeM>(COVERAGE_GRID_DEFAULT_CELL_M);

  // Saved surveys (#5277 P4b WP3, spec §2b.7). `selectedSurvey` holds the
  // FULL DTO, not just an id looked up from `surveysQuery` below, on
  // purpose: `applySurvey` (and the bar's Start/Save/Stop/Edit onSuccess
  // callbacks, which also call back through `onSelectSurvey`) always hand
  // this the freshest row directly, and `surveysQuery`'s own cache can lag
  // one refetch behind a just-created/just-mutated row (its invalidation is
  // async). Deriving `selectedSurvey` by re-looking the id up in
  // `surveysQuery.data` would momentarily lose `intervalSec`/`isLive`/etc.
  // right after Start or Save, before that refetch lands. A manual sender or
  // window change clears it (see the wrapped setters further down), matching
  // "picking a survey applies it; changing anything by hand detaches it"
  // (spec §2b.7).
  //
  // Starts `null`, even with a `survey=` deep link — NOT the deep-linked id
  // itself. The survey list has to load first to know whether that id is
  // real; the effect below is what sets this once it's confirmed to exist,
  // same "seed once, from confirmed data" rule as the sender synthetic-
  // option handling above, just one tick later than a lazy `useState` can
  // reach (the list is a network fetch, not a prop already in hand).
  const [selectedSurvey, setSelectedSurvey] = useState<CoverageSurveyDto | null>(null);
  const selectedSurveyId = selectedSurvey?.id ?? null;
  const appliedInitialSurveyRef = useRef(false);

  // Resolved ONCE per discrete user action (mount / preset click / custom
  // "Apply" / Refresh) via `resolveCoverageWindow`, and cached in state —
  // NEVER recomputed from `Date.now()` during a plain render. See
  // `coverageTimeRange.ts`'s doc comment: an earlier version computed
  // sinceMs/untilMs inline on every render, which fed a numerically
  // different value into the TanStack Query key on every render and caused
  // an endless refetch loop (#5277 browser-validation regression) that kept
  // Refresh permanently disabled and the map never rendering. The lazy
  // `useState` initializer runs exactly once, at mount.
  const [timeWindow, setTimeWindow] = useState<CoverageWindow>(() =>
    resolveCoverageWindow(initialLink?.range ?? '24h', Date.now()),
  );
  const { sinceMs, untilMs, rangeInvalid } = timeWindow;

  // A manual range or sender change is "changing the window/sender by hand"
  // (spec §2b.7) — it detaches whatever survey is currently applied. This
  // does NOT run when `applySurvey` itself sets these (it sets
  // `selectedSurveyId` directly, never through these wrapped setters).
  const selectPreset = (id: Exclude<CoverageRangePreset, 'custom'>) => {
    setPreset(id);
    setTimeWindow(resolveCoverageWindow(id, Date.now()));
    setSelectedSurvey(null);
  };

  /** Switches the UI to the custom from/to inputs WITHOUT resolving a new
   *  window — the window only changes once the user presses Apply, so
   *  merely opening the custom picker can't itself trigger a fetch (and
   *  doesn't detach a selected survey either). */
  const selectCustomPreset = () => {
    setPreset('custom');
  };

  const applyCustomRange = () => {
    setTimeWindow(resolveCoverageWindow('custom', Date.now(), customFrom, customTo));
    setSelectedSurvey(null);
  };

  const handleSenderChange = useCallback((id: string) => {
    setSenderId(id);
    setSelectedSurvey(null);
  }, []);

  const receiversQuery = useCoverageReceivers([]);
  const sendersQuery = useCoverageSenders({ sources: [], sinceMs, untilMs });

  // senderId -> best display name, for CoverageMap's fix popup header.
  // Receptions/receivers carry no name; `/senders` is the only endpoint
  // that does.
  const senderNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sendersQuery.data?.senders ?? []) {
      const name = s.longName || s.shortName;
      if (name) map.set(s.senderId, name);
    }
    return map;
  }, [sendersQuery.data]);

  // Options for the sender SearchableSelect (spec §2a.7). A deep-linked (or
  // otherwise already-selected) sender absent from `/senders` — no fixes in
  // the current window — still gets a synthetic option with its formatted
  // id so the current value never silently vanishes from the picker.
  const senderOptions = useMemo<SearchableSelectOption[]>(() => {
    const senders = sendersQuery.data?.senders ?? [];
    const options: SearchableSelectOption[] = senders.map((s) => {
      const displaySenderId = formatCoverageNodeId(s.senderId);
      const label = s.longName || s.shortName || displaySenderId;
      // #5560: mark senders that are one of our own sources' radios.
      const own = s.senderIsOwnSource
        ? ` · ${t('analysis.coverage.sender_own_source', 'our source {{source}}', {
            source: s.ownSourceName ?? s.ownSourceId ?? '',
          })}`
        : '';
      return {
        value: s.senderId,
        label: `${label} (${displaySenderId}) — ${s.fixCount}${own}`,
        keywords: [s.longName, s.shortName, s.senderId, s.ownSourceName].filter(Boolean).join(' '),
      };
    });
    if (senderId && !senders.some((s) => s.senderId === senderId)) {
      options.push({
        value: senderId,
        label: formatCoverageNodeId(senderId),
        keywords: senderId,
      });
    }
    return options;
  }, [sendersQuery.data, senderId, t]);

  // The cross-source toggle only shows when it can match something (or is
  // already on), so single-source installs never see it.
  const hasOwnSourceSenders = useMemo(
    () => (sendersQuery.data?.senders ?? []).some((s) => s.senderIsOwnSource),
    [sendersQuery.data],
  );

  // The filter only applies while its toggle is on screen. If the window or
  // data changes so no sender is one of our sources, the toggle hides and the
  // filter stops applying, so a hidden control can never leave an empty page.
  const effectiveCrossSourceOnly = crossSourceOnly && hasOwnSourceSenders;

  const receivers = useMemo(() => receiversQuery.data?.receivers ?? [], [receiversQuery.data]);
  const mqttSources = useMemo(() => receiversQuery.data?.mqttSources ?? [], [receiversQuery.data]);

  // receiverKey(sourceId, receiverId) -> best display name / sourceId ->
  // sourceName, for the summary table, distance chart and CSV/GeoJSON export
  // (spec §2a.4/§2a.6). Same composite-key convention as
  // `CoverageReceiverFilter`/`CoverageMap`.
  const receiverNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of receivers) {
      const name = r.longName || r.shortName;
      if (name) map.set(receiverKey(r.sourceId, r.receiverId), name);
    }
    return map;
  }, [receivers]);
  const sourceNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of receivers) {
      if (r.sourceName) map.set(r.sourceId, r.sourceName);
    }
    // #5560: a sender's own source may not be a receiver in this window.
    for (const s of sendersQuery.data?.senders ?? []) {
      if (s.ownSourceId && s.ownSourceName && !map.has(s.ownSourceId)) map.set(s.ownSourceId, s.ownSourceName);
    }
    return map;
  }, [receivers, sendersQuery.data]);

  // Source-scoped receiver filter (#5277 P2 §2.5/§2.9), built from the
  // composite-keyed `deselectedReceiverIds` set — carry-over (a): the same
  // receiverId on two different sources toggles independently.
  const receiverQuery = useMemo(
    () =>
      buildReceiverQuery(
        receivers.map((r) => ({ sourceId: r.sourceId, receiverId: r.receiverId })),
        deselectedReceiverIds,
      ),
    [receivers, deselectedReceiverIds],
  );
  const selectedReceiverKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of receivers) {
      const key = receiverKey(r.sourceId, r.receiverId);
      if (!deselectedReceiverIds.has(key)) set.add(key);
    }
    return set;
  }, [receivers, deselectedReceiverIds]);
  const allReceiversSelected = receivers.length > 0 && selectedReceiverKeys.size === receivers.length;
  const noReceiversSelected = receivers.length > 0 && receiverQuery.noneSelected;

  // Encoded wire form of the CURRENT receiver selection — what "Save as
  // survey" stores on the new row (spec §2b.7: "sender + current window +
  // current receiver filter"). `null` = every receiver, same convention as
  // `CoverageSurveyDto.receivers`. When the picker fell back to
  // `clientSideFilter` (well past the 1000-id / 6000-char cap, spec §2.5),
  // there is no encodable filter to save — the survey is saved with every
  // receiver instead of failing outright; it is a view preference, not a
  // privacy boundary (spec §2b.1).
  const currentReceiversEncoded = useMemo(
    () =>
      receiverQuery.clientSideFilter || !receiverQuery.receiverFilter
        ? null
        : encodeReceiverFilter(receiverQuery.receiverFilter),
    [receiverQuery],
  );

  // Saved surveys (#5277 P4b WP3, spec §2b.7). `surveysQuery` itself is only
  // read here for the deep-link lookup below (and to hand `.refetch` to
  // Refresh) — everyday selection reads/writes go through `selectedSurvey`
  // state above, not this query's cache (see that state's doc comment).
  const surveysQuery = useCoverageSurveys();

  /** Applies a picked/started/saved/stopped survey to the report's own
   *  sender/window/receiver state — the one place all four ever change
   *  together. Sets `selectedSurvey` directly (never through the wrapped
   *  `handleSenderChange`/`selectPreset`/`applyCustomRange` setters above,
   *  which would immediately clear it again). */
  const applySurvey = useCallback(
    (survey: CoverageSurveyDto) => {
      setSelectedSurvey(survey);
      setSenderId(survey.senderId);
      setTimeWindow({
        sinceMs: survey.startAt,
        untilMs: effectiveSurveyEndAt(survey, Date.now()),
        rangeInvalid: false,
      });
      setDeselectedReceiverIds(
        deselectedFromReceiverFilter(
          survey.receivers,
          receivers.map((r) => ({ sourceId: r.sourceId, receiverId: r.receiverId })),
        ),
      );
    },
    [receivers],
  );

  const handleSelectSurvey = useCallback(
    (survey: CoverageSurveyDto | null) => {
      if (!survey) {
        setSelectedSurvey(null);
        return;
      }
      applySurvey(survey);
    },
    [applySurvey],
  );

  // Deep link `survey=<uuid>` (spec §2a.5/§2b.7): applied once, as soon as
  // the survey list has loaded and contains it. Runs at most once per mount
  // (the ref guard) — a survey that no longer exists, or hasn't loaded yet
  // on the first pass, is simply left unapplied rather than retried forever.
  useEffect(() => {
    if (appliedInitialSurveyRef.current) return;
    if (!initialLink?.survey) return;
    if (!surveysQuery.data) return; // still loading
    appliedInitialSurveyRef.current = true;
    const found = surveysQuery.data.find((s) => s.id === initialLink.survey);
    if (found) applySurvey(found);
  }, [initialLink?.survey, surveysQuery.data, applySurvey]);

  const receptionsEnabled = !rangeInvalid && !noReceiversSelected;
  const receptionsQuery = useCoverageReceptions(
    {
      sources: receiverQuery.sources ?? [],
      sinceMs,
      untilMs,
      receiverFilter: receiverQuery.receiverFilter,
      clientSideFilter: receiverQuery.clientSideFilter ? selectedReceiverKeys : undefined,
      senderId: senderId || undefined,
      hops: hops === '' ? undefined : hops,
      hopsMode,
      crossSourceOnly: effectiveCrossSourceOnly,
    },
    receptionsEnabled,
  );

  const items = useMemo(() => receptionsQuery.data?.items ?? [], [receptionsQuery.data]);
  const fixes = useMemo(() => groupReceptionsIntoFixes(items, metric), [items, metric]);

  // P4a pure analysis (spec §2a.7) — all derived from `items`/`fixes`
  // that are already privacy-filtered and already-loaded; no new fetch.
  const singleSender = senderId !== '';
  const fixesAsGapInputs = useMemo<GapFixInput[]>(
    () =>
      fixes.map((f) => ({
        packetKey: f.packetKey,
        firstReceivedAt: f.firstReceivedAt,
        latitude: f.latitude,
        longitude: f.longitude,
      })),
    [fixes],
  );
  // Gaps only run for a single sender, so its protocol follows from its id
  // (MeshCore senders are 64-hex public keys), never a source type (spec
  // §2a.2). The gap rule's default interval (30 s vs 60 s) depends on it.
  const protocol = isMeshCorePubKeyId(senderId) ? 'meshcore' : 'meshtastic';
  // A selected survey's configured interval overrides the observed/default
  // estimate (spec §2b.7/§2a.2's `configured` source).
  const configuredIntervalSec = selectedSurvey?.intervalSec ?? undefined;
  const gapResult = useMemo(
    () => (singleSender ? detectCoverageGaps(fixesAsGapInputs, { protocol, configuredIntervalSec }) : null),
    [singleSender, fixesAsGapInputs, protocol, configuredIntervalSec],
  );
  const summary = useMemo(() => summarizeCoverage(items), [items]);
  const crossSourceRows = useMemo(() => summarizeCrossSourceCoverage(items), [items]);
  const gridCells = useMemo(
    () => (view === 'grid' ? binFixesToGrid(fixes, cellSize, metric) : []),
    [view, fixes, cellSize, metric],
  );
  // Tied to when `items` actually changed (a real fetch), not every render —
  // an export timestamp has no query-key implications, but there is no
  // reason to churn it on every keystroke either. `items` isn't read inside
  // the factory; it's the recompute trigger, which exhaustive-deps can't see.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #5277 P4a WP4: intentional recompute-on-items-change, Date.now() itself has no deps
  const generatedAt = useMemo(() => Date.now(), [items]);
  const exportCtx = useMemo<CoverageExportContext>(
    () => ({
      senderNames,
      receiverNames,
      sourceNames,
      truncated: receptionsQuery.data?.truncated ?? false,
      generatedAt,
      filters: {
        senderId: senderId || null,
        hops: hops === '' ? null : hops,
        hopsMode,
        metric,
      },
    }),
    [
      senderNames,
      receiverNames,
      sourceNames,
      receptionsQuery.data?.truncated,
      generatedAt,
      senderId,
      hops,
      hopsMode,
      metric,
    ],
  );

  // Identifies the current filter set for CoverageMap's fit-once-per-filter
  // behaviour. Deliberately excludes sinceMs/untilMs (the resolved window) —
  // those shift on every Refresh even when the filters themselves didn't
  // change (a preset re-anchors to "now"), and Refresh must never yank the
  // map out from under a user who has since panned/zoomed. `preset` plus the
  // custom from/to inputs capture "which range the user picked" without the
  // refresh-anchor noise.
  const fitKey = useMemo(() => {
    const receiversPart = allReceiversSelected ? 'all' : [...selectedReceiverKeys].sort().join(',');
    const rangePart = preset === 'custom' ? `custom:${customFrom}:${customTo}` : preset;
    return `${senderId}|${receiversPart}|${hops}|${hopsMode}|${rangePart}|${effectiveCrossSourceOnly ? 'x' : ''}`;
  }, [senderId, selectedReceiverKeys, allReceiversSelected, hops, hopsMode, preset, customFrom, customTo, effectiveCrossSourceOnly]);

  const isLoading = receiversQuery.isLoading || sendersQuery.isLoading || receptionsQuery.isLoading;
  const isEmpty = receptionsEnabled && !isLoading && items.length === 0;
  const retentionDays = receiversQuery.data?.retentionDays;
  const hasMqttReceivers = useMemo(
    () => receivers.some((r) => r.receiverKind === 'mqtt_gateway') || mqttSources.length > 0,
    [receivers, mqttSources],
  );

  const handleRefresh = () => {
    // Re-anchors the window to "now" (a preset window slides forward; a
    // custom range is re-validated against its current from/to inputs).
    // That alone changes sinceMs/untilMs, which changes the senders' and
    // receptions' query keys, which TanStack Query fetches automatically —
    // do NOT also call .refetch() on those two here: combined with the key
    // change, an explicit refetch double-fires them (one fetch for the old
    // key via .refetch(), one for the new key from the key change), which
    // is exactly the bug this file's regression test guards against.
    // `receiversQuery`'s key never depends on the time window, so it needs
    // its own explicit refetch to actually do anything on Refresh — same
    // reasoning applies to `surveysQuery` (#5277 P4b WP3).
    //
    // A selected LIVE survey re-anchors to its own effective end (spec
    // §2b.7: "live -> now at resolve time; Refresh re-anchors") instead of
    // the preset — its `startAt` never moves, only how far `effectiveEndAt`
    // has crept since it was last resolved.
    if (selectedSurvey) {
      setTimeWindow({
        sinceMs: selectedSurvey.startAt,
        untilMs: effectiveSurveyEndAt(selectedSurvey, Date.now()),
        rangeInvalid: false,
      });
    } else {
      setTimeWindow(resolveCoverageWindow(preset, Date.now(), customFrom, customTo));
    }
    void receiversQuery.refetch();
    void surveysQuery.refetch();
  };

  return {
    distanceUnit,
    preset,
    selectPreset,
    selectCustomPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    applyCustomRange,
    senderId,
    handleSenderChange,
    senderOptions,
    senderNames,
    hops,
    setHops,
    hopsMode,
    setHopsMode,
    hasOwnSourceSenders,
    crossSourceOnly,
    setCrossSourceOnly,
    metric,
    setMetric,
    view,
    setView,
    cellSize,
    setCellSize,
    handleRefresh,
    isLoading,
    isEmpty,
    items,
    fixes,
    gapResult,
    exportCtx,
    sinceMs,
    untilMs,
    rangeInvalid,
    currentReceiversEncoded,
    selectedSurveyId,
    handleSelectSurvey,
    receivers,
    deselectedReceiverIds,
    setDeselectedReceiverIds,
    mqttSources,
    hasMqttReceivers,
    retentionDays,
    noReceiversSelected,
    receptionsQuery,
    receptionsEnabled,
    fitKey,
    gridCells,
    summary,
    crossSourceRows,
    sourceNames,
    receiverNames,
  };
}
