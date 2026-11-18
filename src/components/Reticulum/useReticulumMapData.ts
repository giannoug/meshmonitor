/**
 * What the Reticulum Locations map draws (#3960 Phase 3/4), shared by today's
 * `ReticulumMap` and the Workspace map (#6365): the destinations with a
 * usable Sideband position (null island and invalid positions dropped), the
 * path-table edges whose two ends are both positioned, and where to centre.
 */
import { useMemo } from 'react';
import type { NeighborLinkDescriptor } from '../map/layers/NeighborLinksLayer';
import { shouldDiscardPosition } from '../../utils/nullIsland';
import { getDiscardInvalidPositions } from '../../utils/positionDisplayConfig';
import type { ReticulumDestinationRow, ReticulumPathRow } from '../../types/reticulum';

/** The Reticulum marker and edge colour, moved verbatim from ReticulumMap (#6365). */
export const RETICULUM_COLOR = '#94e2d5';
const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 2;

export function useReticulumMapData(destinations: ReticulumDestinationRow[], paths: ReticulumPathRow[] | undefined) {
  const positioned = useMemo(
    () => destinations.filter(d =>
      typeof d.latitude === 'number' && isFinite(d.latitude)
      && typeof d.longitude === 'number' && isFinite(d.longitude)
      && !shouldDiscardPosition(d.latitude, d.longitude, undefined, getDiscardInvalidPositions())),
    [destinations],
  );

  const positionByHash = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const d of positioned) {
      map.set(d.destinationHash, [d.latitude as number, d.longitude as number]);
    }
    return map;
  }, [positioned]);

  const pathLinks: NeighborLinkDescriptor[] = useMemo(() => {
    if (!paths || paths.length === 0) return [];
    const links: NeighborLinkDescriptor[] = [];
    for (const p of paths) {
      if (!p.viaHash) continue; // zero-hop / directly reachable — no edge to draw
      const destPos = positionByHash.get(p.destinationHash);
      const viaPos = positionByHash.get(p.viaHash);
      if (!destPos || !viaPos) continue; // both endpoints must be positioned
      links.push({
        key: `${p.destinationHash}-${p.viaHash}`,
        positions: [destPos, viaPos],
        pathOptions: { color: RETICULUM_COLOR, weight: 2, opacity: 0.55, dashArray: '4 4' },
      });
    }
    return links;
  }, [paths, positionByHash]);

  const { center, zoom } = useMemo(() => {
    if (positioned.length > 0) {
      const d = positioned[0];
      return { center: [d.latitude as number, d.longitude as number] as [number, number], zoom: 10 };
    }
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }, [positioned]);

  return { positioned, pathLinks, center, zoom };
}
