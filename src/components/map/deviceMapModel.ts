/**
 * The device map's node filter and its overlay builders, shared by NodesTab
 * and the Workspace device map (#6365) so the two draw the same map from the
 * same toggles. Pure: every toggle, setting and lookup comes in as an
 * argument; the caller keeps its own gate (e.g. `showAccuracyRegions ? … : []`).
 */
import type { ReactNode } from 'react';
import type { LeafletEventHandlerFnMap } from 'leaflet';
import type { DeviceInfo } from '../../types/device';
import type { AircraftDisplayMode } from '../../utils/aircraftClassification';
import type { EnrichedNeighborInfo } from '../../contexts/MapContext';
import { isNodeComplete, resolveMapEndpoint } from '../../utils/nodeHelpers';
import { nodePassesTransportFilter } from '../../utils/nodeTransport';
import { hasAccuracyCell, precisionCellBounds } from '../../utils/precisionOffset';
import { isAgedOutAircraft } from './agedOutAircraft';
import { computeNeighborLinkStyle } from './DeviceMapLayers';
import type { AccuracyRegionDescriptor } from './layers/AccuracyRegionsLayer';
import type { EstimatedPositionRadius } from './layers/EstimatedPositionRadiiLayer';
import type { NeighborLinkDescriptor } from './layers/NeighborLinksLayer';

export interface TransportToggles {
  showRfNodes: boolean;
  showUdpNodes: boolean;
  showMqttNodes: boolean;
}

/** What every overlay of a node shares: the transport, completeness and traceroute filters. */
export interface NodeOverlayFilter {
  transport: TransportToggles;
  /** `transportCutoffSec(effectiveMapMaxAge)`, read once per render. */
  transportCutoff: number;
  showIncompleteNodes: boolean;
  /** When a traceroute is active, only its nodes are drawn. */
  tracerouteNodeNums?: Set<number> | null;
}

export interface MapNodeFilter extends NodeOverlayFilter {
  showEstimatedPositions: boolean;
  nodesWithEstimatedPosition: Set<string>;
  /** Epoch seconds: markers last heard before this are hidden (favourites excepted). */
  mapAgeCutoffSeconds: number;
  aircraftDisplayMode: AircraftDisplayMode;
}

const passesOverlayFilter = (node: DeviceInfo, f: NodeOverlayFilter): boolean =>
  nodePassesTransportFilter(node, f.transport, f.transportCutoff) &&
  (f.showIncompleteNodes || isNodeComplete(node)) &&
  // When traceroute is active, only show nodes involved in the traceroute
  (!f.tracerouteNodeNums || f.tracerouteNodeNums.has(node.nodeNum));

/** Whether a positioned node gets a marker: the shared source of truth for the 2D markers and the 3D features. */
export function passesMapFilters(node: DeviceInfo, f: MapNodeFilter): boolean {
  // Apply standard filters
  if (!nodePassesTransportFilter(node, f.transport, f.transportCutoff)) return false;
  if (!f.showIncompleteNodes && !isNodeComplete(node)) return false;
  if (!f.showEstimatedPositions && node.user?.id && f.nodesWithEstimatedPosition.has(node.user.id)) return false;
  // When traceroute is active, only show nodes involved in the traceroute
  if (f.tracerouteNodeNums && !f.tracerouteNodeNums.has(node.nodeNum)) return false;
  // #5364/#5365 Phase 2: an aged-out aircraft is older than any useful
  // age window by definition, and "Show aged-out" is its own switch, so
  // neither the age slider nor Hide applies to it.
  if (isAgedOutAircraft(node)) return true;
  // Map Features age slider (#3322): hide markers older than the
  // chosen age. Favorites are always shown, matching the standard
  // node age filter. Default (slider at max) is a no-op.
  if (!node.isFavorite && node.lastHeard && node.lastHeard < f.mapAgeCutoffSeconds) return false;
  // Likely-aircraft Hide (#5364/#5365 Phase 1 WP4): suppress the marker,
  // except a favourite is never hidden by this toggle.
  if (f.aircraftDisplayMode === 'hide' && node.likelyAircraft === true && !node.isFavorite) return false;
  return true;
}

/**
 * "N aged out" hint (#5364/#5365 Phase 2): counted from the SAME filtered
 * set the map draws with the checkbox on — never from every node (the
 * Phase 1 count bug) — and independent of the checkbox itself.
 */
export function countAgedOutOnMap(nodes: DeviceInfo[], f: MapNodeFilter): number {
  return nodes.filter((node) => isAgedOutAircraft(node) && passesMapFilters(node, f)).length;
}

/**
 * Position accuracy regions (#4047 Phase 7 WP11) — adapter over the shared
 * `AccuracyRegionsLayer` (WP3). `hasAccuracyCell`/`precisionCellBounds`
 * (`utils/precisionOffset`) hold the cell-size formula. `pathOptions` stays
 * hop-colored (tied visually to the hop-colored marker) via the descriptor's
 * per-region override, so this box is NOT the shared layer's canonical gray
 * default.
 */
export function buildAccuracyRegions(
  nodes: DeviceInfo[],
  f: NodeOverlayFilter,
  hopColor: (node: DeviceInfo) => string,
): AccuracyRegionDescriptor[] {
  return nodes
    .filter((node) => hasAccuracyCell(node.positionPrecisionBits, node.positionIsOverride) && passesOverlayFilter(node, f))
    .map((node) => {
      const color = hopColor(node);
      return {
        key: `accuracy-${node.nodeNum}`,
        bounds: precisionCellBounds(node.position!.latitude, node.position!.longitude, node.positionPrecisionBits as number),
        pathOptions: { color, fillColor: color, fillOpacity: 0.08, opacity: 0.5, weight: 1 },
      };
    });
}

/** Estimated-position uncertainty circles — adapter over the shared `EstimatedPositionRadiiLayer` (#6260 WP5). */
export function buildEstimatedRadii(
  nodes: DeviceInfo[],
  f: NodeOverlayFilter & { nodesWithEstimatedPosition: Set<string>; estimatedUncertainty: Record<string, number> },
  hopColor: (node: DeviceInfo) => string,
): EstimatedPositionRadius[] {
  return nodes
    .filter((node) => node.user?.id && f.nodesWithEstimatedPosition.has(node.user.id) && passesOverlayFilter(node, f))
    .map((node) => {
      // Real multilateration uncertainty radius (issue #3271); 500m base
      // for legacy/missing data.
      const uncertaintyKm = node.user?.id ? f.estimatedUncertainty[node.user.id] : undefined;
      return {
        key: `estimated-${node.nodeNum}`,
        center: [node.position!.latitude, node.position!.longitude] as [number, number],
        radiusMeters: uncertaintyKm != null && uncertaintyKm > 0 ? uncertaintyKm * 1000 : 500,
        color: hopColor(node),
      };
    });
}

export interface NeighborLinkOptions {
  /** Where each node's marker is drawn, by nodeNum. */
  nodePositions: Map<number, [number, number]>;
  /** Issue #1149: only links whose two ends are visible. */
  visibleNodeNums?: Set<number>;
  tracerouteNodeNums?: Set<number> | null;
  lineColor: string;
  /** The caller's popup or click handler for one link. */
  decorate(
    ni: EnrichedNeighborInfo,
    link: { positions: [[number, number], [number, number]]; isBidirectional: boolean },
  ): { children?: ReactNode; eventHandlers?: LeafletEventHandlerFnMap };
}

/**
 * Neighbor-info links (#4047 Phase 7 WP11) — adapter over the shared
 * `NeighborLinksLayer` (WP2). `computeNeighborLinkStyle` holds the 4-tier
 * SNR→weight/opacity table and the unidirectional-arrow gate.
 */
export function buildNeighborLinks(neighborInfo: EnrichedNeighborInfo[], o: NeighborLinkOptions): NeighborLinkDescriptor[] {
  return neighborInfo
    .map((ni, idx): NeighborLinkDescriptor | null => {
      // Anchor each endpoint to where the node's MARKER is rendered
      // (merged / override-aware position, keyed by nodeNum) so the
      // line connects to the visible marker rather than the
      // source-specific reported coords (#3642). Falls back to the
      // record's embedded coords when the node isn't on the map.
      const nodeEndpoint = resolveMapEndpoint(o.nodePositions, ni.nodeNum, ni.nodeLatitude, ni.nodeLongitude);
      const neighborEndpoint = resolveMapEndpoint(o.nodePositions, ni.neighborNodeNum, ni.neighborLatitude, ni.neighborLongitude);
      if (!nodeEndpoint || !neighborEndpoint) return null;

      // Filter out segments where either endpoint is not visible (Issue #1149)
      if (o.visibleNodeNums && (!o.visibleNodeNums.has(ni.nodeNum) || !o.visibleNodeNums.has(ni.neighborNodeNum))) {
        return null;
      }

      // When traceroute is active, only show segments for nodes in the traceroute
      if (o.tracerouteNodeNums && (!o.tracerouteNodeNums.has(ni.nodeNum) || !o.tracerouteNodeNums.has(ni.neighborNodeNum))) {
        return null;
      }

      const positions: [[number, number], [number, number]] = [
        [nodeEndpoint[0], nodeEndpoint[1]],
        [neighborEndpoint[0], neighborEndpoint[1]],
      ];
      const isBidirectional = ni.bidirectional === true;
      const { pathOptions, arrows } = computeNeighborLinkStyle(ni.snr ?? null, isBidirectional, o.lineColor);
      return {
        key: `neighbor-${idx}`,
        positions,
        pathOptions,
        className: `neighbor-line node-${ni.nodeNum} node-${ni.neighborNodeNum}`,
        arrows,
        ...o.decorate(ni, { positions, isBidirectional }),
      };
    })
    .filter((d): d is NeighborLinkDescriptor => d !== null);
}
