/**
 * One user's grants on every device at once (ds13), for the desktop matrix and
 * the phone device chips. Reads each device's set as today's UsersTab reads its
 * scope (`/permissions?sourceId=`, `/channels/all?sourceId=`), and writes
 * through today's `putUserPermissions`: the PUT replaces the device's whole set
 * and the whole global set, so every write sends the device's full set plus the
 * globals, with one entry changed. One write at a time, so two writes can never
 * race and lose a change. Saves as you go; nothing transmits on the mesh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { logger } from '../../../utils/logger';
import { useToast } from '../../../components/ToastContainer';
import type { PermissionSet, ResourceType } from '../../../types/permission';
import { isSourceyResource } from '../../../types/permission';
import { isAnyMeshCoreSourceType } from '../../../utils/nodeTypeCategory';
import {
  channelIndex,
  permissionsUrl,
  putChannelDbPermissions,
  putUserPermissions,
  toggledChannelDbPermission,
  withAdminDefaults,
  type AdminUser,
  type ChannelDatabaseEntry,
  type ChannelDatabasePermission,
  type PermissionSource,
} from '../../../components/users/userPermissionModel';

export type Level = 'none' | 'read' | 'write';
type Grant = NonNullable<PermissionSet[ResourceType]>;

export const levelOf = (p: Grant | undefined): Level => (p?.write ? 'write' : p?.read ? 'read' : 'none');
/** Read / write from the level; viewOnMap and anything else on the grant stay as they are. */
export const withLevel = (p: Grant | undefined, level: Level): Grant => ({ ...p, read: level !== 'none', write: level === 'write' });

/** Today's View on Map checkbox: every channel row, and Nodes on a MeshCore device (#4559, #5094). */
export const hasViewOnMap = (resource: ResourceType, source: PermissionSource) =>
  resource.startsWith('channel_') || (resource === 'nodes' && isAnyMeshCoreSourceType(source.type));

export interface DeviceGrants {
  /** The device's per-source grants (the global ones live in `globals`). */
  perms: PermissionSet;
  channelNames: Map<number, string>;
  channelIds: Set<number>;
}

function split(set: PermissionSet): { sourcey: PermissionSet; global: PermissionSet } {
  const sourcey: PermissionSet = {};
  const global: PermissionSet = {};
  for (const [k, v] of Object.entries(set) as [ResourceType, Grant][]) (isSourceyResource(k) ? sourcey : global)[k] = v;
  return { sourcey, global };
}

export function usePermissionMatrix(user: AdminUser, sources: PermissionSource[]) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [devices, setDevices] = useState<Record<string, DeviceGrants> | null>(null);
  const [globals, setGlobals] = useState<PermissionSet>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // The state above disables the controls; the ref also stops a second click in the same tick.
  const inFlight = useRef(false);
  const [entries, setEntries] = useState<ChannelDatabaseEntry[]>([]);
  const [channelDb, setChannelDb] = useState<ChannelDatabasePermission[]>([]);
  const sourceKey = sources.map((s) => s.id).join(',');

  useEffect(() => {
    let live = true;
    setDevices(null);
    setFailed(false);
    void (async () => {
      try {
        const scoped = await Promise.all(
          sources.map(async (s) => {
            const [reply, channels] = await Promise.all([
              api.get<{ permissions: PermissionSet }>(permissionsUrl(user.id, s.id)),
              api.get<unknown>(`/api/channels/all?sourceId=${encodeURIComponent(s.id)}`).catch(() => []),
            ]);
            return { id: s.id, set: withAdminDefaults(user, reply.permissions), channels: channelIndex(channels) };
          }),
        );
        // Today's page reads the globals with its scope, the first device (none: the unscoped read).
        const first = scoped[0]?.set
          ?? withAdminDefaults(user, (await api.get<{ permissions: PermissionSet }>(permissionsUrl(user.id, null))).permissions);
        if (!live) return;
        setGlobals(split(first).global);
        setDevices(Object.fromEntries(scoped.map((d) => [d.id, { perms: split(d.set).sourcey, channelNames: d.channels.names, channelIds: d.channels.ids }])));
      } catch (err) {
        logger.error('Failed to fetch user permissions:', err);
        if (live) setFailed(true);
      }
    })();
    // Virtual channels: today's two reads (the list may fail for a non-admin, which is fine).
    void api.get<{ data: ChannelDatabaseEntry[] }>('/api/channel-database?protocol=all')
      .then((r) => live && setEntries(r.data || []))
      .catch(() => live && setEntries([]));
    void api.get<{ data: ChannelDatabasePermission[] }>(`/api/users/${user.id}/channel-database-permissions`)
      .then((r) => live && setChannelDb((r.data || []).map((p) => ({
        channelDatabaseId: p.channelDatabaseId, canViewOnMap: p.canViewOnMap, canRead: p.canRead, canWrite: p.canWrite ?? false,
      }))))
      .catch((err) => { logger.error('Failed to fetch channel database permissions:', err); if (live) setChannelDb([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 reload per user and device list, not per object identity
  }, [user.id, user.isAdmin, sourceKey]);

  /** Sends `scope`'s full set plus the globals with `change` applied, then keeps what was sent. */
  const save = useCallback(async (scope: string | null, change: PermissionSet) => {
    if (inFlight.current || !devices) return;
    const { sourcey, global } = split(change);
    const nextDevice = { ...(scope ? devices[scope]?.perms : {}), ...sourcey };
    const nextGlobals = { ...globals, ...global };
    inFlight.current = true;
    setSaving(true);
    try {
      await putUserPermissions(user.id, { ...nextDevice, ...nextGlobals }, scope);
      setGlobals(nextGlobals);
      if (scope) setDevices((d) => d && { ...d, [scope]: { ...d[scope], perms: nextDevice } });
    } catch (err) {
      logger.error('Failed to update permissions:', err);
      const forbidden = !!err && typeof err === 'object' && 'status' in err && err.status === 403;
      showToast(t(forbidden ? 'users.insufficient_permissions_update' : 'users.failed_update_permissions'), 'error');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [devices, globals, user.id, showToast, t]);

  const grant = (scope: string, resource: ResourceType) => devices?.[scope]?.perms[resource];

  return {
    devices,
    globals,
    failed,
    saving,
    setLevel: (scope: string, resource: ResourceType, level: Level) =>
      save(scope, { [resource]: withLevel(grant(scope, resource), level) }),
    setViewOnMap: (scope: string, resource: ResourceType) =>
      save(scope, { [resource]: { ...grant(scope, resource), viewOnMap: !grant(scope, resource)?.viewOnMap } as Grant }),
    /** An install-wide grant, sent as today with `scope`'s set (today's page sends its selected scope). */
    setGlobalLevel: (scope: string | null, resource: ResourceType, level: Level) =>
      save(scope, { [resource]: withLevel(globals[resource], level) }),
    channelDb: {
      entries,
      get: (id: number): ChannelDatabasePermission =>
        channelDb.find((p) => p.channelDatabaseId === id) ?? { channelDatabaseId: id, canViewOnMap: false, canRead: false, canWrite: false },
      toggle: (id: number, field: 'canViewOnMap' | 'canRead' | 'canWrite') =>
        setChannelDb((prev) => {
          const existing = prev.find((p) => p.channelDatabaseId === id) ?? { channelDatabaseId: id, canViewOnMap: false, canRead: false, canWrite: false };
          const next = { channelDatabaseId: id, ...toggledChannelDbPermission(existing, field) };
          return prev.some((p) => p.channelDatabaseId === id) ? prev.map((p) => (p.channelDatabaseId === id ? next : p)) : [...prev, next];
        }),
      save: async () => {
        try {
          await putChannelDbPermissions(user.id, channelDb);
          showToast(t('users.channel_db_permissions_updated'), 'success');
        } catch (err) {
          logger.error('Failed to update channel database permissions:', err);
          showToast(t('users.failed_update_channel_db_permissions'), 'error');
        }
      },
    },
  };
}

export type PermissionMatrixModel = ReturnType<typeof usePermissionMatrix>;
