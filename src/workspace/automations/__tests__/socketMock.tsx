/** A Socket.io stand-in for the rules tests (Task 8.4): the live trace subscribes to it; `fire` delivers a server event. */
import type { ReactNode } from 'react';
import { act } from '@testing-library/react';

type Handler = (data: unknown) => void;

/** A Socket.io stand-in: records emits; `fire` delivers a server event to the page. */
export const fakeSocket = {
  handlers: new Map<string, Set<Handler>>(),
  emits: [] as Array<{ event: string; data: unknown }>,
  on(event: string, h: Handler) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event)!.add(h); },
  off(event: string, h: Handler) { this.handlers.get(event)?.delete(h); },
  emit(event: string, data: unknown) { this.emits.push({ event, data }); },
  fire(event: string, data: unknown) { act(() => { this.handlers.get(event)?.forEach((h) => h(data)); }); },
  reset() { this.handlers.clear(); this.emits = []; },
};

export const socketMock = async (orig: () => Promise<object>) => ({
  ...(await orig()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWebSocketContext: () => ({ state: { socket: fakeSocket, connected: true } }),
});

