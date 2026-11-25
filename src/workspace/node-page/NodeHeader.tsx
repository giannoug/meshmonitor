/**
 * The node page's header (boards f4-node, g4-node; s15n0, s15n5): Back to
 * Nodes, the node (avatar, name, role, favourite mark; id, hardware, firmware,
 * last heard), Message and the three node menus (NodeActionMenus), then the
 * tabs. On the phone Message and the menus are four tiles and ⋯ opens the
 * same Node actions sheet; once the full header scrolls away, the top bar
 * shows the node, so one bar with Back and ⋯ remains (15-12, 15-16, 15-17).
 *
 * Gates are the peek's (Ruling 3.1): Message needs messages:read, the menus a
 * signed-in viewer, and each menu item keeps today's own gate.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import { getHardwareModelName } from '../../utils/nodeHelpers';
import { isHeardRecently } from '../chat/channelLabel';
import { avatarStyle, nodeIdOf, nodeNameOf, shortLabel } from '../nodes/nodeColumns';
import NodeActionMenus from '../patterns/NodeActionMenus';
import { useIsPhone } from '../shell/useIsPhone';
import type { NodeTab } from './NodePage';
import styles from './NodeHeader.module.css';

/** Another protocol's parts of the same header (the MeshCore node page, Task 7.2); unset parts stay the Meshtastic ones. */
export interface NodeHeaderParts {
  role?: string | null;
  /** The id under the name (MeshCore: the short key). */
  id?: string;
  tabs?: Array<{ key: string; label: string; to: string; external?: boolean }>;
  /** In place of Message (a repeater's Log in), or false for none. */
  primary?: ReactNode | false;
  menus?(variant: 'menus' | 'sheet' | 'buttons'): ReactNode;
}

export interface NodeHeaderProps {
  sourceId: string;
  node: DeviceInfo;
  tab: NodeTab | string;
  parts?: NodeHeaderParts;
}

/** The phone bar's height (NodeHeader.module.css `.bar`). */
const BAR_HEIGHT = 52;

const TABS: Array<[NodeTab, string]> = [
  ['overview', 'workspace.node.tab_overview'],
  ['telemetry', 'workspace.node.tab_telemetry'],
  ['links', 'workspace.node.tab_links'],
  ['position', 'workspace.node.tab_position'],
  ['admin', 'workspace.node.tab_admin'],
];

export default function NodeHeader({ sourceId, node, tab, parts }: NodeHeaderProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission } = useAuth();
  const { sourceType } = useSource();
  const { timeFormat, dateFormat } = useSettings();
  const full = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Phone: the bar takes the node once the full header is out of view (no timer, no scroll handler).
  useEffect(() => {
    const el = full.current;
    if (!isPhone || !el || typeof IntersectionObserver === 'undefined') return;
    // The full header counts as gone once it has slid under the bar.
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), { rootMargin: `-${BAR_HEIGHT}px 0px 0px 0px` });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPhone]);

  const nodeId = nodeIdOf(node);
  const shownId = parts?.id ?? nodeId;
  const name = nodeNameOf(node);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const page = `${base}/node/${encodeURIComponent(nodeId)}`;
  const role = parts?.role !== undefined ? parts.role : node.user?.role != null && String(node.user.role) !== '0' ? getDeviceRoleName(node.user.role) : null;
  const hw = node.user?.hwModel ? getHardwareModelName(node.user.hwModel) : null;
  const fw = node.firmwareVersion ?? node.user?.firmwareVersion;
  const heard = node.lastHeard ? t('workspace.map.heard', { time: formatRelativeTime(node.lastHeard * 1000, timeFormat, dateFormat) }) : null;
  const signedIn = authStatus?.authenticated === true;
  // A node with no user id (a MeshCore contact) has no DM to open.
  const canMessage = !!node.user?.id && hasPermission('messages', 'read', { sourceId });
  const protocol = sourceType === 'mqtt_bridge' || sourceType === 'mqtt_broker' ? 'mqtt' : 'meshtastic';

  const avatar = (small?: boolean) => (
    <span className={styles.avatar} data-small={small || undefined} style={avatarStyle(node)} aria-hidden="true">
      {shortLabel(node)}
    </span>
  );
  const roleBadge = role && <span className={styles.role}>{role}</span>;
  const presence = heard && (
    <span className={styles.heard}>
      <span className={styles.dot} data-presence={isHeardRecently(node.lastHeard) ? 'online' : 'offline'} />
      {heard}
    </span>
  );
  const message = parts?.primary !== undefined ? parts.primary : canMessage && (
    <Link className={styles.message} to={`${base}/dm/${encodeURIComponent(nodeId)}`}>
      <UiIcon name="messages" size={isPhone ? 22 : 18} />
      {t('workspace.map.message')}
    </Link>
  );
  const back = (
    <Link className={styles.back} to={`${base}/nodes`}>
      <UiIcon name="back" size={isPhone ? 22 : 16} />
      {(!isPhone || !collapsed) && t('nodes.title')}
    </Link>
  );
  const tabs = (
    <nav className={styles.tabs} aria-label={name}>
      {parts?.tabs
        ? parts.tabs.map(({ key, label, to, external }) => (
            <Link key={key} className={styles.tab} to={to} aria-current={key === tab ? 'page' : undefined}>
              {label}
              {external && <UiIcon name="forward" size={14} />}
            </Link>
          ))
        : TABS.map(([key, label]) => (
            <Link key={key} className={styles.tab} to={key === 'overview' ? page : `${page}/${key}`} aria-current={key === tab ? 'page' : undefined}>
              {t(label)}
            </Link>
          ))}
    </nav>
  );
  const menus = (variant: 'menus' | 'sheet' | 'buttons') =>
    signedIn && (parts?.menus ? parts.menus(variant) : <NodeActionMenus key={`${nodeId}-${variant}`} protocol={protocol} sourceId={sourceId} node={node} variant={variant} />);

  if (isPhone) {
    // Siblings under the page scroller, so the bar and the tabs stay stuck while the rest scrolls.
    return (
      <>
        <div className={styles.bar} data-testid="node-bar" data-collapsed={collapsed || undefined}>
          {back}
          {collapsed && (
            <span className={styles.barNode}>
              {avatar(true)}
              <span className={styles.barText}>
                <span className={styles.barName}>{name}</span>
                <span className={styles.barMeta}>{roleBadge}{presence}</span>
              </span>
            </span>
          )}
          <span className={styles.spacer} />
          {menus('sheet')}
        </div>
        <header ref={full} className={styles.header} data-phone="">
          <div className={styles.identity}>
            {avatar()}
            <div className={styles.titles}>
              <h1 className={styles.name}>{name}</h1>
              <p className={styles.meta}>
                {roleBadge}
                <span className={styles.id}>{shownId}</span>
                {hw && <span>· {hw}</span>}
              </p>
              {presence && <p className={styles.meta}>{presence}</p>}
            </div>
          </div>
          <div className={styles.tiles}>
            {message}
            {menus('buttons')}
          </div>
        </header>
        <div className={styles.phoneTabs}>{tabs}</div>
      </>
    );
  }

  return (
    <header className={styles.header}>
      {back}
      <div className={styles.top}>
        {avatar()}
        <div className={styles.titles}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{name}</h1>
            {roleBadge}
            {node.isFavorite && <UiIcon name="favorite" size={18} className={styles.star} title={t('node_filter.favorites')} />}
          </div>
          <p className={styles.meta}>
            <span className={styles.id}>{shownId}</span>
            {[hw, fw ? t('workspace.node.firmware', { version: fw }) : null].filter(Boolean).map((s) => <span key={s}>· {s}</span>)}
            {presence && <span className={styles.heard}>· {presence}</span>}
          </p>
        </div>
        <div className={styles.actions}>
          {message}
          {menus('menus')}
        </div>
      </div>
      {tabs}
    </header>
  );
}
