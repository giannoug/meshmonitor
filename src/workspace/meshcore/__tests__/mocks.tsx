/** Shared vi.mock factories for the MeshCore board tests (hoisted per file). */
import type { ReactNode } from 'react';

export const wsMock = async (orig: () => Promise<object>) => ({
  ...(await orig()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWebSocketContext: () => ({ state: { socket: null, connected: false } }),
});
