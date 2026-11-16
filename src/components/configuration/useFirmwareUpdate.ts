/**
 * Today's OTA firmware update for the selected source (#5011, #5249, #3413,
 * #5423, #5677): the gateway, the release channel, the releases, the staged
 * upload, the wizard's status and every request and step of the flash.
 * Extracted from FirmwareUpdateSection (Rule X) so the Workspace Firmware page
 * draws the same flow; nothing it downloads, uploads or flashes changed.
 * A caller asks before `restoreBackup`.
 */
import type React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useToast } from '../ToastContainer';
import { usePoll } from '../../hooks/usePoll';
import { useData } from '../../contexts/DataContext';
import { useSource } from '../../contexts/SourceContext';
import { buildOtaGateway } from '../../utils/otaGateway';
import { firmwareUpdateSupport } from '../../utils/firmwareHardwareMap';

// Mirror the server-side types for the frontend
export type UpdateState = 'idle' | 'awaiting-confirm' | 'in-progress' | 'success' | 'error';
export type UpdateStep = 'preflight' | 'backup' | 'download' | 'extract' | 'flash' | 'verify' | null;
export type FirmwareChannel = 'stable' | 'alpha' | 'custom' | 'nightly' | 'local';

/**
 * Scale the unit rather than always printing MB: a 4 KB file reading
 * "0.00 MB" looks like a failed upload (#5249).
 */
export function formatFirmwareSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** A `.bin` the user uploaded, held server-side until it is flashed (#5249). */
export interface StagedUpload {
  originalName: string;
  size: number;
}

export interface PreflightInfo {
  currentVersion: string;
  targetVersion: string;
  gatewayIp: string;
  hwModel: string;
  boardName: string;
  platform: string;
}

/** Mirrors OtaSiblingWarning in src/server/services/firmwareHardwareMap.ts (#5423). */
export interface OtaSiblingWarning {
  code: 'OTA_SIBLING_BUILD';
  board: string;
  boardLabel: string;
  sibling: string;
  siblingLabel: string;
  message: string;
}

export interface UpdateStatus {
  state: UpdateState;
  step: UpdateStep;
  message: string;
  progress?: number;
  logs: string[];
  targetVersion?: string;
  error?: string;
  preflightInfo?: PreflightInfo;
  backupPath?: string;
  downloadUrl?: string;
  downloadSize?: number;
  matchedFile?: string;
  rejectedFiles?: Array<{ name: string; reason: string }>;
  warnings?: OtaSiblingWarning[];
  /** Source whose node the running update is flashing (#5424 follow-up). */
  sourceId?: string;
}

export interface FirmwareRelease {
  tagName: string;
  version: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  assets: Array<{ name: string; downloadUrl: string; size: number }>;
  /** True for the develop nightly build, which has no publish date and gets a "nightly" badge. */
  isNightly?: boolean;
}

export interface FirmwareStatusResponse {
  success: boolean;
  status: UpdateStatus;
  channel: FirmwareChannel;
  // Null when nothing is saved — /status returns the stored setting verbatim.
  customUrl: string | null;
  lastChecked: number | null;
  /** Null when nothing is staged (#5249). Survives a page reload. */
  stagedUpload?: StagedUpload | null;
}

export interface FirmwareReleasesResponse {
  success: boolean;
  releases: FirmwareRelease[];
  channel: FirmwareChannel;
}

export interface FirmwareBackup {
  filename: string;
  path: string;
  timestamp: number;
  size: number;
}

export interface FirmwareBackupsResponse {
  success: boolean;
  backups: FirmwareBackup[];
}

export const STEP_TITLES: Record<string, string> = {
  preflight: 'firmware.wizard_preflight_title',
  backup: 'firmware.wizard_backup_title',
  download: 'firmware.wizard_download_title',
  extract: 'firmware.wizard_extract_title',
  flash: 'firmware.wizard_flash_title',
  verify: 'firmware.wizard_verify_title',
};

export const STEP_ORDER: Array<{ key: string; label: string }> = [
  { key: 'preflight', label: 'Preflight' },
  { key: 'backup', label: 'Backup' },
  { key: 'download', label: 'Download' },
  { key: 'extract', label: 'Extract' },
  { key: 'flash', label: 'Flash' },
  { key: 'verify', label: 'Verify' },
];


/** The releases query (key, request, staleTime), shared by every reader so they share one cache entry. */
export function firmwareReleasesQuery(csrfFetch: ReturnType<typeof useCsrfFetch>, baseUrl: string) {
  return {
    queryKey: ['firmware', 'releases'],
    queryFn: async (): Promise<FirmwareReleasesResponse> => {
      const res = await csrfFetch(`${baseUrl}/api/firmware/releases`);
      if (!res.ok) throw new Error('Failed to fetch firmware releases');
      return res.json();
    },
    staleTime: 60000,
  };
}

export function useFirmwareUpdate(baseUrl: string) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { setConnectionStatus } = useData();
  // #5424 follow-up: every OTA call names the selected source, so the server
  // disconnects and reconnects THIS source's node rather than the primary's.
  // null outside a SourceProvider (legacy single-source install).
  const { sourceId } = useSource();
  const withSource = <T extends Record<string, unknown>>(body: T): T & { sourceId?: string } =>
    sourceId ? { ...body, sourceId } : body;

  // Derive gateway info from poll data
  const { data: pollData } = usePoll();
  const gatewayInfo = useMemo(() => {
    const config = pollData?.config;
    const localNodeInfo = config?.localNodeInfo as { nodeId?: string; nodeNum?: number } | undefined;
    const nodeId = localNodeInfo?.nodeId ?? '';
    const nodeNum = localNodeInfo?.nodeNum ?? 0;
    // Find the gateway node in the nodes array to get hwModel
    const gatewayNode = (pollData?.nodes ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 poll nodes are untyped here (moved from FirmwareUpdateSection)
      (n: any) => n.nodeNum === nodeNum || n.user?.id === nodeId
    );
    return {
      // Issue #5424: `config` is the SELECTED source's connection (usePoll
      // scopes /api/poll by sourceId), so carry its TCP port too. The backend
      // and the meshtastic CLI both read `host:port`; the port is appended only
      // when it differs from the 4403 default.
      gatewayIp: buildOtaGateway(config?.meshtasticNodeIp, config?.meshtasticTcpPort),
      firmwareVersion: config?.deviceMetadata?.firmwareVersion ?? '',
      hwModel: gatewayNode?.user?.hwModel ?? 0,
      // #5677: false until this source's own node row carries a number. A
      // missing row or a null model is "not known yet", never UNSET. A source
      // with no local node (MQTT, MeshCore) has no identity to match a row by.
      hwModelReported:
        (nodeId !== '' || nodeNum !== 0) && typeof gatewayNode?.user?.hwModel === 'number',
      nodeId,
      nodeNum,
      // Issue #2981: track the active source's type so we can disable OTA on
      // sources that can't be reached via the OTA CLI's `--host` (BLE, serial,
      // virtual, mqtt, meshcore). `null` means single-source legacy mode.
      sourceType: (config?.meshtasticSourceType ?? null) as string | null,
      // A bridged node (serial/BLE-only radio fronted by a TCP proxy) reports no
      // native WiFi/Ethernet and cannot be flashed over the air, even though the
      // source is technically TCP. Detected server-side from DeviceMetadata.
      isBridged: (config?.deviceMetadata?.isBridged ?? false) as boolean,
    };
  }, [pollData]);

  // OTA firmware updates require a reachable TCP host AND a node that actually
  // has a native IP transport. A null sourceType is legacy single-source mode and
  // trusts MESHTASTIC_NODE_IP. A bridged node is reached over TCP but the radio
  // itself can't serve an OTA endpoint, so it is excluded.
  const isOtaSupported =
    (gatewayInfo.sourceType === null || gatewayInfo.sourceType === 'meshtastic_tcp') &&
    !!gatewayInfo.gatewayIp &&
    !gatewayInfo.isBridged;

  // #5677: hardware MeshMonitor cannot update at all (meshtasticd, a
  // simulator, an unmapped or non-OTA board) gets a card in place of the
  // update UI. The verdict comes from the same list OTA preflight enforces.
  //
  // The model must be settled first. On a first connect the local node row is
  // stored with hw model 0 until the node's own NodeInfo arrives, and firmware
  // sends that before DeviceMetadata. So a 0 counts as UNSET only once the
  // firmware version (from DeviceMetadata) is known; until then the pane stays
  // as it was, and a normal node never flashes the card while it loads.
  const hwModelSettled =
    gatewayInfo.hwModelReported && (gatewayInfo.hwModel !== 0 || !!gatewayInfo.firmwareVersion);
  const hardwareSupport = useMemo(
    () => (hwModelSettled ? firmwareUpdateSupport(gatewayInfo.hwModel) : null),
    [hwModelSettled, gatewayInfo.hwModel]
  );

  // Issue #3413: a node is considered recovered/reachable only when MeshMonitor
  // currently has a live connection AND the node is answering. This gates the
  // half-flash recovery action below — clearing the safety marker should only
  // happen once the device is actually back online and accepting connections.
  const connection = pollData?.connection;
  const isGatewayOnline = !!(connection?.connected && connection?.nodeResponsive);

  // Local state
  const [channel, setChannel] = useState<FirmwareChannel>('stable');
  const [customUrl, setCustomUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [showRejectedFiles, setShowRejectedFiles] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  // Issue #3413: when Safety Rail 5 (half-flash marker) blocks an OTA, hold the
  // affected nodeId so the wizard can show an inline recovery panel instead of
  // surfacing the raw "DELETE /api/firmware/recovery-marker/..." toast.
  const [halfFlashedNodeId, setHalfFlashedNodeId] = useState<string | null>(null);
  const [isClearingMarker, setIsClearingMarker] = useState(false);
  // #5249: local-file upload. `acknowledgedRisk` gates Install — MeshMonitor
  // cannot tell whether an uploaded binary belongs to this board, so the user
  // confirms that explicitly rather than us implying a check we didn't do.
  const [isUploading, setIsUploading] = useState(false);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref for auto-scrolling logs
  const logRef = useRef<HTMLPreElement>(null);

  // Query: firmware status (polls every 5s)
  const { data: statusData } = useQuery<FirmwareStatusResponse>({
    queryKey: ['firmware', 'status'],
    queryFn: async () => {
      const res = await csrfFetch(`${baseUrl}/api/firmware/status`);
      if (!res.ok) throw new Error('Failed to fetch firmware status');
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Query: firmware releases (staleTime: 60s)
  const { data: releasesData } = useQuery<FirmwareReleasesResponse>(firmwareReleasesQuery(csrfFetch, baseUrl));

  // Query: firmware backups
  const { data: backupsData } = useQuery<FirmwareBackupsResponse>({
    queryKey: ['firmware', 'backups'],
    queryFn: async () => {
      const res = await csrfFetch(`${baseUrl}/api/firmware/backups`);
      if (!res.ok) throw new Error('Failed to fetch firmware backups');
      return res.json();
    },
  });

  // Live status from Socket.IO (set by useWebSocket)
  const liveStatus = queryClient.getQueryData<UpdateStatus>(['firmware', 'liveStatus']);

  // Determine effective status: prefer live status, fall back to polled status
  const effectiveStatus: UpdateStatus | undefined = liveStatus ?? statusData?.status;

  // Sync channel/customUrl from server on initial load
  useEffect(() => {
    if (statusData) {
      setChannel(statusData.channel);
      setCustomUrl(statusData.customUrl || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 sync from the server when its saved channel changes (moved from FirmwareUpdateSection)
  }, [statusData?.channel, statusData?.customUrl]);

  // Auto-scroll log output
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [effectiveStatus?.logs]);

  const releases = releasesData?.releases ?? [];
  const backups = backupsData?.backups ?? [];
  const lastChecked = statusData?.lastChecked ?? null;
  // #5011: Install fetches whatever the SERVER has stored, so gate the button
  // on that rather than on unsaved text sitting in the input.
  const savedCustomUrl = statusData?.customUrl ?? '';

  // ---- Handlers ----

  const handleSaveChannel = async () => {
    setIsSavingChannel(true);
    try {
      const body: Record<string, string> = { channel };
      if (channel === 'custom') {
        body.customUrl = customUrl;
      }
      const res = await csrfFetch(`${baseUrl}/api/firmware/channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save channel');
      }
      // #5011: tell the operator when we rewrote a GitHub page URL into the
      // raw-content one, rather than silently storing something different
      // from what they typed.
      const saved = await res.json().catch(() => null);
      if (saved?.rewritten && saved?.customUrl) {
        setCustomUrl(saved.customUrl);
        showToast(
          t('firmware.custom_url_rewritten', 'Saved — GitHub page URL converted to its raw-content URL'),
          'success',
        );
      } else {
        showToast(t('firmware.channel', 'Release channel saved'), 'success');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'releases'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving channel', 'error');
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/check`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to check for updates');
      }
      showToast(t('firmware.check_now', 'Check complete'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'releases'] });
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error checking for updates', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const stagedUpload = statusData?.stagedUpload ?? null;

  /**
   * #5249: send the chosen `.bin` to the server, which holds it until Install.
   * Raw body + X-Firmware-Filename rather than multipart, matching the other
   * upload endpoints in the app.
   */
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so re-picking the SAME file fires change again.
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.bin')) {
      showToast(t('firmware.upload_not_bin', 'Firmware must be a .bin file'), 'error');
      return;
    }

    setIsUploading(true);
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Firmware-Filename': file.name,
        },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      // A new file invalidates the previous acknowledgement — the user is
      // confirming THIS binary, not whichever one they picked before.
      setAcknowledgedRisk(false);
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
      showToast(t('firmware.upload_ok', 'Firmware uploaded'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error uploading firmware', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDiscardUpload = async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/upload`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to discard upload');
      }
      setAcknowledgedRisk(false);
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error discarding upload', 'error');
    }
  };

  /** #5011: start the wizard against the saved custom URL. */
  const handleInstallCustomUrl = async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSource({
          useCustomUrl: true,
          gatewayIp: gatewayInfo.gatewayIp,
          hwModel: gatewayInfo.hwModel,
          currentVersion: gatewayInfo.firmwareVersion,
        })),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start update');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error starting update', 'error');
    }
  };

  /** #5249: start the wizard against the staged upload instead of a release. */
  const handleInstallUpload = async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSource({
          useStagedUpload: true,
          gatewayIp: gatewayInfo.gatewayIp,
          hwModel: gatewayInfo.hwModel,
          currentVersion: gatewayInfo.firmwareVersion,
        })),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start update');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error starting update', 'error');
    }
  };

  const handleInstall = async (release: FirmwareRelease) => {
    try {
      const body = withSource({
        targetVersion: release.version,
        gatewayIp: gatewayInfo.gatewayIp,
        hwModel: gatewayInfo.hwModel,
        currentVersion: gatewayInfo.firmwareVersion,
      });
      const res = await csrfFetch(`${baseUrl}/api/firmware/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start update');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error starting update', 'error');
    }
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const body = withSource({
        gatewayIp: effectiveStatus?.preflightInfo?.gatewayIp ?? gatewayInfo.gatewayIp,
        nodeId: gatewayInfo.nodeId,
      });
      const res = await csrfFetch(`${baseUrl}/api/firmware/update/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        // "No update step is awaiting confirmation" is a benign race condition —
        // the backend already advanced past this step. Just refetch silently.
        if (res.status === 400 && data.error?.includes('awaiting confirmation')) {
          void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
          return;
        }
        // Issue #3413: Safety Rail 5 blocked the flash because the node is
        // flagged half-flashed. Surface an inline recovery panel instead of the
        // raw API instructions so non-technical users can recover in one click.
        if (res.status === 409 && data.error?.includes('half-flashed')) {
          setHalfFlashedNodeId(gatewayInfo.nodeId);
          return;
        }
        throw new Error(data.error || 'Failed to confirm step');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error confirming step', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  // Issue #3413: clear the half-flash safety marker after a USB recovery, then
  // re-trigger the blocked confirm step. Includes a basic "node is online and
  // accepting connections" guard so the marker can't be cleared while the
  // device is still unreachable — the marker exists to protect a node that may
  // still be corrupted, so we require evidence it has actually recovered.
  const handleClearMarkerAndRetry = async () => {
    if (!halfFlashedNodeId || isClearingMarker) return;
    if (!isGatewayOnline) {
      showToast(
        t(
          'firmware.recovery_not_online',
          'Node is not online and accepting connections yet. Recover it via USB and wait for it to reconnect before clearing the flag.'
        ),
        'error'
      );
      return;
    }
    setIsClearingMarker(true);
    try {
      const res = await csrfFetch(
        `${baseUrl}/api/firmware/recovery-marker/${encodeURIComponent(halfFlashedNodeId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to clear recovery flag');
      }
      showToast(t('firmware.recovery_cleared', 'Recovery flag cleared'), 'success');
      setHalfFlashedNodeId(null);
      // Re-run the preflight confirm now that the marker is gone.
      await handleConfirm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error clearing recovery flag', 'error');
    } finally {
      setIsClearingMarker(false);
    }
  };

  const handleCancel = async () => {
    setHalfFlashedNodeId(null);
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/update/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSource({})),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel update');
      }
      showToast(t('firmware.wizard_cancel', 'Update cancelled'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error cancelling update', 'error');
    }
  };

  const handleDone = async () => {
    setHalfFlashedNodeId(null);
    const wasSuccess = effectiveStatus?.state === 'success';
    try {
      if (wasSuccess) {
        // Immediately show reconnecting state so the UI reflects the disconnect→reconnect cycle
        setConnectionStatus('connecting');
        // Successful update — full disconnect→reconnect cycle to re-download all node data
        await csrfFetch(`${baseUrl}/api/firmware/update/done`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(withSource({})),
        });
      } else {
        // Error dismiss — just reset state
        await csrfFetch(`${baseUrl}/api/firmware/update/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(withSource({})),
        });
      }
    } catch {
      // Best-effort — even if the call fails, clear local queries
    }
    // Invalidate everything so the UI refreshes with new node data
    void queryClient.invalidateQueries();
    queryClient.removeQueries({ queryKey: ['firmware', 'liveStatus'] });
  };

  const handleRetryFlash = async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/firmware/update/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withSource({})),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry flash');
      }
      void queryClient.invalidateQueries({ queryKey: ['firmware', 'status'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error retrying flash', 'error');
    }
  };

  /** Restores without asking (the caller asks first). */
  const restoreBackup = async (backup: FirmwareBackup) => {
    try {
      const body = {
        gatewayIp: effectiveStatus?.preflightInfo?.gatewayIp ?? gatewayInfo.gatewayIp,
        backupPath: backup.path,
      };
      const res = await csrfFetch(`${baseUrl}/api/firmware/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore backup');
      }
      showToast(t('firmware.restore_backup', 'Backup restored'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error restoring backup', 'error');
    }
  };

  // ---- Render helpers ----

  const formatTimestamp = (ts: number | null): string => {
    if (!ts) return t('firmware.never_checked', 'Never');
    return new Date(ts).toLocaleString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStepTitle = (step: UpdateStep): string => {
    if (!step) return '';
    const key = STEP_TITLES[step];
    return key ? t(key, step) : step;
  };

  const isUpdateActive = effectiveStatus && effectiveStatus.state !== 'idle';
  // One OTA runs at a time across all sources. When it belongs to a different
  // source, don't put that source's wizard over this page (its actions would be
  // refused as OTA_SOURCE_MISMATCH); say it is busy instead.
  const isOtherSourceUpdate = !!(
    isUpdateActive && sourceId && effectiveStatus?.sourceId && effectiveStatus.sourceId !== sourceId
  );
  // #5677: never put the card over a wizard that belongs to this page, or its
  // Cancel and Dismiss buttons would be out of reach.
  const unsupportedHardware =
    hardwareSupport && !hardwareSupport.supported && !(isUpdateActive && !isOtherSourceUpdate)
      ? hardwareSupport
      : null;


  return {
    t, sourceId, gatewayInfo, isOtaSupported, hardwareSupport, isGatewayOnline,
    channel, setChannel, customUrl, setCustomUrl, isChecking, isSavingChannel, showRejectedFiles, setShowRejectedFiles,
    isConfirming, halfFlashedNodeId, isClearingMarker, isUploading, acknowledgedRisk, setAcknowledgedRisk, fileInputRef, logRef,
    statusData, effectiveStatus, releases, backups, lastChecked, savedCustomUrl, stagedUpload,
    handleSaveChannel, handleCheckNow, handleFileSelected, handleDiscardUpload, handleInstallCustomUrl, handleInstallUpload,
    handleInstall, handleConfirm, handleClearMarkerAndRetry, handleCancel, handleDone, handleRetryFlash, restoreBackup,
    formatTimestamp, formatBytes, getStepTitle, isUpdateActive, isOtherSourceUpdate, unsupportedHardware,
  };
}
