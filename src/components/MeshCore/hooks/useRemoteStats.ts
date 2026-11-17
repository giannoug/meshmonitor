/**
 * useRemoteStats: the remote node status of MeshCoreRemoteStatsPanel, moved as
 * is so the Workspace (Task 7.3) draws it its own way. Fetched only when
 * `load()` is called (Fetch stats): no auto-fetch, no poll, nothing in
 * receive-only mode, one fetch at a time.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreActions, MeshCoreRemoteStatus } from './useMeshCore';

export function useRemoteStats(publicKey: string, fetchStatus: MeshCoreActions['getRemoteStatus'], receiveOnly = false) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MeshCoreRemoteStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Track an in-flight fetch so a slow Refresh + an interval tick can't
  // race. The interval skips its tick if a fetch is already in flight.
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    // Receive-only mode: silently skip — no request, no toast, no loading
    // state. Guards every caller of `load()` (both the manual Refresh /
    // Fetch-stats buttons below, which are also separately disabled, and any
    // future automatic caller), before any fetchStatus() call and before any
    // loading state is set (#4547 Phase 2 §3.4a(c)).
    if (receiveOnly) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStatus(publicKey);
      if (result) {
        setStatus(result);
        setLastUpdated(Date.now());
      } else {
        setError(t('meshcore.remoteStats.unavailable', 'Status unavailable'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [fetchStatus, publicKey, receiveOnly, t]);

  return { status, loading, error, lastUpdated, load };
}
