/**
 * The Security tab's reads and server-side actions for one source, moved out
 * of SecurityTab (#6365, Rule X) so the Workspace Security page runs the same
 * calls at the same cadence: issues + scanner status, dead nodes, key
 * mismatches (Meshtastic) or the MeshCore findings, refreshed every 30 s; the
 * manual scan, the export and the own-key acknowledge. A 403 on a section's
 * route is remembered and not retried. Nothing here transmits on the mesh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { ApiError } from '../../services/api';
import { isSourceNotConnectedError } from '../../utils/sourceNotConnected';
import type { SecurityCapabilities } from '../../utils/securityCapabilities';
import type { TFunction } from 'i18next';
import type {
  DeadNode,
  NotifyState,
  SecurityIssueView,
  DeadNodesResponse,
  MeshcoreFindings,
  MeshcoreFindingsResponse,
  ScannerStatus,
  SecurityIssuesResponse,
} from './securityTypes';

/** One `/api/security/key-mismatches` row. */
export interface KeyMismatchEvent {
  id: number | string;
  nodeNum: number;
  nodeName?: string | null;
  timestamp: number;
  oldKeyFragment?: string | null;
  newKeyFragment?: string | null;
  action: string;
}

/**
 * Whether a row gets the "Send notification" button (moved from SecurityTab).
 * `allowed`: a DM-capable source, a host that opens the draft, and
 * messages:write on this source. MeshCore also needs a chat contact (Repeaters
 * and Room Servers do not read DMs) that is in the radio's table, and warns
 * when the DM would flood.
 */
export function notifyStateOf(node: SecurityIssueView, allowed: boolean, t: TFunction): NotifyState {
  if (!allowed) return { visible: false };
  if (node.protocol !== 'meshcore') return { visible: true };
  if (node.advType !== 1) return { visible: false };
  if (node.onDevice === false) {
    return {
      visible: true,
      disabled: true,
      hint: t('security.notify_not_on_device', 'This contact is not on the radio, so it cannot receive a DM.'),
    };
  }
  return { visible: true, floodWarning: node.hasKnownPath === false };
}

export function useSecurityData(sourceId: string | undefined, isMeshCore: boolean, caps: SecurityCapabilities) {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<SecurityIssuesResponse | null>(null);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // No manager for this source (SOURCE_NOT_CONNECTED, #4173 N5): an empty
  // state, not an error. The poll keeps running, so it clears on connect.
  const [notConnected, setNotConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mismatchEvents, setMismatchEvents] = useState<KeyMismatchEvent[]>([]);
  const [deadNodes, setDeadNodes] = useState<DeadNode[]>([]);
  const [deadThresholdDays, setDeadThresholdDays] = useState(isMeshCore ? 14 : 7);
  const [deadNodesForbidden, setDeadNodesForbidden] = useState(false);
  const [findings, setFindings] = useState<MeshcoreFindings | null>(null);
  const [findingsForbidden, setFindingsForbidden] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [issuesForbidden, setIssuesForbidden] = useState(false);

  // A 403 on a section's route means no nodes:read on this source. Remember
  // it per section and stop asking: the 30 s poll must not retry-loop.
  const deadNodesForbiddenRef = useRef(false);
  const findingsForbiddenRef = useRef(false);
  const issuesForbiddenRef = useRef(false);
  // Bumped on every source switch; a response from an older generation is
  // dropped so a slow request can't repaint the previous source's data.
  const fetchGenRef = useRef(0);

  const fetchDeadNodes = async (srcParam: string, gen: number) => {
    if (deadNodesForbiddenRef.current) return;
    try {
      const data = await api.get<DeadNodesResponse>(`/api/security/dead-nodes${srcParam}`);
      if (gen !== fetchGenRef.current) return;
      setDeadNodes(data.nodes || []);
      if (typeof data.thresholdDays === 'number') setDeadThresholdDays(data.thresholdDays);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (err instanceof ApiError && err.status === 403) {
        deadNodesForbiddenRef.current = true;
        setDeadNodesForbidden(true);
        setDeadNodes([]);
      } else {
        throw err;
      }
    }
  };

  const fetchFindings = async (srcParam: string, gen: number) => {
    if (findingsForbiddenRef.current) return;
    try {
      const res = await api.get<MeshcoreFindingsResponse>(`/api/security/meshcore/findings${srcParam}`);
      if (gen !== fetchGenRef.current) return;
      setFindings(res.data ?? null);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (err instanceof ApiError && err.status === 403) {
        findingsForbiddenRef.current = true;
        setFindingsForbidden(true);
        setFindings(null);
      } else {
        throw err;
      }
    }
  };

  /** Issues + scanner status. On MeshCore a 403 (no nodes:read) is remembered and not retried. */
  const fetchIssues = async (srcParam: string, gen: number) => {
    if (issuesForbiddenRef.current) return;
    try {
      const [issuesData, statusData] = await Promise.all([
        api.get<SecurityIssuesResponse>(`/api/security/issues${srcParam}`),
        api.get<ScannerStatus>(`/api/security/scanner/status${srcParam}`),
      ]);
      if (gen !== fetchGenRef.current) return;
      setIssues({
        ...issuesData,
        nodes: (issuesData.nodes ?? []).map(n => ({ ...n, nodeKey: n.nodeKey ?? `mt:${n.nodeNum}` })),
      });
      setScannerStatus(statusData);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (isMeshCore && err instanceof ApiError && err.status === 403) {
        issuesForbiddenRef.current = true;
        setIssuesForbidden(true);
        setIssues(null);
      } else {
        throw err;
      }
    }
  };

  const fetchSecurityData = async () => {
    // Defer until a sourceId resolves — the security endpoints require one.
    if (!sourceId) return;
    const gen = fetchGenRef.current;
    try {
      const srcParam = `?sourceId=${encodeURIComponent(sourceId)}`;
      if (isMeshCore) {
        await Promise.all([
          caps.deadNodes ? fetchDeadNodes(srcParam, gen) : Promise.resolve(),
          fetchFindings(srcParam, gen),
          fetchIssues(srcParam, gen),
        ]);
      } else {
        const [mismatchData] = await Promise.all([
          api.get<{ events: KeyMismatchEvent[] }>(`/api/security/key-mismatches${srcParam}`),
          fetchIssues(srcParam, gen),
          fetchDeadNodes(srcParam, gen),
        ]);
        if (gen !== fetchGenRef.current) return;
        setMismatchEvents(mismatchData.events || []);
      }
      setError(null);
      setNotConnected(false);
    } catch (err) {
      if (isSourceNotConnectedError(err)) {
        setNotConnected(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : t('security.failed_load'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // New source: invalidate in-flight responses and clear the previous
    // source's lists so they never flash under the new one (#6283 review).
    fetchGenRef.current += 1;
    setDeadNodes([]);
    setFindings(null);
    setIssues(null);
    setScannerStatus(null);
    deadNodesForbiddenRef.current = false;
    findingsForbiddenRef.current = false;
    issuesForbiddenRef.current = false;
    setDeadNodesForbidden(false);
    setFindingsForbidden(false);
    setIssuesForbidden(false);
    setNotConnected(false);
    void fetchSecurityData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, [sourceId, isMeshCore]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerScan = useCallback(async () => {
    if (!sourceId) {
      setError(t('security.failed_scan'));
      return;
    }
    setScanning(true);
    try {
      await api.post('/api/security/scanner/scan', { sourceId });

      // Wait a moment then refresh data
      setTimeout(fetchSecurityData, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.failed_scan'));
    } finally {
      setScanning(false);
    }
  }, [sourceId, t]); // eslint-disable-line react-hooks/exhaustive-deps -- #6365 moved verbatim from SecurityTab

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const exportUrl = `/api/security/export?format=${format}${sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''}`;
      await api.download(exportUrl, { filename: `security-scan-${Date.now()}.${format}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.failed_export'));
    }
  }, [t, sourceId]);

  const acknowledgeOwnKey = useCallback(async () => {
    if (!sourceId) return;
    setAcknowledging(true);
    try {
      await api.post('/api/security/own-key/acknowledge', { sourceId });
      await fetchSecurityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.failed_load'));
    } finally {
      setAcknowledging(false);
    }
  }, [sourceId, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    issues, scannerStatus, loading, error, setError, notConnected, scanning, mismatchEvents, deadNodes, deadThresholdDays,
    deadNodesForbidden, findings, findingsForbidden, acknowledging, issuesForbidden, fetchSecurityData, triggerScan,
    handleExport, acknowledgeOwnKey,
  };
}
