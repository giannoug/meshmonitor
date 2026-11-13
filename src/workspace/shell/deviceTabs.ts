/**
 * Per device type: which of today's tabs each Workspace entry leads to, and
 * today's words for a device's state. Shared by the sidebar, the phone tab bar,
 * the switcher and the You page.
 */
import type { TFunction } from 'i18next';
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

/** Today's words for a device's state. */
export function statusLabel(t: TFunction, status: WorkspaceSource['status']): string {
  return {
    connected: t('source.status_connected'),
    connecting: t('source.status_connecting'),
    offline: t('source.status_disconnected'),
    disabled: t('source.status_disabled'),
  }[status];
}

/** The DMs path of a device (today's DM view until Phase 2), or null when its type has none. */
export function dmsPathOf(source: WorkspaceSource): string | null {
  const tab = source.type === 'meshcore_mqtt' ? null : TOOL_TABS[familyOf(source.type)].dms;
  return tab && `/source/${encodeURIComponent(source.id)}/${tab}`;
}
