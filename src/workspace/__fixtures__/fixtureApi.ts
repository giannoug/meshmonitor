/**
 * Serves the Athens fixture by method and path, for Vitest (`renderWorkspace`
 * stubs `fetch` with it) and Playwright (`tests/workspace-e2e/fixtureRoutes.ts`).
 *
 * Keys are `'<METHOD> <path-pattern>'` with `:param` segments, matched against
 * the pathname only; a handler reads the query from the URL it is given. A
 * handler returns a body (sent as 200 JSON), a `Response`, or `undefined` to
 * fall through. Overrides are tried before the defaults. No match: `undefined`.
 */
import { athensFixture as A, SOURCE_IDS } from './athens';
import * as R from './reports';
import * as M from './messages';
import * as P from './packets';
import * as T from './telemetry';

export type FixtureHandler = (url: URL, init?: RequestInit) => unknown | Response;

/**
 * A node as the server's dashboard routes send it: the stored row's flat fields (names, position,
 * device metrics), which Map Analysis reads; the poll's nested fields are kept beside them.
 */
export function dbRow(n: (typeof A.nodes)[number], sourceId: string) {
  return {
    ...n,
    sourceId,
    nodeId: n.user?.id, longName: n.user?.longName, shortName: n.user?.shortName, hwModel: n.user?.hwModel, role: n.user?.role,
    publicKey: n.user?.publicKey,
    latitude: n.position?.latitude, longitude: n.position?.longitude, altitude: n.position?.altitude,
    ...n.deviceMetrics,
  };
}

const defaults: Record<string, FixtureHandler> = {
  'GET /api/config': () => A.config,
  'GET /api/csrf-token': () => ({ csrfToken: 'fixture-csrf-token' }),
  'GET /api/auth/status': () => A.authStatus,
  'GET /api/users/:id/channel-database-permissions': () => ({ data: [] }),
  'GET /api/user/preferences': () => ({ success: true, data: { preferences: A.userPreferences } }),
  'GET /api/settings': () => A.settings,
  'GET /api/admin/layout-usage': () => ({ success: true, data: A.layoutUsage }),
  // Empty lists for the re-hosted Server › General page (r4), which toasts on a 404.
  'GET /api/embed-profiles': () => [],
  'GET /api/channel-database': () => ({ success: true, data: [] }),
  'GET /api/scripts/inventory': () => ({ success: true, data: { scripts: [] } }),
  'GET /api/sources': () => A.sources,
  'GET /api/sources/:id/status': (url) => A.statuses[url.pathname.split('/')[3]],
  'GET /api/unified/status': () => A.unifiedStatus,
  // The all-devices map (f6, 5-01 …, 5-08): Station G2's nodes, traceroutes and neighbour links; the other devices' bundles are empty.
  'GET /api/unified/dashboard': (url) =>
    (url.searchParams.get('sources') ?? '').split(',').filter(Boolean).map((sourceId) => ({
      sourceId,
      nodes: sourceId === SOURCE_IDS.g2 ? A.nodes.map((n) => dbRow(n, sourceId)) : [],
      traceroutes: sourceId === SOURCE_IDS.g2 ? A.traceroutes.map((r) => ({ ...r, sourceId })) : [],
      neighborInfo: sourceId === SOURCE_IDS.g2 ? A.neighborInfo : [],
      channels: sourceId === SOURCE_IDS.g2 ? A.channels : [],
    })),
  // Overview › Messages (7-01 … 7-09): the unified feed, its channel list and Station G2's key collision.
  'GET /api/unified/channels': () => M.unifiedChannels,
  'GET /api/unified/messages': (url) => M.unifiedMessagesReply(url),
  'GET /api/channels/collisions': (url) => ({ collisions: M.channelCollisions[url.searchParams.get('sourceId') ?? ''] ?? [] }),
  // Overview › Telemetry (7-03, 7-04, 7-07): favorited series and the latest readings.
  'GET /api/unified/telemetry/series': () => ({ success: true, data: { series: T.telemetrySeries } }),
  'GET /api/unified/telemetry': () => T.telemetryLatest,
  // Overview › Packets (7-05, 7-08): the merged stream and its charts. Capture state is the
  // `captureOn` override (packets.ts): as a default it would change Classic's chrome snapshot.
  'GET /api/unified/packets': () => ({ packets: P.unifiedPackets, hasMore: false, nextCursor: null, sources: P.unifiedPacketSources }),
  'GET /api/unified/packets/distribution': () => P.unifiedDistribution,
  // The pop-out window (18-01, 18-02): the primary device's packets; a later page is empty.
  'GET /api/packets': (url) => (Number(url.searchParams.get('offset') ?? 0) > 0 ? { ...P.popoutPackets, packets: [] } : P.popoutPackets),
  'GET /api/packets/relay-nodes': () => ({ relayNodes: [] }),
  // Athens MQTT's receptions (18-03, 18-04).
  'GET /api/sources/:id/mqtt/packets': () => ({
    success: true, data: { packets: P.mqttPackets, total: 214, offset: 0, limit: 5000, enabled: true, maxCount: 5000, maxAgeHours: 24 },
  }),
  'GET /api/sources/:id/mqtt/packets/gateways': () => ({ success: true, data: { gateways: P.mqttGateways } }),
  'GET /api/sources/:id/mqtt/packets/receptions': () => ({ success: true, data: { receptions: P.mqttReceptions } }),
  'GET /api/messages/unread-by-source': () => A.unreadBySource,
  'GET /api/messages/unread-counts': () => A.unreadCounts,
  'GET /api/messages/first-unread': () => ({ success: true, data: A.firstUnread }),
  // Older pages for a conversation's scroll-back: the poll already holds them all.
  'GET /api/messages/channel/:channel': () => ({ messages: [], hasMore: false }),
  'GET /api/messages/direct/:a/:b': () => ({ messages: [], hasMore: false }),
  // The DM's traceroute strip: the stored runs it can pick from, and the pair history for Statistical.
  'GET /api/traceroutes/participation/:nodeNum': (url) => {
    const nodeNum = Number(url.pathname.split('/')[4]);
    const entries = A.traceroutes
      .slice(1)
      .filter((r) => r.fromNodeNum === nodeNum || r.toNodeNum === nodeNum)
      .map((r) => ({ ...r, id: r.id!, channel: 0, participation: 'endpoint', hopCount: r.hopCount }));
    return { success: true, data: { entries } };
  },
  // The stored history, plus a run that got no reply (Show failed traceroutes, 15-04).
  'GET /api/traceroutes/history/:from/:to': () => [
    ...A.traceroutes,
    { ...A.traceroutes[0], id: 38, route: 'null', routeBack: 'null', snrTowards: 'null', snrBack: 'null', hopCount: 0,
      timestamp: A.traceroutes[2].timestamp - 3_600_000, createdAt: A.traceroutes[2].timestamp - 3_600_000 },
  ],
  // Share contact on the node page's Admin tab (15-03): today's QR, built on request.
  'GET /api/nodes/:nodeNum/contact-url': () => ({ success: true, data: { url: 'https://meshtastic.org/v/#CgcSBUtpZmlzaWE' } }),
  // Athens Rover's tracked-asset trail (15-02).
  'GET /api/assets/:nodeNum/track': (url) =>
    Number(url.pathname.split('/')[3]) === A.roverTrack.nodeNum ? { success: true, data: A.roverTrack } : undefined,
  'GET /api/nodes/identity-changes': () => ({ success: true, data: { detections: [] } }),
  // The node dialogs (15-05, 15-06): Kifisia Rooftop as Athens MQTT heard it, its saved position
  // override, and the merge dry run (unverified pairing, too large to undo).
  'GET /api/nodes/:nodeNum/copy-candidates': () => ({ success: true, data: { candidates: A.copyCandidates, target: null } }),
  'GET /api/nodes/:nodeId/position-override': () => ({ enabled: true, latitude: 38.0741, longitude: 23.8112, altitude: 310, isPrivate: true }),
  'POST /api/nodes/identity-changes/merge/preview': () => ({ success: true, data: A.mergePreview }),
  // The MQTT mirror reads the same mesh as Station G2.
  'GET /api/poll': (url) => {
    const sourceId = url.searchParams.get('sourceId');
    return !sourceId || sourceId === SOURCE_IDS.g2 || sourceId === SOURCE_IDS.mqtt ? A.poll : undefined;
  },
  'GET /api/device/tx-status': () => A.txStatus,
  'POST /api/messages/mark-read': () => ({ success: true }),
  'GET /api/sources/:id/beacon-offers/count': () => ({
    success: true,
    data: { pending: A.beaconOffers.filter((o) => !o.dismissedAt && !o.mutedAt).length, total: A.beaconOffers.length },
  }),
  'GET /api/sources/:id/beacon-offers': () => ({ success: true, data: A.beaconOffers }),
  'GET /api/connection': (url) => {
    const status = A.statuses[url.searchParams.get('sourceId') ?? SOURCE_IDS.g2];
    return status && { ...A.poll.connection, connected: status.connected };
  },
  // Message details (10-02 / 10-10): the stored send timeline; heard-by is for channel sends only.
  'GET /api/sources/:id/messages/:messageId/events': (url) => ({
    success: true,
    data: { events: A.messageEvents.filter((e) => e.messageId === decodeURIComponent(url.pathname.split('/')[5])) },
  }),
  'GET /api/sources/:id/messages/:messageId/heard-by': () => ({ success: true, data: { heardBy: [] } }),
  'GET /api/direct-neighbors': () => ({}),
  'POST /api/translate': () => ({ success: true, data: A.translation }),
  // Message search (10-15 / 10-16): the first page of 31 results; Load more serves it again.
  'GET /api/messages/search': () => ({ success: true, count: A.searchResults.length, total: 31, data: A.searchResults }),
  // Activity (c-home-e4 / e5 / e6): one page per device; Station G2 has five items, the rest none.
  'GET /api/sources/:id/activity': (url) => ({
    success: true,
    data: { items: url.searchParams.has('before') ? [] : (A.activity[url.pathname.split('/')[3]] ?? []), nextBefore: null },
  }),
  // The device map (Main, f2-layers, 15-09): Station G2's neighbour links; no GeoJSON layers.
  'GET /api/sources/:id/neighbor-info': (url) => (url.pathname.split('/')[3] === SOURCE_IDS.g2 ? A.neighborInfo : []),
  'GET /api/geojson/layers': () => [],
  'GET /api/sources/:id/waypoints': (url) => ({ success: true, data: url.pathname.split('/')[3] === SOURCE_IDS.g2 ? A.waypoints : [] }),
  'GET /api/sources/:id/markers': () => ({ success: true, data: [] }),
  // Today's other node charts and the signal trend (the node page's Telemetry tab and Overview, f4 / f5).
  'GET /api/telemetry/:nodeId/smarthops': () => ({
    success: true,
    data: [0, 1, 2, 3].map((i) => ({ timestamp: Date.now() - i * 3_600_000, minHops: 1, maxHops: 2, avgHops: 1.5 })),
  }),
  'GET /api/telemetry/:nodeId/linkquality': () => ({
    success: true,
    data: [0, 1, 2, 3].map((i) => ({ timestamp: Date.now() - i * 3_600_000, quality: 7 + (i % 2) })),
  }),
  'GET /api/telemetry/:nodeId/signal-trend': () => ({
    success: true,
    data: {
      trend: 'degrading', basis: 'rssi', snr: null, noiseFloor: null, noiseFloorRising: false,
      rssi: { recent: -98, baseline: -92, delta: -6, recentCount: 40, baselineCount: 280, unit: 'dBm' },
    },
  }),
  'GET /api/packets/stats/distribution': () => ({
    enabled: true, total: 64, byDevice: [],
    byType: [
      { portnum: 3, portnum_name: 'POSITION_APP', count: 28 },
      { portnum: 67, portnum_name: 'TELEMETRY_APP', count: 22 },
      { portnum: 1, portnum_name: 'TEXT_MESSAGE_APP', count: 14 },
    ],
  }),
  // Analysis on the Overview map (5-01 … 5-06): Station G2's traceroutes, neighbour links, Athens
  // Rover's trail and the hop counts; elevation is on without DEM tiles (no 3D).
  'GET /api/analysis/traceroutes': () => ({
    items: A.traceroutes.map((r) => ({ ...r, sourceId: SOURCE_IDS.g2 })), hasMore: false, nextCursor: null,
  }),
  'GET /api/analysis/neighbors': () => ({
    items: A.neighborInfo.map((n) => ({ ...n, sourceId: SOURCE_IDS.g2, neighborNum: n.neighborNodeNum })),
  }),
  'GET /api/analysis/positions': () => ({
    items: A.roverTrack.segments[0].map((p) => ({ ...p, nodeNum: A.roverTrack.nodeNum, sourceId: SOURCE_IDS.g2 })),
    hasMore: false,
    nextCursor: null,
  }),
  'GET /api/analysis/hop-counts': () => ({
    entries: A.nodes.map((n) => ({ sourceId: SOURCE_IDS.g2, nodeNum: n.nodeNum, hops: n.hopsAway ?? 0 })),
  }),
  'GET /api/elevation/capabilities': () => ({ success: true, data: { enabled: true, terrainTiles: false } }),
  // The terrain between two points (Link Profile 5-04, the segment inspector 5-06): 32 samples across a valley (a clear path).
  'POST /api/elevation/profile': (_url, init) => {
    const { pointA: a, pointB: b } = JSON.parse(String(init?.body ?? '{}')) as Record<'pointA' | 'pointB', { lat: number; lng: number }>;
    const toRad = Math.PI / 180;
    const meters = 6_371_000 * 2 * Math.asin(Math.sqrt(
      Math.sin(((b.lat - a.lat) * toRad) / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(((b.lng - a.lng) * toRad) / 2) ** 2,
    ));
    const samples = Array.from({ length: 32 }, (_, i) => {
      const f = i / 31;
      return { distance: meters * f, lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, elevation: Math.round(300 - 290 * Math.sin(f * Math.PI)) };
    });
    return { success: true, data: { distanceMeters: meters, provider: 'fixture', samples } };
  },
  // Overview › Reports (6-01 … 6-15): Mesh Issues' last run and findings, the Coverage Report's data.
  'GET /api/analysis/mesh-issues/status': () => ({ success: true, data: R.meshIssuesStatus }),
  'GET /api/analysis/mesh-issues/summary': () => ({ success: true, data: R.meshIssuesSummary }),
  'GET /api/analysis/mesh-issues': (url) => R.meshIssuesPage(url),
  'GET /api/analysis/coverage/receivers': () => ({
    success: true, data: { receivers: R.coverageReceivers, retentionDays: 30, mqttSources: R.coverageMqttSources },
  }),
  'GET /api/analysis/coverage/senders': () => ({ success: true, data: { senders: R.coverageSenders, truncated: false } }),
  'GET /api/analysis/coverage/receptions': () => ({
    success: true, data: { items: R.coverageReceptions, pageSize: 1000, hasMore: false, nextCursor: null },
  }),
  'GET /api/analysis/coverage/surveys': () => ({ success: true, data: R.coverageSurveys }),
  // Traceroute Explorer, Solar, ok_to_mqtt and NodeInfo Enrichment (6-04 … 6-07, 6-11 … 6-14).
  'GET /api/traceroutes/explorer': () => ({ success: true, data: R.explorerResponse }),
  'GET /api/analysis/solar-nodes': () => R.solarNodes,
  'GET /api/analysis/solar-forecast': () => R.solarForecast,
  'GET /api/analysis/mqtt-violations/gateways': (url) => R.mqttGatewaysReply(url),
  'GET /api/analysis/mqtt-violations/packets': (url) => R.mqttPacketsReply(url),
  'GET /api/nodes/enrichment/analysis': () => ({ success: true, data: R.enrichmentAnalysis }),
  'GET /api/telemetry/:nodeId': (url) => {
    const nodeId = decodeURIComponent(url.pathname.split('/')[3]);
    return A.telemetry.filter((row) => row.nodeId === nodeId);
  },
};

interface Route {
  method: string;
  path: RegExp;
  handler: FixtureHandler;
}

function compile(table: Partial<Record<string, FixtureHandler>>): Route[] {
  return Object.entries(table).flatMap(([key, handler]) => {
    if (!handler) return [];
    const [method, pattern] = key.split(' ');
    const source = pattern
      .split('/')
      .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/');
    return [{ method: method.toUpperCase(), path: new RegExp(`^${source}$`), handler }];
  });
}

const defaultRoutes = compile(defaults);

export function fixtureApi(
  overrides: Partial<Record<string, FixtureHandler>> = {},
): (url: string, init?: RequestInit) => Response | undefined {
  const routes = [...compile(overrides), ...defaultRoutes];
  return (rawUrl, init) => {
    const url = new URL(rawUrl, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    for (const route of routes) {
      if (route.method !== method || !route.path.test(url.pathname)) continue;
      const body = route.handler(url, init);
      if (body === undefined) continue;
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return undefined;
  };
}
