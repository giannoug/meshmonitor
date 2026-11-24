/**
 * The remote target of a device's settings (Task 5.9, boards b-set-d6,
 * 12-11, 12-20, 12-25, 12-29): what Admin Commands does for its selected
 * node, for the Workspace's categories. The frame holds one per chosen node
 * (RemoteTarget.tsx); pages read it with `useRemoteTarget()`.
 *
 * - The values read from the node are their own set (Ruling DG): a second
 *   useDeviceConfigState that never loads from this radio, dropped when the
 *   target changes, so "This radio" still shows the local values untouched.
 * - Nothing is read on its own. Picking a node sends one passkey status read
 *   (asks the server, sends nothing on the mesh); Read from node sends today's
 *   request for one category, after today's ensureSessionPasskey.
 * - Send to node is today's admin command per changed category, one after
 *   another, never retried here (the server's attempts setting applies, or
 *   this page's Attempts, as today).
 * - The only timer is today's passkey countdown: local, 1 s, no requests.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useToast } from '../../../components/ToastContainer';
import { mqttRootErrorMessage } from '../../../components/MQTT/mqttRootApiError';
import { createChannelFromResponse, createEmptyChannelSlot } from '../../../components/admin-commands/channelLoadingUtils';
import type { ConfigSaveSection } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import apiService, { ApiError, type AdminCommandAck } from '../../../services/api';
import type { Channel } from '../../../types/device';
import { isTxDisabledError } from '../../../utils/txDisabled';
import { CATEGORIES, type CategoryTarget } from '../categories';
import { applyRemoteConfig, applyRemoteOwner, LOAD_ALL_ORDER, REMOTE_READS, remoteCommand } from './remoteConfig';
import { remoteEntry, updateRemote, useRemoteEntry, type PasskeyState, type RemoteNode, type SendStatus } from './remoteTargetStore';

export type SendOutcome = 'sent' | 'noReply';

export interface DeviceMetadata {
  firmwareVersion: string;
  deviceStateVersion: number;
  canShutdown: boolean | null;
  hasWifi: boolean;
  hasBluetooth: boolean;
  hasEthernet: boolean;
  role: number;
  positionFlags: number;
  hwModel: number;
  hasRemoteHardware: boolean;
  hasXeddsa?: boolean;
  bleAddress?: string;
}

type AdminResult = { success: boolean; message?: string; ack?: AdminCommandAck; data?: { message?: string } };

export interface RemoteTargetApi {
  target: CategoryTarget;
  node: RemoteNode;
  /** The source's other nodes, in today's order (nodeOptionsUtils). */
  nodes: RemoteNode[];
  setTarget(next: number | 'local'): void;
  passkeyState: PasskeyState | null;
  /** The node's values (Ruling DG), for the frame's remote config. */
  state: DeviceConfigState;
  readCategory(id: string): Promise<void>;
  /** The category being read, or 'all' during Load All Config. */
  reading: string | null;
  loadAll(): Promise<void>;
  progress: { current: number; total: number; id: string } | null;
  lastRead: Record<string, number>;
  /** Sends `id`'s queued values as today's admin command. Throws (after today's toast) when nothing went out. */
  sendCategory(id: string): Promise<SendOutcome>;
  channels: Channel[] | null;
  setChannel(channel: Channel): void;
  /** Today's per-send attempts override (#4487): null uses the Remote Administration setting. */
  attempts: number | null;
  setAttempts(n: number | null): void;
  metadata: DeviceMetadata | null;
  retrieveMetadata(): Promise<void>;
  setTime(): Promise<void>;
  busy: 'metadata' | 'time' | null;
  /** Today's executeCommand for this node: toasts its result, throws after toasting a failure. */
  execute(command: string, params?: Record<string, unknown>): Promise<AdminResult>;
  /** Transmit is off on this source: today's notice replaces the remote actions (#4294). */
  blocked: boolean;
  /**
   * Favourite / ignored as set from this session (Node management): today's
   * admin protocol cannot read them back, so nothing else is known.
   */
  nodeStatus: Record<number, { isFavorite?: boolean; isIgnored?: boolean }>;
  setNodeStatus(nodeNum: number, patch: { isFavorite?: boolean; isIgnored?: boolean }): void;
  /** A category's status in the settings list, for sends outside the queue (a channel's own Save). */
  markSent(id: string, status: SendStatus | undefined): void;
}

export const RemoteTargetContext = createContext<RemoteTargetApi | null>(null);

/** The device's remote target, or null while its settings configure its own radio. */
export const useRemoteTarget = () => useContext(RemoteTargetContext);

/** "Sends 1 request to Hilltop Relay over the mesh, 3 hops". */
export function useReadSends(id: string): string {
  const { t } = useTranslation();
  const remote = useContext(RemoteTargetContext);
  if (!remote) return '';
  const { node } = remote;
  const hops = node.hopsAway != null ? t('workspace.settings.remote.hops_suffix', { count: node.hopsAway }) : '';
  // With no live session passkey the server asks the node for one first: one request more (M3).
  const p = remote.passkeyState;
  const passkey = p?.hasPasskey && p.remainingSeconds !== null ? '' : t('workspace.settings.remote.passkey_sends');
  return t('workspace.settings.remote.read_sends', { count: REMOTE_READS[id] === 'channels' ? 8 : 1, name: node.longName }) + passkey + hops;
}

/** Today's `/api/admin/session-passkey-status` reply. */
type PasskeyStatus = { isLocalNode?: boolean; hasPasskey: boolean; remainingSeconds: number | null };

/**
 * Picks the target through the URL only (useTargetNode keeps the store in step): `?node=!xxxxxxxx`
 * for a node, and an empty `?node=` for this radio, which outranks the node picked before.
 */
export function useSetRemoteTarget(sourceId: string, nodes: RemoteNode[]) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  return useCallback(
    (next: number | 'local') => {
      const node = next === 'local' ? null : nodes.find((n) => n.nodeNum === next) ?? null;
      updateRemote(sourceId, { pickerOpen: false });
      void navigate({ pathname, search: `?node=${node ? node.nodeId : ''}`, hash }, { replace: true });
    },
    [sourceId, nodes, navigate, pathname, hash],
  );
}

/** Today's passkey line for the chosen node (AdminCommandsTab). */
export function passkeyLine(t: TFunction, node: RemoteNode | null, passkey: PasskeyState | null): string {
  if (!node) return t('admin_commands.local_node_no_passkey');
  if (passkey?.hasPasskey && passkey.remainingSeconds !== null) return t('admin_commands.remote_node_passkey_acquired', { seconds: passkey.remainingSeconds });
  return t('admin_commands.remote_node_passkey');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sectionOf = (id: string) => CATEGORIES.find((c) => c.id === id)?.saveSection;

export function useRemoteTargetState({
  sourceId,
  node,
  nodes,
  state,
  blocked,
  setTarget,
  rebase,
}: {
  sourceId: string;
  node: RemoteNode;
  nodes: RemoteNode[];
  state: DeviceConfigState;
  blocked: boolean;
  setTarget(next: number | 'local'): void;
  /** The queue's baseline for a section moves to what was just read. */
  rebase(section: ConfigSaveSection): void;
}): RemoteTargetApi {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entry = useRemoteEntry(sourceId);
  const { nodeNum } = node;
  const [reading, setReading] = useState<string | null>(null);
  const [progress, setProgress] = useState<RemoteTargetApi['progress']>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);
  const [busy, setBusy] = useState<RemoteTargetApi['busy']>(null);
  const [nodeStatus, setStatuses] = useState<RemoteTargetApi['nodeStatus']>({});
  const latest = useRef(state);
  latest.current = state;

  // Today's passkey status: one read when the node is picked, then a local countdown (no requests).
  useEffect(() => {
    let live = true;
    apiService
      .post<PasskeyStatus>('/api/admin/session-passkey-status', { nodeNum, sourceId })
      .then((r) => {
        if (live) updateRemote(sourceId, { passkey: r.isLocalNode ? null : { hasPasskey: r.hasPasskey, remainingSeconds: r.remainingSeconds } });
      })
      .catch(() => {
        // Informational, as today.
      });
    const tick = setInterval(() => {
      // Nothing to count: no store write, so nothing re-renders (M1).
      const p = remoteEntry(sourceId).passkey;
      if (!p || p.remainingSeconds === null) return;
      updateRemote(sourceId, {
        passkey: p.remainingSeconds - 1 <= 0 ? { hasPasskey: false, remainingSeconds: null } : { ...p, remainingSeconds: p.remainingSeconds - 1 },
      });
    }, 1000);
    return () => {
      live = false;
      clearInterval(tick);
    };
  }, [sourceId, nodeNum]);

  const ensurePasskey = useCallback(async () => {
    try {
      const r = await apiService.ensureSessionPasskey<{ success: boolean; hasPasskey: boolean; remainingSeconds: number | null }>({ nodeNum, sourceId });
      if (r.hasPasskey) updateRemote(sourceId, { passkey: { hasPasskey: true, remainingSeconds: r.remainingSeconds } });
    } catch (error) {
      throw new Error(t('admin_commands.failed_session_passkey', { error: (error as Error).message }), { cause: error });
    }
  }, [nodeNum, sourceId, t]);

  const markRead = useCallback(
    (id: string) => {
      updateRemote(sourceId, (e) => ({ lastRead: { ...e.lastRead, [id]: Date.now() } }));
      const section = sectionOf(id);
      if (section) rebase(section);
    },
    [sourceId, rebase],
  );

  /** One read of one category; true when the node answered. Toasts nothing (the callers do). */
  const readOne = useCallback(
    async (id: string): Promise<boolean> => {
      const type = REMOTE_READS[id];
      if (type === 'owner') {
        const r = await apiService.post<{ owner?: Parameters<typeof applyRemoteOwner>[0] }>('/api/admin/load-owner', { nodeNum, sourceId });
        return applyRemoteOwner(r?.owner, latest.current);
      }
      if (type === 'channels') {
        // Today's single pass: all eight slots in parallel, nothing re-sent; a slot that does not answer shows empty.
        const now = Date.now();
        let failed = 0;
        let firstError: Error | null = null;
        const loaded = await Promise.all(
          Array.from({ length: 8 }, async (_, index): Promise<Channel> => {
            try {
              const r = await apiService.post<{ channel?: Parameters<typeof createChannelFromResponse>[0] }>('/api/admin/get-channel', { nodeNum, channelIndex: index, sourceId });
              if (r?.channel) return createChannelFromResponse(r.channel, index, now);
            } catch (error) {
              firstError ??= error instanceof Error ? error : new Error(String(error));
            }
            failed += 1;
            return createEmptyChannelSlot(index, now);
          }),
        );
        if (failed === 8) throw firstError ?? new Error(t('admin_commands.failed_load_channels'));
        setChannels(loaded);
        if (failed > 0) showToast(t('admin_commands.channels_loaded_partial', { count: 8 - failed, failed }), 'warning');
        return true;
      }
      if (!type) return false;
      const r = await apiService.post<{ config?: unknown }>('/api/admin/load-config', { nodeNum, configType: type, sourceId });
      return applyRemoteConfig(type, r?.config, latest.current, nodeNum);
    },
    [nodeNum, sourceId, showToast, t],
  );

  const label = useCallback((id: string) => t(CATEGORIES.find((c) => c.id === id)?.labelKey ?? id), [t]);

  const readCategory = useCallback(
    async (id: string) => {
      if (reading) return;
      setReading(id);
      try {
        await ensurePasskey();
        if (await readOne(id)) {
          markRead(id);
          showToast(t('admin_commands.config_loaded_success', { configType: label(id) }), 'success');
        } else {
          showToast(t('admin_commands.config_load_failed', { configType: label(id) }), 'error');
        }
      } catch (error) {
        showToast((error as Error).message || t('admin_commands.config_load_failed', { configType: label(id) }), 'error');
      } finally {
        setReading(null);
      }
    },
    [reading, ensurePasskey, readOne, markRead, showToast, t, label],
  );

  // Today's Load All Config: every section in order, 200 ms apart, one request each (channels: one per slot).
  const loadAll = useCallback(async () => {
    if (reading) return;
    setReading('all');
    let ok = 0;
    let failed = 0;
    try {
      for (const [i, id] of LOAD_ALL_ORDER.entries()) {
        setProgress({ current: i + 1, total: LOAD_ALL_ORDER.length, id });
        try {
          if (await readOne(id)) {
            markRead(id);
            ok += 1;
          } else failed += 1;
        } catch {
          failed += 1;
        }
        if (i < LOAD_ALL_ORDER.length - 1) await sleep(200);
      }
      if (ok > 0 && failed === 0) showToast(t('admin_commands.all_configs_loaded', { count: ok }), 'success');
      else if (ok > 0) showToast(t('admin_commands.configs_partially_loaded', { loaded: ok, errors: failed }), 'warning');
      else showToast(t('admin_commands.failed_load_all_configs'), 'error');
    } finally {
      setReading(null);
      setProgress(null);
    }
  }, [reading, readOne, markRead, showToast, t]);

  const execute = useCallback(
    async (command: string, params: Record<string, unknown> = {}): Promise<AdminResult> => {
      if (blocked) {
        showToast(t('tx_disabled.remote_admin_notice'), 'warning');
        throw new Error('TX_DISABLED_REMOTE_ADMIN_BLOCKED');
      }
      try {
        const result = await apiService.sendAdminCommand<AdminResult>({
          command,
          nodeNum,
          sourceId,
          ...(attempts != null ? { retryAttempts: attempts } : {}),
          ...params,
        });
        showToast(result.message || result.data?.message || t('admin_commands.command_executed', { command }), 'success');
        return result;
      } catch (error) {
        if (isTxDisabledError(error)) showToast(t('tx_disabled.send_blocked_toast'), 'warning');
        else showToast(mqttRootErrorMessage(error, t) || (error as Error).message || t('admin_commands.failed_execute_command'), 'error');
        throw error;
      }
    },
    [blocked, nodeNum, sourceId, attempts, showToast, t],
  );

  const markSent = useCallback(
    (id: string, s: SendStatus | undefined) =>
      updateRemote(sourceId, (e) => {
        const sent = { ...e.sent };
        if (s) sent[id] = s;
        else delete sent[id];
        return { sent };
      }),
    [sourceId],
  );

  const sendCategory = useCallback(
    async (id: string): Promise<SendOutcome> => {
      const section = sectionOf(id);
      const cmd = section ? remoteCommand(section, latest.current, t) : { error: t('admin_commands.failed_execute_command') };
      if ('error' in cmd) {
        showToast(cmd.error, 'error');
        throw new Error(cmd.error);
      }
      const mark = (s: SendStatus | undefined) => markSent(id, s);
      mark('sending');
      try {
        const result = await execute(cmd.command, cmd.params);
        // As today's Admin Commands: a sent Protection Level is now the node's, so the next send neither asks for it nor resends it.
        const policy = (cmd.params.config as { packetSignaturePolicy?: number } | undefined)?.packetSignaturePolicy;
        if (section === 'security' && policy !== undefined) latest.current.setSecurityLoadedSignaturePolicy(policy);
        // Only favorite / ignore wait for a routing ACK today; a timed-out one is No reply, anything else is Sent.
        const outcome: SendOutcome = result.ack?.timedOut ? 'noReply' : 'sent';
        mark(outcome);
        return outcome;
      } catch (error) {
        // The node never answered for its passkey, so nothing was applied: No reply, still queued.
        mark(error instanceof ApiError && error.code === 'PASSKEY_TIMEOUT' ? 'noReply' : undefined);
        throw error;
      }
    },
    [execute, markSent, showToast, t],
  );

  const retrieveMetadata = useCallback(async () => {
    setBusy('metadata');
    setMetadata(null);
    try {
      const r = await apiService.post<{ deviceMetadata?: DeviceMetadata }>('/api/admin/get-device-metadata', { nodeNum, sourceId });
      if (r?.deviceMetadata) {
        // The Protection Level picker and the restart rules follow this node's firmware (#5612).
        if (typeof r.deviceMetadata.firmwareVersion === 'string') latest.current.setLocalFirmwareVersion(r.deviceMetadata.firmwareVersion);
        setMetadata(r.deviceMetadata);
        showToast(t('admin_commands.device_metadata_loaded'), 'success');
      } else showToast(t('admin_commands.failed_device_metadata'), 'error');
    } catch (error) {
      showToast((error as Error).message || t('admin_commands.failed_device_metadata'), 'error');
    } finally {
      setBusy(null);
    }
  }, [nodeNum, sourceId, showToast, t]);

  const setTime = useCallback(async () => {
    setBusy('time');
    try {
      await apiService.post('/api/admin/set-time', { nodeNum, sourceId });
      showToast(t('admin_commands.set_time_sent', 'Time sync command sent successfully'), 'success');
    } catch (error) {
      showToast((error as Error).message || t('admin_commands.failed_set_time', 'Failed to send set-time command'), 'error');
    } finally {
      setBusy(null);
    }
  }, [nodeNum, sourceId, showToast, t]);

  const setNodeStatus = useCallback(
    (n: number, patch: { isFavorite?: boolean; isIgnored?: boolean }) => setStatuses((prev) => ({ ...prev, [n]: { ...prev[n], ...patch } })),
    [],
  );

  const setChannel = useCallback((ch: Channel) => setChannels((prev) => prev && prev.map((c) => (c.id === ch.id ? ch : c))), []);

  return useMemo(
    () => ({
      target: { kind: 'remote', nodeNum },
      node,
      nodes,
      setTarget,
      passkeyState: entry.passkey,
      state,
      readCategory,
      reading,
      loadAll,
      progress,
      lastRead: entry.lastRead,
      sendCategory,
      channels,
      setChannel,
      attempts,
      setAttempts,
      metadata,
      retrieveMetadata,
      setTime,
      busy,
      execute,
      blocked,
      nodeStatus,
      setNodeStatus,
      markSent,
    }),
    [nodeNum, node, nodes, setTarget, entry.passkey, state, readCategory, reading, loadAll, progress, entry.lastRead, sendCategory, channels, setChannel, attempts, metadata, retrieveMetadata, setTime, busy, execute, blocked, nodeStatus, setNodeStatus, markSent],
  );
}
