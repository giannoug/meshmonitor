/**
 * useMeshCoreContactSync: the Radio contact list's state and requests (#5502),
 * moved as is out of MeshCoreContactSyncSection so the Workspace's Maintenance
 * page (Task 7.4) draws its own rows over the same requests. Reads on
 * connect; every change is a local write over the serial/TCP link.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { parseJsonResponse } from '../../../utils/parseJsonResponse';

export interface SyncStatus {
  available: boolean;
  manualAddContacts: number | null;
  autoAddEnabled: boolean | null;
  missingFavorites: Array<{ publicKey: string; name: string | null }>;
  deviceContactCount: number;
  deviceContactsKnown?: boolean;
  /** Contacts "Remove non-favourite contacts" would remove / keep (#5777). */
  removableContactCount?: number;
  keptContactCount?: number;
}

export interface AutoAddConfig {
  supported: boolean;
  overwriteOldest: boolean;
  types: { chat: boolean; repeater: boolean; room: boolean; sensor: boolean };
  maxHops: number;
}

export type AddMode = 'all' | 'types' | 'none';
export type AddType = keyof AutoAddConfig['types'];

export const TYPE_ORDER: AddType[] = ['chat', 'repeater', 'room', 'sensor'];
export const MAX_HOPS_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface RemoveResult {
  removed: number;
  kept: number;
  failed: number;
  total: number;
}

export interface PushResult {
  added: Array<{ publicKey: string; name: string | null }>;
  alreadyOnDevice: number;
  skipped: Array<{ publicKey: string; name: string | null; reason: 'ignored' | 'unknown_type' | 'failed' }>;
  notAddedNoRoom: number;
  evicted: string[];
  capacityKnown: boolean;
  maxContacts: number | null;
  freeSlotsBefore: number | null;
  freeSlotsAfter: number | null;
  error?: string;
}

export interface UseMeshCoreContactSyncOptions {
  baseUrl: string;
  sourceId: string;
  connected: boolean;
  /** configuration:write — may change the auto-add device setting. */
  canEditConfig: boolean;
}

export function useMeshCoreContactSync({ baseUrl, sourceId, connected, canEditConfig }: UseMeshCoreContactSyncOptions) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const prefix = `${baseUrl}/api/sources/${encodeURIComponent(sourceId)}/meshcore`;
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [savingAutoAdd, setSavingAutoAdd] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AutoAddConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<RemoveResult | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await csrfFetch(`${prefix}/contacts/device-sync`);
      const body = await parseJsonResponse(res);
      if (body?.success && body.data) setStatus(body.data as SyncStatus);
    } catch {
      // Leave the last known status; the section stays usable.
    }
  }, [csrfFetch, prefix]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await csrfFetch(`${prefix}/config/autoadd-config`);
      const body = await parseJsonResponse(res);
      setConfig(body?.success && body.data ? (body.data as AutoAddConfig) : null);
    } catch {
      setConfig(null);
    }
  }, [csrfFetch, prefix]);

  useEffect(() => {
    if (connected) {
      void loadStatus();
      void loadConfig();
    }
  }, [connected, loadStatus, loadConfig]);

  const configFailed = t('meshcore.contact_sync.config_failed', 'Could not change the auto-add options.');

  const postConfig = async (patch: Record<string, unknown>): Promise<boolean> => {
    const res = await csrfFetch(`${prefix}/config/autoadd-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = await parseJsonResponse(res);
    if (!body?.success) {
      setError(body?.error || configFailed);
      return false;
    }
    return true;
  };

  const postAutoAdd = async (enabled: boolean): Promise<boolean> => {
    const res = await csrfFetch(`${prefix}/config/auto-add-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const body = await parseJsonResponse(res);
    if (!body?.success) {
      setError(body?.error || t('meshcore.contact_sync.auto_add_failed', 'Could not change the auto-add setting.'));
      return false;
    }
    return true;
  };

  /** Run a settings change, then re-read the radio's answer. */
  const runConfigChange = async (change: () => Promise<boolean>) => {
    setSavingConfig(true);
    setError(null);
    try {
      await change();
    } catch {
      setError(configFailed);
    } finally {
      await Promise.all([loadStatus(), loadConfig()]);
      setSavingConfig(false);
    }
  };

  const handleMode = (next: AddMode) =>
    runConfigChange(async () => {
      if (next === 'all') return postAutoAdd(true);
      if (!(await postAutoAdd(false))) return false;
      const anyType = config ? TYPE_ORDER.some((k) => config.types[k]) : false;
      if (next === 'none') {
        return anyType
          ? postConfig({ types: { chat: false, repeater: false, room: false, sensor: false } })
          : true;
      }
      // 'types': at least one type has to be on, or the radio reads as manual.
      return anyType ? true : postConfig({ types: { chat: true } });
    });

  const handleType = (type: AddType, value: boolean) =>
    runConfigChange(() => postConfig({ types: { [type]: value } }));

  const handleOverwrite = (value: boolean) => runConfigChange(() => postConfig({ overwriteOldest: value }));

  const handleMaxHops = (value: number) => runConfigChange(() => postConfig({ maxHops: value }));

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    setRemoveResult(null);
    try {
      const res = await csrfFetch(`${prefix}/contacts/remove-non-favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await parseJsonResponse(res);
      if (!body?.success) {
        setError(body?.error || t('meshcore.contact_sync.remove_failed', 'Could not remove contacts from the radio.'));
      } else {
        setRemoveResult(body.data as RemoveResult);
      }
    } catch {
      setError(t('meshcore.contact_sync.remove_failed', 'Could not remove contacts from the radio.'));
    } finally {
      setConfirmRemove(false);
      setRemoving(false);
      await loadStatus();
    }
  };

  const handleToggleAutoAdd = async (enabled: boolean) => {
    setSavingAutoAdd(true);
    setError(null);
    try {
      const res = await csrfFetch(`${prefix}/config/auto-add-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const body = await parseJsonResponse(res);
      if (!body?.success) {
        setError(body?.error || t('meshcore.contact_sync.auto_add_failed', 'Could not change the auto-add setting.'));
        return;
      }
      await loadStatus();
    } catch {
      setError(t('meshcore.contact_sync.auto_add_failed', 'Could not change the auto-add setting.'));
    } finally {
      setSavingAutoAdd(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    setError(null);
    setPushResult(null);
    try {
      const res = await csrfFetch(`${prefix}/contacts/push-to-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await parseJsonResponse(res);
      if (!body?.success) {
        setError(body?.error || t('meshcore.contact_sync.push_failed', 'Could not push contacts to the radio.'));
        return;
      }
      setPushResult(body.data as PushResult);
      await loadStatus();
    } catch {
      setError(t('meshcore.contact_sync.push_failed', 'Could not push contacts to the radio.'));
    } finally {
      setPushing(false);
    }
  };

  const autoAdd = status?.autoAddEnabled ?? null;
  const optionsSupported = config?.supported === true;
  const mode: AddMode | null =
    !optionsSupported || autoAdd === null
      ? null
      : autoAdd
        ? 'all'
        : TYPE_ORDER.some((k) => config!.types[k])
          ? 'types'
          : 'none';
  const configLocked = !canEditConfig || !connected || savingConfig;
  const hopChoices = config && !MAX_HOPS_CHOICES.includes(config.maxHops)
    ? [...MAX_HOPS_CHOICES, config.maxHops]
    : MAX_HOPS_CHOICES;
  const hopLabel = (v: number) =>
    v === 0
      ? t('meshcore.contact_sync.hops_any', 'No limit')
      : v === 1
        ? t('meshcore.contact_sync.hops_direct', 'Direct only')
        : t('meshcore.contact_sync.hops_n', { count: v - 1, defaultValue: 'Up to {{count}} hops' });
  const removable = status?.removableContactCount ?? 0;
  const kept = status?.keptContactCount ?? 0;
  const typeLabels: Record<AddType, string> = {
    chat: t('meshcore.contact_sync.type_chat', 'Companions'),
    repeater: t('meshcore.contact_sync.type_repeater', 'Repeaters'),
    room: t('meshcore.contact_sync.type_room', 'Room servers'),
    sensor: t('meshcore.contact_sync.type_sensor', 'Sensors'),
  };
  const missing = status?.missingFavorites.length ?? 0;
  const skippedBy = (reason: PushResult['skipped'][number]['reason']) =>
    pushResult?.skipped.filter((s) => s.reason === reason).length ?? 0;

  return {
    prefix,
    status,
    savingAutoAdd,
    pushing,
    pushResult,
    error,
    config,
    savingConfig,
    confirmRemove,
    setConfirmRemove,
    removing,
    removeResult,
    handleMode,
    handleType,
    handleOverwrite,
    handleMaxHops,
    handleRemove,
    handleToggleAutoAdd,
    handlePush,
    autoAdd,
    optionsSupported,
    mode,
    configLocked,
    hopChoices,
    hopLabel,
    removable,
    kept,
    typeLabels,
    missing,
    skippedBy,
  };
}
