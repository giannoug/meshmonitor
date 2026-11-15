/**
 * The Dashboard map's fit controllers, moved verbatim out of DashboardMap so
 * the Workspace Overview map (#6365) uses the same ones without loading the
 * whole Dashboard map: the one fit to the nodes on opening, and Zoom to fit.
 */
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// ---------------------------------------------------------------------------
// MapBoundsUpdater — internal helper that calls fitBounds inside the map ctx
// ---------------------------------------------------------------------------

interface MapBoundsUpdaterProps {
  positions: [number, number][];
  sourceId: string | null;
  /**
   * When true, an admin has configured a Default Map Center (lat/lon/zoom), so
   * the map should open there and we must NOT auto-fit to node bounds. Mirrors
   * the per-source classic map priority in NodesTab (issue #4125).
   */
  skip: boolean;
}

export function MapBoundsUpdater({ positions, sourceId, skip }: MapBoundsUpdaterProps) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    // A configured Default Map Center wins over auto-fit (issue #4125).
    if (skip) return;
    // Only auto-fit once on initial load, then let the user control the view
    if (hasFittedRef.current) return;
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
      hasFittedRef.current = true;
    }
  }, [map, positions, sourceId, skip]);

  return null;
}

/**
 * One-tap "Zoom to fit" for the Dashboard / Unified map (#4898), mirroring the
 * classic /nodes map (#4496). `MapBoundsUpdater` only auto-fits once on load
 * (and not at all when a Default Map Center is set), so this gives an explicit
 * re-frame that always works. `request` is a monotonic counter so repeated
 * clicks re-fit even when the node set is unchanged.
 */
export function FitAllNodesController({ request, positions }: { request: number; positions: Array<[number, number]> }) {
  const map = useMap();
  const lastHandled = useRef(0);

  useEffect(() => {
    if (request === 0 || request === lastHandled.current) return;
    lastHandled.current = request;
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    map.fitBounds(positions, { padding: [50, 50], animate: true, duration: 0.5, maxZoom: 15 });
  }, [request, positions, map]);

  return null;
}

