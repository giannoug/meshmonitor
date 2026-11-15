/**
 * Overview › Users and Audit log (o4, q4, 13-13, 13-18, o5, 16-03, 16-08):
 * the accounts, their stored grants per device, each device's channels, and
 * the audit log. Served as overrides (`usersFixtures`), not defaults, so no
 * other page's requests change.
 */
import type { PermissionSet } from '../../types/permission';
import type { AdminUser } from '../../components/users/userPermissionModel';
import type { AuditLogEntry, AuditStats } from '../../components/useAuditLog';
import type { FixtureHandler } from './fixtureApi';
import { SOURCE_IDS as S } from './athens';

const NOW = Date.now();
const CREATED = NOW - 90 * 86_400_000;
const MIN = 60_000;

const base = { isActive: true, passwordLocked: false, createdAt: CREATED, passkeyCount: 0 } as const;

/** `GET /api/users`. `admin` (id 1) is the fixture's signed-in user. */
export const adminUsers: AdminUser[] = [
  { ...base, id: 1, username: 'admin', email: null, displayName: 'Athens Ops', authProvider: 'local', isAdmin: true, lastLoginAt: NOW },
  { ...base, id: 2, username: 'giannoug', email: 'giannoug@athensmesh.gr', displayName: null, authProvider: 'local', isAdmin: true, lastLoginAt: NOW - 5 * MIN, passkeyCount: 1 },
  { ...base, id: 3, username: 'nikos', email: null, displayName: null, authProvider: 'oidc', isAdmin: false, lastLoginAt: NOW - 120 * MIN },
  { ...base, id: 4, username: 'field-team', email: 'field@athensmesh.gr', displayName: 'Field team', authProvider: 'local', isAdmin: false, lastLoginAt: NOW - 20 * MIN, passkeyCount: 2 },
  { ...base, id: 5, username: 'viewer', email: null, displayName: null, authProvider: 'local', isAdmin: false, isActive: false, lastLoginAt: null },
  { ...base, id: 6, username: 'anonymous', email: null, displayName: 'Anonymous', authProvider: 'local', isAdmin: false, lastLoginAt: null },
];

const r = { read: true, write: false };
const rw = { read: true, write: true };

/** Stored grants: `global` (sourceId NULL) and per device, as `getUserPermissionSetsBySourceAsync` returns them. */
export const storedPermissions: Record<number, { global: PermissionSet; bySource: Record<string, PermissionSet> }> = {
  3: {
    global: { dashboard: r, info: r, automations: r },
    bySource: {
      [S.g2]: {
        messages: rw, nodes: { viewOnMap: false, ...r }, channel_0: { viewOnMap: true, ...rw }, channel_1: { viewOnMap: false, ...r },
        automation: rw, connection: r, traceroute: rw, packetmonitor: r,
      },
      [S.heltec]: { messages: r, nodes: { viewOnMap: true, ...r }, connection: r, packetmonitor: r },
      [S.rak]: { messages: rw, nodes: { viewOnMap: false, ...r }, channel_0: { viewOnMap: false, ...r }, traceroute: rw },
      [S.mqtt]: { messages: r, nodes: { viewOnMap: false, ...r }, packetmonitor: r },
    },
  },
  4: { global: { dashboard: r }, bySource: { [S.g2]: { messages: rw, nodes: { viewOnMap: false, ...r } } } },
};

/** `GET /api/channels/all?sourceId=`: the channels each device has configured (MeshCore and Reticulum have none). */
export const deviceChannels: Record<string, { id: number; name: string }[]> = {
  [S.g2]: [{ id: 0, name: 'LongFast' }, { id: 1, name: 'gauntlet' }],
  [S.rak]: [{ id: 0, name: '' }],
  [S.mqtt]: [{ id: 0, name: 'LongFast' }],
};

export const channelDatabase = [
  { id: 11, name: 'Athens Public', protocol: 'meshtastic', description: 'MQTT decryption', isEnabled: true },
  { id: 12, name: '#athens', protocol: 'meshcore', description: null, isEnabled: true },
];

const at = (minutesAgo: number) => NOW - minutesAgo * MIN;
const entry = (e: Partial<AuditLogEntry> & Pick<AuditLogEntry, 'id' | 'action'>): AuditLogEntry => ({
  userId: 2, username: 'giannoug', resource: null, details: null, ipAddress: '192.168.1.23', valueBefore: null, valueAfter: null,
  timestamp: at(e.id), ...e,
});

/** `GET /api/audit`: the first page of 42 entries. */
export const auditLogs: AuditLogEntry[] = [
  entry({ id: 1, action: 'settings_updated', resource: 'settings', details: JSON.stringify({ sourceId: S.g2, keys: ['maxNodeAgeHours'] }) }),
  entry({ id: 14, userId: 3, username: 'nikos', action: 'message_deleted', resource: 'messages', details: 'Deleted message 4821 from channel 0', ipAddress: '192.168.1.31' }),
  entry({ id: 33, userId: null, username: null, action: 'position_estimation_run', resource: 'settings', details: 'Ran position estimation: 12 node(s) estimated', ipAddress: null }),
  entry({ id: 47, action: 'permissions_updated', resource: 'permissions', details: JSON.stringify({ userId: 3, permissions: { traceroute: rw }, sourceId: S.rak }) }),
  entry({ id: 65, action: 'api_token_used', resource: 'auth', details: 'GET /api/v1/nodes' }),
  entry({ id: 163, userId: 4, username: 'field-team', action: 'login_success', resource: 'auth', details: 'Local login', ipAddress: '10.0.4.18' }),
  entry({ id: 210, action: 'user_deactivated', resource: 'users', details: JSON.stringify({ userId: 5, username: 'viewer' }) }),
];

export const auditStats: AuditStats = {
  actionStats: [
    { action: 'login_success', count: 412 }, { action: 'settings_updated', count: 96 }, { action: 'api_token_used', count: 61 },
    { action: 'permissions_updated', count: 14 }, { action: 'message_deleted', count: 9 }, { action: 'position_estimation_run', count: 6 },
    { action: 'user_deactivated', count: 1 },
  ],
  userStats: [{ username: 'giannoug', count: 530 }, { username: 'nikos', count: 41 }, { username: 'field-team', count: 28 }],
  dailyStats: [],
  totalEvents: 599,
};

export const AUDIT_TOTAL = 42;

const userIdOf = (url: URL) => Number(url.pathname.split('/')[3]);

/** The server's GET merge: the device's grants with the globals on top. */
function permissionsReply(url: URL) {
  const stored = storedPermissions[userIdOf(url)] ?? { global: {}, bySource: {} };
  const sourceId = url.searchParams.get('sourceId');
  return { permissions: { ...(sourceId ? stored.bySource[sourceId] ?? {} : {}), ...stored.global } };
}

export const usersFixtures: Record<string, FixtureHandler> = {
  'GET /api/users': () => ({ users: adminUsers }),
  'GET /api/users/:id/permissions': permissionsReply,
  'PUT /api/users/:id/permissions': () => ({ success: true, message: 'Permissions updated successfully' }),
  'GET /api/channels/all': (url) => deviceChannels[url.searchParams.get('sourceId') ?? ''] ?? [],
  'GET /api/channel-database': () => ({ success: true, data: channelDatabase }),
  'GET /api/users/:id/channel-database-permissions': (url) =>
    ({ data: userIdOf(url) === 3 ? [{ channelDatabaseId: 11, canViewOnMap: true, canRead: true }] : [] }),
  'PUT /api/users/:id/channel-database-permissions': () => ({ success: true }),
  'PUT /api/users/:id/admin': () => ({ success: true }),
  'PUT /api/users/:id': () => ({ success: true }),
  'POST /api/users/:id/set-password': () => ({ success: true }),
  'POST /api/users': () => ({ success: true }),
  'DELETE /api/users/:id': () => ({ success: true }),
  'DELETE /api/users/:id/permanent': () => ({ success: true }),
  'GET /api/auth/passkey/admin/users/:id': (url) => ({
    success: true,
    data: {
      userId: Number(url.pathname.split('/')[6]),
      username: adminUsers.find((u) => u.id === Number(url.pathname.split('/')[6]))?.username ?? '',
      passwordLoginDisabled: false,
      passkeys: [
        { id: 1, nickname: 'MacBook', rpId: 'athensmesh.gr', createdAt: CREATED, lastUsedAt: at(20) },
        { id: 2, nickname: 'Pixel 9', rpId: 'athensmesh.gr', createdAt: CREATED, lastUsedAt: null },
      ],
    },
  }),
  'GET /api/audit': () => ({ logs: auditLogs, total: AUDIT_TOTAL, offset: 0, limit: 100 }),
  'GET /api/audit/stats/summary': () => ({ stats: auditStats, days: 30 }),
};
