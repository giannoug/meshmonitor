/**
 * The Overview's destinations (note ds3, s5n0), shared by the desktop
 * OverviewSidebar and the phone OverviewHome: the all-devices tools, then the
 * install-wide ones ("This MeshMonitor"). Labels are today's for the pages
 * Classic already links (D9b); the gates are Classic's: Automation Engine with
 * automations:read (DashboardSidebar), Users for admins (SidebarFooter), Audit
 * Log with audit:read (Sidebar).
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { UiIconName } from '../../components/icons';

export interface OverviewTool {
  key: string;
  to: string;
  label: string;
  icon: UiIconName;
}

export function useOverviewTools(): { devices: OverviewTool[]; install: OverviewTool[] } {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  const devices: OverviewTool[] = [
    { key: 'map', to: '/overview/map', label: t('workspace.overview.map'), icon: 'map' },
    { key: 'dashboard', to: '/overview/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
    { key: 'messages', to: '/overview/messages', label: t('source.sidebar.unified_messages'), icon: 'messages' },
    { key: 'telemetry', to: '/overview/telemetry', label: t('source.sidebar.unified_telemetry'), icon: 'telemetry' },
    { key: 'packets', to: '/overview/packets', label: t('source.sidebar.unified_packets'), icon: 'list' },
    { key: 'analysis', to: '/overview/analysis', label: t('source.sidebar.map_analysis'), icon: 'globe' },
    { key: 'reports', to: '/overview/reports', label: t('source.sidebar.reports', 'Analysis & Reports'), icon: 'file' },
  ];
  const install: OverviewTool[] = [
    ...(hasPermission('automations', 'read')
      ? [{ key: 'automations', to: '/overview/automations', label: t('source.sidebar.automations', 'Automation Engine'), icon: 'zap' as const }]
      : []),
    ...(isAdmin ? [{ key: 'users', to: '/overview/users', label: t('nav.users'), icon: 'users' as const }] : []),
    ...(hasPermission('audit', 'read') ? [{ key: 'audit', to: '/overview/audit', label: t('nav.audit_log'), icon: 'reports' as const }] : []),
  ];
  return { devices, install };
}
