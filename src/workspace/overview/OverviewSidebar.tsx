/**
 * The desktop Overview sidebar (board f6-overview, note ds3): "Overview" with
 * "All devices · N of M connected", the all-devices tools, This MeshMonitor
 * (install-wide tools, by Classic's gates), and the devices with their state.
 * The frame and rows are the device sidebar's, so both sidebars look alike.
 */
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { isReceiveOnly, overviewStatus, statusLabel } from '../shell/deviceTabs';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { useOverviewTools, type OverviewTool } from './overviewTools';
import frame from '../shell/DeviceSidebar.module.css';
import styles from './OverviewSidebar.module.css';

/** The URLs that show the all-devices map, so its row is current on each. */
const MAP_PATHS = ['/', '/overview', '/overview/map'];

interface OverviewSidebarProps {
  sources: WorkspaceSource[];
  /** Called after a row is followed (closes the drawer). */
  onNavigate?: () => void;
}

export default function OverviewSidebar({ sources, onNavigate }: OverviewSidebarProps) {
  const { t } = useTranslation();
  const path = useLocation().pathname.replace(/(.)\/$/, '$1');
  // `/reports/…` is the same page as `/overview/reports/…` (Task 4.4).
  const toolPath = path.replace(/^\/reports(?=\/|$)/, '/overview/reports');
  const { devices, install } = useOverviewTools();
  const title = t('workspace.shell.overview');
  const rowClass = (on: boolean) => `${frame.row} ${on ? frame.on : ''}`;

  const toolList = (label: string, tools: OverviewTool[]) => (
    <ul className={frame.list} aria-label={label}>
      {tools.map((tool) => {
        const on = tool.key === 'map' ? MAP_PATHS.includes(path) : toolPath === tool.to || toolPath.startsWith(`${tool.to}/`);
        return (
          <li key={tool.key}>
            <Link to={tool.to} className={rowClass(on)} aria-current={on ? 'page' : undefined} onClick={onNavigate}>
              <UiIcon name={tool.icon} size={16} />
              <span className={frame.label}>{tool.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const state = (s: WorkspaceSource) => {
    if (s.status !== 'connected') return statusLabel(t, s.status);
    if (isReceiveOnly(s)) return t('workspace.switcher.receive_only');
    const online = s.live?.activeNodeCount;
    return online !== undefined ? t('workspace.shell.online_count', { count: online }) : statusLabel(t, s.status);
  };

  return (
    <aside className={frame.sidebar} aria-label={title}>
      <div className={frame.head}>
        <div className={frame.headText}>
          <h2 className={frame.title}>{title}</h2>
          <p className={frame.status}>{overviewStatus(t, sources)}</p>
        </div>
      </div>
      <div className={frame.body}>
        {toolList(title, devices)}
        {install.length > 0 && (
          <>
            <h3 className={styles.group}>{t('workspace.overview.this_meshmonitor')}</h3>
            {toolList(t('workspace.overview.this_meshmonitor'), install)}
          </>
        )}
        <h3 className={styles.group}>{t('workspace.shell.devices')}</h3>
        <ul className={frame.list} aria-label={t('workspace.shell.devices')}>
          {sources
            .filter((s) => s.status !== 'disabled')
            .map((s) => (
              <li key={s.id}>
                <Link to={`/source/${encodeURIComponent(s.id)}`} className={frame.row} onClick={onNavigate}>
                  <span className={styles.swatch} style={{ background: s.colorToken }} aria-hidden="true" />
                  <span className={frame.label} title={s.name}>{s.name}</span>
                  <span className={`${frame.count} ${styles.state}`}>
                    <span className={frame.dot} data-status={s.status} aria-hidden="true" />
                    {state(s)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </aside>
  );
}
