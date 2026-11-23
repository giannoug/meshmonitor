/**
 * A Meshtastic device's built-ins and their reads (Task 8.3): today's
 * `/api/settings?sourceId=` read once per visit, shared by every built-in
 * that keeps its settings there, and each other built-in's own GET (Auto Ping,
 * Time Sync, the two node filters, Forwarding, Ignored nodes) once per visit,
 * as today's Automation tab reads them all on open. Auto Ping's sessions are
 * re-read every 5 s while one runs (today's poll, moved).
 *
 * Channels and the local node come from today's poll, read once with no
 * interval; the pages whose fields need `/api/nodes` (node filters, Time
 * Sync, the admin scanner's log) read it once, as today; scripts and the
 * airtime picker's candidates only on the pages that use them.
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { usePoll } from '../../hooks/usePoll';
import { useCachedSourceStatus } from '../../hooks/useDashboardData';
import { useSettings } from '../../contexts/SettingsContext';
import { channelLabel } from '../chat/channelLabel';
import type { Values } from '../meshcore/automations/builtins';
import { builtinTable, type MeshtasticBuiltin } from './builtins';

/** Today's Auto Ping session poll (AutoPingSection). */
const SESSION_POLL_MS = 5000;

export const settingsKey = (sourceId: string) => ['workspace', 'automation', 'settings', sourceId] as const;
export const builtinKey = (sourceId: string, id: string) => ['workspace', 'automation', 'builtin', sourceId, id] as const;
export const nodesKey = (sourceId: string) => ['workspace', 'automation', 'nodes', sourceId] as const;

/** Built-ins whose page reads `/api/nodes` (today's sections read it). */
const NEEDS_NODES = new Set(['auto-traceroute', 'auto-localstats', 'auto-time-sync', 'remote-admin-scanner']);
const NEEDS_SCRIPTS = new Set(['auto-responder', 'timer-triggers', 'geofence-triggers']);

export interface ApiNode {
  nodeNum: number;
  user?: { id?: string; longName?: string; shortName?: string; hwModel?: number; role?: number | string };
  hwModel?: number;
  hasRemoteAdmin?: boolean;
  lastRemoteAdminCheck?: number;
  remoteAdminMetadata?: string | null;
  position?: { latitude?: number; longitude?: number };
  longName?: string;
  lastHeard?: number;
  hopsAway?: number;
  channel?: number;
}

export function nodeName(nd: ApiNode): string {
  return nd.user?.longName || nd.longName || nd.user?.shortName || nd.user?.id || `!${nd.nodeNum.toString(16).padStart(8, '0')}`;
}

export function useBuiltins(sourceId: string, page: string | null) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useCachedSourceStatus(sourceId);
  const { distanceUnit } = useSettings();
  // Today's poll, read once (no interval): channels, nodes and the local node.
  const { data: poll } = usePoll({ pollInterval: 0 });
  const { data: apiNodes } = useQuery({
    queryKey: nodesKey(sourceId),
    enabled: !!page && NEEDS_NODES.has(page),
    queryFn: () => apiService.get<ApiNode[]>(`/api/nodes?sourceId=${encodeURIComponent(sourceId)}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Today's scanner timer (RemoteAdminScannerSection), moved: its counts and log re-read every 30 s while it is on, on that page only.
    refetchInterval: () =>
      page === 'remote-admin-scanner' && queryClient.getQueryData<Values>(builtinKey(sourceId, 'remote-admin-scanner'))?.enabled === true ? 30_000 : false,
  });
  const { data: scriptRows = [] } = useQuery({
    queryKey: ['workspace', 'automation', 'scripts'],
    enabled: !!page && NEEDS_SCRIPTS.has(page),
    queryFn: async () => {
      const raw = await apiService.get<unknown>('/api/scripts');
      const list = Array.isArray(raw) ? raw : Array.isArray((raw as { scripts?: unknown })?.scripts) ? (raw as { scripts: unknown[] }).scripts : [];
      return (list as Array<string | { path?: string; filename?: string; name?: string }>)
        .map((s) => (typeof s === 'string' ? { path: s, filename: s.split('/').pop() } : s))
        .filter((s): s is { path: string; filename?: string; name?: string } => typeof s.path === 'string')
        .map((s) => ({ path: s.path, name: s.name || s.filename || s.path }));
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: candidateRows = [] } = useQuery({
    queryKey: ['workspace', 'automation', 'airtime-candidates', sourceId],
    enabled: page === 'airtime-cutoff',
    queryFn: async () => {
      const body = await apiService.get<{ data?: { candidates?: Array<{ nodeNum: number; longName?: string | null; shortName?: string | null; nodeId?: string | null }> } }>(
        `/api/automation/airtime-candidates?sourceId=${encodeURIComponent(sourceId)}`,
      );
      return (body?.data?.candidates ?? []).map((c) => ({
        nodeNum: c.nodeNum,
        label: c.longName || c.shortName || c.nodeId || `!${c.nodeNum.toString(16).padStart(8, '0')}`,
      }));
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const localNodeNum = status?.nodeNum ?? null;
  const channels = useMemo(
    () => (poll?.channels ?? []).filter((c) => c.role !== 0).map((c) => ({ id: c.id, name: channelLabel(t, c, c.id) })).sort((a, c) => a.id - c.id),
    [poll?.channels, t],
  );
  const sourceNodes = useMemo(() => (apiNodes ?? (poll?.nodes as ApiNode[] | undefined) ?? []), [apiNodes, poll?.nodes]);
  const nodes = useMemo(
    () => sourceNodes
      .filter((nd) => typeof nd.nodeNum === 'number')
      .map((nd) => ({
        num: nd.nodeNum,
        id: nd.user?.id ?? `!${nd.nodeNum.toString(16).padStart(8, '0')}`,
        name: nodeName(nd),
        role: nd.user?.role !== undefined ? Number(nd.user.role) : undefined,
        hwModel: nd.user?.hwModel ?? nd.hwModel,
        hasRemoteAdmin: nd.hasRemoteAdmin === true,
      }))
      .sort((a, c) => a.name.localeCompare(c.name)),
    [sourceNodes],
  );
  const settings = useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryKey: settingsKey(id),
        queryFn: () => apiService.get<Record<string, unknown>>(`/api/settings?sourceId=${encodeURIComponent(id)}`),
        staleTime: Infinity,
      }),
    [queryClient],
  );
  const table = useMemo(
    () => builtinTable(t, { channels, nodes, scripts: scriptRows, candidates: candidateRows, localNodeNum, settings, distanceUnit: distanceUnit === 'mi' ? 'mi' : 'km' }),
    [t, channels, nodes, scriptRows, candidateRows, localNodeNum, settings, distanceUnit],
  );
  const results = useQueries({
    queries: table.map((b) => ({
      queryKey: builtinKey(sourceId, b.id),
      queryFn: () => b.load(sourceId),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
      refetchInterval: (q: { state: { data?: Values } }) =>
        b.id === 'auto-ping' && Array.isArray(q.state.data?.sessions) && (q.state.data.sessions as unknown[]).length > 0 ? SESSION_POLL_MS : false,
    })),
  });
  const setSaved = (b: MeshtasticBuiltin, values: Values) => {
    queryClient.setQueryData(builtinKey(sourceId, b.id), values);
    // The shared settings read is stale now; the next load re-reads it.
    void queryClient.invalidateQueries({ queryKey: settingsKey(sourceId), refetchType: 'none' });
  };
  const reload = async (b: MeshtasticBuiltin) => {
    await queryClient.invalidateQueries({ queryKey: settingsKey(sourceId), refetchType: 'none' });
    await queryClient.invalidateQueries({ queryKey: builtinKey(sourceId, b.id) });
  };
  return { table, results, setSaved, reload, nodes: sourceNodes, channels, localNodeNum };
}
