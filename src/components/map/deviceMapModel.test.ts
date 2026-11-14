/**
 * @vitest-environment jsdom
 *
 * The device map's shared filter and overlay builders (#6365), used by NodesTab
 * and the Workspace device map. jsdom: importing DeviceMapLayers pulls in Leaflet.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DeviceInfo } from '../../types/device';
import type { EnrichedNeighborInfo } from '../../contexts/MapContext';
import {
  buildAccuracyRegions,
  buildEstimatedRadii,
  buildNeighborLinks,
  countAgedOutOnMap,
  passesMapFilters,
  type MapNodeFilter,
} from './deviceMapModel';

const NOW_S = Math.floor(Date.now() / 1000);
const node = (nodeNum: number, extra: Partial<DeviceInfo> = {}): DeviceInfo => ({
  nodeNum,
  user: { id: `!${nodeNum.toString(16)}`, longName: `Node ${nodeNum}`, shortName: `N${nodeNum}`, hwModel: 43 },
  lastHeard: NOW_S - 60,
  position: { latitude: 37.9, longitude: 23.7 },
  ...extra,
});
const filter = (over: Partial<MapNodeFilter> = {}): MapNodeFilter => ({
  transport: { showRfNodes: true, showUdpNodes: false, showMqttNodes: false },
  transportCutoff: NOW_S - 86_400,
  showIncompleteNodes: true,
  showEstimatedPositions: true,
  nodesWithEstimatedPosition: new Set(),
  tracerouteNodeNums: null,
  mapAgeCutoffSeconds: NOW_S - 3_600,
  aircraftDisplayMode: 'mark',
  ...over,
});

describe('passesMapFilters', () => {
  it('draws an RF node heard inside the window', () => {
    expect(passesMapFilters(node(1), filter())).toBe(true);
  });

  it('follows the transport toggles', () => {
    const mqtt = node(2, { viaMqtt: true });
    expect(passesMapFilters(mqtt, filter())).toBe(false);
    expect(passesMapFilters(mqtt, filter({ transport: { showRfNodes: false, showUdpNodes: false, showMqttNodes: true } }))).toBe(true);
  });

  it('hides a node older than the age slider unless it is a favourite', () => {
    const old = node(3, { lastHeard: NOW_S - 7_200 });
    expect(passesMapFilters(old, filter())).toBe(false);
    expect(passesMapFilters({ ...old, isFavorite: true }, filter())).toBe(true);
  });

  it('keeps only the active traceroute\'s nodes', () => {
    expect(passesMapFilters(node(4), filter({ tracerouteNodeNums: new Set([5]) }))).toBe(false);
    expect(passesMapFilters(node(5), filter({ tracerouteNodeNums: new Set([5]) }))).toBe(true);
  });

  it('hides estimated positions when that toggle is off', () => {
    const f = filter({ showEstimatedPositions: false, nodesWithEstimatedPosition: new Set(['!6']) });
    expect(passesMapFilters(node(6), f)).toBe(false);
  });

  it('Hide suppresses a likely aircraft but never a favourite', () => {
    const plane = node(7, { likelyAircraft: true });
    expect(passesMapFilters(plane, filter({ aircraftDisplayMode: 'hide' }))).toBe(false);
    expect(passesMapFilters({ ...plane, isFavorite: true }, filter({ aircraftDisplayMode: 'hide' }))).toBe(true);
  });

  it('an aged-out aircraft skips the age slider, and countAgedOutOnMap counts it', () => {
    const aged = node(8, { isIgnored: true, aircraftAgedOutAt: NOW_S - 99_999, lastHeard: NOW_S - 99_999 });
    expect(passesMapFilters(aged, filter())).toBe(true);
    expect(countAgedOutOnMap([aged, node(9)], filter())).toBe(1);
  });
});

describe('overlay builders', () => {
  const hopColor = () => 'var(--hop)';

  it('accuracy regions only for low-precision, non-override nodes that pass the overlay filter', () => {
    const regions = buildAccuracyRegions(
      [node(1, { positionPrecisionBits: 13 }), node(2, { positionPrecisionBits: 32 }), node(3, { positionPrecisionBits: 13, positionIsOverride: true })],
      filter(),
      hopColor,
    );
    expect(regions.map((r) => r.key)).toEqual(['accuracy-1']);
    expect(regions[0].pathOptions).toMatchObject({ color: 'var(--hop)', fillOpacity: 0.08, weight: 1 });
  });

  it('estimated radii use the multilateration uncertainty, else 500 m', () => {
    const radii = buildEstimatedRadii(
      [node(1), node(2), node(3)],
      { ...filter(), nodesWithEstimatedPosition: new Set(['!1', '!2']), estimatedUncertainty: { '!1': 1.5 } },
      hopColor,
    );
    expect(radii.map((r) => [r.key, r.radiusMeters])).toEqual([['estimated-1', 1500], ['estimated-2', 500]]);
  });

  const link = (over: Partial<EnrichedNeighborInfo>): EnrichedNeighborInfo =>
    ({ nodeNum: 1, neighborNodeNum: 2, snr: 5, timestamp: 0, createdAt: 0, bidirectional: true, ...over }) as EnrichedNeighborInfo;

  it('neighbour links anchor to the drawn markers, skip unplaced ends, and take the caller\'s decoration', () => {
    const decorate = vi.fn(() => ({ eventHandlers: { click: () => {} } }));
    const nodePositions = new Map<number, [number, number]>([[1, [1, 1]], [2, [2, 2]]]);
    const links = buildNeighborLinks([link({}), link({ neighborNodeNum: 3 })], { nodePositions, lineColor: 'var(--line)', decorate });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ key: 'neighbor-0', positions: [[1, 1], [2, 2]], className: 'neighbor-line node-1 node-2' });
    expect(links[0].eventHandlers?.click).toBeTypeOf('function');
    expect(decorate).toHaveBeenCalledWith(expect.objectContaining({ nodeNum: 1 }), { positions: [[1, 1], [2, 2]], isBidirectional: true });
  });

  it('neighbour links follow the visible set and the traceroute set; one-way links get arrows', () => {
    const nodePositions = new Map<number, [number, number]>([[1, [1, 1]], [2, [2, 2]]]);
    const decorate = () => ({});
    expect(buildNeighborLinks([link({})], { nodePositions, lineColor: 'x', decorate, visibleNodeNums: new Set([1]) })).toEqual([]);
    expect(buildNeighborLinks([link({})], { nodePositions, lineColor: 'x', decorate, tracerouteNodeNums: new Set([2]) })).toEqual([]);
    const [oneWay] = buildNeighborLinks([link({ bidirectional: false })], { nodePositions, lineColor: 'x', decorate });
    expect(oneWay.arrows).toEqual({ color: 'x' });
    expect(oneWay.pathOptions.dashArray).toBe('5, 5');
  });
});
