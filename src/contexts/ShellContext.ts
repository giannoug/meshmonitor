/**
 * ShellContext — tells a Classic page it is re-hosted inside the Workspace
 * shell (#6365). When `embedded`, the page hides its own chrome (topbar,
 * sidebar, back button) because the shell draws its own. Without a provider
 * the default is `{ embedded: false }`, so Classic renders exactly as before.
 */
import { createContext, useContext } from 'react';

export const ShellContext = createContext<{ embedded: boolean }>({ embedded: false });

export function useShellEmbedded(): boolean {
  return useContext(ShellContext).embedded;
}
