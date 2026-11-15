/**
 * The Traceroute Explorer's state, data and handlers (#5511), shared by
 * today's TracerouteExplorerReport and the Workspace TracerouteExplorerPage
 * (#6365). One window of stored runs from the server; every other filter
 * runs client-side. Reads only: nothing here sends to any node.
 */
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettings } from '../../../contexts/SettingsContext';
import type { DeviceInfo } from '../../../types/device';
import type { NodeTransportClass } from '../../../utils/nodeTransport';
import { EXPLORER_QUERY_KEY, RANGE_PRESETS, fetchExplorer } from './explorerApi';
import {
  DEFAULT_FILTERS,
  buildRuns,
  filterRuns,
  groupByPair,
  nodeKeyOf,
  nodeLongLabel,
  summarize,
  type ExplorerFilters,
  type ExplorerNodeWire,
  type ExplorerProtocol,
  type ExplorerRun,
  type ProtocolFilter,
} from './explorerModel';
import type { LineMode } from './ExplorerMap';
import type { GroupMode } from './ExplorerTable';

export type ViewMode = 'table' | 'split' | 'map';

const PREFS_KEY = 'meshmonitor.tracerouteExplorer.prefs';

interface Prefs {
  view: ViewMode;
  group: GroupMode;
  lines: LineMode;
  split: number;
  /** Protocol filter; only applied while both protocols are in the window. */
  protocol: ProtocolFilter;
}
const DEFAULT_PREFS: Prefs = { view: 'split', group: 'pair', lines: 'usage', split: 52, protocol: 'all' };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      view: p.view === 'table' || p.view === 'map' || p.view === 'split' ? p.view : DEFAULT_PREFS.view,
      group: p.group === 'flat' ? 'flat' : 'pair',
      lines: p.lines === 'snr' ? 'snr' : 'usage',
      protocol: p.protocol === 'meshtastic' || p.protocol === 'meshcore' ? p.protocol : 'all',
      split: typeof p.split === 'number' && p.split >= 25 && p.split <= 75 ? p.split : DEFAULT_PREFS.split,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * The explorer's state, data and handlers (TracerouteExplorerReport's logic,
 * shared with the Workspace TracerouteExplorerPage, #6365). Reads only.
 */
export function useTracerouteExplorer() {
  const { timeFormat, dateFormat } = useSettings();

  const [rangeId, setRangeId] = useState('24h');
  const hours = RANGE_PRESETS.find(p => p.id === rangeId)?.hours ?? null;
  const [sourceFilter, setSourceFilter] = useState('');
  const [filters, setFilters] = useState<ExplorerFilters>(DEFAULT_FILTERS);
  const [syncMap, setSyncMap] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [openPairs, setOpenPairs] = useState<Set<string>>(new Set());
  const [full, setFull] = useState(false);
  const workRef = useRef<HTMLDivElement>(null);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => setPrefs(prev => ({ ...prev, ...patch })), []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }, [prefs]);

  const query = useQuery({
    queryKey: [EXPLORER_QUERY_KEY, { hours }],
    queryFn: () => fetchExplorer({ hours, sourceIds: [] }),
    staleTime: 30_000,
  });
  const data = query.data;

  const allRuns = useMemo(() => buildRuns(data?.runs ?? []), [data]);
  const nodes = useMemo(() => new Map<string, ExplorerNodeWire>((data?.nodes ?? []).map(n => [nodeKeyOf(n), n])), [data]);
  const protocolsPresent = useMemo(() => new Set(allRuns.map(r => r.protocol)), [allRuns]);
  const bothProtocols = protocolsPresent.size > 1;
  // The saved protocol choice applies only while it can be changed from the UI.
  const activeFilters = useMemo<ExplorerFilters>(
    () => ({ ...filters, protocol: bothProtocols ? prefs.protocol : 'all' }),
    [filters, bothProtocols, prefs.protocol],
  );
  const sourceNames = useMemo(() => new Map((data?.sources ?? []).map(s => [s.id, s.name])), [data]);
  // Per protocol: a synthetic MeshCore number must never match a Meshtastic node.
  const devicesByProtocol = useMemo<Record<ExplorerProtocol, DeviceInfo[]>>(() => {
    const out: Record<ExplorerProtocol, DeviceInfo[]> = { meshtastic: [], meshcore: [] };
    for (const n of data?.nodes ?? []) {
      out[n.protocol ?? 'meshtastic'].push({
        nodeNum: n.nodeNum,
        user: {
          id: n.nodeId,
          longName: n.longName ?? undefined,
          shortName: n.shortName ?? undefined,
          hwModel: n.hwModel ?? undefined,
          role: n.role != null ? String(n.role) : undefined,
        },
        position: n.latitude != null && n.longitude != null ? { latitude: n.latitude, longitude: n.longitude } : undefined,
      });
    }
    return out;
  }, [data]);

  const sourceRuns = useMemo(
    () => (sourceFilter ? allRuns.filter(r => r.sourceIds.includes(sourceFilter)) : allRuns),
    [allRuns, sourceFilter],
  );
  const mapRuns = useMemo(() => filterRuns(sourceRuns, { ...activeFilters, nodeKey: null }, nodes), [sourceRuns, activeFilters, nodes]);
  const tableRuns = useMemo(
    () => (syncMap && activeFilters.nodeKey != null ? filterRuns(sourceRuns, activeFilters, nodes) : mapRuns),
    [syncMap, sourceRuns, activeFilters, nodes, mapRuns],
  );
  const pairs = useMemo(() => groupByPair(tableRuns), [tableRuns]);
  const summary = useMemo(() => summarize(tableRuns), [tableRuns]);

  const runByKey = useMemo(() => new Map(allRuns.map(r => [r.key, r])), [allRuns]);
  const selectedRun = selectedKey ? runByKey.get(selectedKey) ?? null : null;
  const focusRun = (hoverKey ? runByKey.get(hoverKey) : null) ?? selectedRun;
  const pairRuns = useMemo(
    () => (selectedRun ? sourceRuns.filter(r => r.pairKey === selectedRun.pairKey) : []),
    [selectedRun, sourceRuns],
  );

  // Esc leaves full screen; the page behind it must not scroll meanwhile.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [full]);

  const setFilter = <K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const toggleTransport = (tr: NodeTransportClass) =>
    setFilter('transports', filters.transports.includes(tr) ? filters.transports.filter(x => x !== tr) : [...filters.transports, tr]);

  const onSelectRun = (run: ExplorerRun) => {
    setSelectedKey(prev => (prev === run.key ? null : run.key));
    setHoverKey(null);
  };
  const onNodeClick = (nodeKey: string) => {
    setFilter('nodeKey', filters.nodeKey === nodeKey ? null : nodeKey);
    setSelectedKey(null);
  };
  const onTogglePair = (key: string) =>
    setOpenPairs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const work = workRef.current;
    if (!work) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = work.getBoundingClientRect();
      const pct = Math.min(75, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100));
      updatePrefs({ split: Math.round(pct) });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
  const onDividerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') updatePrefs({ split: Math.max(25, prefs.split - 4) });
    if (e.key === 'ArrowRight') updatePrefs({ split: Math.min(75, prefs.split + 4) });
  };

  const fitKey = `${rangeId}|${sourceFilter}|${data ? 'loaded' : 'empty'}`;
  const filterNode = filters.nodeKey != null ? nodeLongLabel(nodes, filters.nodeKey) : null;

  return {
    timeFormat,
    dateFormat,
    rangeId,
    setRangeId,
    hours,
    sourceFilter,
    setSourceFilter,
    filters,
    setFilters,
    syncMap,
    setSyncMap,
    prefs,
    setPrefs,
    selectedKey,
    setSelectedKey,
    hoverKey,
    setHoverKey,
    openPairs,
    setOpenPairs,
    full,
    setFull,
    workRef,
    updatePrefs,
    query,
    data,
    allRuns,
    nodes,
    protocolsPresent,
    bothProtocols,
    activeFilters,
    sourceNames,
    devicesByProtocol,
    sourceRuns,
    mapRuns,
    tableRuns,
    pairs,
    summary,
    runByKey,
    selectedRun,
    focusRun,
    pairRuns,
    setFilter,
    toggleTransport,
    onSelectRun,
    onNodeClick,
    onTogglePair,
    onDividerPointerDown,
    onDividerKey,
    fitKey,
    filterNode,
  };
}

export type TracerouteExplorerState = ReturnType<typeof useTracerouteExplorer>;
