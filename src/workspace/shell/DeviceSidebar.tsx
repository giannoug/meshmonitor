/**
 * The sidebar of layout D (board a-chat-D-desktop, note asD). Its content
 * follows the route (spec §5.3):
 *
 * - `device`: header (device name, status line), the Search Messages field
 *   (Task 2.6; with its ⌘K / Ctrl+K hint) where the viewer can search, the device's tools, then
 *   Channels and Direct messages. A Meshtastic-family device lists its
 *   channels and DM conversations (Task 2.3); other types link to today's
 *   tabs. "Message a node" opens the DM inbox (Meshtastic family, Task 2.6)
 *   or today's DM tab.
 * - `settings` / `server` / `you`: the categories of the re-hosted settings
 *   pages, as links to their Workspace URLs (Phases 5 and 6 rebuild them).
 * - `overview`: the all-devices tools (note ds3).
 *
 * Rows follow today's permission gates, read with the same rules as MeshCore's
 * tabs (`visibleMeshCoreViews`), for the device in the URL.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon, type UiIconName } from '../../components/icons';
import { deviceConfigurationNav, globalSettingsNav, mapNav } from '../../components/nav/sourceNavEntries';
import {
  configurationNavItems,
  hasDeviceConfigurationPage,
  settingsNavItems,
} from '../../components/search/configSections';
import { PREFERENCE_CATEGORIES } from '../routes';
import SidebarSection from './SidebarSection';
import { isMeshtasticFamily, statusLabel, useDeviceTab } from './deviceTabs';
import ChannelList from '../chat/ChannelList';
import DmList from '../chat/DmList';
import type { WorkspaceSource } from './useWorkspaceSources';
import styles from './DeviceSidebar.module.css';

export type SidebarMode = 'device' | 'overview' | 'settings' | 'server' | 'you';

interface Row {
  to: string;
  label: string;
  icon?: UiIconName;
  count?: string;
}

interface DeviceSidebarProps {
  mode: SidebarMode;
  sourceId: string | null;
  source: WorkspaceSource | undefined;
  /** Called after a row is followed (closes the drawer). */
  onNavigate?: () => void;
  /** Opens message search for this device; null where the viewer cannot search it. */
  onSearch?: (() => void) | null;
}

export default function DeviceSidebar({ mode, sourceId, source, onNavigate, onSearch }: DeviceSidebarProps) {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  const base = sourceId ? `/source/${encodeURIComponent(sourceId)}` : '';
  const tab = useDeviceTab(source);

  const list = (rows: Row[]) => (
    <ul className={styles.list}>
      {rows.map((r) => (
        <li key={r.to + r.label}>
          <NavLink to={r.to} end className={({ isActive }) => `${styles.row} ${isActive ? styles.on : ''}`} onClick={onNavigate}>
            {r.icon && <UiIcon name={r.icon} size={16} />}
            <span className={styles.label}>{r.label}</span>
            {r.count && <span className={styles.count}>{r.count}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  if (mode === 'overview') {
    const rows: Row[] = [
      { to: '/overview/map', label: mapNav(t).label, icon: 'map' },
      { to: '/overview/messages', label: t('source.sidebar.unified_messages'), icon: 'messages' },
      { to: '/overview/telemetry', label: t('source.sidebar.unified_telemetry'), icon: 'telemetry' },
      { to: '/overview/packets', label: t('source.sidebar.unified_packets', 'Unified Packets'), icon: 'package' },
      { to: '/overview/analysis', label: t('source.sidebar.map_analysis'), icon: 'map' },
      { to: '/overview/reports', label: t('source.sidebar.reports', 'Analysis & Reports'), icon: 'reports' },
      ...(hasPermission('automations', 'read') ? [{ to: '/overview/automations', label: t('source.sidebar.automations', 'Automation Engine'), icon: 'bot' as const }] : []),
      ...(isAdmin ? [{ to: '/overview/users', label: t('nav.users'), icon: 'users' as const }] : []),
      ...(hasPermission('audit', 'read') ? [{ to: '/overview/audit', label: t('nav.audit_log'), icon: 'reports' as const }] : []),
    ];
    return <Frame title={t('workspace.shell.overview')}>{list(rows)}</Frame>;
  }

  if (mode === 'server' || mode === 'you') {
    const prefs = mode === 'you';
    const rows = settingsNavItems(t, { mode: 'global', isAdmin, canWriteSettings: hasPermission('settings', 'write', { anySource: true }) })
      .map((item) => ({ cat: item.id.slice('settings-'.length), label: item.label }))
      .filter(({ cat }) => PREFERENCE_CATEGORIES.includes(cat) === prefs)
      .map(({ cat, label }) => ({ to: `/${prefs ? 'preferences' : 'server'}/${cat}`, label }));
    return <Frame title={prefs ? t('workspace.shell.preferences') : globalSettingsNav(t).label}>{list(rows)}</Frame>;
  }

  if (!source) return <Frame title={t('workspace.shell.devices')}>{null}</Frame>;

  const header = <DeviceHeader source={source} />;

  if (mode === 'settings') {
    const items = [
      ...(hasDeviceConfigurationPage(source.type) ? configurationNavItems(t, { showFirmware: isAdmin }) : []),
      ...settingsNavItems(t, {
        mode: 'source',
        isAdmin,
        canWriteSettings: hasPermission('settings', 'write', { sourceId: source.id }),
        sourceType: source.type,
        canReadSources: hasPermission('sources', 'read'),
        canReadConfiguration: hasPermission('configuration', 'read', { sourceId: source.id }),
      }),
    ];
    const seen = new Set<string>();
    const rows = items.flatMap((item) => {
      const cat = item.id.replace(/^(config|settings)-/, '');
      if (seen.has(cat)) return [];
      seen.add(cat);
      return [{ to: `${base}/settings/${cat}`, label: item.label }];
    });
    return <Frame title={source.name} header={header}>{list(rows)}</Frame>;
  }

  // Device mode.
  const active = source.live?.activeNodeCount;
  const tools: Array<Row & { key: string }> = [
    { key: 'map', to: '', label: mapNav(t).label, icon: 'map' },
    { key: 'nodes', to: '', label: t('nodes.title'), icon: 'radioSignal', count: active !== undefined ? t('workspace.shell.online_count', { count: active }) : undefined },
    { key: 'dashboard', to: '', label: t('nav.dashboard'), icon: 'dashboard' },
    { key: 'automation', to: '', label: t('nav.automation'), icon: 'bot' },
    { key: 'config', to: '', label: deviceConfigurationNav(t).label, icon: 'configuration' },
    { key: 'tools', to: '', label: t('workspace.shell.more_tools'), icon: 'activity' },
  ];
  const rows = tools.flatMap((r) => {
    const to = tab(r.key);
    return to ? [{ ...r, to }] : [];
  });
  const channels = tab('channels');
  const dms = tab('dms');

  const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);

  return (
    <Frame title={source.name} header={header}>
      {onSearch && (
        <button type="button" className={styles.search} onClick={onSearch}>
          <UiIcon name="search" size={16} />
          <span className={styles.label}>{t('search.title')}</span>
          <kbd className={styles.kbd}>{t(mac ? 'workspace.search.shortcut_mac' : 'workspace.search.shortcut_other')}</kbd>
        </button>
      )}
      {list(rows)}
      {channels && (
        <SidebarSection title={t('channels.title')}>
          {isMeshtasticFamily(source.type) ? (
            <ChannelList sourceId={source.id} sourceType={source.type} onNavigate={onNavigate} />
          ) : (
            list([{ to: channels, label: t('workspace.shell.open_channels'), icon: 'channels' }])
          )}
        </SidebarSection>
      )}
      {dms && (
        <SidebarSection title={t('workspace.shell.direct_messages')}>
          {isMeshtasticFamily(source.type) && <DmList sourceId={source.id} onNavigate={onNavigate} />}
          {list([{ to: dms, label: t('workspace.shell.message_a_node'), icon: 'plus' }])}
        </SidebarSection>
      )}
    </Frame>
  );
}

function Frame({ title, header, children }: { title: string; header?: ReactNode; children: ReactNode }) {
  return (
    <aside className={styles.sidebar} aria-label={title}>
      {header ?? <div className={styles.head}><h2 className={styles.title}>{title}</h2></div>}
      <div className={styles.body}>{children}</div>
    </aside>
  );
}

/** Name and status line: "Connected · !a1b2c3d4". */
function DeviceHeader({ source }: { source: WorkspaceSource }) {
  const { t } = useTranslation();
  const label = statusLabel(t, source.status);
  const nodeNum = source.live?.nodeNum;
  const line = nodeNum !== undefined && source.status === 'connected' ? `${label} · !${nodeNum.toString(16).padStart(8, '0')}` : label;
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        <h2 className={styles.title} title={source.name}>{source.name}</h2>
        <p className={styles.status}>
          <span className={styles.dot} data-status={source.status} aria-hidden="true" />
          <span>{line}</span>
        </p>
      </div>
    </div>
  );
}
