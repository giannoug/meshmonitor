/**
 * The providers App mounts for itself, under the source's own SourceProvider
 * and socket, for a Workspace conversation screen (Ruling AD). UIProvider and
 * useMessagingView read the tab from the location, so they are handed
 * Classic's location for the tab (`channels` or `messages`), as
 * WorkspaceSource does for App.
 */
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { DataProvider } from '../../contexts/DataContext';
import { MessagingProvider } from '../../contexts/MessagingContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { UIProvider } from '../../contexts/UIContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';

export interface ChatProvidersProps {
  sourceId: string;
  source: DashboardSource;
  classicTab: 'channels' | 'messages';
  children: ReactNode;
}

export default function ChatProviders({ sourceId, source, classicTab, children }: ChatProvidersProps) {
  const location = useLocation();
  const classic = { ...location, pathname: `/source/${encodeURIComponent(sourceId)}/${classicTab}` };
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <SettingsProvider baseUrl={appBasename}>
          <DataProvider>
            <Routes location={classic}>
              <Route
                path="*"
                element={
                  <UIProvider>
                    <MessagingProvider baseUrl={appBasename}>{children}</MessagingProvider>
                  </UIProvider>
                }
              />
            </Routes>
          </DataProvider>
        </SettingsProvider>
      </WebSocketProvider>
    </SourceProvider>
  );
}
