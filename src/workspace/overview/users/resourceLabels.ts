/**
 * Row labels for the permission matrix: today's en.json labels where UsersTab
 * has one (D9b); the board's words where today's label is hardcoded English
 * (Nodes & map, Packet monitor, Channel database, Automations (all rules)).
 * Tooltips are today's.
 */
import type { TFunction } from 'i18next';
import type { ResourceType } from '../../../types/permission';
import { CHANNEL_TOOLTIP, NODES_TOOLTIP, PERMISSION_TOOLTIPS } from '../../../components/users/userPermissionModel';

const TODAY: Partial<Record<ResourceType, string>> = {
  settings: 'nav.settings',
  configuration: 'nav.device_configuration',
  info: 'nav.info',
  automation: 'nav.automation',
  audit: 'nav.audit',
  security: 'nav.security',
  nodes_private: 'nodes_private',
  connection: 'users.can_control_connection',
  traceroute: 'users.traceroute_permission',
};

export function resourceLabel(t: TFunction, resource: ResourceType): string {
  const channel = /^channel_(\d+)$/.exec(resource);
  if (channel) return channel[1] === '0' ? t('users.channel_primary') : t('users.channel_n', { n: channel[1] });
  if (resource === 'messages') return `${t('nav.messages')} & DM`;
  const key = TODAY[resource];
  return key ? t(key) : t(`workspace.users.resource.${resource}`);
}

export const resourceTooltip = (resource: ResourceType): string =>
  resource.startsWith('channel_') ? CHANNEL_TOOLTIP : resource === 'nodes' ? NODES_TOOLTIP : PERMISSION_TOOLTIPS[resource] ?? '';
