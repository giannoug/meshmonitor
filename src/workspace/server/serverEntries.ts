/**
 * The Server list (s13n0 `server_sidebar`), shared by the desktop sidebar and
 * the phone list (13-16), and the gates of s13n2:
 *
 * - Backup & maintenance: every viewer with settings access (settings:read).
 * - Security & privacy: settings:read too, because today every settings viewer
 *   sees the hosted privacy documents (writers edit them); the page shows a
 *   non-admin only those.
 * - Background jobs: settings:write (s13n2).
 * - General, Map & tiles and Integrations: admins, and settings writers too,
 *   because today a non-admin writer can change MeshCore messaging, the
 *   Reticulum cap, custom tilesets, GeoJSON layers and map styles, and sees
 *   Virtual Node replay; the pages show such a user only those rows.
 * - Everything else: admins only.
 *
 * The list shows only what the user can open. Devices is today's source list
 * until Task 6.6 draws its page.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { UiIconName } from '../../components/icons';

export type ServerGate = 'read' | 'write' | 'admin';

export interface ServerEntry {
  key: string;
  label: string;
  /** The page, under `/server/`. */
  path: string;
  icon: UiIconName;
  gate: ServerGate;
}

const ENTRIES: Array<Omit<ServerEntry, 'label'> & { labelKey: string }> = [
  { key: 'devices', labelKey: 'workspace.server.nav.devices', path: 'devices', icon: 'radioSignal', gate: 'admin' },
  { key: 'general', labelKey: 'workspace.server.general', path: 'general', icon: 'settings', gate: 'write' },
  { key: 'notification-services', labelKey: 'workspace.server.nav.notification_services', path: 'notification-services', icon: 'notifications', gate: 'admin' },
  { key: 'security', labelKey: 'workspace.server.nav.security', path: 'security', icon: 'security', gate: 'read' },
  { key: 'backup', labelKey: 'workspace.server.nav.backup', path: 'backup', icon: 'server', gate: 'read' },
  { key: 'channel-database', labelKey: 'workspace.server.nav.channel_database', path: 'channel-database', icon: 'key', gate: 'admin' },
  { key: 'scripts', labelKey: 'workspace.server.nav.scripts', path: 'scripts', icon: 'terminal', gate: 'admin' },
  { key: 'map', labelKey: 'workspace.server.nav.map', path: 'map', icon: 'map', gate: 'write' },
  { key: 'embed', labelKey: 'workspace.server.nav.embed', path: 'embed', icon: 'code', gate: 'admin' },
  { key: 'background-jobs', labelKey: 'workspace.server.nav.background_jobs', path: 'background-jobs', icon: 'time', gate: 'write' },
  { key: 'integrations', labelKey: 'workspace.server.nav.integrations', path: 'integrations', icon: 'package', gate: 'write' },
  { key: 'analytics', labelKey: 'workspace.server.nav.analytics', path: 'analytics', icon: 'reports', gate: 'admin' },
];

/** Today's `#settings-<x>` sections that live on a Workspace page now. */
export const SERVER_ALIASES: Record<string, string> = {
  'default-source': 'general',
  reticulum: 'general',
  'meshcore-messaging': 'general',
  'apprise-server': 'notification-services',
  maintenance: 'backup',
  system: 'backup',
  privacy: 'security',
  'remote-admin': 'security',
  'position-estimation': 'background-jobs',
  'auto-enrichment': 'background-jobs',
  'mesh-issues': 'background-jobs',
  coverage: 'background-jobs',
  solar: 'background-jobs',
  translation: 'integrations',
  elevation: 'integrations',
  'mqtt-root-directory': 'integrations',
  ducting: 'integrations',
  adsb: 'integrations',
  meshwars: 'integrations',
  'atak-cot': 'integrations',
  'virtual-node-replay': 'integrations',
};

/** Today's gates: admin; settings:write and settings:read on any source (the unscoped settings routes' union). */
export function useServerAccess() {
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  const canWrite = isAdmin || hasPermission('settings', 'write', { anySource: true });
  const canRead = canWrite || hasPermission('settings', 'read', { anySource: true });
  const allows = (gate: ServerGate) => (gate === 'admin' ? isAdmin : gate === 'write' ? canWrite : canRead);
  // Until the auth status answers, nothing is known to be allowed or refused.
  return { ready: !!authStatus, isAdmin, canWrite, canRead, allows };
}

/** The entries this user can open, in s13n0's order. */
export function useServerEntries(): ServerEntry[] {
  const { t } = useTranslation();
  const { allows } = useServerAccess();
  return ENTRIES.filter((e) => allows(e.gate)).map(({ labelKey, ...e }) => ({ ...e, label: t(labelKey) }));
}
