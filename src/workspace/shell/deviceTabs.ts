/**
 * Per device type: which of today's tabs each Workspace entry leads to, and
 * today's words for a device's state. Shared by the sidebar, the phone tab bar,
 * the switcher and the You page.
 */
import type { TFunction } from 'i18next';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeviceConfigurationPage } from '../../components/search/configSections';
import { visibleMeshCoreViews, type MeshCoreView } from '../../components/MeshCore/meshCoreViewAccess';
import type { ResourceType } from '../../types/permission';
import { useChannelDatabaseEntries } from '../chat/useChannelDatabaseEntries';
import type { WorkspaceSource } from './useWorkspaceSources';

/** Tab per tool row, by source type; null: the type has no such tab. Meshtastic `dms` is the Workspace inbox (Task 2.6), `map` the Workspace device map (Task 3.1). */
export const TOOL_TABS: Record<'meshtastic' | 'meshcore' | 'reticulum', Record<string, string | null>> = {
  meshtastic: { map: 'map', nodes: 'nodes', dashboard: 'dashboard', automation: 'automation', config: 'settings', tools: 'info', channels: 'channels', dms: 'dms' },
  meshcore: { map: 'nodes', nodes: 'nodes', dashboard: 'telemetry', automation: 'automations', config: 'configuration', tools: 'info', channels: 'channels', dms: 'dms' },
  reticulum: { map: 'map', nodes: 'destinations', dashboard: null, automation: null, config: 'configuration', tools: 'info', channels: null, dms: 'dms' },
};

export function familyOf(type: string): 'meshtastic' | 'meshcore' | 'reticulum' {
  if (type === 'meshcore') return 'meshcore';
  if (type === 'reticulum') return 'reticulum';
  return 'meshtastic';
}

/** Sources that Classic serves with App (Meshtastic TCP and the MQTT types): the Workspace chat's scope. */
export function isMeshtasticFamily(type: string): boolean {
  return familyOf(type) === 'meshtastic' && type !== 'meshcore_mqtt';
}

/** App's message gate (App.tsx canSearch): messages:read or any channel_N:read on the device. */
export function canReadMessages(hasPermission: ReturnType<typeof useAuth>['hasPermission'], sourceId: string): boolean {
  return ['messages', ...Array.from({ length: 8 }, (_, i) => `channel_${i}`)].some((r) =>
    hasPermission(r as ResourceType, 'read', { sourceId }),
  );
}

/** Today's words for a device's state. */
export function statusLabel(t: TFunction, status: WorkspaceSource['status']): string {
  return {
    connected: t('source.status_connected'),
    connecting: t('source.status_connecting'),
    offline: t('source.status_disconnected'),
    disabled: t('source.status_disabled'),
  }[status];
}

/** The view gate each entry shares with MeshCore's tabs. */
const GATE: Record<string, MeshCoreView> = {
  map: 'nodes', nodes: 'nodes', dashboard: 'telemetry', automation: 'automations', config: 'configuration',
  tools: 'info', channels: 'channels', dms: 'dms',
};

/**
 * Where each device entry (a `TOOL_TABS` key) leads for this viewer, or null
 * when the device type has no such tab or the viewer may not open it: the same
 * gates as MeshCore's tabs (`visibleMeshCoreViews`; DMs need messages:read).
 * A Meshtastic-family device's Channels follow Classic's Channels tab instead
 * (App.tsx `hasAnyChannelPermission`): any `channel_N:read`, or a readable
 * Channel Database entry, which is fetched only when no slot is readable.
 * Shared by the desktop sidebar, the phone tab bar and the device Home.
 */
export function useDeviceTab(source: WorkspaceSource | null | undefined): (key: string) => string | null {
  const { authStatus, hasPermission } = useAuth();
  const meshtastic = !!source && isMeshtasticFamily(source.type);
  const anySlot =
    !!source &&
    meshtastic &&
    Array.from({ length: 8 }, (_, i) => `channel_${i}` as ResourceType).some((r) => hasPermission(r, 'read', { sourceId: source.id }));
  const { entries } = useChannelDatabaseEntries(meshtastic && !anySlot);
  if (!source) return () => null;
  const base = `/source/${encodeURIComponent(source.id)}`;
  const family = familyOf(source.type);
  const visible = visibleMeshCoreViews({
    canRead: (resource) => hasPermission(resource, 'read', { sourceId: source.id }),
    isAuthenticated: authStatus?.authenticated ?? false,
  });
  return (key) => {
    if (source.type === 'meshcore_mqtt') return key === 'map' ? base : null;
    if (key === 'automation' && source.type === 'mqtt_bridge') return null;
    if (key === 'config' && family === 'meshtastic' && !hasDeviceConfigurationPage(source.type)) return null;
    if (key === 'channels' && meshtastic) return anySlot || entries.length > 0 ? `${base}/channels` : null;
    const name = TOOL_TABS[family][key];
    return name && visible.includes(GATE[key]) ? `${base}/${name}` : null;
  };
}
