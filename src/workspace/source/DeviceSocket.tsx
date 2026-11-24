/**
 * The open Meshtastic-family device's one live connection (Ruling 9.1 IJ):
 * its SourceProvider and per-source WebSocketProvider, with today's device
 * notification toasts (DeviceNotices) on that socket, held once at the device
 * screen so every page under `/source/:id` (settings, tools, security and
 * automations included) has them, as Classic's App holds one socket on every
 * tab. Pages under it open no socket of their own. The App fallback keeps its
 * own (App mounts its provider and toaster itself), so it is not wrapped.
 */
import type { ReactNode } from 'react';
import { SourceProvider } from '../../contexts/SourceContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import DeviceNotices from '../patterns/DeviceNotices';

export default function DeviceSocket({ source, children }: { source: DashboardSource; children: ReactNode }) {
  return (
    <SourceProvider sourceId={source.id} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <DeviceNotices />
        {children}
      </WebSocketProvider>
    </SourceProvider>
  );
}
