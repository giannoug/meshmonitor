/**
 * A node's map peek (board Main, ds1, s15n4: today's map NodePopup): who it
 * is, its signal, the last traceroute, then Message, the three node menus and
 * Open node page. A side panel on desktop and a bottom sheet on phone; the
 * map stays in view either way.
 *
 * Gates are today's: Message needs messages:read (the popup's "More
 * details"), the node menus need a signed-in viewer (as the DM header), and
 * each menu item keeps its own gate (NodeActionMenus).
 */
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { TracerouteBody } from '../../components/map/popups/sections';
import { useRecentTraceroute } from '../../components/map/popups/nodeCardModel';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import { useNodes } from '../../hooks/useServerData';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import { getDistanceToNode } from '../../utils/distance';
import { getEffectiveHops } from '../../utils/nodeHops';
import { getHardwareModelName, parseNodeId } from '../../utils/nodeHelpers';
import NodeActionMenus from '../patterns/NodeActionMenus';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './NodePeek.module.css';

export interface NodePeekProps {
  node: DeviceInfo;
  sourceId: string;
  onClose(): void;
}

/** A stable avatar colour per node, as the DM header's. */
const avatarToken = (nodeNum: number) => `var(--device-${(nodeNum % 8) + 1})`;

export default function NodePeek({ node, sourceId, onClose }: NodePeekProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { authStatus, hasPermission } = useAuth();
  const { sourceType } = useSource();
  const { currentNodeId } = useData();
  const { traceroutes } = useMapContext();
  const { nodes } = useNodes();
  const { distanceUnit, nodeHopsCalculation, timeFormat, dateFormat } = useSettings();
  const recent = useRecentTraceroute(traceroutes, currentNodeId, node.user?.id);

  const nodeId = node.user?.id ?? `!${node.nodeNum.toString(16).padStart(8, '0')}`;
  const name = node.user?.longName || node.user?.shortName || nodeId;
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const nodePage = `${base}/node/${encodeURIComponent(nodeId)}`;
  const role = node.user?.role != null && String(node.user.role) !== '0' ? getDeviceRoleName(node.user.role) : null;
  const home = nodes.find((n) => n.user?.id === currentNodeId);
  const isHome = node.user?.id === currentNodeId;
  const hops = isHome ? 0 : getEffectiveHops(node, nodeHopsCalculation, traceroutes, currentNodeId ? parseNodeId(currentNodeId) : null);
  const distance = isHome ? null : getDistanceToNode(home, node, distanceUnit);
  const battery = node.deviceMetrics?.batteryLevel;
  const chUtil = node.deviceMetrics?.channelUtilization;
  const hw = getHardwareModelName(node.user?.hwModel);
  const sub = [hw, node.lastHeard ? t('workspace.map.heard', { time: formatRelativeTime(node.lastHeard * 1000, timeFormat, dateFormat) }) : null]
    .filter(Boolean)
    .join(' · ');
  const signedIn = authStatus?.authenticated === true;
  const canMessage = !!node.user?.id && hasPermission('messages', 'read', { sourceId });
  const protocol = sourceType === 'mqtt_bridge' || sourceType === 'mqtt_broker' ? 'mqtt' : 'meshtastic';
  const openNodePage = () => void navigate(nodePage, { state: { focusDmNodeId: nodeId } });

  const stat = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  const stats = [
    hops != null && hops < 999 && stat(t('nodes.hops'), hops),
    node.snr != null && stat(t('workspace.map.snr'), <>{node.snr.toFixed(1)} <small>dB</small></>),
    node.rssi != null && stat(t('workspace.map.rssi'), node.rssi),
    battery != null && stat(t('workspace.map.battery'), battery === 101 ? t('nodes.plugged_in') : <>{battery}<small>%</small></>),
    distance && stat(t('direct_links.distance', 'Distance'), distance),
    chUtil != null && stat(t('workspace.map.ch_util'), <>{chUtil.toFixed(0)}<small>%</small></>),
  ].filter(Boolean);

  const head = (
    <div className={styles.identity}>
      <span className={styles.avatar} style={{ background: avatarToken(node.nodeNum) }} aria-hidden="true">
        {node.user?.shortName?.trim() || nodeId.slice(-4)}
      </span>
      <div className={styles.titles}>
        {!isPhone && <h2 id={`peek-${node.nodeNum}`} className={styles.name}>{name}</h2>}
        <p className={styles.meta}>
          {role && <span className={styles.role}>{role}</span>}
          <span className={styles.id}>{nodeId}</span>
        </p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
    </div>
  );

  const body = (
    <>
      {stats.length > 0 && <dl className={styles.stats}>{stats}</dl>}
      {!isHome && (
        <div className={styles.route}>
          <TracerouteBody recentTraceroute={recent} nodes={nodes} distanceUnit={distanceUnit} />
        </div>
      )}
      {canMessage && (
        <Link className={styles.message} to={`${base}/dm/${encodeURIComponent(nodeId)}`}>
          <UiIcon name="messages" size={18} />
          {t('workspace.map.message')}
        </Link>
      )}
      {signedIn && (
        <div className={styles.menus}>
          <NodeActionMenus key={nodeId} protocol={protocol} sourceId={sourceId} node={node} variant={isPhone ? 'sheet' : 'menus'} onOpenNodePage={openNodePage} />
        </div>
      )}
      <Link className={styles.open} to={nodePage} state={{ focusDmNodeId: nodeId }}>
        {t('workspace.map.open_node_page')}
        <UiIcon name="chevronRight" size={16} />
      </Link>
    </>
  );

  if (isPhone) {
    return (
      <Sheet open onClose={onClose} title={name} side="bottom">
        {head}
        {body}
      </Sheet>
    );
  }
  return (
    <aside className={styles.peek} aria-labelledby={`peek-${node.nodeNum}`}>
      <div className={styles.head}>
        {head}
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {body}
    </aside>
  );
}
