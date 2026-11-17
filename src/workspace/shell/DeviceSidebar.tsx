/**
 * The sidebar of layout D (board a-chat-D-desktop, note asD). Its content
 * follows the route (spec §5.3):
 *
 * - `device`: header (device name, status line, and the Activity bell of
 *   Task 2.8 on a Meshtastic-family device), the Search Messages field
 *   (Task 2.6; with its ⌘K / Ctrl+K hint) where the viewer can search, the device's tools, then
 *   Channels and Direct messages. A Meshtastic-family device lists its
 *   channels and DM conversations (Task 2.3); other types link to today's
 *   tabs. "Message a node" opens the DM inbox (Meshtastic family, Task 2.6)
 *   or today's DM tab.
 * - `settings`: the device's settings list (Task 5.2, SettingsList).
 * - `server` is ServerSidebar's (Task 6.4), `you` is YouSidebar's.
 * - `overview` is OverviewSidebar's (Task 4.1).
 *
 * Rows follow today's permission gates, read with the same rules as MeshCore's
 * tabs (`visibleMeshCoreViews`), for the device in the URL. A MeshCore device
 * lists its own tools, channels, rooms and DMs (MeshCoreSidebar, Task 7.1),
 * with a gear to today's Settings.
 */
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon, type UiIconName } from '../../components/icons';
import { deviceConfigurationNav, mapNav } from '../../components/nav/sourceNavEntries';
import SidebarSection from './SidebarSection';
import SettingsList from '../settings/SettingsList';
import { canReadMessages, isMeshtasticFamily, statusLabel, useDeviceTab } from './deviceTabs';
import ActivityPanel from '../activity/ActivityPanel';
import ChannelList from '../chat/ChannelList';
import DmList from '../chat/DmList';
import ConnectionCard from '../devices/ConnectionCard';
import { visibleMeshCoreViews } from '../../components/MeshCore/meshCoreViewAccess';
import type { WorkspaceSource } from './useWorkspaceSources';
import styles from './DeviceSidebar.module.css';

// Its own chunk: today's MeshCore list helpers stay out of the shell.
const MeshCoreSidebar = lazy(() => import('../meshcore/MeshCoreSidebar.tsx'));

export type SidebarMode = 'device' | 'overview' | 'settings' | 'server' | 'you';

interface Row {
  to: string;
  label: string;
  icon?: UiIconName;
  count?: string;
}

interface DeviceSidebarProps {
  mode: SidebarMode;
  source: WorkspaceSource | undefined;
  /** Called after a row is followed (closes the drawer). */
  onNavigate?: () => void;
  /** Opens message search for this device; null where the viewer cannot search it. */
  onSearch?: (() => void) | null;
}

export default function DeviceSidebar({ mode, source, onNavigate, onSearch }: DeviceSidebarProps) {
  const { t } = useTranslation();
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

  if (!source) return <Frame title={t('workspace.shell.devices')}>{null}</Frame>;

  const header = <DeviceHeader source={source} />;

  if (mode === 'settings') {
    return (
      <aside className={styles.sidebar} aria-label={source.name}>
        <SettingsList sourceId={source.id} sourceName={source.name} sourceType={source.type} variant="sidebar" onNavigate={onNavigate} />
      </aside>
    );
  }

  if (source.type === 'meshcore') {
    return (
      <Frame title={source.name} header={header}>
        <Suspense fallback={null}>
          <MeshCoreSidebar key={source.id} source={source} onNavigate={onNavigate} />
        </Suspense>
      </Frame>
    );
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

/**
 * Name and status line: "Connected · !a1b2c3d4", and the Activity bell (Task 2.8, Meshtastic family).
 * The status line opens the device's Connection card (ds6, Task 6.7).
 */
function DeviceHeader({ source }: { source: WorkspaceSource }) {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const bell = isMeshtasticFamily(source.type) && canReadMessages(hasPermission, source.id);
  // A MeshCore device's gear: today's Settings tab (board 8-01).
  const gear =
    source.type === 'meshcore' &&
    visibleMeshCoreViews({
      canRead: (resource) => hasPermission(resource, 'read', { sourceId: source.id }),
      isAuthenticated: authStatus?.authenticated ?? false,
    }).includes('settings');
  const label = statusLabel(t, source.status);
  const nodeNum = source.live?.nodeNum;
  const line = nodeNum !== undefined && source.status === 'connected' ? `${label} · !${nodeNum.toString(16).padStart(8, '0')}` : label;
  const [cardOpen, setCardOpen] = useState(false);
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        <h2 className={styles.title} title={source.name}>{source.name}</h2>
        <button type="button" className={styles.status} aria-haspopup="dialog" onClick={() => setCardOpen(true)}>
          <span className={styles.dot} data-status={source.status} aria-hidden="true" />
          <span>{line}</span>
        </button>
      </div>
      <ConnectionCard source={source} open={cardOpen} onClose={() => setCardOpen(false)} />
      {bell && <ActivityPanel key={source.id} sourceId={source.id} deviceName={source.name} />}
      {gear && (
        <NavLink className={styles.gear} to={`/source/${encodeURIComponent(source.id)}/settings`} aria-label={t('nav.settings', 'Settings')} title={t('nav.settings', 'Settings')}>
          <UiIcon name="settings" size={18} />
        </NavLink>
      )}
    </div>
  );
}
