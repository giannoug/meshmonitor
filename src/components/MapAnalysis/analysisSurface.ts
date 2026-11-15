/**
 * What the surface drawing the Map Analysis components adds to them. Classic
 * Map Analysis provides nothing (`{}`) and behaves as today. The Workspace
 * Overview map (#6365), which keeps every control of today's Dashboard map,
 * provides:
 *
 * - `ageGate`: the Dashboard map's per-node age gate (#4899: companions by
 *   `maxAgeHours`, MeshCore infrastructure by `infraMaxAgeHours`, 0 = never),
 *   with its ignored-node rule;
 * - `hidePositionlessAdverts`: #5578, MeshCore markers without a current
 *   position advert are not drawn;
 * - `ringColor`: #6125 / #6175, the colour ring by source or gateway;
 * - `onSourceSelect`: where a popup's "seen by" row goes.
 */
import { createContext, useContext } from 'react';
import type { NodeSourceRef } from '../Dashboard/DashboardNodePopup';

export interface AnalysisSurface {
  ageGate?: { maxAgeHours: number; infraMaxAgeHours: number };
  hidePositionlessAdverts?: boolean;
  ringColor?(node: { sourceId?: string; gateways?: unknown }): string | null;
  onSourceSelect?(source: NodeSourceRef, nodeId: string | undefined): void;
}

export const AnalysisSurfaceContext = createContext<AnalysisSurface>({});

export function useAnalysisSurface(): AnalysisSurface {
  return useContext(AnalysisSurfaceContext);
}
