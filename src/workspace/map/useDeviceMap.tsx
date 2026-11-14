/**
 * What the device map draws (boards Main, f2-layers, 15-09), built from the
 * same inputs and filters NodesTab uses for its map: useSourceView's
 * processed nodes, the MapContext toggles, the Settings window and Node
 * Display settings. A marker or link click opens its peek instead of
 * NodesTab's Leaflet popup (s15n4: NodePopup is the map peek).
 */
import { useMemo } from 'react';
import { Tooltip } from 'react-leaflet';
import { useMapContext, type EnrichedNeighborInfo } from '../../contexts/MapContext';
import { useMapViewSelector } from '../../contexts/mapViewStore';
import { useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import { useData } from '../../contexts/DataContext';
import { useTelemetryNodes } from '../../hooks/useServerData';
import { useNodeQuickAgeFilter } from '../../hooks/useNodeQuickAgeFilter';
import { computeNeighborLinkStyle } from '../../components/map/DeviceMapLayers';
import { isAgedOutAircraft, AGED_OUT_AIRCRAFT_OPACITY } from '../../components/map/agedOutAircraft';
import type { NodeMarkerDescriptor } from '../../components/map/layers/NodeMarkersLayer';
import type { NeighborLinkDescriptor } from '../../components/map/layers/NeighborLinksLayer';
import type { AccuracyRegionDescriptor } from '../../components/map/layers/AccuracyRegionsLayer';
import type { EstimatedPositionRadius } from '../../components/map/layers/EstimatedPositionRadiiLayer';
import type { Node3DFeature } from '../../components/map/Base3DMap';
import type { DeviceInfo } from '../../types/device';
import type { FlightNodeEntry } from '../../utils/packetFlightEdges';
import type { MeasurePoint } from '../../utils/measureDistance';
import { createNodeIcon, getHopColor } from '../../utils/mapIcons';
import { calculateNodeOpacity } from '../../utils/nodeDimming';
import { getEffectiveHops } from '../../utils/nodeHops';
import { getEffectivePosition, hasValidEffectivePosition, isNodeComplete, parseNodeId, resolveMapEndpoint } from '../../utils/nodeHelpers';
import { categoryGlyphFamily, getNodeTypeCategory, markerRoleProps } from '../../utils/nodeTypeCategory';
import { isMqttOnlySourceType, nodePassesTransportFilter, transportCutoffSec } from '../../utils/nodeTransport';
import { applyPrecisionCellOffsets, hasAccuracyCell, precisionCellBounds } from '../../utils/precisionOffset';
import { effectiveMapMaxAgeHours } from '../../utils/mapAge';
import { resolveNodeListAgeHours } from '../../utils/nodeQuickAgeFilter';
import { resolveClusterZoomThreshold } from '../../utils/mapZoomAnimation';
import { unifiedNodeKey } from '../../utils/nodeIdentity';

export const markerKey = (node: DeviceInfo) => String(node.user?.id ?? node.nodeNum);

export interface DeviceMapInputs {
  processedNodes: DeviceInfo[];
  agedOutAircraftNodes?: DeviceInfo[];
  tracerouteNodeNums?: Set<number> | null;
  visibleNodeNums?: Set<number>;
  onLinkClick(link: EnrichedNeighborInfo): void;
}

export function useDeviceMap({ processedNodes, agedOutAircraftNodes, tracerouteNodeNums, visibleNodeNums, onLinkClick }: DeviceMapInputs) {
  const map = useMapContext();
  const settings = useSettings();
  const { sourceType } = useSource();
  const { currentNodeId } = useData();
  const { nodesWithEstimatedPosition, estimatedUncertainty } = useTelemetryNodes();
  const [quickAgeHours] = useNodeQuickAgeFilter();
  const showLabel = useMapViewSelector((s) => s.zoom >= 13);
  const zoomShowsNeighborLinks = useMapViewSelector((s) => s.zoom >= settings.neighborInfoMinZoom);

  const currentNodeNum = currentNodeId ? parseNodeId(currentNodeId) : null;
  // As NodesTab (#5283): an MQTT-only source skips the transport toggles.
  const mqttOnly = isMqttOnlySourceType(sourceType);
  const transport = {
    showRfNodes: mqttOnly || map.showRfNodes,
    showUdpNodes: mqttOnly || map.showUdpNodes,
    showMqttNodes: mqttOnly || map.showMqttNodes,
  };
  const listAgeHours = resolveNodeListAgeHours(quickAgeHours, settings.maxNodeAgeHours);
  const effectiveMapMaxAge = effectiveMapMaxAgeHours(map.mapMaxAgeHours, listAgeHours);
  const transportCutoff = transportCutoffSec(effectiveMapMaxAge);
  const mapAgeCutoffSeconds = Date.now() / 1000 - effectiveMapMaxAge * 60 * 60;
  const hopsOf = (node: DeviceInfo) =>
    node.user?.id === currentNodeId ? 0 : getEffectiveHops(node, settings.nodeHopsCalculation, map.traceroutes, currentNodeNum);

  // NodesTab's map set: positioned, not hidden from the map, aged-out aircraft only while shown.
  const positioned = (list: DeviceInfo[] | undefined) => (list ?? []).filter((n) => !n.hideFromMap && hasValidEffectivePosition(n));
  const agedOut = positioned(agedOutAircraftNodes);
  const nodesWithPosition = map.showAgedOutAircraft && agedOut.length > 0 ? [...positioned(processedNodes), ...agedOut] : positioned(processedNodes);

  const nodePositions = useMemo(() => {
    const offset = applyPrecisionCellOffsets(
      nodesWithPosition
        .map((node) => ({ node, eff: getEffectivePosition(node) }))
        .filter((e) => e.eff.latitude != null && e.eff.longitude != null)
        .map(({ node, eff }) => ({
          item: node,
          id: unifiedNodeKey(node) ?? String(node.nodeNum),
          latLng: [eff.latitude as number, eff.longitude as number] as [number, number],
          bits: node.positionPrecisionBits,
          isOverride: node.positionIsOverride,
        })),
      { enabled: map.spreadNodes },
    );
    return new Map(offset.map(({ item, latLng }) => [item.nodeNum, latLng] as const));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 keyed on positions like NodesTab's memo
  }, [nodesWithPosition.map((n) => { const p = getEffectivePosition(n); return `${n.nodeNum}:${p.latitude}:${p.longitude}:${n.positionPrecisionBits}`; }).join(','), map.spreadNodes]);

  const passesMapFilters = (node: DeviceInfo): boolean => {
    if (!nodePassesTransportFilter(node, transport, transportCutoff)) return false;
    if (!settings.showIncompleteNodes && !isNodeComplete(node)) return false;
    if (!map.showEstimatedPositions && node.user?.id && nodesWithEstimatedPosition.has(node.user.id)) return false;
    if (tracerouteNodeNums && !tracerouteNodeNums.has(node.nodeNum)) return false;
    if (isAgedOutAircraft(node)) return true;
    if (!node.isFavorite && node.lastHeard && node.lastHeard < mapAgeCutoffSeconds) return false;
    if (map.aircraftDisplayMode === 'hide' && node.likelyAircraft === true && !node.isFavorite) return false;
    return true;
  };
  const visibleMapNodes = nodesWithPosition.filter(passesMapFilters);

  const nodeMarkers: NodeMarkerDescriptor[] = visibleMapNodes.map((node) => {
    const key = markerKey(node);
    const { isRouter, roleCategory } = markerRoleProps(node);
    const isSelected = map.selectedNodeId === node.user?.id;
    const hops = hopsOf(node);
    const animate = map.showAnimations && map.animatedNodes.has(node.user?.id || '');
    const aged = isAgedOutAircraft(node);
    const markAircraft = aged || (map.aircraftDisplayMode !== 'show' && node.likelyAircraft === true);
    return {
      key,
      position: nodePositions.get(node.nodeNum)!,
      iconSig: `${node.nodeNum}-${hops}-${isSelected}-${node.user?.role}-${node.isUnmessagable ? 1 : 0}-${markAircraft ? 1 : 0}-${node.user?.shortName}-${showLabel}-${animate}-${settings.mapPinStyle}-${settings.mapPinColorMode}`,
      buildIcon: () =>
        createNodeIcon({
          variant: 'meshtastic',
          hops,
          isSelected,
          isRouter,
          roleCategory,
          isUnmessagable: !!node.isUnmessagable,
          isLikelyAircraft: markAircraft,
          shortName: node.user?.shortName,
          showLabel: showLabel || animate,
          animate,
          highlightSelected: isSelected,
          pinStyle: settings.mapPinStyle,
          colorMode: settings.mapPinColorMode,
          nodeNum: node.nodeNum,
        }),
      opacity: aged
        ? AGED_OUT_AIRCRAFT_OPACITY
        : calculateNodeOpacity(node.lastHeard, settings.nodeDimmingEnabled, settings.nodeDimmingStartHours, settings.nodeDimmingMinOpacity, settings.maxNodeAgeHours),
      zIndexOffset: animate ? 10000 : 0,
      children: (
        <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
          {node.user?.longName || node.user?.shortName || `!${node.nodeNum.toString(16)}`}
        </Tooltip>
      ),
    };
  });

  const regionNodes = nodesWithPosition.filter(
    (node) =>
      nodePassesTransportFilter(node, transport, transportCutoff) &&
      (settings.showIncompleteNodes || isNodeComplete(node)) &&
      (!tracerouteNodeNums || tracerouteNodeNums.has(node.nodeNum)),
  );
  const accuracyRegions: AccuracyRegionDescriptor[] = map.showAccuracyRegions
    ? regionNodes
        .filter((node) => hasAccuracyCell(node.positionPrecisionBits, node.positionIsOverride))
        .map((node) => {
          const color = getHopColor(hopsOf(node), settings.overlayColors.hopColors);
          return {
            key: `accuracy-${node.nodeNum}`,
            bounds: precisionCellBounds(node.position!.latitude, node.position!.longitude, node.positionPrecisionBits as number),
            pathOptions: { color, fillColor: color, fillOpacity: 0.08, opacity: 0.5, weight: 1 },
          };
        })
    : [];
  const estimatedRadii: EstimatedPositionRadius[] =
    map.showEstimatedPositions && map.showAccuracyRegions
      ? regionNodes
          .filter((node) => node.user?.id && nodesWithEstimatedPosition.has(node.user.id))
          .map((node) => {
            const km = estimatedUncertainty[node.user!.id];
            return {
              key: `estimated-${node.nodeNum}`,
              center: [node.position!.latitude, node.position!.longitude] as [number, number],
              radiusMeters: km != null && km > 0 ? km * 1000 : 500,
              color: getHopColor(hopsOf(node), settings.overlayColors.hopColors),
            };
          })
      : [];

  const neighborLinks: NeighborLinkDescriptor[] =
    map.showNeighborInfo && zoomShowsNeighborLinks
      ? map.neighborInfo.flatMap((ni, idx): NeighborLinkDescriptor[] => {
          const a = resolveMapEndpoint(nodePositions, ni.nodeNum, ni.nodeLatitude, ni.nodeLongitude);
          const b = resolveMapEndpoint(nodePositions, ni.neighborNodeNum, ni.neighborLatitude, ni.neighborLongitude);
          if (!a || !b) return [];
          if (visibleNodeNums && (!visibleNodeNums.has(ni.nodeNum) || !visibleNodeNums.has(ni.neighborNodeNum))) return [];
          if (tracerouteNodeNums && (!tracerouteNodeNums.has(ni.nodeNum) || !tracerouteNodeNums.has(ni.neighborNodeNum))) return [];
          const { pathOptions, arrows } = computeNeighborLinkStyle(ni.snr ?? null, ni.bidirectional === true, settings.overlayColors.neighborLine);
          return [{
            key: `neighbor-${idx}`,
            positions: [a, b],
            pathOptions,
            className: `neighbor-line node-${ni.nodeNum} node-${ni.neighborNodeNum}`,
            arrows,
            eventHandlers: { click: () => onLinkClick(ni) },
          }];
        })
      : [];

  const flightNodes: FlightNodeEntry[] = map.showPacketFlights
    ? visibleMapNodes.flatMap((n) => {
        const p = nodePositions.get(n.nodeNum);
        return p ? [{ nodeNum: n.nodeNum, lat: p[0], lng: p[1] }] : [];
      })
    : [];

  const node3DFeatures: Node3DFeature[] = visibleMapNodes.flatMap((node) => {
    const p = nodePositions.get(node.nodeNum);
    return p
      ? [{
          key: markerKey(node),
          lat: p[0],
          lng: p[1],
          label: node.user?.shortName ?? undefined,
          color: getHopColor(hopsOf(node)),
          category: categoryGlyphFamily(getNodeTypeCategory(node)),
          opacity: calculateNodeOpacity(node.lastHeard, settings.nodeDimmingEnabled, settings.nodeDimmingStartHours, settings.nodeDimmingMinOpacity, settings.maxNodeAgeHours),
        }]
      : [];
  });

  const measurePoints: MeasurePoint[] = nodesWithPosition.flatMap((node) => {
    const p = nodePositions.get(node.nodeNum);
    return p ? [{ id: markerKey(node), lat: p[0], lng: p[1], label: node.user?.shortName }] : [];
  });

  return {
    visibleMapNodes,
    nodePositions,
    nodeMarkers,
    accuracyRegions,
    estimatedRadii,
    neighborLinks,
    flightNodes,
    node3DFeatures,
    measurePoints,
    effectiveMapMaxAge,
    listAgeHours,
    hopsOf,
    mqttOnly,
    clusterZoomThreshold: resolveClusterZoomThreshold(settings.mapZoomGateThreshold, settings.mapClusteringEnabled),
    aircraftCount: nodesWithPosition.filter((n) => n.likelyAircraft === true && !isAgedOutAircraft(n)).length,
    agedOutCount: [...positioned(processedNodes), ...agedOut].filter((n) => isAgedOutAircraft(n) && passesMapFilters(n)).length,
  };
}
