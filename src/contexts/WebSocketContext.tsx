/**
 * WebSocket Context
 *
 * Provides WebSocket connection state globally across the application.
 * Manages the Socket.io connection for real-time mesh data updates.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { useWebSocket, type WebSocketState } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext.js';

interface WebSocketContextType {
  /** WebSocket connection state */
  state: WebSocketState;
  /** Whether WebSocket is enabled (authenticated users only) */
  enabled: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

/**
 * WebSocket Provider Component
 *
 * Wraps the application to provide WebSocket connectivity.
 * Only establishes connection when user is authenticated.
 *
 * @example
 * ```tsx
 * <WebSocketProvider>
 *   <App />
 * </WebSocketProvider>
 * ```
 */
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authStatus, loading: authLoading } = useAuth();

  // Only enable WebSocket when user is authenticated
  const enabled = !authLoading && (authStatus?.authenticated ?? false);

  // Use the WebSocket hook
  const state = useWebSocket(enabled);

  const value = useMemo(() => ({
    state,
    enabled,
  }), [state, enabled]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to access WebSocket context
 *
 * @returns WebSocket connection state and configuration
 * @throws Error if used outside of WebSocketProvider
 *
 * @example
 * ```tsx
 * const { state, enabled } = useWebSocketContext();
 *
 * if (state.connected) {
 *   console.log('Real-time updates active');
 * }
 * ```
 */
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);

  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }

  return context;
}

/**
 * Hook to get just the WebSocket connection status
 *
 * @returns Whether WebSocket is currently connected
 *
 * @example
 * ```tsx
 * const isConnected = useWebSocketConnected();
 *
 * return (
 *   <div>
 *     Status: {isConnected ? 'Real-time' : 'Polling'}
 *   </div>
 * );
 * ```
 */
export function useWebSocketConnected(): boolean {
  const context = useContext(WebSocketContext);
  return context?.state.connected ?? false;
}

/**
 * The nearest WebSocketProvider's socket, or null outside one or before it
 * connects. For listeners that may also run where no provider is mounted.
 */
// eslint-disable-next-line react-refresh/only-export-components -- #6365 a hook beside its context, as useWebSocketContext
export function useOptionalSocket(): Socket | null {
  return useContext(WebSocketContext)?.state.socket ?? null;
}
