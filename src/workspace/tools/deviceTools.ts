/**
 * A Meshtastic-family device's More tools (note ds12): Info, Packet monitor
 * and Security, each under today's tab gate on this device (App.tsx
 * `tabPermissions`: info:read, packetmonitor:read, security:read). Shared by
 * the desktop sidebar's More tools… group and the phone's Tools page (q1).
 */
import { useAuth } from '../../contexts/AuthContext';
import type { UiIconName } from '../../components/icons';
import type { ResourceType } from '../../types/permission';
import { useTranslation } from 'react-i18next';

export interface DeviceTool {
  key: 'info' | 'packetmonitor' | 'security';
  to: string;
  icon: UiIconName;
  label: string;
  /** The Tools page's second line. */
  lineKey: string;
  tone: string;
}

const TOOLS: Array<{ key: DeviceTool['key']; resource: ResourceType; icon: UiIconName; labelKey: string; lineKey: string; tone: string }> = [
  { key: 'info', resource: 'info', icon: 'info', labelKey: 'nav.info', lineKey: 'workspace.tools.info_line', tone: 'blue' },
  { key: 'packetmonitor', resource: 'packetmonitor', icon: 'list', labelKey: 'nav.packet_monitor', lineKey: 'workspace.tools.packets_line', tone: 'green' },
  { key: 'security', resource: 'security', icon: 'security', labelKey: 'nav.security', lineKey: 'workspace.tools.security_line', tone: 'peach' },
];

/** The tools this viewer may open on a Meshtastic-family device; none for other types (they list their own). */
export function useDeviceTools(sourceId: string, sourceType: string | undefined): DeviceTool[] {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  if (!sourceType || sourceType === 'meshcore' || sourceType === 'meshcore_mqtt' || sourceType === 'reticulum') return [];
  const base = `/source/${encodeURIComponent(sourceId)}`;
  return TOOLS.filter((tool) => hasPermission(tool.resource, 'read', { sourceId })).map((tool) => ({
    key: tool.key, to: `${base}/${tool.key}`, icon: tool.icon, label: t(tool.labelKey), lineKey: tool.lineKey, tone: tool.tone,
  }));
}

/** Info's groups (o2, 16-01): each opens `info/<group>` with today's fields. */
export const INFO_GROUPS = ['connection', 'radio', 'node', 'mesh', 'records', 'mqtt', 'server'] as const;
export type InfoGroup = (typeof INFO_GROUPS)[number];

/** A security row's node id in Workspace URLs: `!hex` for Meshtastic (`mt:<n>`), the public key for MeshCore (`mc:<pk>`). */
export function nodeIdOf(nodeKey: string): string | null {
  if (nodeKey.startsWith('mc:')) return nodeKey.slice(3);
  if (!nodeKey.startsWith('mt:')) return null;
  const num = Number(nodeKey.slice(3));
  return Number.isFinite(num) ? `!${num.toString(16).padStart(8, '0')}` : null;
}
