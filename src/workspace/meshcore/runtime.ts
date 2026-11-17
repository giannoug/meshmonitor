/** The one MeshCore runtime a native screen runs (MeshCoreScreen), for its parts. */
import { createContext, useContext } from 'react';
import type { UseMeshCoreState } from '../../components/MeshCore/hooks/useMeshCore';

export interface MeshCoreRuntime {
  sourceId: string;
  deviceName: string;
  meshCore: UseMeshCoreState;
  /** Today's strict receive-only mode for this device (tx-status). */
  receiveOnly: boolean;
}

export const RuntimeContext = createContext<MeshCoreRuntime | null>(null);

export function useMeshCoreRuntime(): MeshCoreRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('useMeshCoreRuntime outside MeshCoreScreen');
  return runtime;
}
