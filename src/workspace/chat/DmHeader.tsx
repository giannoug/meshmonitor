/**
 * The DM header (boards 10-01, 10-07; note s10n0): the node chip (its name
 * opens the node page), role, Last seen · hops · id, Mute, and the node
 * menus. On the phone, Back and ⋯ (the node actions sheet).
 */
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import type { TimeFormat, DateFormat } from '../../contexts/SettingsContext';
import type { DeviceInfo } from '../../types/device';
import { formatDateTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import NodeActionMenus, { type NodeProtocol } from '../patterns/NodeActionMenus';
import { isHeardRecently } from './channelLabel';
import threadStyles from './ChannelThread.module.css';
import styles from './DmHeader.module.css';

export interface DmHeaderProps {
  sourceId: string;
  nodeId: string;
  node: DeviceInfo | undefined;
  name: string;
  protocol: NodeProtocol;
  isPhone: boolean;
  /** Signed in: Mute and the node menus (a guest has neither). */
  signedIn: boolean;
  muted: boolean;
  onMute(until: number | null): void;
  onUnmute(): void;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  onMessagesPurged(): void;
}

/** A stable avatar colour per node, as MessageRowD's. */
const avatarToken = (nodeId: string) => `var(--device-${((parseInt(nodeId.replace('!', ''), 16) || 0) % 8) + 1})`;

export default function DmHeader(props: DmHeaderProps) {
  const { sourceId, nodeId, node, name, protocol, isPhone } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const nodePage = `${base}/node/${encodeURIComponent(nodeId)}`;
  // The node page is today's (re-hosted) Messages tab, opened on this node.
  const openNodePage = () => void navigate(nodePage, { state: { focusDmNodeId: nodeId } });
  const short = node?.user?.shortName?.trim() || nodeId.slice(-4);
  const role = node?.user?.role != null && String(node.user.role) !== '0' ? getDeviceRoleName(node.user.role) : null;
  const hops = node?.hopsAway;
  const meta = [
    node?.lastHeard ? t('messages.last_seen', { time: formatDateTime(new Date(node.lastHeard * 1000), props.timeFormat, props.dateFormat) }) : null,
    typeof hops === 'number' ? (hops === 0 ? t('workspace.chat.direct') : t('workspace.chat.hops', { count: hops })) : null,
    isPhone ? null : nodeId,
  ].filter(Boolean).join(' · ');

  return (
    <header className={threadStyles.header} data-testid="dm-header">
      {isPhone && (
        <Link className={threadStyles.icon} to={base}>
          <UiIcon name="back" size={22} />
          <span className={threadStyles.srOnly}>{t('common.back')}</span>
        </Link>
      )}
      <span className={styles.avatar} style={{ background: avatarToken(nodeId) }} aria-hidden="true">
        {short}
        <span className={styles.dot} data-presence={isHeardRecently(node?.lastHeard) ? 'online' : 'offline'} />
      </span>
      <div className={threadStyles.titles}>
        <h1 className={threadStyles.title}>
          <Link className={styles.name} to={nodePage} state={{ focusDmNodeId: nodeId }}>
            {name}
            <UiIcon name="chevronRight" size={16} />
          </Link>
          {role && <span className={styles.role}>{role}</span>}
        </h1>
        {meta && <p className={threadStyles.subtitle}>{meta}</p>}
      </div>
      <div className={threadStyles.tools}>
        {props.signedIn && (
          <MuteMenu muted={props.muted} onMute={props.onMute} onUnmute={props.onUnmute} buttonClassName={threadStyles.button} alignRight />
        )}
        {props.signedIn && node && (
          <NodeActionMenus
            protocol={protocol}
            sourceId={sourceId}
            node={node}
            variant={isPhone ? 'sheet' : 'menus'}
            onOpenNodePage={openNodePage}
            onMessagesPurged={props.onMessagesPurged}
          />
        )}
      </div>
    </header>
  );
}
