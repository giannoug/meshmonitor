/**
 * A MeshCore MQTT region feed (boards 8-15, 8-23; notes s8n0, s8n5; Task 7.5),
 * native at the source's URL as a receive-only device. It has no radio: it
 * reads what observers publish to the broker, so nothing here can send (no
 * compose, no adverts, no telemetry requests).
 *
 * - Overview: today's banner, Region / Broker (Hidden when the server withholds
 *   it, as today) / Nodes / Observers, the observers' heartbeats, the nodes
 *   learned from adverts, the decrypted channel lines with "(older, key
 *   unknown)" and each sender's clock offset, the latest packets and a link to
 *   Notifications.
 * - Tabs (`nodes`, `channels`, `packets`, `notifications`): the Nodes table,
 *   the decrypted channel lines, the packet monitor (every observer) and the
 *   Notifications page, the same four today's view has.
 *
 * Reads are today's (`meshcore/ingest/*`, useRegionFeed); without
 * connection:read the body is today's permission note.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { appBasename } from '../../init';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import apiService from '../../services/api';
import { UiIcon, type UiIconName } from '../../components/icons';
import { MeshCoreClockOffset } from '../../components/MeshCore/MeshCoreClockOffset';
import type { MeshCoreMessage, MeshCoreNode, UseMeshCoreState } from '../../components/MeshCore/hooks/useMeshCore';
import { useMeshCoreViewAccess } from '../../components/MeshCore/meshCoreViewAccess';
import { formatTime, payloadLabel } from '../../components/MeshCore/meshcorePacketRows';
import type { MeshCorePacketRow } from '../../hooks/useMeshCorePackets';
import { meshcoreClockOffsetMs } from '../../utils/meshcoreMessageTime';
import { meshcoreRoleLabel, meshcoreRoleLabelKey } from '../../components/MeshCore/meshcoreRole';
import StateView from '../patterns/StateView';
import ReadOnlyNote from '../chat/ReadOnlyNote';
import type { MessageActionContext } from '../chat/messageActions';
import OfflineBanner from '../devices/OfflineBanner';
import MeshCoreNodesTable from './MeshCoreNodesTable';
import MeshCoreThread from './MeshCoreThread';
import { RuntimeContext } from './runtime';
import { useIsPhone } from '../shell/useIsPhone';
import MeshCorePacketsPage from './MeshCorePacketsPage';
import PhoneDeviceHeader from './PhoneDeviceHeader';
import ToolHead from './ToolHead';
import { feedChannels, rereadFeed, useFeedMessages, useFeedNodes, useFeedOverview, type FeedMessage, type FeedNode, type FeedObserver } from './useRegionFeed';
import styles from './McTools.module.css';

const NotificationsCategory = lazy(() => import('../settings/categories/NotificationsCategory.tsx'));

export type FeedTab = 'overview' | 'nodes' | 'channels' | 'packets' | 'notifications';

/** An observer that has not been heard for an hour reads as stale (amber). */
const STALE_MS = 3_600_000;

export default function RegionFeedPage({ sourceId, source, tab }: { sourceId: string; source: DashboardSource; tab: FeedTab }) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <SettingsProvider baseUrl={appBasename}>
          <Gate sourceId={sourceId} source={source} tab={tab} />
        </SettingsProvider>
      </WebSocketProvider>
    </SourceProvider>
  );
}

function Gate({ sourceId, source, tab }: { sourceId: string; source: DashboardSource; tab: FeedTab }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  if (!hasPermission('connection', 'read', { sourceId })) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {isPhone && <PhoneDeviceHeader sourceId={sourceId} />}
        <p className={styles.note} role="note">{t('meshcore.no_permission', 'You do not have permission to view this MeshCore source.')}</p>
      </div>
    );
  }
  return <Feed sourceId={sourceId} source={source} tab={tab} />;
}

/** "1 min ago", in the browser's language. */
function useAgo() {
  const { i18n } = useTranslation();
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto', style: 'short' });
  return (ms: number | null | undefined) => {
    if (!ms) return '—';
    const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (secs < 60) return rtf.format(-secs, 'second');
    if (secs < 3600) return rtf.format(-Math.floor(secs / 60), 'minute');
    if (secs < 86_400) return rtf.format(-Math.floor(secs / 3600), 'hour');
    return rtf.format(-Math.floor(secs / 86_400), 'day');
  };
}

const days = (secs: number | null) => (secs == null ? null : `${Math.floor(secs / 86_400)} d`);

function Feed({ sourceId, source, tab }: { sourceId: string; source: DashboardSource; tab: FeedTab }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const ago = useAgo();
  const showNotifications = useMeshCoreViewAccess(false).includes('notifications');
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const { data: overview, error } = useFeedOverview(sourceId);
  const overviewTab = tab === 'overview';
  const { data: nodes = [], isSuccess: nodesLoaded } = useFeedNodes(sourceId, overviewTab || tab === 'nodes');
  const { data: messages = [] } = useFeedMessages(sourceId, overviewTab || tab === 'channels');
  // Today re-reads the nodes and messages each time their tab opens; the first open is the first read.
  const queryClient = useQueryClient();
  const shownTab = useRef(tab);
  useEffect(() => {
    if (shownTab.current === tab) return;
    shownTab.current = tab;
    rereadFeed(queryClient, sourceId, tab === 'nodes' ? ['nodes'] : tab === 'channels' ? ['messages'] : tab === 'overview' ? ['nodes', 'messages'] : []);
  }, [tab, queryClient, sourceId]);
  // The Overview's two latest packets: one read, no poll (the Packets tab is the live monitor).
  const { data: latest = [] } = useQuery({
    queryKey: ['meshcore-ingest', sourceId, 'latest-packets'],
    queryFn: async () =>
      (await apiService.get<{ packets?: Array<MeshCorePacketRow & { observerCount?: number }> }>(`/api/sources/${encodeURIComponent(sourceId)}/meshcore/packets/grouped?limit=2`))
        ?.packets ?? [],
    enabled: overviewTab && !isPhone,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const region = overview?.region || '—';
  const broker = overview?.brokerUrl || (overview ? t('meshcore.ingest.broker_hidden', 'Hidden') : '—');
  const observers = overview?.observers ?? [];
  const reporting = observers.filter((o) => o.online).length;
  const nameOf = (key: string) => nodes.find((n) => n.publicKey === key)?.name ?? `${key.slice(0, 12)}…`;
  const role = (n: FeedNode) => (n.advType != null ? t(meshcoreRoleLabelKey(n.advType), meshcoreRoleLabel(n.advType)) : '—');
  const position = (n: FeedNode) => (n.latitude != null && n.longitude != null ? `${n.latitude.toFixed(2)}, ${n.longitude.toFixed(2)}` : '—');
  const channels = feedChannels(messages);

  const tabs: Array<{ id: FeedTab; label: string; icon: UiIconName; to: string }> = [
    { id: 'overview', label: t('meshcore.ingest.tab_overview', 'Overview'), icon: 'dashboard', to: base },
    { id: 'nodes', label: t('meshcore.ingest.tab_nodes', 'Nodes'), icon: 'radioSignal', to: `${base}/nodes` },
    { id: 'channels', label: t('meshcore.ingest.tab_channels', 'Channels'), icon: 'channels', to: `${base}/channels` },
    { id: 'packets', label: t('meshcore.ingest.tab_packets', 'Packets'), icon: 'list', to: `${base}/packets` },
    ...(showNotifications ? [{ id: 'notifications' as const, label: t('meshcore.ingest.tab_notifications', 'Notifications'), icon: 'notifications' as const, to: `${base}/notifications` }] : []),
  ];

  const banner = (
    <p className={styles.banner} role="note">
      <UiIcon name="globe" size={18} />
      <span>{t('meshcore.ingest.banner', 'Receive-only region feed. This source has no radio: it reads what other observers heard and cannot transmit.')}</span>
    </p>
  );
  const stat = (label: string, value: ReactNode, sub: string) => (
    <div className={`${styles.card} ${styles.cardBody}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statSub}>{sub}</span>
    </div>
  );
  const section = (title: string, body: ReactNode, link?: { to: string; label: string }) => (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {link && <Link className={styles.link} to={link.to}>{link.label} ›</Link>}
      </div>
      {body}
    </section>
  );

  const observerTable = observers.length === 0 ? (
    <p className={styles.note}>{t('meshcore.ingest.no_observers', 'No observer status heartbeats received yet.')}</p>
  ) : isPhone ? (
    <div className={styles.card}>
      {observers.map((o: FeedObserver) => {
        const stale = Date.now() - o.lastSeenMs > STALE_MS;
        return (
          <div key={o.publicKey} className={styles.listRow} data-testid="feed-observer">
            <span />
            <span>
              <p className={styles.rowTitle} title={o.publicKey}>{nameOf(o.publicKey)}</p>
              <p className={`${styles.rowSub} ${stale ? styles.warn : ''}`}>
                {stale
                  ? t('workspace.meshcore.feed_last_heartbeat', { time: ago(o.lastSeenMs) })
                  : [t('workspace.meshcore.feed_heartbeat', { time: ago(o.lastSeenMs) }),
                      o.batteryMv != null ? `${(o.batteryMv / 1000).toFixed(2)} V` : null,
                      o.uptimeSecs != null ? t('workspace.meshcore.feed_up', { time: days(o.uptimeSecs) }) : null].filter(Boolean).join(' · ')}
              </p>
            </span>
            <span />
          </div>
        );
      })}
    </div>
  ) : (
    <div className={`${styles.card} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('meshcore.ingest.observer', 'Observer')}</th>
            <th>{t('meshcore.ingest.last_seen', 'Last heartbeat')}</th>
            <th>{t('meshcore.ingest.battery', 'Battery')}</th>
            <th>{t('meshcore.ingest.uptime', 'Uptime')}</th>
            <th>{t('meshcore.ingest.noise_floor', 'Noise floor')}</th>
          </tr>
        </thead>
        <tbody>
          {observers.map((o) => (
            <tr key={o.publicKey} data-testid="feed-observer">
              <td title={o.publicKey}><strong>{nameOf(o.publicKey)}</strong></td>
              <td>{ago(o.lastSeenMs)}</td>
              <td>{o.batteryMv != null ? `${(o.batteryMv / 1000).toFixed(2)} V` : '—'}</td>
              <td>{days(o.uptimeSecs) ?? '—'}</td>
              <td>{o.noiseFloor != null ? `${o.noiseFloor} dBm` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const nodeTable = (rows: FeedNode[]) => rows.length === 0 ? (
    <p className={styles.note}>{t('meshcore.ingest.no_nodes', 'No nodes discovered from adverts yet.')}</p>
  ) : (
    <div className={`${styles.card} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('meshcore.ingest.node_name', 'Name')}</th>
            <th>{t('workspace.meshcore.feed_role')}</th>
            <th>{t('meshcore.ingest.last_heard', 'Last heard')}</th>
            <th>{t('meshcore.ingest.node_position', 'Position')}</th>
            <th>{t('workspace.meshcore.feed_key')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.publicKey}>
              <td><strong>{n.name || t('meshcore.ingest.unnamed', 'Unnamed')}</strong></td>
              <td>{role(n)}</td>
              <td>{ago(n.lastHeard)}</td>
              <td>{position(n)}</td>
              <td className={styles.mono} title={n.publicKey}>{n.publicKey.slice(0, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const messageLine = (m: FeedMessage, i: number) => (
    <div key={m.id ?? i} className={styles.listRow}>
      <strong>{m.channelName || t('meshcore.ingest.channel_unnamed', { id: m.channelIdx, defaultValue: 'Channel {{id}}' })}</strong>
      <span>{m.fromName ? `${m.fromName}: ` : ''}{m.text}</span>
      <span className={styles.muted}>
        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        {m.createdAt != null && <MeshCoreClockOffset offsetMs={meshcoreClockOffsetMs(m.createdAt, m.senderTimestamp)} />}
      </span>
    </div>
  );
  const unreadable = messages.filter((m) => m.legacy).length;
  const channelLines = (all: boolean) => {
    const readable = messages.filter((m) => !m.legacy);
    const shown = all ? readable : channels.filter((c) => c.name !== null).map((c) => c.latest);
    if (shown.length === 0 && unreadable === 0) {
      return <p className={styles.note}>{t('meshcore.ingest.no_messages', 'No channel messages decrypted. Only channels you hold a key for can be read.')}</p>;
    }
    return (
      <div className={styles.card}>
        {shown.map(messageLine)}
        {unreadable > 0 && (
          <div className={styles.listRow}>
            <strong>#?</strong>
            <span className={styles.muted}>{t('workspace.meshcore.feed_unreadable', { count: unreadable, older: t('meshcore.ingest.channel_legacy', '(older, key unknown)') })}</span>
            <span />
          </div>
        )}
      </div>
    );
  };

  const statusLine = t('workspace.meshcore.feed_subtitle', { region });
  const stats = (
    <div className={styles.cards}>
      {stat(t('meshcore.ingest.region', 'Region'), region, t('workspace.meshcore.feed_region_sub'))}
      {stat(t('meshcore.ingest.broker', 'Broker'), broker, overview?.brokerUrl ? '' : t('workspace.meshcore.feed_broker_sub'))}
      {stat(t('meshcore.ingest.nodes_seen', 'Nodes'), overview?.nodeCount ?? '—', t('workspace.meshcore.feed_nodes_sub'))}
      {stat(t('meshcore.ingest.observers', 'Observers'), observers.length || '—', t('workspace.meshcore.feed_reporting', { count: reporting }))}
    </div>
  );

  let content: ReactNode;
  if (tab === 'nodes') content = <FeedNodes sourceId={sourceId} name={source.name} nodes={nodes} loaded={nodesLoaded} />;
  else if (tab === 'channels') content = <FeedChannels sourceId={sourceId} name={source.name} messages={messages} />;
  else if (tab === 'packets') content = <MeshCorePacketsPage sourceId={sourceId} embedded />;
  else if (tab === 'notifications') {
    content = showNotifications ? (
      <Suspense fallback={<StateView kind="loading" />}>
        <NotificationsCategory sourceId={sourceId} target={{ kind: 'local' }} readOnly={false} />
      </Suspense>
    ) : (
      <p className={styles.note}>{t('meshcore.no_permission', 'You do not have permission to view this MeshCore source.')}</p>
    );
  } else if (isPhone) {
    content = (
      <>
        {section(t('workspace.meshcore.feed_observers', { count: observers.length, reporting }), observerTable)}
        {section(t('workspace.meshcore.feed_channels'), channelLines(false))}
      </>
    );
  } else {
    content = (
      <div className={styles.split}>
        <div className={styles.section}>
          {section(t('meshcore.ingest.observers', 'Observers'), observerTable)}
          {section(t('workspace.meshcore.feed_nodes', { count: overview?.nodeCount ?? nodes.length }), nodeTable(nodes.slice(0, 3)), { to: `${base}/nodes`, label: t('meshcore.ingest.tab_nodes', 'Nodes') })}
        </div>
        <div className={styles.section}>
          {section(t('workspace.meshcore.feed_channels'), channelLines(false))}
          {section(t('workspace.meshcore.feed_packets'), (
            <div className={styles.card}>
              {latest.map((p, i) => (
                <div key={p.id ?? i} className={styles.listRow}>
                  <span className={styles.mono}>{formatTime(p.timestamp).slice(0, 8)}</span>
                  <span>
                    <span className={styles.badge}>{payloadLabel(p)}</span> {p.advertName ?? ''}
                  </span>
                  <span className={styles.muted}>{t('workspace.meshcore.feed_obs', { count: Number(p.observerCount ?? 0) })}</span>
                </div>
              ))}
            </div>
          ), { to: `${base}/packets`, label: t('meshcore.ingest.tab_packets', 'Packets') })}
          {showNotifications && (
            <div className={`${styles.card} ${styles.listRow}`}>
              <span />
              <span>{t('workspace.meshcore.feed_alerts')}</span>
              <Link className={styles.link} to={`${base}/notifications`}>{t('meshcore.ingest.tab_notifications', 'Notifications')} ›</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        {overviewTab ? (
          <>
            <PhoneDeviceHeader sourceId={sourceId} detail={statusLine} />
            {banner}
            <OfflineBanner sourceId={sourceId} />
            <nav className={styles.tiles} aria-label={source.name}>
              {tabs.filter((x) => x.id !== 'overview').map((x) => (
                <Link key={x.id} className={styles.tile} to={x.to}>
                  <UiIcon name={x.icon} size={22} />
                  <span>{x.id === 'nodes' && overview ? `${x.label} · ${overview.nodeCount}` : x.label}</span>
                </Link>
              ))}
            </nav>
          </>
        ) : (
          <>
            <ToolHead title={tabs.find((x) => x.id === tab)?.label ?? source.name} back={{ label: source.name, to: base }} />
            <OfflineBanner sourceId={sourceId} />
          </>
        )}
        {error && <p className={styles.error} role="alert">{error instanceof Error ? error.message : String(error)}</p>}
        {content}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToolHead title={source.name} subtitle={t('workspace.meshcore.feed_kind', { region })} back={{ label: '', to: base }} />
      {banner}
      <OfflineBanner sourceId={sourceId} />
      {stats}
      <nav className={styles.tabs} aria-label={source.name}>
        {tabs.map((x) => (
          <NavLink key={x.id} className={styles.tab} to={x.to} end>{x.label}</NavLink>
        ))}
      </nav>
      {error && <p className={styles.error} role="alert">{error instanceof Error ? error.message : String(error)}</p>}
      {content}
    </div>
  );
}

/** The feed's nodes in a runtime of their own (no radio): what MeshCoreNodesTable reads, read-only. */
function FeedNodes({ sourceId, name, nodes, loaded }: { sourceId: string; name: string; nodes: FeedNode[]; loaded: boolean }) {
  const meshCore = useMemo(
    () =>
      ({
        nodes: nodes.map((n): MeshCoreNode => ({
          publicKey: n.publicKey, name: n.name ?? '', advType: n.advType ?? 0, lastHeard: n.lastHeard ?? undefined,
          latitude: n.latitude ?? undefined, longitude: n.longitude ?? undefined,
        } as MeshCoreNode)),
        contacts: [],
        status: null,
        actions: {},
        hasLoadedOnce: loaded,
      }) as unknown as UseMeshCoreState,
    [nodes, loaded],
  );
  return (
    <RuntimeContext.Provider value={{ sourceId, deviceName: name, meshCore, receiveOnly: true }}>
      <MeshCoreNodesTable feed />
    </RuntimeContext.Provider>
  );
}

const NO_CONTACTS: never[] = [];
const ignore = () => {};
/** Read-only: no row action offers itself (no send, react, translate or delete on a feed). */
const READ_ONLY: MessageActionContext = { canSend: false, canTranslate: false, translateHint: '', sendsTapback: '', sendsResend: '', filter: () => null };

/** The feed's decrypted channel lines on the 8-01 thread with no composer (s8n5): one channel at a time, the older ones counted. */
function FeedChannels({ sourceId, name, messages }: { sourceId: string; name: string; messages: FeedMessage[] }) {
  const { t } = useTranslation();
  const channels = feedChannels(messages).filter((c) => c.name !== null);
  const [picked, setPicked] = useState<string | null>(null);
  const channel = picked ?? channels[0]?.name ?? null;
  const unreadable = messages.filter((m) => m.legacy).length;
  const thread = useMemo(
    () =>
      messages
        .filter((m) => !m.legacy && (m.channelName ?? (m.channelIdx != null ? `#${m.channelIdx}` : null)) === channel)
        .map((m, i): MeshCoreMessage => {
          const at = m.createdAt ?? m.timestamp ?? 0;
          return {
            id: String(m.id ?? i), fromPublicKey: `channel-${m.channelIdx ?? 0}`, fromName: m.fromName ?? undefined, text: m.text ?? '',
            timestamp: at, receivedAt: at, senderTimestamp: m.senderTimestamp ?? undefined,
          } as MeshCoreMessage;
        })
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, channel],
  );
  return (
    <section className={styles.section} aria-label={t('meshcore.ingest.tab_channels', 'Channels')}>
      <div className={styles.filters}>
        {channels.map((c) => (
          <button key={c.name} type="button" className={styles.chip} aria-pressed={c.name === channel} onClick={() => setPicked(c.name)}>
            {c.name} <span className={styles.chipCount}>{c.count}</span>
          </button>
        ))}
      </div>
      <div className={`${styles.card} ${styles.thread}`}>
        <MeshCoreThread
          conversationKey={`${sourceId}:${channel ?? ''}`}
          ariaLabel={channel ?? name}
          messages={thread}
          contacts={NO_CONTACTS}
          deviceName={name}
          emptyText={t('meshcore.ingest.no_messages', 'No channel messages decrypted. Only channels you hold a key for can be read.')}
          unreadAnchorMs={null}
          backlogLoading={false}
          hasMore={false}
          loadingOlder={false}
          onLoadOlder={ignore}
          actionContext={READ_ONLY}
          onAction={ignore}
          footer={(row) => (row.message.receivedAt != null && row.message.senderTimestamp != null
            ? <MeshCoreClockOffset offsetMs={meshcoreClockOffsetMs(row.message.receivedAt, row.message.senderTimestamp)} />
            : null)}
          translations={{}}
          translationActions={{ dismiss: ignore }}
        />
      </div>
      {unreadable > 0 && (
        <p className={styles.note}>
          <strong>#?</strong> {t('workspace.meshcore.feed_unreadable', { count: unreadable, older: t('meshcore.ingest.channel_legacy', '(older, key unknown)') })}
        </p>
      )}
      <ReadOnlyNote kind="receive-only" />
    </section>
  );
}
