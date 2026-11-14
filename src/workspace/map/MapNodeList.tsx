/**
 * "On the map · N" (board Main): the nodes the map draws, in the Nodes sort
 * order, each opening its peek. Collapses like today's node list beside the
 * map (the same UI setting), and leads to Nodes for the full table.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useSettings } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import styles from './DeviceMap.module.css';

export interface MapNodeListProps {
  sourceId: string;
  nodes: DeviceInfo[];
  selectedId: string | null;
  hopsOf(node: DeviceInfo): number;
  onPick(node: DeviceInfo): void;
}

export default function MapNodeList({ sourceId, nodes, selectedId, hopsOf, onPick }: MapNodeListProps) {
  const { t } = useTranslation();
  const { timeFormat, dateFormat } = useSettings();
  const { isNodeListCollapsed, setIsNodeListCollapsed } = useUI();
  const title = t('workspace.map.on_the_map');

  if (isNodeListCollapsed) {
    return (
      <button type="button" className={styles.listOpen} onClick={() => setIsNodeListCollapsed(false)} aria-label={t('workspace.map.list_show')}>
        <UiIcon name="list" size={18} />
        <span>{title}</span>
      </button>
    );
  }
  return (
    <section className={styles.list} aria-labelledby="map-list-title">
      <div className={styles.listHead}>
        <h2 id="map-list-title" className={styles.listTitle}>
          {title} <span className={styles.count}>· {nodes.length}</span>
        </h2>
        <button type="button" className={styles.iconButton} onClick={() => setIsNodeListCollapsed(true)} aria-label={t('workspace.map.list_hide')}>
          <UiIcon name="back" size={18} />
        </button>
      </div>
      <ul className={styles.rows} aria-label={title}>
        {nodes.map((node) => {
          const hops = hopsOf(node);
          const role = node.user?.role != null && String(node.user.role) !== '0' ? getDeviceRoleName(node.user.role) : null;
          const battery = node.deviceMetrics?.batteryLevel;
          const line = [
            hops >= 999 ? null : hops === 0 ? t('workspace.chat.direct') : t('workspace.chat.hops', { count: hops }),
            node.snr != null ? `${node.snr.toFixed(1)} dB` : null,
            battery != null ? (battery === 101 ? t('nodes.plugged_in') : `${battery}%`) : null,
          ].filter(Boolean).join(' · ');
          return (
            <li key={node.nodeNum}>
              <button type="button" className={styles.row} aria-current={selectedId === node.user?.id || undefined} onClick={() => onPick(node)}>
                <span className={styles.avatar} style={{ background: `var(--device-${(node.nodeNum % 8) + 1})` }} aria-hidden="true">
                  {node.user?.shortName?.trim() || String(node.nodeNum).slice(-4)}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>
                    <span className={styles.ellipsis}>{node.user?.longName || node.user?.shortName || `!${node.nodeNum.toString(16)}`}</span>
                    {role && <span className={styles.role}>{role}</span>}
                  </span>
                  {line && <span className={styles.rowLine}>{line}</span>}
                </span>
                {node.lastHeard ? <span className={styles.time}>{formatRelativeTime(node.lastHeard * 1000, timeFormat, dateFormat)}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Link className={styles.listFoot} to={`/source/${encodeURIComponent(sourceId)}/nodes`}>
        {t('workspace.map.open_in_nodes')}
        <UiIcon name="chevronRight" size={16} />
      </Link>
    </section>
  );
}
