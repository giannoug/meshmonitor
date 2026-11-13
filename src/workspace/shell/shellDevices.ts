/** The shell's devices, for pages inside it (the You page). */
import { createContext, useContext } from 'react';
import type { WorkspaceSource } from './useWorkspaceSources';

export interface ShellDevices {
  sources: WorkspaceSource[];
  /** The device open in the URL, else the last one opened this session (in memory only), else null. */
  home: WorkspaceSource | null;
}

export const ShellDevicesContext = createContext<ShellDevices>({ sources: [], home: null });

export const useShellDevices = () => useContext(ShellDevicesContext);
