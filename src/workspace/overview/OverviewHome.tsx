/**
 * The phone Overview Home (board 5-07-overview-home, note s5n0): `/overview`
 * below 768 px, under the shell's "Overview ▾" header. Tiles for the
 * all-devices tools, then This MeshMonitor, as the desktop OverviewSidebar
 * (same list, same gates). The tab bar stays Home · DMs · Activity · You.
 *
 * Subtitles are the board's where they need no data of their own; the map's
 * node count is today's deduplicated Unified count (`useUnifiedStatus`, the
 * hook and poll Classic's Dashboard uses). Nothing here sends.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useUnifiedStatus } from '../../hooks/useDashboardData';
import { useOverviewTools, type OverviewTool } from './overviewTools';
import styles from './OverviewHome.module.css';

const SUBTITLES: Record<string, string> = {
  dashboard: 'workspace.overview.dashboard_sub',
  packets: 'workspace.overview.packets_sub',
  analysis: 'workspace.overview.analysis_sub',
  users: 'workspace.overview.users_sub',
};

export default function OverviewHome() {
  const { t } = useTranslation();
  const { devices, install } = useOverviewTools();
  const nodes = useUnifiedStatus()?.nodeCount;

  const subtitle = (key: string) => {
    if (key === 'map') return nodes !== undefined ? t('workspace.overview.nodes', { count: nodes }) : null;
    return SUBTITLES[key] ? t(SUBTITLES[key]) : null;
  };

  const section = (label: string, tools: OverviewTool[]) =>
    tools.length > 0 && (
      <section>
        <h2 className={styles.label}>{label}</h2>
        <nav className={styles.tiles} aria-label={label}>
          {tools.map((tool) => {
            const sub = subtitle(tool.key);
            return (
              <Link key={tool.key} to={tool.to} className={styles.tile}>
                <UiIcon name={tool.icon} size={24} />
                <span className={styles.text}>
                  <span className={styles.title} data-row-title="">{tool.label}</span>
                  {sub && <span className={styles.sub}>{sub}</span>}
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
    );

  return (
    <div className={styles.page}>
      {section(t('workspace.overview.all_devices'), devices)}
      {section(t('workspace.overview.this_meshmonitor'), install)}
      <p className={styles.note}>
        <UiIcon name="info" size={14} />
        <span>{t('workspace.overview.home_note')}</span>
      </p>
    </div>
  );
}
