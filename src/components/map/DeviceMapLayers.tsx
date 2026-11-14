/**
 * The device map's node and link layers, as NodesTab draws them inside its
 * `BaseMap` (moved here unchanged so the Workspace device map can draw the
 * same layers, #6365). Presentational: every descriptor is built by the
 * caller; this only places the layers, in NodesTab's order.
 */
import React, { type ReactNode } from 'react';
import type L from 'leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import PolarGridOverlay from '../PolarGridOverlay.js';
import GeoJsonOverlay from '../GeoJsonOverlay';
import type { GeoJsonLayer } from '../../server/services/geojsonService.js';
import { NodeMarkersLayer, type NodeMarkerDescriptor } from './layers/NodeMarkersLayer';
import { NodeMarkerCluster } from './layers/NodeMarkerCluster';
import { NeighborLinksLayer, type NeighborLinkDescriptor } from './layers/NeighborLinksLayer';
import { AccuracyRegionsLayer, type AccuracyRegionDescriptor } from './layers/AccuracyRegionsLayer';
import { EstimatedPositionRadiiLayer, type EstimatedPositionRadius } from './layers/EstimatedPositionRadiiLayer';

// Separate components for traceroutes that can update independently
// These prevent marker re-renders when only the traceroute paths change
// Renamed from TraceroutePathsLayer/SelectedTracerouteLayer (#4047 Phase 7
// WP13) — those names shadowed the shared `map/layers/TraceroutePathsLayer`;
// these are thin pass-through wrappers of pre-built nodes, not that layer.
const TraceroutePathsContainer = React.memo<{ paths: React.ReactNode; enabled: boolean }>(
  ({ paths }) => {
    return <>{paths}</>;
  }
);

const SelectedTracerouteContainer = React.memo<{ traceroute: React.ReactNode; enabled: boolean }>(
  ({ traceroute }) => {
    return <>{traceroute}</>;
  }
);

/**
 * NodesTab's neighbor-link SNR encoding (#4047 Phase 7 WP11): a 4-tier
 * weight/opacity table plus a uniform amber color (`overlayColors.neighborLine`),
 * unlike the shared `NeighborLinksLayer`'s other consumers, which use the
 * continuous `snrToNeighborOpacity` curve (`utils/neighborLinks.ts`) — the two
 * are deliberately NOT unified (spec §4.1: "NodesTab uses a different 4-tier
 * SNR→weight/opacity table — that stays in the NodesTab adapter"). Direction
 * arrows are unidirectional-only, matching the shared layer's `arrows` gate.
 * Extracted as a pure function (module-scope, exported) so this table and the
 * arrow gate can be pinned with a unit test independent of the full
 * component render.
 */
// eslint-disable-next-line react-refresh/only-export-components -- #4047 pure helper co-located with its only consumer for adapter unit testing; not a component
export function computeNeighborLinkStyle(
  snr: number | null,
  isBidirectional: boolean,
  lineColor: string,
): { pathOptions: L.PathOptions; arrows?: { color: string } } {
  let weight: number;
  let opacity: number;
  if (snr != null) {
    if (snr > 10) { weight = 4; opacity = 0.85; }
    else if (snr >= 0) { weight = 3; opacity = 0.6; }
    else { weight = 2; opacity = 0.4; }
  } else { weight = 2; opacity = 0.3; }

  return {
    pathOptions: {
      color: lineColor,
      weight,
      opacity,
      dashArray: isBidirectional ? undefined : '5, 5',
    },
    arrows: isBidirectional ? undefined : { color: lineColor },
  };
}

export interface DeviceMapLayersProps {
  /** The MapContext toggles these layers read. */
  mapState: { showPolarGrid: boolean; showPaths: boolean; showRoute: boolean };
  /** Node marker descriptors. */
  nodes: NodeMarkerDescriptor[];
  onOmsClick?: (marker: LeafletMarker, key: string) => void;
  /** Zoom at which clustering stops; null/undefined draws no cluster layer. */
  clusterZoomThreshold: number | null | undefined;
  estimatedRadii: EstimatedPositionRadius[];
  accuracyRegions: AccuracyRegionDescriptor[];
  ownNodePosition: { lat: number; lng: number } | null;
  geoJsonLayers: GeoJsonLayer[];
  traceroutePaths: ReactNode;
  selectedTraceroute: ReactNode;
  neighborLinks: NeighborLinkDescriptor[];
}

export function DeviceMapLayers({
  mapState: { showPolarGrid, showPaths, showRoute },
  nodes: nodeMarkers,
  onOmsClick,
  clusterZoomThreshold: resolvedClusterZoomThreshold,
  estimatedRadii,
  accuracyRegions,
  ownNodePosition,
  geoJsonLayers,
  traceroutePaths: traceroutePathsElements,
  selectedTraceroute: selectedNodeTraceroute,
  neighborLinks,
}: DeviceMapLayersProps) {
  return (
    <>
              {resolvedClusterZoomThreshold != null ? (
                <NodeMarkerCluster disableClusteringAtZoom={resolvedClusterZoomThreshold}>
                  <NodeMarkersLayer markers={nodeMarkers} onOmsClick={onOmsClick} />
                </NodeMarkerCluster>
              ) : (
                <NodeMarkersLayer markers={nodeMarkers} onOmsClick={onOmsClick} />
              )}

              {/* Uncertainty circles for estimated positions. The "Show
                  Accuracy" map toggle governs the radius (issue #3271
                  follow-up) — turning it off declutters the circles while the
                  estimated-node markers stay under "Show Estimated Positions".
                  Both are required so a circle never renders without its
                  marker. Shared with the MeshCore map (#6260 WP5). */}
              <EstimatedPositionRadiiLayer radii={estimatedRadii} />

              {/* Position accuracy regions — shared layer (#4047 Phase 7 WP11),
                  hop-colored `pathOptions` computed in the `accuracyRegions`
                  adapter above (ties visually to the hop-colored marker; NOT
                  the shared layer's canonical gray default). */}
              <AccuracyRegionsLayer regions={accuracyRegions} />

              {showPolarGrid && ownNodePosition && (
                <PolarGridOverlay center={ownNodePosition} />
              )}

              <GeoJsonOverlay layers={geoJsonLayers} />

              {/* Draw traceroute paths (independent layer) */}
              <TraceroutePathsContainer paths={traceroutePathsElements} enabled={showPaths} />

              {/* Draw selected node traceroute (independent layer) */}
              <SelectedTracerouteContainer traceroute={selectedNodeTraceroute} enabled={showRoute} />

              {/* Neighbor info connections — shared layer (#4047 Phase 7 WP11),
                  descriptors built in the `neighborLinks` adapter above
                  (4-tier SNR pathOptions, hover-dim className, unidirectional
                  arrows, popup). */}
              <NeighborLinksLayer links={neighborLinks} />
    </>
  );
}

export default DeviceMapLayers;
