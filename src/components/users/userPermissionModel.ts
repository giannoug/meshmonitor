/**
 * The admin user/permission model UsersTab edits, moved out of UsersTab (Rule X,
 * #6365) so the Workspace Users page sends the very same requests: the resource
 * lists, the admin all-granted fallback, the PUT bodies, and which per-source
 * rows a source shows. Behaviour is unchanged; UsersTab imports it.
 */
import api from '../../services/api';
import type { PermissionSet, ResourceType } from '../../types/permission';
import { RESOURCES, SOURCEY_RESOURCES } from '../../types/permission';

export interface PermissionSource {
  id: string;
  name: string;
  type: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  authProvider: 'local' | 'oidc' | 'proxy';
  isAdmin: boolean;
  isActive: boolean;
  passwordLocked: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  /** Passkey-only account (#5841). */
  passwordLoginDisabled?: boolean;
  /** How many passkeys the user has (#5841). */
  passkeyCount?: number;
}

export interface ChannelDatabaseEntry {
  id: number;
  name: string;
  protocol?: 'meshtastic' | 'meshcore';
  description: string | null;
  isEnabled: boolean;
}

export interface ChannelDatabasePermission {
  channelDatabaseId: number;
  canViewOnMap: boolean;
  canRead: boolean;
  /**
   * PR-C: write capability on individual channel-database entries. The
   * server-side schema for `channel_database_permissions` does not yet
   * carry a canWrite column — PR-B is expected to land that migration in
   * parallel. Until then the UI sends the field and the server ignores it
   * (or accepts and persists it once the schema catches up).
   */
  canWrite?: boolean;
}

export const PERMISSION_KEYS = [
  'dashboard', 'nodes', 'channel_0', 'channel_1', 'channel_2', 'channel_3',
  'channel_4', 'channel_5', 'channel_6', 'channel_7', 'messages', 'settings',
  'configuration', 'info', 'automation', 'connection', 'traceroute', 'audit',
  'security', 'nodes_private', 'packetmonitor', 'waypoints'
] as const;

// PR-C: Global (non-sourcey) resources that surface above the per-source
// grid. Derived from RESOURCES \ SOURCEY_RESOURCES so new globals (e.g.
// `channel_database`, registered for migration 064 in PR-A) appear here
// automatically. The source-scope dropdown does not affect these grants —
// they are stored against sourceId=null.
export const GLOBAL_PERMISSION_RESOURCES = RESOURCES.filter(
  (r) => !SOURCEY_RESOURCES.includes(r.id)
).map((r) => r.id);

/**
 * If user is admin and no permissions returned, set all permissions
 * (including the global resources rendered in the Global Resources
 * section — see GLOBAL_PERMISSION_RESOURCES).
 */
export function withAdminDefaults(user: Pick<AdminUser, 'isAdmin'>, permissions: PermissionSet): PermissionSet {
  if (!(user.isAdmin && Object.keys(permissions).length === 0)) return permissions;
  const allPermissions: PermissionSet = {};
  PERMISSION_KEYS.forEach(resource => {
    if (resource.startsWith('channel_')) {
      allPermissions[resource] = { viewOnMap: true, read: true, write: true };
    } else {
      allPermissions[resource] = { read: true, write: true };
    }
  });
  GLOBAL_PERMISSION_RESOURCES.forEach(resource => {
    allPermissions[resource] = { read: true, write: true };
  });
  return allPermissions;
}

/** `GET /api/users/:id/permissions[?sourceId=]`: the scope's grants with the globals merged in. */
export function permissionsUrl(userId: number, scopeId: string | null): string {
  return scopeId
    ? `/api/users/${userId}/permissions?sourceId=${scopeId}`
    : `/api/users/${userId}/permissions`;
}

/**
 * Filter out empty/undefined permissions and ensure valid structure.
 * PR-C: also include any global (non-sourcey) resources the admin
 * edited via the Global Resources section. The server PUT splits the
 * payload by resource type and routes globals to sourceId=null,
 * sourcey rows to the in-scope sourceId.
 */
export function buildPermissionsPayload(permissions: PermissionSet): PermissionSet {
  const validPermissions: PermissionSet = {};
  const allKeys: ResourceType[] = [...PERMISSION_KEYS, ...GLOBAL_PERMISSION_RESOURCES];
  allKeys.forEach(resource => {
    if (!permissions[resource]) return;
    // `nodes` carries viewOnMap alongside channel_* resources (#4559):
    // read makes the node/contact list available, viewOnMap additionally
    // publishes positions on the map — the same split channels already have.
    if (resource.startsWith('channel_') || resource === 'nodes') {
      validPermissions[resource] = {
        viewOnMap: permissions[resource]?.viewOnMap || false,
        read: permissions[resource]?.read || false,
        write: permissions[resource]?.write || false
      };
    } else {
      validPermissions[resource] = {
        read: permissions[resource]?.read || false,
        write: permissions[resource]?.write || false
      };
    }
  });
  return validPermissions;
}

/**
 * `PUT /api/users/:id/permissions`. The server REPLACES the whole
 * (user, sourceId) scope and the whole global scope with what is sent, so
 * `permissions` must be the full set as loaded, not a delta.
 */
export function putUserPermissions(userId: number, permissions: PermissionSet, scopeId: string | null) {
  return api.put(`/api/users/${userId}/permissions`, {
    permissions: buildPermissionsPayload(permissions),
    ...(scopeId !== null ? { sourceId: scopeId } : {})
  });
}

/**
 * Normalize: always send canWrite so the server has a chance to
 * persist it once PR-B's schema column lands. Existing servers
 * ignore unknown fields (canViewOnMap/canRead are the only ones
 * validated and stored today).
 */
export function putChannelDbPermissions(userId: number, list: ChannelDatabasePermission[]) {
  const payload = list.map(p => ({
    channelDatabaseId: p.channelDatabaseId,
    canViewOnMap: p.canViewOnMap,
    canRead: p.canRead,
    canWrite: p.canWrite ?? false,
  }));
  return api.put(`/api/users/${userId}/channel-database-permissions`, {
    permissions: payload,
  });
}

/** The channels a source has configured: names for labels, ids for which `channel_N` rows it shows. */
export function channelIndex(channels: unknown): { names: Map<number, string>; ids: Set<number> } {
  const names = new Map<number, string>();
  const ids = new Set<number>();
  if (Array.isArray(channels)) {
    channels.forEach((ch: { id: number; name: string }) => {
      // Some channels (notably Primary / channel_0) come back without a
      // name set — still configured, just unlabeled. Track IDs
      // independently from names so we can render an unnamed Primary
      // row but skip slots the source doesn't actually use.
      if (typeof ch.id === 'number') ids.add(ch.id);
      if (ch.name) names.set(ch.id, ch.name);
    });
  }
  return { names, ids };
}

export const isMqttSourceType = (type: string | undefined) => type === 'mqtt_broker' || type === 'mqtt_bridge';

/**
 * The per-source rows a source shows. Only sourcey resources (globals have
 * their own section). MQTT scopes hide channel_0..7 — their channels are
 * keyed through channel_database_permissions instead. channel_N rows appear
 * only for channels actually configured on the scoped source: MeshCore
 * sources have no per-slot channels, and Meshtastic sources with fewer than
 * 8 active channels shouldn't expose empty slots.
 */
export function isSourceRowShown(resource: string, sourceType: string | undefined, configuredChannelIds: Set<number>): boolean {
  if (!SOURCEY_RESOURCES.includes(resource as ResourceType)) return false;
  if (isMqttSourceType(sourceType) && resource.startsWith('channel_')) return false;
  const channelMatch = /^channel_(\d+)$/.exec(resource);
  if (channelMatch) {
    const id = Number(channelMatch[1]);
    if (!configuredChannelIds.has(id)) return false;
  }
  return true;
}

/** Channel-database toggles: write needs read, so read off clears write and write on sets read. */
export function toggledChannelDbPermission(
  existing: ChannelDatabasePermission,
  field: 'canViewOnMap' | 'canRead' | 'canWrite',
): { canViewOnMap: boolean; canRead: boolean; canWrite: boolean } {
  if (field === 'canViewOnMap') {
    return { canViewOnMap: !existing.canViewOnMap, canRead: existing.canRead, canWrite: existing.canWrite ?? false };
  }
  if (field === 'canRead') {
    const newValue = !existing.canRead;
    return { canViewOnMap: existing.canViewOnMap, canRead: newValue, canWrite: newValue ? (existing.canWrite ?? false) : false };
  }
  const newValue = !(existing.canWrite ?? false);
  return { canViewOnMap: existing.canViewOnMap, canRead: newValue ? true : existing.canRead, canWrite: newValue };
}

export const PERMISSION_TOOLTIPS: Record<string, string> = {
  dashboard: 'Controls visibility of source cards on the main dashboard. Does NOT include node or message access — grant those separately.',
  nodes: 'Read: view node list, neighbor info, and map markers. Write: edit node names/notes.',
  nodes_private: 'Read: view detailed position history for individual nodes.',
  messages: 'Read: view node details, messages, and channel list. Write: send direct messages.',
  settings: 'Read: view global settings. Write: change settings, map styles, GeoJSON layers.',
  configuration: 'Read: view device configuration. Write: change device radio/module settings.',
  info: 'Read: view device info and statistics.',
  automation: 'Read: view automation rules. Write: create/edit automation rules.',
  connection: 'Connect/disconnect the Meshtastic device for this source.',
  // #5898: read and write are separate, like every other resource.
  traceroute: 'Read: view traceroutes and route data. Write: send traceroutes and NeighborInfo requests over the mesh.',
  audit: 'Read: view the audit log. Write: purge audit log entries.',
  security: 'Read: view security scan results. Write: run scans, manage flagged/dead nodes.',
  packetmonitor: 'Read: view raw Meshtastic packets in the packet monitor.',
  waypoints: 'Read: view map waypoints. Write: create, edit, and delete waypoints (WAYPOINT_APP).',
  themes: 'Read: view custom color themes. Write: create and edit custom themes.',
  sources: 'Read: view per-source status. Write: create, edit, enable/disable, and delete data sources.',
  channel_database: 'Read: list global PSK library entries. Write: create/edit/delete entries used for MQTT decryption.',
};

export const CHANNEL_TOOLTIP = 'View on Map: show nodes heard on this channel. Read: view messages. Write: send messages.';
export const NODES_TOOLTIP = 'View on Map: publish node/contact positions on the map. Read: view the node list.';
