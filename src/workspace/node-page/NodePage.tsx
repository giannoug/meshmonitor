/**
 * The node page (boards f4-node, f5-telemetry, g4-node, g5-links, 15-02…15-04,
 * 15-12, 15-16, 15-17; note ds1): `/source/:id/node/:nodeId[/<tab>]` on a
 * Meshtastic-family device. NodeHeader (the node, Message and the three node
 * menus, the tabs) over one tab: Overview, Telemetry, Links, Position and
 * Admin. Every tab shows to anyone who can read the node (Ruling BE); each
 * part inside keeps Classic's own gate. Desktop and phone share this
 * one data path; the tabs lay themselves out per width.
 *
 * One owner per screen (Ruling AD): App is not mounted. The page runs the
 * source's node state with the hooks App uses (useChatRuntime's poll,
 * useSourceView) under the providers App mounts for itself, at Classic's
 * `/nodes` location, plus its own MapProvider: the page's node is the map's
 * selection, so a mobile node's position history loads (`usePositionHistory`,
 * server reads only) and is drawn on the page's map. Opening the page sends
 * nothing on the mesh and starts no timer; every send is one of today's
 * controls (NodeActionMenus) with its own gate, Sends line and confirm.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapProvider, useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { usePersistedNodeFilters } from '../../hooks/usePersistedNodeFilters';
import { usePositionHistory } from '../../hooks/usePositionHistory';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import { useNodes } from '../../hooks/useServerData';
import { useSourceView } from '../../hooks/useSourceView';
import { appBasename } from '../../init';
import type { DbTraceroute } from '../../services/database';
import ChatProviders from '../chat/ChatProviders';
import { useChatRuntime } from '../chat/useChatRuntime';
import { themeColors } from '../map/themeColors';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import AdminTab from './AdminTab';
import LinksTab from './LinksTab';
import NodeHeader from './NodeHeader';
import OverviewTab from './OverviewTab';
import PositionTab from './PositionTab';
import TelemetryTab from './TelemetryTab';
import styles from './NodePage.module.css';

export type NodeTab = 'overview' | 'telemetry' | 'links' | 'position' | 'admin';

export interface NodePageRouteProps {
  sourceId: string;
  source: DashboardSource;
  nodeId: string;
  tab: NodeTab;
}

export default function NodePageRoute({ sourceId, source, nodeId, tab }: NodePageRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="nodes">
      <MapProvider>
        <NodePage sourceId={sourceId} nodeId={nodeId} tab={tab} />
      </MapProvider>
    </ChatProviders>
  );
}

const noop = () => {};

function NodePage({ sourceId, nodeId, tab }: { sourceId: string; nodeId: string; tab: NodeTab }) {
  const isPhone = useIsPhone();
  const { pollData, view: messaging } = useChatRuntime(-1);
  const { setTraceroutes, setSelectedNodeId, selectedNodeId } = useMapContext();
  const settings = useSettings();
  const { nodes, isLoading } = useNodes();
  const [nodeFilters] = usePersistedNodeFilters('nodeFilters');
  const csrfFetch = useCsrfFetch();
  const queryClient = useQueryClient();
  const authFetch = useCallback((url: string, init?: RequestInit) => csrfFetch(url, init), [csrfFetch]);
  const refetchPoll = useCallback(() => queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) }), [queryClient, sourceId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 a theme change re-reads the CSS variables, as App does
  const mergedThemeColors = useMemo(() => themeColors(settings.overlayColors), [settings.overlayColors, settings.theme]);
  const view = useSourceView({
    baseUrl: appBasename,
    authFetch,
    refetchPoll,
    nodeFilters,
    mergedThemeColors,
    setSelectedRouteSegment: noop,
    setShowPurgeDataModal: noop,
  });

  // As App's poll processing: traceroutes arrive with the poll (the strip and the hop counts read them).
  const polledTraceroutes = pollData?.traceroutes;
  useEffect(() => {
    if (polledTraceroutes) setTraceroutes(polledTraceroutes as unknown as DbTraceroute[]);
  }, [polledTraceroutes, setTraceroutes]);
  // The page's node is the map's selection: its trail loads and is highlighted.
  useEffect(() => setSelectedNodeId(nodeId), [nodeId, setSelectedNodeId]);
  usePositionHistory({ selectedNodeId, nodes, baseUrl: appBasename, sourceId, authFetch });

  const node = nodes.find((n) => n.user?.id === nodeId);

  if (!node) {
    return (
      <div className={styles.page}>
        <StateView kind={isLoading ? 'loading' : 'notFound'} />
      </div>
    );
  }

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <NodeHeader sourceId={sourceId} node={node} tab={tab} />
      <div className={styles.body}>
        {tab === 'overview' && <OverviewTab sourceId={sourceId} node={node} mapNodes={view.processedNodes} />}
        {tab === 'telemetry' && <TelemetryTab sourceId={sourceId} node={node} />}
        {tab === 'links' && <LinksTab sourceId={sourceId} node={node} />}
        {tab === 'position' && <PositionTab sourceId={sourceId} node={node} mapNodes={view.processedNodes} />}
        {tab === 'admin' && <AdminTab sourceId={sourceId} node={node} messages={messaging.messages} />}
      </div>
    </div>
  );
}
