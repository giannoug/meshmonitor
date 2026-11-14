/**
 * @vitest-environment jsdom
 *
 * peekCenterTarget: the phone map aims half a map below the node, at the zoom
 * MapCenterController will land on, so the node clears its peek sheet.
 */
import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { peekCenterTarget, type CenterMap } from '../peekCenter';

/** A flat stub: 1000 px per degree, y grows southwards; records the zoom of each call. */
function stubMap(zoom: number, height: number) {
  const zooms: number[] = [];
  const map = {
    getZoom: () => zoom,
    getContainer: () => ({ clientHeight: height }) as HTMLElement,
    project: (ll: L.LatLngExpression, z: number) => {
      zooms.push(z);
      const { lat, lng } = L.latLng(ll);
      return L.point(lng * 1000, -lat * 1000);
    },
    unproject: (pt: L.PointExpression, z: number) => {
      zooms.push(z);
      const { x, y } = L.point(pt);
      return L.latLng(-y / 1000, x / 1000);
    },
  } as unknown as CenterMap;
  return { map, zooms };
}

describe('peekCenterTarget', () => {
  it('aims half the map height below the node, at the target zoom', () => {
    const { map, zooms } = stubMap(12, 800);
    const [lat, lng] = peekCenterTarget(map, [38, 23.8], 15);
    expect(lat).toBeCloseTo(37.6, 9); // 400 px south
    expect(lng).toBeCloseTo(23.8, 9);
    expect(zooms).toEqual([15, 15]);
  });

  it('keeps a closer current zoom, as MapCenterController does (it only zooms in)', () => {
    const { map, zooms } = stubMap(18, 600);
    const [lat] = peekCenterTarget(map, [38, 23.8], 15);
    expect(lat).toBeCloseTo(37.7, 9);
    expect(zooms).toEqual([18, 18]);
  });
});
