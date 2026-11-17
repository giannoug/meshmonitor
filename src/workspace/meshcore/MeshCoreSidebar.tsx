/**
 * A MeshCore device's lists in layout D (boards 8-01 … 8-04, note s8n0), and
 * on the phone Home (8-16): Map, Nodes, Dashboard, Automations and More tools…
 * (Info, Packet monitor and today's other tabs), then Channels, Rooms and
 * Direct messages.
 *
 * - Channels: today's channel list, `#` (or a lock for a private one), unread
 *   in bold with a dot, a Channel Database channel tagged "Virtual ·
 *   receive-only". The ⋯ on the heading holds today's Mark all as Read,
 *   Unread first and Sort (device, name, last, count, custom + Reorder…).
 * - Rooms: green dot logged in, amber ring saved password, grey ring not
 *   logged in; the ⋯ holds Sort rooms by and Mark all as Read.
 * - Direct messages: the threads with history, newest first; each opens
 *   today's DM view on that contact (Ruling 7.1 DM), then "Message a node".
 *
 * Sorting and marking read stay in MeshMonitor (localStorage and the read
 * state); nothing here sends on the mesh. Rows follow today's view gates.
 */
import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon, type UiIconName } from '../../components/icons';
import { mapNav } from '../../components/nav/sourceNavEntries';
import { visibleMeshCoreViews, type MeshCoreView } from '../../components/MeshCore/meshCoreViewAccess';
import { MeshCoreChannelReorderList } from '../../components/MeshCore/MeshCoreChannelReorderList';
import { markManyRead } from '../../components/MeshCore/meshcoreUnreadStore';
import {
  loadChannelCustomOrder,
  loadChannelSortMode,
  loadRoomCustomOrder,
  loadRoomSortMode,
  saveChannelCustomOrder,
  saveChannelSortMode,
  saveRoomCustomOrder,
  saveRoomSortMode,
  sortItems,
  type ChannelSortMode,
  type RoomSortMode,
} from '../../components/MeshCore/meshcoreChannelOrder';
import { calculateDistance, formatDistance } from '../../utils/distance';
import { useSettingsOptional } from '../../contexts/SettingsContext';
import { advertHasPosition } from '../../utils/meshcoreAdvertPosition';
import RowMenu, { type RowMenuItem } from '../patterns/RowMenu';
import Sheet from '../patterns/Sheet';
import { useDeviceTab } from '../shell/deviceTabs';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { channelKind, channelName, roomLabel } from './meshcoreLabels';
import { useRoomSessions } from './roomSessions';
import { useMeshCoreLists } from './useMeshCoreLists';
import listStyles from '../chat/ChannelList.module.css';
import homeStyles from '../chat/PhoneHome.module.css';
import styles from './MeshCoreSidebar.module.css';

/** Today's "unread first" switch (MeshCoreChannelsView). */
const SORT_UNREAD_FIRST_KEY = 'meshmonitor-meshcore-channel-sort-unread-first';

/** More tools…: today's tabs the board's sidebar has no row for, in nav order. */
const MORE: Array<{ view: MeshCoreView; key: string; fallback: string; icon: UiIconName }> = [
  { view: 'info', key: 'meshcore.nav.info', fallback: 'Node Info', icon: 'info' },
  { view: 'packets', key: 'meshcore.nav.packets', fallback: 'Packet Monitor', icon: 'activity' },
  { view: 'configuration', key: 'nav.device_configuration', fallback: 'Device Configuration', icon: 'configuration' },
  { view: 'notifications', key: 'meshcore.nav.notifications', fallback: 'Notifications', icon: 'notifications' },
  { view: 'security', key: 'nav.security', fallback: 'Security', icon: 'security' },
];

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** A room key from the stats matches a contact by prefix either way, as today's Rooms view does. */
const sameRoom = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

interface MeshCoreSidebarProps {
  source: WorkspaceSource;
  onNavigate?: () => void;
  /** `home`: the phone Home's tiles and 52 px rows (8-16). */
  variant?: 'sidebar' | 'home';
}

export default function MeshCoreSidebar({ source, onNavigate, variant = 'sidebar' }: MeshCoreSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authStatus, hasPermission } = useAuth();
  const tab = useDeviceTab(source);
  const sourceId = source.id;
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const home = variant === 'home';
  const lists = useMeshCoreLists(sourceId, source.status === 'connected');
  const sessions = useRoomSessions(sourceId);
  const distanceUnit = useSettingsOptional()?.distanceUnit ?? 'km';
  const visible = visibleMeshCoreViews({
    canRead: (resource) => hasPermission(resource, 'read', { sourceId }),
    isAuthenticated: authStatus?.authenticated ?? false,
  });

  // Channel order: today's per-device sort and the global "unread first" switch.
  const [channelSort, setChannelSort] = useState<ChannelSortMode>(() => loadChannelSortMode(sourceId));
  const [channelOrder, setChannelOrder] = useState<number[]>(() => loadChannelCustomOrder(sourceId));
  const [unreadFirst, setUnreadFirst] = useState(() => readFlag(SORT_UNREAD_FIRST_KEY));
  const [roomSort, setRoomSort] = useState<RoomSortMode>(() => loadRoomSortMode(sourceId));
  const [roomOrder, setRoomOrder] = useState<string[]>(() => loadRoomCustomOrder(sourceId));
  const [reorder, setReorder] = useState<'channels' | 'rooms' | null>(null);

  const label = (c: { id: number; name: string }) => channelName(t, c);
  const channels = useMemo(() => {
    const items = lists.channels.map((c) => ({ ...c, name: c.name }));
    const sorted = sortItems(items, channelSort, {
      customOrder: channelOrder,
      latest: lists.unread.channelLatest,
      counts: lists.unread.channelCounts,
      label,
    });
    if (!unreadFirst) return sorted;
    const latest = lists.unread.channelLatest;
    const first = sorted.filter((c) => lists.unreadChannels.has(c.id)).sort((a, b) => (latest[b.id] ?? 0) - (latest[a.id] ?? 0));
    return [...first, ...sorted.filter((c) => !lists.unreadChannels.has(c.id))];
    // `label` reads only `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 label is rebuilt each render from t
  }, [lists.channels, lists.unread.channelLatest, lists.unread.channelCounts, lists.unreadChannels, channelSort, channelOrder, unreadFirst, t]);

  const self = lists.self;
  const selfHasLocation = advertHasPosition(self?.latitude, self?.longitude);
  // Today's Rooms list: distance from this device's fix, for the Distance sort and its row meta.
  const roomDistances = useMemo(() => {
    const out: Record<string, number> = {};
    if (!selfHasLocation) return out;
    for (const room of lists.rooms) {
      if (advertHasPosition(room.latitude, room.longitude)) {
        out[room.publicKey] = calculateDistance(self!.latitude!, self!.longitude!, room.latitude!, room.longitude!);
      }
    }
    return out;
  }, [lists.rooms, selfHasLocation, self]);
  const rooms = useMemo(() => {
    const counts: Record<string, number> = {};
    const latest: Record<string, number> = {};
    for (const room of lists.rooms) {
      const stat = lists.unread.roomStats.find((s) => sameRoom(s.roomPublicKey, room.publicKey));
      counts[room.publicKey] = stat?.count ?? 0;
      latest[room.publicKey] = stat?.latest ?? 0;
    }
    const items = lists.rooms.map((room) => ({ id: room.publicKey, name: roomLabel(room), room }));
    return sortItems(items, roomSort, { customOrder: roomOrder, latest, counts, distances: roomDistances });
  }, [lists.rooms, lists.unread.roomStats, roomSort, roomOrder, roomDistances]);

  const unreadRoomKeys = lists.unread.unreadRooms;
  const nameOf = (key: string) => {
    const c = lists.contacts.find((x) => sameRoom(x.publicKey, key));
    return c?.advName || c?.name || `${key.slice(0, 8)}…`;
  };
  const dms = [...lists.dmPeers].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  const markAllChannels = () =>
    markManyRead(
      sourceId,
      Object.entries(lists.unread.channelLatest).map(([idx, ts]) => ({ kind: 'meshcore_channel' as const, key: idx, ts })),
    );
  const markAllRooms = () =>
    markManyRead(sourceId, [...lists.unread.roomLatest].map(([key, ts]) => ({ kind: 'meshcore_room' as const, key, ts })));

  const channelSortItem = (mode: ChannelSortMode, key: string, fallback: string): RowMenuItem => ({
    key: mode,
    label: t(key, fallback),
    icon: 'sortAscending',
    checked: channelSort === mode,
    onSelect: () => {
      setChannelSort(mode);
      saveChannelSortMode(sourceId, mode);
    },
  });
  const channelMenu: RowMenuItem[] = [
    {
      key: 'read',
      label: t('channels.mark_all_read_button', 'Mark all as Read'),
      icon: 'checkAll',
      disabled: lists.unreadChannels.size === 0,
      onSelect: markAllChannels,
    },
    {
      key: 'unread-first',
      label: t('meshcore.channels.sort_unread_first', 'Show channels with unread messages first'),
      icon: 'favorite',
      checked: unreadFirst,
      onSelect: () => {
        const next = !unreadFirst;
        setUnreadFirst(next);
        try {
          localStorage.setItem(SORT_UNREAD_FIRST_KEY, String(next));
        } catch {
          /* private window: this session only */
        }
      },
    },
    channelSortItem('device', 'meshcore.channels.order.device', 'Device order'),
    channelSortItem('name', 'meshcore.channels.order.name', 'Channel name'),
    channelSortItem('lastMessage', 'meshcore.channels.order.last_message', 'Last message'),
    channelSortItem('messageCount', 'meshcore.channels.order.message_count', 'Message count'),
    channelSortItem('custom', 'meshcore.channels.order.custom', 'Custom'),
    ...(lists.channels.length > 1
      ? [{ key: 'reorder', label: t('workspace.meshcore.reorder'), icon: 'dragHandle' as const, onSelect: () => setReorder('channels') }]
      : []),
  ];
  const roomSortItem = (mode: RoomSortMode, key: string, fallback: string, disabled = false): RowMenuItem => ({
    key: mode,
    label: t(key, fallback),
    icon: 'sortAscending',
    checked: roomSort === mode,
    disabled,
    onSelect: () => {
      setRoomSort(mode);
      saveRoomSortMode(sourceId, mode);
    },
  });
  const roomMenu: RowMenuItem[] = [
    roomSortItem('name', 'meshcore.rooms.order.name', 'Room name'),
    roomSortItem('lastMessage', 'meshcore.rooms.order.last_message', 'Last message'),
    roomSortItem('messageCount', 'meshcore.rooms.order.message_count', 'Message count'),
    roomSortItem('distance', 'meshcore.rooms.order.distance', 'Distance', !selfHasLocation),
    roomSortItem('custom', 'meshcore.rooms.order.custom', 'Custom'),
    ...(lists.rooms.length > 1
      ? [{ key: 'reorder', label: t('workspace.meshcore.reorder'), icon: 'dragHandle' as const, onSelect: () => setReorder('rooms') }]
      : []),
    {
      key: 'read',
      label: t('channels.mark_all_read_button', 'Mark all as Read'),
      icon: 'checkAll',
      disabled: unreadRoomKeys.size === 0,
      onSelect: markAllRooms,
    },
  ];

  const tools: Array<{ key: string; icon: UiIconName; label: string; count?: string }> = [
    { key: 'map', icon: 'map', label: mapNav(t).label },
    {
      key: 'nodes',
      icon: 'radioSignal',
      label: t('nodes.title'),
      count: source.live?.activeNodeCount !== undefined ? t('workspace.shell.online_count', { count: source.live.activeNodeCount }) : undefined,
    },
    { key: 'dashboard', icon: 'dashboard', label: t('nav.dashboard') },
    { key: 'automation', icon: 'zap', label: t('meshcore.nav.automations', 'Automations') },
  ];
  const moreItems: RowMenuItem[] = MORE.filter((m) => visible.includes(m.view)).map((m) => ({
    key: m.view,
    label: t(m.key, m.fallback),
    icon: m.icon,
    onSelect: () => {
      onNavigate?.();
      void navigate(`${base}/${m.view}`);
    },
  }));
  const moreLabel = t('workspace.shell.more_tools');
  const more = moreItems.length > 0 && (
    <RowMenu
      label={moreLabel}
      items={moreItems}
      triggerClassName={home ? `${homeStyles.tile} ${styles.tileButton}` : `${styles.toolRow} ${styles.toolButton}`}
      trigger={
        <>
          <UiIcon name="more" size={home ? 22 : 16} />
          <span className={home ? homeStyles.tileLabel : styles.label}>{moreLabel}</span>
        </>
      }
    />
  );

  const row = (on: boolean, extra = '') => `${listStyles.row} ${home ? listStyles.large : ''} ${on ? listStyles.on : ''} ${extra}`;
  const heading = (title: string, dot: boolean, menu?: { label: string; items: RowMenuItem[]; heading?: string }) => (
    <div className={styles.heading}>
      <h3 className={styles.headingText}>{title}</h3>
      {dot && <span className={styles.headingDot} aria-label={t('meshcore.channels.unread_badge', 'Unread messages')} />}
      {menu && (
        <span className={styles.headingMenu}>
          <RowMenu label={menu.label} items={menu.items} heading={menu.heading} />
        </span>
      )}
    </div>
  );

  return (
    <div className={styles.lists} data-variant={variant}>
      {home ? (
        <nav className={homeStyles.tiles} aria-label={t('workspace.home.tools_label')}>
          {tools.flatMap(({ key, icon, label: text }) => {
            const to = tab(key);
            return to ? [<NavLink key={key} to={to} className={homeStyles.tile}><UiIcon name={icon} size={22} /><span className={homeStyles.tileLabel}>{text}</span></NavLink>] : [];
          })}
          {more}
        </nav>
      ) : (
        <ul className={styles.tools}>
          {tools.flatMap(({ key, icon, label: text, count }) => {
            const to = tab(key);
            return to
              ? [
                  <li key={key}>
                    <NavLink to={to} end className={styles.toolRow} onClick={onNavigate}>
                      <UiIcon name={icon} size={16} />
                      <span className={styles.label}>{text}</span>
                      {count && <span className={styles.count}>{count}</span>}
                    </NavLink>
                  </li>,
                ]
              : [];
          })}
          {more && <li>{more}</li>}
        </ul>
      )}

      {tab('channels') && (
        <section className={styles.section}>
          {heading(t('channels.title'), lists.unreadChannels.size > 0, { label: t('workspace.meshcore.channels_menu'), items: channelMenu })}
          <ul className={listStyles.list}>
            {channels.map((c) => {
              const name = label(c);
              const unread = lists.unreadChannels.has(c.id);
              const kind = channelKind(c);
              return (
                <li key={c.id}>
                  <NavLink
                    to={`${base}/channel/${c.id}`}
                    className={({ isActive }) => row(isActive, unread ? listStyles.unread : '')}
                    onClick={onNavigate}
                  >
                    <span className={listStyles.hash} aria-hidden="true">#</span>
                    <span className={listStyles.name}>{name}</span>
                    {c.virtual && <span className={styles.tag}>{t('workspace.meshcore.virtual_tag')}</span>}
                    {kind === 'private' && !c.virtual && (
                      <span className={styles.end} title={t('meshcore.channels.kind.private', 'Private channel')}>
                        <UiIcon name="encrypted" size={14} />
                      </span>
                    )}
                    {lists.isChannelMuted(c.id) && <span className={styles.end}><UiIcon name="muted" size={14} /></span>}
                    {unread && <span className={styles.dot} aria-label={t('meshcore.channels.unread_badge', 'Unread messages')} />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {visible.includes('rooms') && (
        <section className={styles.section}>
          {heading(t('meshcore.nav.rooms', 'Rooms'), unreadRoomKeys.size > 0, {
            label: t('meshcore.rooms.order.sort_by', 'Sort rooms by'),
            heading: t('meshcore.rooms.order.sort_by', 'Sort rooms by'),
            items: roomMenu,
          })}
          {rooms.length === 0 && <p className={styles.empty}>{t('meshcore.rooms.no_rooms', 'No room servers discovered yet')}</p>}
          <ul className={listStyles.list}>
            {rooms.map(({ id: key, name }) => {
              const state = sessions.has(key) ? 'on' : lists.savedRooms.has(key) ? 'saved' : 'off';
              const unread = unreadRoomKeys.has(key);
              return (
                <li key={key}>
                  <NavLink
                    to={`${base}/room/${encodeURIComponent(key)}`}
                    className={({ isActive }) => row(isActive, unread ? listStyles.unread : '')}
                    onClick={onNavigate}
                  >
                    <span className={listStyles.hash} aria-hidden="true">
                      <span className={styles.room} data-room={state} title={t(`workspace.meshcore.room_${state}`)} />
                    </span>
                    <span className={listStyles.name}>{name}</span>
                    {roomSort === 'distance' && typeof roomDistances[key] === 'number' && (
                      <span className={styles.meta}>{formatDistance(roomDistances[key], distanceUnit)}</span>
                    )}
                    {lists.isDMMuted(key) && <span className={styles.end}><UiIcon name="muted" size={14} /></span>}
                    {unread && <span className={styles.dot} aria-label={t('meshcore.rooms.unread', 'Unread posts')} />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab('dms') && (
        <section className={styles.section}>
          {heading(t('workspace.shell.direct_messages'), lists.unreadDms.size > 0)}
          <ul className={listStyles.list}>
            {dms.map((p) => {
              const unread = lists.unreadDms.has(p.publicKey);
              return (
                <li key={p.publicKey}>
                  <NavLink
                    to={`${base}/dm/${encodeURIComponent(p.publicKey)}`}
                    className={({ isActive }) => row(isActive, unread ? listStyles.unread : '')}
                    onClick={onNavigate}
                  >
                    <span className={listStyles.hash} aria-hidden="true"><UiIcon name="user" size={14} /></span>
                    <span className={listStyles.name}>{nameOf(p.publicKey)}</span>
                    {unread && <span className={styles.dot} aria-label={t('workspace.meshcore.unread_dm')} />}
                  </NavLink>
                </li>
              );
            })}
            <li>
              <NavLink to={tab('dms')!} end className={({ isActive }) => row(isActive)} onClick={onNavigate}>
                <span className={listStyles.hash} aria-hidden="true"><UiIcon name="plus" size={14} /></span>
                <span className={listStyles.name}>{t('workspace.shell.message_a_node')}</span>
              </NavLink>
            </li>
          </ul>
        </section>
      )}

      <Sheet open={reorder !== null} onClose={() => setReorder(null)} title={t('workspace.meshcore.reorder_title')}>
        {reorder === 'channels' && (
          <MeshCoreChannelReorderList
            channels={channels.map((c) => ({ id: c.id, label: `# ${label(c)}` }))}
            onSave={(order) => {
              setChannelOrder(order);
              saveChannelCustomOrder(sourceId, order);
              setChannelSort('custom');
              saveChannelSortMode(sourceId, 'custom');
              setReorder(null);
            }}
            onCancel={() => setReorder(null)}
          />
        )}
        {reorder === 'rooms' && (
          <MeshCoreChannelReorderList<string>
            channels={rooms.map((r) => ({ id: r.id, label: r.name }))}
            onSave={(order) => {
              setRoomOrder(order);
              saveRoomCustomOrder(sourceId, order);
              setRoomSort('custom');
              saveRoomSortMode(sourceId, 'custom');
              setReorder(null);
            }}
            onCancel={() => setReorder(null)}
          />
        )}
      </Sheet>
    </div>
  );
}
