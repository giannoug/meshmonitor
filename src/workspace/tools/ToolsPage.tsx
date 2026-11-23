/**
 * A device's Tools (board q1-tools; note ds12): `/source/:id/tools`, the
 * phone's door to what the desktop sidebar keeps under More tools…: Info,
 * Packet monitor and Security, then the device's Dashboard, and a row to the
 * Overview (Analysis, Reports, Users and the Audit log are install-wide).
 * Each row follows today's tab gate on this device. The page reads nothing
 * and sends nothing.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useShellDevices } from '../shell/shellDevices';
import { useDeviceTab } from '../shell/deviceTabs';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import { useDeviceTools } from './deviceTools';
import mc from '../meshcore/McTools.module.css';
import styles from './Tools.module.css';

export default function ToolsPage({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sources } = useShellDevices();
  const device = sources.find((s) => s.id === sourceId);
  const tab = useDeviceTab(device);
  const tools = useDeviceTools(sourceId, device?.type);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const dashboard = tab('dashboard');

  const rows: Array<{ key: string; to: string; icon: UiIconName; label: string; line: string; tone: string }> = [
    ...tools.map((tool) => ({ ...tool, line: t(tool.lineKey) })),
    ...(dashboard
      ? [{ key: 'dashboard', to: dashboard, icon: 'dashboard' as const, label: t('nav.dashboard'), line: t('workspace.tools.dashboard_line'), tone: 'purple' }]
      : []),
  ];

  const row = (r: { key: string; to: string; icon: UiIconName; label: string; line: string; tone: string }) => (
    <li key={r.key}>
      <Link to={r.to} className={styles.toolRow}>
        <span className={styles.toolIcon} data-tone={r.tone} aria-hidden="true">
          <UiIcon name={r.icon} size={22} />
        </span>
        <span className={styles.toolText}>
          <span className={styles.toolLabel}>{r.label}</span>
          <span className={styles.toolLine}>{r.line}</span>
        </span>
        <UiIcon name="chevronRight" size={18} />
      </Link>
    </li>
  );

  return (
    <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
      <ToolHead title={t('workspace.home.tools')} back={{ label: t('workspace.tools.home'), to: base }} />
      <section className={mc.section} aria-label={deviceName}>
        <h2 className={mc.sectionTitle}>{deviceName}</h2>
        <ul className={styles.toolList}>{rows.map(row)}</ul>
      </section>
      <ul className={styles.toolList}>
        {row({ key: 'overview', to: '/overview', icon: 'dashboard', label: t('workspace.shell.overview'), line: t('workspace.tools.overview_line'), tone: 'muted' })}
      </ul>
    </div>
  );
}
