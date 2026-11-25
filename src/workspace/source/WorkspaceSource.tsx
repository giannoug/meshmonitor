/**
 * `/source/:sourceId/*` in the Workspace (spec §5.3–5.5). Renders the source
 * through the same dispatch as Classic (`renderSourceApp`), re-hosted:
 *
 * - Meshtastic-family sources (App): Classic URLs redirect to their Workspace
 *   form, and App sees the Classic location of a Workspace-only URL
 *   (`classicSourceLocation`), since it picks its tab from the path. A
 *   channel (`channel/<n>[/beacons]`) is the Workspace's own ChannelThread,
 *   a DM (`dm/<nodeId>`) its own DmConversation, the DM inbox (`dms`) its
 *   DmInbox, Activity (`activity`) its ActivityFeed (Task 2.8), the device map
 *   (`map`) its DeviceMap (Task 3.1), Nodes (`nodes`) its NodesPage (Task 3.3), the
 *   Dashboard (`dashboard`) its DeviceDashboard (Task 8.1), Automations
 *   (`automation[/builtins|/<built-in>]`, and today's `automation#<built-in>`)
 *   its DeviceAutomations (Task 8.3), an MQTT
 *   source's packet monitor (`packetmonitor`) its MqttReceptions (Task 4.7), and the bare
 *   source URL on a phone its PhoneHome (Task 2.6), and device settings
 *   (`settings[/…]`, and the Classic URLs that redirect there) its
 *   SettingsFrame (Task 5.2), with App not mounted (Ruling AD: one owner of
 *   the message state per screen), the remote target (`settings?node=`) too (Task 5.9).
 *   A desktop bare source URL keeps the re-hosted App.
 * - MeshCore: the view comes from the URL and view changes
 *   navigate. A MeshCore view the viewer may not open is replaced in the URL
 *   by the one the page shows. A MeshCore channel (`channel/<idx>`), room
 *   (`room/<key>`) and the phone's bare device URL are the Workspace's own
 *   MeshCoreScreen (Task 7.1), with today's page not mounted, and so are Nodes
 *   (`nodes`) and a node's page (`node/<key>[/<tab>]`, Task 7.2). Today's
 *   Nodes view (list and map) is `map` (`?node=<key>` centres it on a node);
 *   `dm/<key>` opens today's DM view on that contact. Device settings
 *   (`settings[/…]`) are the settings frame: this radio's pages (Task 7.4) and a
 *   repeater's or room server's Settings and Console with `?node=<key>` (the
 *   node page's Log in and Console links, Task 7.3); today's Device
 *   Configuration URLs (`configuration[#<section>]`, `#configuration`) open
 *   the page that holds them. Info (`info`), the packet monitor (`packets`) and
 *   Automations (`automations[/<built-in>]`) are native too (Task 7.5), and so
 *   is the Dashboard (today's `telemetry` view, Task 8.1). Every other view
 *   stays re-hosted.
 * - Reticulum (Task 7.6): every view is the Workspace's ReticulumScreen (the
 *   phone's bare device URL its Home; desktop's goes to Destinations, as
 *   today), and device settings (`settings[/…]`, and today's `configuration`,
 *   which redirects there) the settings frame. Today's page is not mounted.
 * - A MeshCore MQTT region feed: its Overview (the source URL) and its Nodes,
 *   Channels, Packets and Notifications tabs are the Workspace's RegionFeedPage
 *   (Task 7.5); any other URL keeps today's page.
 * - An unknown source shows the Overview with a "not found" note.
 */
import { lazy, useCallback, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import DeviceSocket from './DeviceSocket';
import { useDashboardSources } from '../../hooks/useDashboardData';
import {
  MESHCORE_FALLBACK_VIEW,
  resolveMeshCoreView,
  visibleMeshCoreViews,
  type MeshCoreView,
} from '../../components/MeshCore/meshCoreViewAccess';
import { renderSourceApp, type SourcePages } from '../../sourceDispatch';
import {
  classicSourceLocation,
  MESHCORE_SETTINGS,
  meshcoreSettingsRedirect,
  meshcoreViewForPath,
  RETICULUM_CONFIGURATION,
  RETICULUM_SETTINGS,
  reticulumScreenForPath,
  workspaceRedirect,
} from '../routes';
import { OverviewRehost, Redirect, Rehost } from '../rehost/pages';
import { useHashTarget } from '../rehost/useHashTarget';
import type { NodeTab } from '../node-page/NodePage';
import { useIsPhone } from '../shell/useIsPhone';
import type { MeshCoreScreenKind } from '../meshcore/MeshCoreScreen';
import { isMqttOnlySourceType } from '../../utils/nodeTransport';
import { BUILTIN_IDS } from '../automations/ids';
import { isMeshtasticFamily } from '../shell/deviceTabs';
import { INFO_GROUPS, type InfoGroup } from '../tools/deviceTools';
import styles from './WorkspaceSource.module.css';
import StateView from '../patterns/StateView';

// The same chunks Classic loads (main.tsx); Reticulum's page is the Workspace's own (Task 7.6).
const PAGES: SourcePages = {
  App: lazy(() => import('../../App.tsx')),
  MeshCoreSourcePage: lazy(() => import('../../pages/MeshCoreSourcePage.tsx')),
  MeshCoreIngestSourcePage: lazy(() => import('../../pages/MeshCoreIngestSourcePage.tsx')),
};

const ChannelThread = lazy(() => import('../chat/ChannelThread.tsx'));
const DmConversation = lazy(() => import('../chat/DmConversation.tsx'));
/** `channel/<n>` and `channel/<n>/beacons`: the Workspace chat (Task 2.3). */
const CHAT_PATH = /^channel\/(\d+)(\/beacons)?\/?$/;
/** `dm/<nodeId>`: the Workspace DM (Task 2.4). */
const DM_PATH = /^dm\/([^/]+)\/?$/;
const DmInbox = lazy(() => import('../chat/DmInbox.tsx'));
const PhoneHome = lazy(() => import('../chat/PhoneHome.tsx'));
/** `dms`: the Workspace DM inbox (Task 2.6). */
const DMS_PATH = /^dms\/?$/;
const ActivityFeed = lazy(() => import('../activity/ActivityFeed.tsx'));
/** `activity`: the Workspace Activity feed (Task 2.8). */
const ACTIVITY_PATH = /^activity\/?$/;
const DeviceMap = lazy(() => import('../map/DeviceMap.tsx'));
/** `map`: the Workspace device map (Task 3.1). */
const MAP_PATH = /^map\/?$/;
const NodesPage = lazy(() => import('../nodes/NodesPage.tsx'));
/** `nodes`: the Workspace Nodes table and list (Task 3.3). */
const NODES_PATH = /^nodes\/?$/;
/** `node/<id>[/<tab>]`: the Workspace node page (Task 3.4). */
const NodePage = lazy(() => import('../node-page/NodePage.tsx'));
const NODE_PATH = /^node\/([^/]+)(?:\/([^/]+))?\/?$/;
const NODE_TABS: readonly string[] = ['telemetry', 'links', 'position', 'admin'];
/** `dashboard`: the Workspace Dashboard (Task 8.1). */
const MeshtasticDashboard = lazy(() => import('../dashboard/DeviceDashboard.tsx'));
const DASHBOARD_PATH = /^dashboard\/?$/;
/** `automation[/builtins|/<built-in>]`: the Workspace device Automations (Task 8.3); today's `automation#<built-in>` opens that built-in's page. */
const DeviceAutomations = lazy(() => import('../automations/DeviceAutomations.tsx'));
const AUTOMATION_PATH = /^automation(?:\/([^/]+))?\/?$/;
/** `packetmonitor` on an MQTT source: the Workspace receptions page (Task 4.7); a device with its own radio: the device monitor (Task 8.5). */
const MqttReceptions = lazy(() => import('../tools/MqttReceptions.tsx'));
const DevicePackets = lazy(() => import('../tools/DevicePackets.tsx'));
const PACKETS_PATH = /^packetmonitor\/?$/;
/** Tools (q1), Info (`info[/<group>]`) and Security (`security[/quiet]`) (Task 8.5). */
const ToolsPage = lazy(() => import('../tools/ToolsPage.tsx'));
const InfoPage = lazy(() => import('../tools/InfoPage.tsx'));
const DeviceSecurity = lazy(() => import('../tools/DeviceSecurity.tsx'));
const TOOLS_PATH = /^tools\/?$/;
const INFO_PATH = /^info(?:\/([^/]+))?\/?$/;
const SECURITY_PATH = /^security(?:\/(quiet))?\/?$/;
/** Today's `#info`, `#security` and `#packetmonitor` anchors on the bare source URL. */
const TOOL_ANCHOR = /^#(info|security|packetmonitor)$/;
/** `settings[/<category>[/<sub>]]`: the Workspace device settings (Task 5.2). */
const SettingsFrame = lazy(() => import('../settings/SettingsFrame.tsx'));
const SETTINGS_PATH = /^settings(\/|$)/;
/** MeshCore's native screens (Task 7.1): a channel, a room, the phone Home. */
const MeshCoreScreen = lazy(() => import('../meshcore/MeshCoreScreen.tsx'));
const MC_CHANNEL_PATH = /^channel\/(\d+)\/?$/;
const MC_ROOM_PATH = /^room\/([^/]+)\/?$/;
const MC_DM_PATH = /^dm\/([^/]+)\/?$/;
/** MeshCore Nodes (Task 7.2); today's Nodes view (list and map) is `map`. */
const MC_NODES_PATH = /^nodes\/?$/;
/** The MeshCore node page's tabs besides Overview (Task 7.2). */
const MC_NODE_TABS: readonly string[] = ['telemetry', 'links', 'position', 'admin', 'neighbours'];
/** Info, the packet monitor and Automations (Task 7.5); `automations/<built-in>` is one built-in's page. */
const MC_INFO_PATH = /^info\/?$/;
const MC_PACKETS_PATH = /^packets\/?$/;
const MC_AUTOMATIONS_PATH = /^automations(?:\/([^/]+))?\/?$/;
/** Today's Dashboard view (`telemetry`): the Workspace Dashboard (Task 8.1). */
const MC_DASHBOARD_PATH = /^telemetry\/?$/;
/** Every Reticulum view (Task 7.6): the device screen, with today's page not mounted. */
const ReticulumScreen = lazy(() => import('../reticulum/ReticulumScreen.tsx'));
/** A region feed (Task 7.5): its Overview at the source URL, and its tabs. */
const RegionFeedPage = lazy(() => import('../meshcore/RegionFeedPage.tsx'));
const FEED_PATH = /^(nodes|channels|packets|notifications)?\/?$/;
/** A draft handed over in the location state, if any (Security's "Send a DM"). */
const draftOf = (state: unknown): string | null => {
  const draft = (state as { draft?: unknown } | null)?.draft;
  return typeof draft === 'string' ? draft : null;
};
/** The URL of a MeshCore view: the re-hosted Nodes view (list and map) lives at `map`. */
const mcViewPath = (view: MeshCoreView) => (view === 'nodes' ? 'map' : view);

export default function WorkspaceSource() {
  const { t } = useTranslation();
  const { sourceId = '', '*': splat = '' } = useParams<{ sourceId: string; '*': string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: sources, isLoading } = useDashboardSources();
  const { authStatus, loading: authLoading, hasPermission } = useAuth();
  const isPhone = useIsPhone();
  const source = sources?.find((s) => s.id === sourceId);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const goToView = useCallback((view: string) => void navigate(`${base}/${view}`), [navigate, base]);
  // What the re-hosted App sees (Meshtastic family), and the hash the real URL needs for it.
  const classic = classicSourceLocation(location);
  const hashTarget = useHashTarget(classic.hash);

  // Every branch below renders its page next to any <Redirect>, never in its
  // place, so a URL fix-up does not remount the page.
  if (isLoading && !source) return <StateView kind="loading" page />;
  if (sources && !source) {
    // The Overview's own socket, as on every non-source route (Ruling N).
    return (
      <WebSocketProvider>
        <OverviewRehost notice={<p className={styles.notice} role="status">{t('workspace.source.not_found')}</p>} />
      </WebSocketProvider>
    );
  }

  if (source?.type === 'meshcore') {
    // The access rules need the grants; wait for them rather than redirect on an empty set.
    if (authLoading) return <StateView kind="loading" page />;
    const requested = meshcoreViewForPath(splat, location.hash);
    const visible = visibleMeshCoreViews({
      canRead: (resource) => hasPermission(resource, 'read', { sourceId }),
      isAuthenticated: authStatus?.authenticated ?? false,
    });
    const channel = splat.match(MC_CHANNEL_PATH);
    const room = splat.match(MC_ROOM_PATH);
    const node = splat.match(NODE_PATH);
    const automations = splat.match(MC_AUTOMATIONS_PATH);
    const mcSecurity = splat.match(SECURITY_PATH);
    // An unknown node tab shows the Overview, and the URL follows.
    const nodeTabKnown = !node?.[2] || MC_NODE_TABS.includes(node[2]);
    const screen: MeshCoreScreenKind | null =
      channel && visible.includes('channels')
        ? { kind: 'channel', idx: Number(channel[1]) }
        : room && visible.includes('rooms')
          ? { kind: 'room', key: room[1] }
          : MC_INFO_PATH.test(splat) && visible.includes('info')
            ? { kind: 'info' }
          : MC_PACKETS_PATH.test(splat) && visible.includes('packets')
            ? { kind: 'packets' }
          : automations && visible.includes('automations')
            ? { kind: 'automations', builtin: automations[1] ?? null }
          : mcSecurity && visible.includes('security')
            ? { kind: 'security', quiet: !!mcSecurity[1] }
          : MC_DASHBOARD_PATH.test(splat) && visible.includes('telemetry')
            ? { kind: 'dashboard' }
          : MC_NODES_PATH.test(splat)
            ? { kind: 'nodes' }
            : node
              ? { kind: 'node', key: node[1], tab: nodeTabKnown && node[2] ? node[2] : 'overview' }
              : isPhone && splat === '' && !location.hash
                ? { kind: 'home' }
                : null;
    if (screen) {
      return (
        <Redirect to={node && !nodeTabKnown ? `${base}/node/${encodeURIComponent(node[1])}` : null}>
          <Rehost>
            <MeshCoreScreen key={sourceId} sourceId={sourceId} source={source} screen={screen} />
          </Rehost>
        </Redirect>
      );
    }
    const query = new URLSearchParams(location.search);
    // Device settings, this radio's and a remote target's (Tasks 7.3, 7.4): the settings frame.
    // Today's Device Configuration URLs (`configuration[#<section>]`, `#configuration`) open the page that holds them.
    const settingsTo = meshcoreSettingsRedirect(base, splat, location.hash);
    if (settingsTo || MESHCORE_SETTINGS.test(splat)) {
      const path = (settingsTo ?? location.pathname).split('?')[0].replace(/^\/source\/[^/]+\/settings\/?/, '').replace(/\/$/, '');
      return (
        <Redirect to={settingsTo}>
          <Rehost>
            {/* The same element as the screens above, so moving to settings keeps the one useMeshCore runtime. */}
            <MeshCoreScreen key={sourceId} sourceId={sourceId} source={source} screen={{ kind: 'settings', path }} />
          </Rehost>
        </Redirect>
      );
    }
    const view = resolveMeshCoreView(requested ?? MESHCORE_FALLBACK_VIEW, visible);
    const dm = splat.match(MC_DM_PATH);
    // Keep the URL on the view the page shows: a forbidden or unknown view, or
    // the `#configuration` deep link, becomes `/source/:id/<view>`.
    const fix = requested !== view;
    const onViewChange = (next: MeshCoreView) => next !== view && goToView(mcViewPath(next));
    return (
      <Redirect to={fix ? `${base}/${mcViewPath(view)}` : null}>
        <Rehost>
          {renderSourceApp(PAGES, sourceId, source, splat, {
            meshcore: {
              view,
              onViewChange,
              dmContact: view === 'dms' && dm ? dm[1] : null,
              dmRequest: location.key,
              // Security's "Send a DM" hands its notice over in the location state (Task 8.5).
              dmDraft: view === 'dms' && dm ? draftOf(location.state) : null,
              mapNode: splat.startsWith('map') ? query.get('node') : null,
            },
          })}
        </Rehost>
      </Redirect>
    );
  }

  if (source?.type === 'reticulum') {
    // Device settings (LXMF identity, RNode radio); today's Configuration view opens them.
    const configuration = RETICULUM_CONFIGURATION.test(splat);
    if (configuration || RETICULUM_SETTINGS.test(splat)) {
      const path = configuration ? '' : splat.replace(/^settings\/?/, '').replace(/\/$/, '');
      return (
        <Redirect to={configuration ? `${base}/settings` : null}>
          <Rehost>
            <SettingsFrame key={sourceId} sourceId={sourceId} source={source} path={path} />
          </Rehost>
        </Redirect>
      );
    }
    // Every other URL is the one device screen, so moving between views keeps its one poll.
    const { screen, fix } = reticulumScreenForPath(splat, isPhone);
    return (
      <Redirect to={fix ? `${base}/${fix}` : null}>
        <Rehost>
          <ReticulumScreen key={sourceId} sourceId={sourceId} source={source} screen={screen} />
        </Rehost>
      </Redirect>
    );
  }

  if (source?.type === 'meshcore_mqtt') {
    // The region feed (Task 7.5): its Overview and tabs are native; any other URL shows today's page.
    const feed = !location.hash && splat.match(FEED_PATH);
    if (feed) {
      return (
        <Rehost>
          <RegionFeedPage key={sourceId} sourceId={sourceId} source={source} tab={(feed[1] as 'nodes' | 'channels' | 'packets' | 'notifications' | undefined) ?? 'overview'} />
        </Rehost>
      );
    }
    return <Rehost>{renderSourceApp(PAGES, sourceId, source, splat)}</Rehost>;
  }

  // A Meshtastic-family device's pages share its one socket and notices (DeviceSocket, Ruling 9.1 IJ); the same
  // root element on every page, keyed by device, so moving between its pages keeps the connection.
  const device = (page: ReactNode) => (
    <DeviceSocket key={sourceId} source={source!}>
      {page}
    </DeviceSocket>
  );

  // Today's `#info` / `#security` / `#packetmonitor` anchors open their Workspace page (Task 8.5).
  const anchor = source && isMeshtasticFamily(source.type) && splat === '' && location.hash.match(TOOL_ANCHOR);
  if (anchor) return <Navigate replace to={`${base}/${anchor[1]}`} />;

  // Tools, Info, Security and a device's own packet monitor (Task 8.5), under today's tab gates (App.tsx
  // tabPermissions); without the grant the URL falls through to App, which sends the viewer on as today.
  if (source && isMeshtasticFamily(source.type)) {
    if (TOOLS_PATH.test(splat)) {
      return device(
        <Rehost>
          <ToolsPage key={sourceId} sourceId={sourceId} deviceName={source.name} />
        </Rehost>
      );
    }
    const info = splat.match(INFO_PATH);
    if (info && hasPermission('info', 'read', { sourceId })) {
      const group = info[1] && (INFO_GROUPS as readonly string[]).includes(info[1]) ? (info[1] as InfoGroup) : null;
      return device(
        <Redirect to={info[1] && !group ? `${base}/info` : null}>
          <Rehost>
            <InfoPage key={sourceId} sourceId={sourceId} source={source} group={group} />
          </Rehost>
        </Redirect>
      );
    }
    const security = splat.match(SECURITY_PATH);
    if (security && hasPermission('security', 'read', { sourceId })) {
      return device(
        <Rehost>
          <DeviceSecurity key={sourceId} sourceId={sourceId} source={source} quiet={!!security[1]} />
        </Rehost>
      );
    }
    if (!isMqttOnlySourceType(source.type) && PACKETS_PATH.test(splat) && hasPermission('packetmonitor', 'read', { sourceId })) {
      return device(
        <Rehost>
          <DevicePackets key={sourceId} sourceId={sourceId} source={source} />
        </Rehost>
      );
    }
  }

  // Device settings, with the remote target (`?node=`, Task 5.9). A Classic settings URL is fixed up
  // beside the frame, which already shows its category.
  if (source) {
    const to = workspaceRedirect(location);
    if (to || SETTINGS_PATH.test(splat)) {
      const path = (to ?? location.pathname).split('?')[0].replace(/^\/source\/[^/]+\/settings\/?/, '');
      return device(
        <Redirect to={to}>
          <Rehost>
            <SettingsFrame key={sourceId} sourceId={sourceId} source={source} path={path} />
          </Rehost>
        </Redirect>
      );
    }
  }

  // Today's Automation tab gate (App.tsx tabPermissions): not an MQTT bridge, automation:read on this device.
  const automation = source && source.type !== 'mqtt_bridge' && hasPermission('automation', 'read', { sourceId }) && splat.match(AUTOMATION_PATH);
  if (automation) {
    const anchor = !automation[1] ? location.hash.replace(/^#/, '') : '';
    const page = automation[1] ?? ((BUILTIN_IDS as readonly string[]).includes(anchor) ? anchor : '');
    return device(
      <Redirect to={page && !automation[1] ? `${base}/automation/${page}` : null}>
        <Rehost>
          <DeviceAutomations key={sourceId} sourceId={sourceId} source={source} path={page} />
        </Rehost>
      </Redirect>
    );
  }

  const chat = source && splat.match(CHAT_PATH);
  if (chat) {
    return device(
      <Rehost>
        <ChannelThread key={sourceId} sourceId={sourceId} source={source} channel={Number(chat[1])} view={chat[2] ? 'beacons' : 'thread'} />
      </Rehost>
    );
  }

  const dm = source && splat.match(DM_PATH);
  if (dm) {
    return device(
      <Rehost>
        <DmConversation key={sourceId} sourceId={sourceId} source={source} nodeId={dm[1]} />
      </Rehost>
    );
  }

  if (source && DMS_PATH.test(splat)) {
    return device(
      <Rehost>
        <DmInbox key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  if (source && ACTIVITY_PATH.test(splat)) {
    return device(
      <Rehost>
        <ActivityFeed key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  if (source && MAP_PATH.test(splat)) {
    return device(
      <Rehost>
        <DeviceMap key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  if (source && DASHBOARD_PATH.test(splat)) {
    return device(
      <Rehost>
        <MeshtasticDashboard key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  if (source && NODES_PATH.test(splat)) {
    return device(
      <Rehost>
        <NodesPage key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  if (source && isMqttOnlySourceType(source.type) && PACKETS_PATH.test(splat)) {
    return device(
      <Rehost>
        <MqttReceptions key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  const nodePage = source && splat.match(NODE_PATH);
  if (nodePage) {
    const nodeId = nodePage[1];
    const segment = nodePage[2];
    const known = !segment || NODE_TABS.includes(segment);
    // An unknown tab shows the Overview, and the URL follows.
    return device(
      <Redirect to={known ? null : `${base}/node/${encodeURIComponent(nodeId)}`}>
        <Rehost>
          <NodePage
            key={`${sourceId}/${nodeId}`}
            sourceId={sourceId}
            source={source}
            nodeId={nodeId}
            tab={known && segment ? (segment as NodeTab) : 'overview'}
          />
        </Rehost>
      </Redirect>
    );
  }

  // The phone device Home (c-home-e1). A `#section` deep link still goes to App, which serves it.
  if (source && isPhone && splat === '' && !location.hash) {
    return device(
      <Rehost>
        <PhoneHome key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  // Meshtastic family: App. A Classic URL redirects to its Workspace form;
  // meanwhile App already shows that URL's Classic tab.
  const classicSplat = classic.pathname.replace(/^\/source\/[^/]+\/?/, '');
  return (
    <Redirect to={workspaceRedirect(location) ?? hashTarget}>
      <Rehost>
        {/* App reads its tab from the location; hand it the Classic one. */}
        <Routes location={{ ...location, pathname: classic.pathname, hash: classic.hash }}>
          <Route path="*" element={renderSourceApp(PAGES, sourceId, source, classicSplat)} />
        </Routes>
      </Rehost>
    </Redirect>
  );
}
