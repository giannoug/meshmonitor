/**
 * Meshtastic node actions (#6365 Task 2.2): the node requests (traceroute,
 * NodeInfo/position exchange, telemetry, neighbor info), the favorite/
 * favorite-lock/ignored/hide-from-map toggles, position override and node
 * data purges, moved out of App.tsx and useSourceView unchanged so the
 * Workspace can call the same code.
 *
 * The public methods take a node number. Classic's call sites pass a node id
 * (`!xxxxxxxx`, or a MeshCore public key for neighbor info) and key their
 * loading spinners by it, so the id-keyed originals stay reachable through
 * `byNodeId`. Click-event handling (stopPropagation) and confirmation prompts
 * stay with the caller.
 */
import { useCallback, useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DeviceInfo } from '../types/device';
import { useToast } from '../components/ToastContainer';
import { useSource } from '../contexts/SourceContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { AuthContext } from '../contexts/AuthContext';
import { useNodes, setNodeFieldInCache } from './useServerData';
import { sourcePollQueryKey } from './pollQueryKey';
import apiService from '../services/api';
import { logger } from '../utils/logger';
import { isTxDisabledBody } from '../utils/txDisabled';
import { resolveNeighborInfoErrorToast } from '../utils/neighborInfoError';
import { nodeIdFromNum } from '../utils/mentions';
import {
  favoritePendingKey,
  pendingFavoriteRequests,
  pendingIgnoredRequests,
  pendingHideFromMapRequests,
} from '../utils/pendingToggles';

export type TelemetryRequestType = 'device' | 'environment' | 'airQuality' | 'power';

/** Body of POST /api/nodes/:id/position-override, as PositionOverrideModal sends it. */
export interface PositionOverride {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  isPrivate?: boolean;
}

/** Which node data to purge — one of PurgeDataModal's purge buttons. */
export interface PurgeOptions {
  what: 'traceroutes' | 'telemetry' | 'positionHistory';
}

const PURGE_KINDS = {
  traceroutes: { path: 'traceroutes', done: 'toast.purged_traceroutes', failed: 'toast.failed_purge_traceroutes' },
  telemetry: { path: 'telemetry', done: 'toast.purged_telemetry', failed: 'toast.failed_purge_telemetry' },
  positionHistory: {
    path: 'position-history',
    done: 'toast.purged_position_history',
    failed: 'toast.failed_purge_position_history',
  },
} as const;

/** Aircraft mark choices; the request body names them as AircraftMarkMenuItems does. */
const AIRCRAFT_MODES = { aircraft: 'aircraft', not: 'not_aircraft', clear: 'clear' } as const;

export interface MeshtasticNodeActionsOptions {
  /** The deployment base path (`appBasename`). */
  baseUrl: string;
  /** CSRF-aware fetch wrapper. */
  authFetch: (url: string, options?: RequestInit, retryCount?: number, timeoutMs?: number) => Promise<Response>;
  /** Refetch fn from the source's usePoll() call. */
  refetchPoll: () => unknown;
  /**
   * useCsrfFetch()'s fetch, for scanForAdmin (MessagesTab scans with it: no
   * client timeout, and the scan can outlast authFetch's 10 s). Optional
   * because useSourceView's instance never scans and has no CsrfProvider in
   * its tests; without it the scan falls back to authFetch.
   */
  csrfFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function useMeshtasticNodeActions(options: MeshtasticNodeActionsOptions) {
  const { baseUrl, authFetch, refetchPoll, csrfFetch = authFetch } = options;

  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId, sourceType } = useSource();
  const { connectionStatus } = useData();
  const { setTracerouteLoading } = useUI();
  // useContext, not useAuth(): useSourceView's tests render without an AuthProvider.
  const authStatus = useContext(AuthContext)?.authStatus;
  const { nodes } = useNodes();
  const queryClient = useQueryClient();
  const isMeshCoreSource = sourceType === 'meshcore';

  // Per-request loading state, keyed by node id (moved from App.tsx).
  // Position exchange loading state (separate from traceroute loading)
  const [positionLoading, setPositionLoading] = useState<string | null>(null);

  // NodeInfo exchange loading state (for key exchange / user info request)
  const [nodeInfoLoading, setNodeInfoLoading] = useState<string | null>(null);

  // NeighborInfo request loading state
  const [neighborInfoLoading, setNeighborInfoLoading] = useState<string | null>(null);

  // Telemetry request loading state
  const [telemetryRequestLoading, setTelemetryRequestLoading] = useState<string | null>(null);

  const tracerouteById = useCallback(
    async (nodeId: string, channel?: number) => {
      if (connectionStatus !== 'connected') {
        return;
      }

      try {
        // Set loading state
        setTracerouteLoading(nodeId);

        // Convert nodeId to node number
        const nodeNumStr = nodeId.replace('!', '');
        const nodeNum = parseInt(nodeNumStr, 16);

        const response = await authFetch(`${baseUrl}/api/traceroute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ destination: nodeNum, sourceId, ...(channel !== undefined && { channel }) }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setTracerouteLoading(null);
          if (isTxDisabledBody(response.status, errorData)) {
            showToast(t('tx_disabled.send_blocked_toast'), 'warning');
          }
          return;
        }

        logger.debug(`🗺️ Traceroute request sent to ${nodeId}`);

        // Poll for traceroute results with increasing delays
        // This provides faster UI feedback instead of waiting for the 5s poll interval
        const pollDelays = [2000, 5000, 10000, 15000]; // 2s, 5s, 10s, 15s
        pollDelays.forEach(delay => {
          setTimeout(() => {
            void refetchPoll();
          }, delay);
        });

        // Clear loading state after 30 seconds
        setTimeout(() => {
          setTracerouteLoading(null);
        }, 30000);
      } catch (error) {
        logger.error('Failed to send traceroute:', error);
        setTracerouteLoading(null);
      }
    },
    [connectionStatus, setTracerouteLoading, authFetch, baseUrl, sourceId, refetchPoll, showToast, t]
  );

  const exchangePositionById = async (nodeId: string, channel?: number) => {
    if (connectionStatus !== 'connected') {
      return;
    }

    // Prevent duplicate requests (debounce logic)
    if (positionLoading === nodeId) {
      logger.debug(`📍 Position exchange already in progress for ${nodeId}`);
      return;
    }

    try {
      // Set loading state using dedicated position loading state
      setPositionLoading(nodeId);

      // Convert nodeId to node number for backend
      const nodeNumStr = nodeId.replace('!', '');
      const nodeNum = parseInt(nodeNumStr, 16);

      // Use direct fetch with CSRF token (consistent with other message endpoints)
      const response = await authFetch(`${baseUrl}/api/position/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destination: nodeNum, sourceId: sourceId || undefined, ...(channel !== undefined && { channel }) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setPositionLoading(null);
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
        }
        return;
      }

      logger.debug(`📍 Position request sent to ${nodeId}`);

      // Trigger a poll to refresh messages immediately
      setTimeout(() => {
        // The poll will run and fetch the new system message
        // We use a small delay to ensure the backend has finished writing to DB
      }, 500);

      // Clear loading state after 30 seconds
      setTimeout(() => {
        setPositionLoading(null);
      }, 30000);
    } catch (error) {
      logger.error('Failed to send position request:', error);
      setPositionLoading(null);
    }
  };

  const exchangeNodeInfoById = async (nodeId: string, channel?: number) => {
    if (connectionStatus !== 'connected') {
      return;
    }

    // Prevent duplicate requests (debounce logic)
    if (nodeInfoLoading === nodeId) {
      logger.debug(`🔑 NodeInfo exchange already in progress for ${nodeId}`);
      return;
    }

    try {
      // Set loading state
      setNodeInfoLoading(nodeId);

      // Convert nodeId to node number for backend
      const nodeNumStr = nodeId.replace('!', '');
      const nodeNum = parseInt(nodeNumStr, 16);

      // Use direct fetch with CSRF token
      const response = await authFetch(`${baseUrl}/api/nodeinfo/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destination: nodeNum, sourceId: sourceId || undefined, ...(channel !== undefined && { channel }) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setNodeInfoLoading(null);
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
        }
        return;
      }

      logger.debug(`🔑 NodeInfo request sent to ${nodeId}`);

      // Clear loading state after 30 seconds
      setTimeout(() => {
        setNodeInfoLoading(null);
      }, 30000);
    } catch (error) {
      logger.error('Failed to send nodeinfo request:', error);
      setNodeInfoLoading(null);
    }
  };

  const requestNeighborInfoById = async (nodeId: string) => {
    if (connectionStatus !== 'connected') {
      return;
    }

    // Prevent duplicate requests (debounce logic)
    if (neighborInfoLoading === nodeId) {
      logger.debug(`🏠 NeighborInfo request already in progress for ${nodeId}`);
      return;
    }

    try {
      // Set loading state
      setNeighborInfoLoading(nodeId);

      let response: Response;
      if (sourceType === 'meshcore' && sourceId) {
        const normalized = nodeId.toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(normalized)) {
          logger.warn(`🏠 Invalid MeshCore publicKey: ${nodeId.substring(0, 16)}…`);
          setNeighborInfoLoading(null);
          return;
        }
        response = await authFetch(`${baseUrl}/api/sources/${sourceId}/meshcore/neighbors/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: normalized }),
        });
        logger.debug(`🏠 MeshCore neighbors request sent for ${normalized.substring(0, 16)}…`);
      } else {
        // Meshtastic: convert hex nodeId to numeric destination
        const nodeNumStr = nodeId.replace('!', '');
        const nodeNum = parseInt(nodeNumStr, 16);
        response = await authFetch(`${baseUrl}/api/neighborinfo/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: nodeNum, sourceId: sourceId || undefined }),
        });
        logger.debug(`🏠 NeighborInfo request sent to ${nodeId}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setNeighborInfoLoading(null);
        if (isTxDisabledBody(response.status, errorData)) {
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
        } else {
          // #4568: every other rejection — 403 (node is multi-hop, so not
          // eligible) and 429 (rate limited) chief among them — used to fall
          // straight through to `return` with no toast. The spinner cleared
          // correctly, but on a LAN the round trip is milliseconds, so the
          // button just flashed and the user was told nothing.
          const toast = resolveNeighborInfoErrorToast(response.status, errorData, t('errors.unknown'));
          showToast(t(toast.key, toast.params ?? {}), toast.variant);
        }
        return;
      }

      // Clear loading state after 30 seconds
      setTimeout(() => {
        setNeighborInfoLoading(null);
      }, 30000);
    } catch (error) {
      logger.error('Failed to send neighborinfo request:', error);
      setNeighborInfoLoading(null);
    }
  };

  const requestTelemetryById = async (nodeId: string, telemetryType: TelemetryRequestType) => {
    if (connectionStatus !== 'connected') {
      return;
    }

    // Prevent duplicate requests (debounce logic)
    if (telemetryRequestLoading === nodeId) {
      logger.debug(`📊 Telemetry request already in progress for ${nodeId}`);
      return;
    }

    try {
      // Set loading state
      setTelemetryRequestLoading(nodeId);

      // Convert nodeId to node number for backend
      const nodeNumStr = nodeId.replace('!', '');
      const nodeNum = parseInt(nodeNumStr, 16);

      // Use direct fetch with CSRF token. Pass sourceId so the request is routed
      // through the correct source's manager AND the destination channel is looked
      // up on that source (issue #3573) — omitting it let the backend cross-source
      // match a wrong channel and send the request unanswerably.
      const response = await authFetch(`${baseUrl}/api/telemetry/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destination: nodeNum, telemetryType, sourceId: sourceId || undefined }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        if (isTxDisabledBody(response.status, detail)) {
          setTelemetryRequestLoading(null);
          showToast(t(isMeshCoreSource ? 'meshcore.receive_only.blocked_toast' : 'tx_disabled.send_blocked_toast'), 'warning');
          return;
        }
        throw new Error(detail.error || `Telemetry request failed (${response.status})`);
      }

      logger.debug(`📊 Telemetry request (${telemetryType}) sent to ${nodeId}`);

      // Clear loading state after 30 seconds
      setTimeout(() => {
        setTelemetryRequestLoading(null);
      }, 30000);
    } catch (error) {
      // The throw above and a genuine network failure both land here, and this
      // used to only log — so a rejected telemetry request cleared its spinner
      // and told the user nothing: the same silent-failure shape fixed for
      // neighbor info in #4568. Unlike that endpoint there is no 403/429 to
      // explain specially — the server answers 400 (validation), 503 (not
      // connected) or 500 — so its own message is the most specific thing
      // available and gets surfaced directly.
      logger.error('Failed to send telemetry request:', error);
      setTelemetryRequestLoading(null);
      showToast(
        t('toast.telemetry_request_failed', {
          error: error instanceof Error ? error.message : t('errors.network'),
        }),
        'error',
      );
    }
  };

  // Function to toggle node favorite status
  const toggleFavorite = useCallback(
    async (node: DeviceInfo) => {
      if (!node.user?.id) {
        logger.error('Cannot toggle favorite: node has no user ID');
        return;
      }

      // Prevent multiple rapid clicks on the same node (scoped to current source)
      const favKey = favoritePendingKey(sourceId, node.nodeNum);
      if (pendingFavoriteRequests.get(favKey) !== undefined) {
        return;
      }

      // Store the original state before any updates
      const originalFavoriteStatus = node.isFavorite;
      const newFavoriteStatus = !originalFavoriteStatus;

      try {
        // Mark this request as pending with the expected new state
        pendingFavoriteRequests.set(favKey, newFavoriteStatus);

        // Optimistically update the UI by writing straight into the poll
        // query cache. useNodes() re-derives (via applyPendingNodeOverrides)
        // on every cache change, so this renders immediately and survives
        // the next poll response until the server catches up.
        setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isFavorite: newFavoriteStatus });

        // Send update to backend (with device sync enabled by default)
        const response = await authFetch(`${baseUrl}/api/nodes/${node.user.id}/favorite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isFavorite: newFavoriteStatus,
            syncToDevice: true, // Enable two-way sync to Meshtastic device
            sourceId,
          }),
        });

        if (!response.ok) {
          if (response.status === 403) {
            showToast(t('toast.insufficient_permissions_favorites'), 'error');
            // Revert to original state using the saved original value
            setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isFavorite: originalFavoriteStatus });
            return;
          }
          throw new Error('Failed to update favorite status');
        }

        const result = await response.json();

        // Log the result including device sync status
        let statusMessage = `${newFavoriteStatus ? '⭐' : '☆'} Node ${node.user.id} favorite status updated`;
        if (result.deviceSync) {
          if (result.deviceSync.status === 'success') {
            statusMessage += ' (synced to device ✓)';
          } else if (result.deviceSync.status === 'failed') {
            // Only show error for actual failures (not firmware compatibility)
            statusMessage += ` (device sync failed: ${result.deviceSync.error || 'unknown error'})`;
          }
          // 'skipped' status (e.g., pre-2.7 firmware) is not shown to user - logged on server only
        }
        logger.debug(statusMessage);
      } catch (error) {
        logger.error('Error toggling favorite:', error);
        // Revert to original state using the saved original value
        setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isFavorite: originalFavoriteStatus });
        // Remove from pending on error since we reverted
        pendingFavoriteRequests.delete(favKey);
        showToast(t('toast.failed_update_favorite'), 'error');
      }
      // Note: On success, the polling logic will remove from pendingFavoriteRequests
      // when it detects the server has caught up
    },
    [sourceId, queryClient, authFetch, baseUrl, showToast, t]
  );

  // Function to toggle node favorite lock status
  const toggleFavoriteLock = useCallback(
    async (node: DeviceInfo) => {
      if (!node.user?.id) {
        logger.error('Cannot toggle favorite lock: node has no user ID');
        return;
      }

      const newLocked = !node.favoriteLocked;

      try {
        // Optimistically update the UI — write straight into the poll query
        // cache (#3962 5.4 PR8); useNodes() picks it up on next render.
        setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { favoriteLocked: newLocked });

        const response = await authFetch(`${baseUrl}/api/nodes/${node.user.id}/favorite-lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: newLocked, sourceId }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        logger.debug(`${newLocked ? '🔒' : '🔓'} Node ${node.user.id} favorite lock set to: ${newLocked}`);
      } catch (error) {
        logger.error('Error toggling favorite lock:', error);
        // Revert
        setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { favoriteLocked: !newLocked });
        showToast(t('toast.failed_update_favorite_lock', 'Failed to update favorite lock'), 'error');
      }
    },
    [queryClient, authFetch, baseUrl, sourceId, showToast, t]
  );

  // Function to toggle node ignored status
  const toggleIgnored = async (node: DeviceInfo) => {
    if (!node.user?.id) {
      logger.error('Cannot toggle ignored: node has no user ID');
      return;
    }

    // Prevent multiple rapid clicks on the same node (scoped to current source)
    const ignKey = favoritePendingKey(sourceId, node.nodeNum);
    if (pendingIgnoredRequests.get(ignKey) !== undefined) {
      return;
    }

    // Store the original state before any updates
    const originalIgnoredStatus = node.isIgnored;
    const newIgnoredStatus = !originalIgnoredStatus;

    try {
      // Mark this request as pending with the expected new state
      pendingIgnoredRequests.set(ignKey, newIgnoredStatus);

      // Optimistically update the UI by writing straight into the poll
      // query cache (#3962 5.4 PR8) — useNodes() re-derives via
      // applyPendingNodeOverrides on every cache change.
      setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isIgnored: newIgnoredStatus });

      // Send update to backend (with device sync enabled by default)
      const response = await authFetch(`${baseUrl}/api/nodes/${node.user.id}/ignored`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isIgnored: newIgnoredStatus,
          syncToDevice: true, // Enable two-way sync to Meshtastic device
          sourceId,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          showToast(t('toast.insufficient_permissions_ignored'), 'error');
          // Revert to original state using the saved original value
          setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isIgnored: originalIgnoredStatus });
          return;
        }
        throw new Error('Failed to update ignored status');
      }

      const result = await response.json();

      // Log the result including device sync status
      let statusMessage = `${newIgnoredStatus ? '🚫' : '✅'} Node ${node.user.id} ignored status updated`;
      if (result.deviceSync) {
        if (result.deviceSync.status === 'success') {
          statusMessage += ' (synced to device ✓)';
        } else if (result.deviceSync.status === 'failed') {
          // Only show error for actual failures (not firmware compatibility)
          statusMessage += ` (device sync failed: ${result.deviceSync.error || 'unknown error'})`;
        }
        // 'skipped' status (e.g., pre-2.7 firmware) is not shown to user - logged on server only
      }
      logger.debug(statusMessage);
    } catch (error) {
      logger.error('Error toggling ignored:', error);
      // Revert to original state using the saved original value
      setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { isIgnored: originalIgnoredStatus });
      // Remove from pending on error since we reverted
      pendingIgnoredRequests.delete(ignKey);
      showToast(t('toast.failed_update_ignored'), 'error');
    }
    // Note: On success, the polling logic will remove from pendingIgnoredRequests
    // when it detects the server has caught up
  };

  // Toggle the per-node "Hide from Map" flag (issue #3549). Display-only: the
  // node stays visible everywhere except map markers. Mirrors toggleIgnored's
  // optimistic-update + per-source pending-request pattern, minus device sync.
  //
  // #4137: App.tsx (this hook's original home) is only ever mounted per-source (via SourceProvider under
  // /source/:sourceId/*) — there is no separate "unified" caller of this
  // toggle today. But since mergeNodesAcrossSources now ORs hideFromMap across
  // sources for every cross-source consumer (Dashboard, Map Analysis, the
  // unified node list — see mergeNodesAcrossSources.ts), a node stays hidden
  // there forever unless EVERY source that ever hid it gets cleared. A
  // per-source-only clear reproduces the exact "can't un-hide" bug reported
  // in #4137. This is the only hide/show entry point in the UI, so it always
  // converges the flag across every source for this nodeNum (allSources:
  // true) rather than only the row for the currently-viewed source.
  // sourceId is still sent and still required server-side — it remains the
  // permission anchor for the write, just not the update scope.
  const toggleHideFromMap = async (node: DeviceInfo) => {
    if (!node.user?.id) {
      logger.error('Cannot toggle hideFromMap: node has no user ID');
      return;
    }

    const hfmKey = favoritePendingKey(sourceId, node.nodeNum);
    if (pendingHideFromMapRequests.get(hfmKey) !== undefined) {
      return;
    }

    const originalStatus = Boolean(node.hideFromMap);
    const newStatus = !originalStatus;

    try {
      pendingHideFromMapRequests.set(hfmKey, newStatus);

      // Optimistically update the UI by writing straight into the poll
      // query cache (#3962 5.4 PR8) — useNodes() re-derives via
      // applyPendingNodeOverrides on every cache change.
      setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { hideFromMap: newStatus });

      const response = await authFetch(`${baseUrl}/api/nodes/${node.user.id}/hide-from-map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hideFromMap: newStatus,
          sourceId,
          allSources: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          showToast(t('toast.insufficient_permissions_hide_from_map', 'You do not have permission to change map visibility'), 'error');
          setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { hideFromMap: originalStatus });
          pendingHideFromMapRequests.delete(hfmKey);
          return;
        }
        throw new Error('Failed to update hideFromMap status');
      }

      logger.debug(`🗺️ Node ${node.user.id} hideFromMap → ${newStatus}`);
    } catch (error) {
      logger.error('Error toggling hideFromMap:', error);
      setNodeFieldInCache(queryClient, sourceId, node.nodeNum, { hideFromMap: originalStatus });
      pendingHideFromMapRequests.delete(hfmKey);
      showToast(t('toast.failed_update_hide_from_map', 'Failed to update map visibility'), 'error');
    }
    // Note: On success, the polling logic will remove from pendingHideFromMapRequests
    // when it detects the server has caught up
  };

  const overridePosition = async (nodeNum: number, pos: PositionOverride | null) => {
    const data = pos ?? { enabled: false };
    const node = nodes.find(n => n.nodeNum === nodeNum);
    const nodeId = node?.user?.id;
    if (!nodeId) {
      throw new Error('Node not found');
    }

    const response = await authFetch(`${baseUrl}/api/nodes/${nodeId}/position-override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...data, sourceId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save position override');
    }

    showToast(t('position_override.save_success'), 'success');
    // Refresh data to get updated position
    void refetchPoll();
  };

  const purgeNodeData = async (nodeNum: number, opts: PurgeOptions) => {
    const kind = PURGE_KINDS[opts.what];
    const node = nodes.find(n => n.nodeNum === nodeNum);
    const nodeName = node?.user?.shortName || node?.user?.longName || `Node ${nodeNum}`;

    try {
      const response = await authFetch(`${baseUrl}/api/messages/nodes/${nodeNum}/${kind.path}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast(t(kind.done, { count: data.deletedCount, node: nodeName }), 'success');
        // Refresh data from backend to ensure consistency
        void refetchPoll();
      } else {
        const errorData = await response.json();
        showToast(t(kind.failed, { error: errorData.message || t('errors.unknown') }), 'error');
      }
    } catch (err) {
      showToast(
        t(kind.failed, { error: err instanceof Error ? err.message : t('errors.network') }),
        'error'
      );
    }
  };

  // Same request as MessagesTab's handleScanForAdmin, which stays in place.
  const scanForAdmin = async (nodeNum: number) => {
    try {
      const scanQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
      const response = await csrfFetch(`${baseUrl}/api/nodes/${nodeNum}/scan-remote-admin${scanQuery}`, {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 403) {
          showToast(t('messages.scan_admin_permission_denied'), 'error');
          return;
        }
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      if (result.hasRemoteAdmin) {
        const firmware = result.metadata?.firmwareVersion || t('common.unknown');
        showToast(t('messages.scan_admin_success', { firmware }), 'success');
      } else {
        showToast(t('messages.scan_admin_no_access'), 'warning');
      }
    } catch (error) {
      logger.error('Failed to scan for admin:', error);
      showToast(t('messages.scan_admin_failed'), 'error');
    }
  };

  // Same request and cache patch as AircraftMarkMenuItems, which stays in
  // place. Rejects with the API error (its `code` names the reason); the
  // toasts stay with the caller.
  const markAircraft = async (nodeNum: number, mark: keyof typeof AIRCRAFT_MODES, allSources: boolean) => {
    if (!sourceId) return;
    const mode = AIRCRAFT_MODES[mark];
    const body = allSources ? { sourceId, nodeNum, mode, allSources: true } : { sourceId, nodeNum, mode };
    await apiService.post('/api/aircraft/mark', body);
    const now = Date.now();
    const by = authStatus?.user?.id ?? null;
    const patch: Partial<DeviceInfo> =
      mode === 'not_aircraft'
        ? { likelyAircraft: false, aircraftManualMark: 'not_aircraft', aircraftManualMarkAt: now, aircraftManualMarkBy: by, aircraftFixedAt: now }
        : mode === 'aircraft'
          ? { likelyAircraft: true, aircraftManualMark: 'aircraft', aircraftManualMarkAt: now, aircraftManualMarkBy: by, aircraftFixedAt: null }
          : { aircraftManualMark: null, aircraftManualMarkAt: null, aircraftManualMarkBy: null, aircraftFixedAt: null };
    setNodeFieldInCache(queryClient, sourceId, nodeNum, patch);
    void queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) });
  };

  return {
    traceroute: (nodeNum: number, channel?: number) => tracerouteById(nodeIdFromNum(nodeNum), channel),
    exchangeNodeInfo: (nodeNum: number, channel?: number) => exchangeNodeInfoById(nodeIdFromNum(nodeNum), channel),
    exchangePosition: (nodeNum: number, channel?: number) => exchangePositionById(nodeIdFromNum(nodeNum), channel),
    // The server picks the channel for telemetry requests, so none is sent (as today).
    requestTelemetry: (nodeNum: number, type: TelemetryRequestType, _channel?: number) =>
      requestTelemetryById(nodeIdFromNum(nodeNum), type),
    requestNeighborInfo: (nodeNum: number) => requestNeighborInfoById(nodeIdFromNum(nodeNum)),
    scanForAdmin,
    toggleFavorite,
    toggleFavoriteLock,
    toggleIgnored,
    toggleHideFromMap,
    markAircraft,
    overridePosition,
    purgeNodeData,
    byNodeId: {
      traceroute: tracerouteById,
      exchangePosition: exchangePositionById,
      exchangeNodeInfo: exchangeNodeInfoById,
      requestNeighborInfo: requestNeighborInfoById,
      requestTelemetry: requestTelemetryById,
    },
    loading: {
      position: positionLoading,
      nodeInfo: nodeInfoLoading,
      neighborInfo: neighborInfoLoading,
      telemetry: telemetryRequestLoading,
    },
  };
}

export type MeshtasticNodeActions = ReturnType<typeof useMeshtasticNodeActions>;
