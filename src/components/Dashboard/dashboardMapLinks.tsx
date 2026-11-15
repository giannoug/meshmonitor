/**
 * The Dashboard map's node age gate and its link overlays (route segments /
 * traceroutes, MeshCore and Meshtastic neighbour links), moved verbatim out of
 * DashboardMap so the Workspace Overview map (#6365) draws exactly the same
 * things from the same data. DashboardMap calls these in place of its former
 * inline code; its output is unchanged.
 */
import { Popup } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import DashboardNeighborPopup from './DashboardNeighborPopup';
import { isMeshCoreInfrastructureAdvType } from '../MeshCore/meshcoreRole';
import { isAgedOutAircraft } from '../map/agedOutAircraft';
import type { NeighborLinkDescriptor } from '../map/layers/NeighborLinksLayer';
import { resolveMapEndpoint } from '../../utils/nodeHelpers';
import { snrToNeighborOpacity, dedupByUnorderedPair } from '../../utils/neighborLinks';
import {
  hopTransportClass,
  segmentPassesTransportFilter,
  tracerouteTransportClass,
  transportFilterIsInert,
} from '../../utils/tracerouteTransport';
import {
  parseSnapshotRoutePositions,
  resolveSegmentPosition,
  decomposeTraceroute,
  type TracerouteRenderSegment,
} from '../../utils/tracerouteSegments';

export interface TransportFlags {
  showRfNodes: boolean;
  showUdpNodes: boolean;
  showMqttNodes: boolean;
}

export interface AgeGateCutoffs {
  /** Unix seconds: older companions are hidden. */
  ageCutoffTime: number;
  /** Unix seconds: older MeshCore infrastructure is hidden, unless `infraNever`. */
  infraCutoffTime: number;
  infraNever: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 DashboardMap's node rows are untyped (moved verbatim)
type AnyNode = any;

/**
 * #4899: per-node age gate — MeshCore infrastructure (advType 2/3) uses the
 * infra window (or never expires when it's 0); everything else uses the
 * companion window. Favorites bypass both, as before.
 */
export function passesDashboardAgeGate(n: AnyNode, { ageCutoffTime, infraCutoffTime, infraNever }: AgeGateCutoffs): boolean {
  if (n.isFavorite) return true;
  // #5364/#5365 Phase 2: an aged-out aircraft is by definition older than
  // its age-out window, which is often the map window too. It is only
  // kept when "Show aged-out" is on (below), so let it past the age gate.
  if (isAgedOutAircraft(n)) return true;
  if (n.lastHeard == null) return false;
  if (n.isMeshCore && isMeshCoreInfrastructureAdvType(n.advType)) {
    return infraNever || n.lastHeard >= infraCutoffTime;
  }
  return n.lastHeard >= ageCutoffTime;
}

/**
 * MeshCore neighbor links: one Polyline per edge whose BOTH endpoints resolve
 * to a currently-visible MeshCore node. Endpoints are filtered through the
 * same node pipeline, so links to a hidden node (stale / ignored / RF off)
 * naturally drop out. Deduped by the unordered {publicKey, neighborPublicKey}
 * pair (shared `dedupByUnorderedPair`, #4047 Phase 7 WP7) so the same link
 * reported by multiple sources (Unified view) draws once. Emits descriptors
 * for the shared `NeighborLinksLayer` — fixed cyan/dashed look, no popup.
 */
export function dashboardMeshCoreNeighborLinks(
  meshcoreNeighbors: AnyNode[] | undefined,
  positionByPublicKey: Map<string, [number, number]>,
): NeighborLinkDescriptor[] {
  const withPositions: {
    publicKey: string;
    neighborPublicKey: string;
    a: [number, number];
    b: [number, number];
    snr: number | null;
  }[] = [];
  for (const e of (meshcoreNeighbors ?? [])) {
    const pk = e?.publicKey;
    const npk = e?.neighborPublicKey;
    if (typeof pk !== 'string' || typeof npk !== 'string') continue;
    const a = positionByPublicKey.get(pk);
    const b = positionByPublicKey.get(npk);
    if (!a || !b) continue;
    withPositions.push({ publicKey: pk, neighborPublicKey: npk, a, b, snr: e?.snr ?? null });
  }
  const deduped = dedupByUnorderedPair(
    withPositions,
    (x) => x.publicKey,
    (x) => x.neighborPublicKey,
  );
  return deduped.map(({ publicKey: pk, neighborPublicKey: npk, a, b, snr }) => {
    const pairKey = pk < npk ? `${pk}~${npk}` : `${npk}~${pk}`;
    const positions: [[number, number], [number, number]] = [a, b];
    return {
      key: `mc-neighbor-${pairKey}`,
      positions,
      pathOptions: {
        color: '#06b6d4',
        weight: 1.5,
        opacity: snrToNeighborOpacity(snr),
        dashArray: '6 4',
      },
    };
  });
}

/**
 * Traceroute render segments: one TracerouteRenderSegment per hop, forward
 * AND return leg, built via the shared `decomposeTraceroute` (which /4-scales
 * the Dashboard's raw SNR, resolves #1862 snapshot positions ahead of live
 * `positionByNodeNum`, and gates the return leg on the #2051 guard). Hops older
 * than the map age window are dropped (#3322); #5097 Show RF / UDP / MQTT
 * filters each hop.
 */
export function dashboardTracerouteSegments(
  traceroutes: AnyNode[] | undefined,
  positionByNodeNum: Map<number, [number, number]>,
  maxAgeHours: number,
  transportFlags: TransportFlags,
): TracerouteRenderSegment[] {
  // All three on means the filter can remove nothing — skip the per-hop work.
  const transportFilterActive = !transportFilterIsInert(transportFlags);
  const trCutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const segs: TracerouteRenderSegment[] = [];
  for (const tr of (traceroutes ?? [])) {
    const trTimestamp = Number(tr?.timestamp ?? tr?.createdAt ?? 0);
    if (trTimestamp && trTimestamp < trCutoffMs) continue;
    const fromNum = Number(tr?.fromNodeNum);
    const toNum = Number(tr?.toNodeNum);
    if (!Number.isFinite(fromNum) || !Number.isFinite(toNum)) continue;
    const snapshot = parseSnapshotRoutePositions(tr?.routePositions);
    // #4162: gate on the rendered-marker map so route segments never dangle
    // to a node that has no marker.
    const resolvePosition = (nodeNum: number): [number, number] | null =>
      resolveSegmentPosition(nodeNum, snapshot, positionByNodeNum, true);
    const keyPrefix = `tr-${tr.sourceId ?? 'x'}-${tr.id}`;
    const decomposed = decomposeTraceroute(
      {
        fromNodeNum: fromNum,
        toNodeNum: toNum,
        route: tr?.route,
        routeBack: tr?.routeBack,
        snrTowards: tr?.snrTowards,
        snrBack: tr?.snrBack,
        timestamp: tr?.timestamp,
        createdAt: tr?.createdAt,
      },
      { resolvePosition },
    );
    // #5097 — a hop's class is this record's transport unless the hop's own
    // unknown-SNR sentinel says MQTT.
    const recordClass = tracerouteTransportClass(tr);
    for (const seg of decomposed) {
      if (
        transportFilterActive &&
        !segmentPassesTransportFilter([hopTransportClass(recordClass, seg.isMqtt)], transportFlags)
      ) {
        continue;
      }
      segs.push({ ...seg, key: `${keyPrefix}-${seg.key}` });
    }
  }
  return segs;
}

/**
 * Meshtastic neighbor links — transport-coloured, bidirectional solid vs
 * unidirectional dashed, with `DashboardNeighborPopup`. #4042: endpoints are
 * resolved through `resolveMapEndpoint` against `positionByNodeNum` (the
 * rendered-marker positions), the link's embedded coordinates as fallback.
 */
export function dashboardMeshtasticNeighborLinks(
  neighborInfo: AnyNode[],
  positionByNodeNum: Map<number, [number, number]>,
  { showRfNodes, showUdpNodes, showMqttNodes }: TransportFlags,
): NeighborLinkDescriptor[] {
  return neighborInfo
    .filter((link: AnyNode) => {
      const tc = link.transportClass ?? 'rf';
      if (tc === 'mqtt' && !showMqttNodes) return false;
      if (tc === 'udp' && !showUdpNodes) return false;
      if (tc === 'rf' && !showRfNodes) return false;
      return true;
    })
    .map((link: AnyNode, idx: number): NeighborLinkDescriptor | null => {
      const nodeEndpoint = resolveMapEndpoint(positionByNodeNum, link.nodeNum, link.nodeLatitude, link.nodeLongitude);
      const neighborEndpoint = resolveMapEndpoint(positionByNodeNum, link.neighborNodeNum, link.neighborLatitude, link.neighborLongitude);
      // Skip if either endpoint has no resolvable position (no marker AND no embedded coords).
      if (!nodeEndpoint || !neighborEndpoint) {
        return null;
      }

      const positions: [[number, number], [number, number]] = [nodeEndpoint, neighborEndpoint];

      const tc = link.transportClass ?? 'rf';
      const colorByTransport = tc === 'mqtt' ? '#22c55e' : tc === 'udp' ? '#f97316' : 'blue';
      const pathOptions: PathOptions = link.bidirectional
        ? { color: colorByTransport, weight: 2, opacity: 0.6 }
        : { color: colorByTransport, weight: 1, opacity: 0.6, dashArray: '5, 5' };

      // Stable key by canonical node-pair (not array index) so the deduped
      // line keeps its identity across polls.
      const pairKey = link.nodeNum != null && link.neighborNodeNum != null
        ? `${Math.min(Number(link.nodeNum), Number(link.neighborNodeNum))}-${Math.max(Number(link.nodeNum), Number(link.neighborNodeNum))}`
        : `idx-${idx}`;

      return {
        key: `neighbor-link-${pairKey}`,
        positions,
        pathOptions,
        children: (
          <Popup>
            <DashboardNeighborPopup link={link} />
          </Popup>
        ),
      };
    })
    .filter((d): d is NeighborLinkDescriptor => d !== null);
}
