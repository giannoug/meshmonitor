/**
 * The phone Nodes list (board g3-nodes): two-line rows, each opening the node
 * page. The second line is hops · SNR · battery · distance, as the desktop
 * table's cells; a node added from a contact link and not yet heard says so.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import { getDistanceToNode } from '../../utils/distance';
import TwoLineRow from '../patterns/TwoLineRow';
import { avatarStyle, batteryText, hopsText, nodeIdOf, nodeNameOf, shortLabel, type CellContext } from './nodeColumns';
import styles from './NodesTable.module.css';

export interface NodesListProps {
  sourceId: string;
  nodes: DeviceInfo[];
  ctx: CellContext;
}

export default function NodesList({ sourceId, nodes, ctx }: NodesListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  return (
    <ul className={styles.list} aria-label={t('nodes.title')}>
      {nodes.map((node) => {
        const nodeId = nodeIdOf(node);
        const imported = !!node.importedAt && !node.lastHeard;
        const role = node.user?.role != null && String(node.user.role) !== '0' ? getDeviceRoleName(node.user.role) : null;
        const hops = ctx.hopsOf(node);
        const line = imported
          ? t('nodes.imported_badge_title')
          : [
              hops >= 999 ? null : hops === 0 ? hopsText(0, t) : t('workspace.chat.hops', { count: hops }),
              node.hopsAway === 0 && node.snr != null ? `${node.snr.toFixed(1)} dB` : null,
              batteryText(node.deviceMetrics?.batteryLevel, t),
              getDistanceToNode(ctx.home, node, ctx.distanceUnit),
            ].filter(Boolean).join(' · ');
        return (
          <li key={node.nodeNum}>
            <TwoLineRow
              onClick={() => void navigate(`${base}/node/${encodeURIComponent(nodeId)}`, { state: { focusDmNodeId: nodeId } })}
              leading={<span className={styles.avatar} style={avatarStyle(node)} aria-hidden="true">{shortLabel(node)}</span>}
              title={
                <span className={styles.rowTitle}>
                  <span className={styles.ellipsis}>{nodeNameOf(node)}</span>
                  {node.isFavorite && <UiIcon name="favorite" size={14} title={t('node_filter.favorites')} className={styles.fav} />}
                  {role && <span className={styles.role} data-router={/router|repeater/i.test(role) || undefined}>{role}</span>}
                  {imported && <span className={styles.imported}>{t('nodes.imported_badge')}</span>}
                </span>
              }
              subtitle={line || undefined}
              trailing={node.lastHeard ? <span className={styles.time}>{formatRelativeTime(node.lastHeard * 1000, ctx.timeFormat, ctx.dateFormat)}</span> : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}
