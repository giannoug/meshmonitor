/**
 * Where to centre the phone map so a node clears its peek sheet (g1-map).
 * MapCenterController leaves its target a quarter of the map below centre
 * (room for a popup above it); the phone peek sheet covers the lower half,
 * so aim half a map lower and the node lands a quarter from the top.
 */
import type L from 'leaflet';
import { computeClampedTargetZoom } from '../../utils/mapZoomAnimation';

export type CenterMap = Pick<L.Map, 'project' | 'unproject' | 'getZoom' | 'getContainer'>;

export function peekCenterTarget(map: CenterMap, p: [number, number], targetZoom: number): [number, number] {
  // The zoom MapCenterController will land on, so the pixel shift holds there.
  const zoom = computeClampedTargetZoom(map.getZoom(), targetZoom);
  const ll = map.unproject(map.project(p, zoom).add([0, map.getContainer().clientHeight / 2]), zoom);
  return [ll.lat, ll.lng];
}
