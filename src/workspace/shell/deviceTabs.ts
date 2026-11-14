/**
 * Per device type: which of today's tabs each Workspace entry leads to, and
 * today's words for a device's state. Shared by the sidebar, the phone tab bar,
 * the switcher and the You page.
 */
import type { TFunction } from 'i18next';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeviceConfigurationPage } from '../../components/search/configSections';
import { visibleMeshCoreViews, type MeshCoreView } from '../../components/MeshCore/meshCoreViewAccess';
import type { WorkspaceSource } from './useWorkspaceSources';

/** Tab per tool row, by source type; null: the type has no such tab. */
export const TOOL_TABS: Record<'meshtastic' | 'meshcore' | 'reticulum', Record<string, string | null>> = {
  meshtastic: { map: 'nodes', nodes: 'nodes', dashboard: 'dashboard', automation: 'automation', config: 'settings', tools: 'info', channels: 'channels', dms: 'messages' },
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
 * Shared by the desktop sidebar and the phone tab bar.
 */
export function useDeviceTab(source: WorkspaceSource | null | undefined): (key: string) => string | null {
  const { authStatus, hasPermission } = useAuth();
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
    const name = TOOL_TABS[family][key];
    return name && visible.includes(GATE[key]) ? `${base}/${name}` : null;
  };
}
