/**
 * The providers App mounts for itself, under the source's own SourceProvider
 * (the device's socket is DeviceSocket's, one per open device, Ruling 9.1 IJ), for a
 * Workspace screen App is not mounted on (Ruling AD): a conversation, or the device map
 * (`nodes`). UIProvider and
 * useMessagingView read the tab from the location, so they are handed
 * Classic's location for the tab (`channels` or `messages`), as
 * WorkspaceSource does for App.
 */
import { useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useToast } from '../../components/ToastContainer';
import { DataProvider } from '../../contexts/DataContext';
import { MessagingProvider } from '../../contexts/MessagingContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { UIProvider, useUI } from '../../contexts/UIContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';

export interface ChatProvidersProps {
  sourceId: string;
  source: DashboardSource;
  classicTab: 'channels' | 'messages' | 'nodes';
  children: ReactNode;
}

export default function ChatProviders({ sourceId, source, classicTab, children }: ChatProvidersProps) {
  const location = useLocation();
  const classic = { ...location, pathname: `/source/${encodeURIComponent(sourceId)}/${classicTab}` };
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <DataProvider>
          <Routes location={classic}>
            <Route
              path="*"
              element={
                <UIProvider>
                  <SendErrors />
                  <MessagingProvider baseUrl={appBasename}>{children}</MessagingProvider>
                </UIProvider>
              }
            />
          </Routes>
        </DataProvider>
      </SettingsProvider>
    </SourceProvider>
  );
}

/**
 * The shared send handlers report a failed send, reaction, bell, position or
 * resend through `useUI().setError` with today's words; Classic shows it in its
 * error banner, the Workspace as an error toast (F.2 B-I1).
 */
function SendErrors() {
  const { error, setError } = useUI();
  const { showToast } = useToast();
  useEffect(() => {
    if (!error) return;
    showToast(error, 'error');
    setError(null);
  }, [error, setError, showToast]);
  return null;
}
