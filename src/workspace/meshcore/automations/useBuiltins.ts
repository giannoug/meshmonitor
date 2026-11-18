/**
 * The built-ins' reads (Task 7.5): each built-in's today's GET, once per page
 * visit (today's Automations view reads them all on open), shared by the
 * overview and each built-in's page through the query cache. Auto Ping's
 * session list is re-read every 5 s while a session runs, as today.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import { useMeshCoreRuntime } from '../runtime';
import { channelsQuery } from '../useMeshCoreLists';
import { builtinTable, type Builtin, type Values } from './builtins';

/** Today's Auto Ping session poll (MeshCoreAutoPingSection SESSION_POLL_MS). */
const SESSION_POLL_MS = 5000;

export const builtinKey = (sourceId: string, id: string) => ['workspace', 'meshcore', 'builtin', sourceId, id] as const;

export function useBuiltins({ scripts = false }: { scripts?: boolean } = {}) {
  const { t } = useTranslation();
  const { sourceId, meshCore } = useMeshCoreRuntime();
  const queryClient = useQueryClient();
  const connected = meshCore.status?.connected ?? false;
  const { data: channels = [] } = useQuery(channelsQuery(sourceId, connected));
  // The responder's and timers' script picker: today's `/api/scripts` read, only on those pages.
  const { data: scriptRows = [] } = useQuery({
    queryKey: ['workspace', 'meshcore', 'scripts'],
    enabled: scripts,
    queryFn: async () => {
      const raw = await apiService.get<unknown>('/api/scripts');
      const list = Array.isArray(raw) ? raw : Array.isArray((raw as { scripts?: unknown })?.scripts) ? (raw as { scripts: unknown[] }).scripts : [];
      return (list as Array<{ path?: string; filename?: string; name?: string }>)
        .filter((s) => typeof s.path === 'string')
        .map((s) => ({ path: s.path!, name: s.name || s.filename || s.path! }));
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const contacts = useMemo(
    () => meshCore.contacts.filter((c) => !c.isLocal).map((c) => ({ publicKey: c.publicKey, name: c.advName || c.name || `${c.publicKey.slice(0, 8)}…`, advType: c.advType })),
    [meshCore.contacts],
  );
  const isCompanion = meshCore.status?.deviceType === 1;
  const table = useMemo(
    () => builtinTable(t, { channels: channels.map((c) => ({ id: c.id, name: c.name })), contacts, scripts: scriptRows }).filter((b) => !b.companionOnly || isCompanion),
    [t, channels, contacts, scriptRows, isCompanion],
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
  const setSaved = (b: Builtin, values: Values) => queryClient.setQueryData(builtinKey(sourceId, b.id), values);
  const reload = (b: Builtin) => queryClient.invalidateQueries({ queryKey: builtinKey(sourceId, b.id) });
  return { table, results, setSaved, reload };
}
