/**
 * The Workspace-native Reticulum screens (Task 7.6, boards 9-01 … 9-16,
 * notes s9n0 … s9n4): the phone Home (the bare device URL below 768 px),
 * Destinations, Interfaces, Paths, the Map, the Dashboard, LXMF conversations
 * (`dms`, `dm/<peer>`) and Info. Device settings are the settings frame
 * (ReticulumSettingsFrame); nothing of today's ReticulumSourcePage is mounted.
 *
 * One owner per screen (Ruling AD): this runs today's `useReticulum` once for
 * the device, inside the providers today's page mounts (Source, socket,
 * Settings, Map). Its status poll (about every 30 s, today's) runs once per
 * screen: moving between these views keeps the one runtime, and nothing here
 * adds a request on open. The screen publishes the conversations and
 * destinations for the shell's sidebar, which sits outside it.
 *
 * As today: without `nodes:read` on the device the body is a permission note
 * and nothing polls. On desktop the status line (s9n0) sits above every view.
 */
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { MapProvider } from '../../contexts/MapContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';
import { useReticulum } from '../../components/Reticulum/hooks/useReticulum';
import { useIsPhone } from '../shell/useIsPhone';
import PhoneDeviceHeader from '../meshcore/PhoneDeviceHeader';
import { RnsRuntimeContext, rnsKeys, type RnsLists } from './runtime';
import ReticulumStatusLine from './ReticulumStatusLine';
import styles from './Reticulum.module.css';
import StateView from '../patterns/StateView';

const ReticulumHome = lazy(() => import('./ReticulumHome.tsx'));
const LxmfThread = lazy(() => import('./LxmfThread.tsx'));
const LxmfInbox = lazy(() => import('./LxmfInbox.tsx'));
const DestinationsPage = lazy(() => import('./DestinationsPage.tsx'));
const InterfacesPage = lazy(() => import('./InterfacesPage.tsx'));
const PathsPage = lazy(() => import('./PathsPage.tsx'));
const ReticulumMapPage = lazy(() => import('./ReticulumMapPage.tsx'));
const ReticulumInfoPage = lazy(() => import('./ReticulumInfoPage.tsx'));
const ReticulumDashboardPage = lazy(() => import('./ReticulumDashboardPage.tsx'));
const ReticulumSettingsFrame = lazy(() => import('./settings/ReticulumSettingsFrame.tsx'));

export type ReticulumScreenKind =
  | { kind: 'home' }
  | { kind: 'destinations' }
  | { kind: 'interfaces' }
  | { kind: 'paths' }
  | { kind: 'map' }
  | { kind: 'dashboard' }
  | { kind: 'dms' }
  | { kind: 'dm'; peer: string }
  | { kind: 'info' }
  /** Device settings (`path` follows `/settings/`), in the same runtime so going there and back re-reads nothing. */
  | { kind: 'settings'; path: string };

export interface ReticulumScreenProps {
  sourceId: string;
  source: DashboardSource;
  screen: ReticulumScreenKind;
}

export default function ReticulumScreen({ sourceId, source, screen }: ReticulumScreenProps) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <SettingsProvider baseUrl={appBasename}>
          <MapProvider>
            <Gate sourceId={sourceId} source={source} screen={screen} />
          </MapProvider>
        </SettingsProvider>
      </WebSocketProvider>
    </SourceProvider>
  );
}

function Gate({ sourceId, source, screen }: { sourceId: string; source: DashboardSource; screen: ReticulumScreenKind }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const isPhone = useIsPhone();
  // Today's gate (ReticulumSourcePage): the resource the Reticulum data routes enforce.
  if (!hasPermission('nodes', 'read', { sourceId })) {
    // Settings answer to their own grants, not to the device screen's.
    if (screen.kind === 'settings') return <SettingsBody sourceId={sourceId} source={source} path={screen.path} />;
    return (
      <section className={styles.screen} data-phone={isPhone || undefined}>
        {isPhone && <PhoneDeviceHeader sourceId={sourceId} />}
        <StateView kind="noPermission" title={t('reticulum.no_permission', 'You do not have permission to view this Reticulum source.')} />
      </section>
    );
  }
  return <Runtime sourceId={sourceId} source={source} screen={screen} />;
}

function SettingsBody({ sourceId, source, path }: { sourceId: string; source: DashboardSource; path: string }) {
  return (
    <Suspense fallback={<StateView kind="loading" page />}>
      <ReticulumSettingsFrame sourceId={sourceId} source={source} path={path} />
    </Suspense>
  );
}

function Runtime({ sourceId, source, screen }: { sourceId: string; source: DashboardSource; screen: ReticulumScreenKind }) {
  const deviceName = source.name;
  const isPhone = useIsPhone();
  const rns = useReticulum({ sourceId });
  const queryClient = useQueryClient();
  const { conversations, destinations, status } = rns;
  // The sidebar's lists, from the poll above: the sidebar asks for nothing itself.
  useEffect(() => {
    const lists: RnsLists = { conversations, destinations, destinationCount: status?.destinationCount ?? null };
    queryClient.setQueryData(rnsKeys.lists(sourceId), lists);
  }, [conversations, destinations, status?.destinationCount, queryClient, sourceId]);
  const runtime = useMemo(() => ({ sourceId, deviceName, rns }), [sourceId, deviceName, rns]);
  if (screen.kind === 'settings') {
    return (
      <RnsRuntimeContext.Provider value={runtime}>
        <SettingsBody sourceId={sourceId} source={source} path={screen.path} />
      </RnsRuntimeContext.Provider>
    );
  }

  // The phone's pages draw their own bar; Home carries the status in its header.
  const statusLine = !isPhone && <ReticulumStatusLine />;
  return (
    <RnsRuntimeContext.Provider value={runtime}>
      <section className={styles.screen} data-phone={isPhone || undefined}>
        {statusLine}
        <Suspense fallback={<StateView kind="loading" page />}>
          {screen.kind === 'home' ? (
            <ReticulumHome />
          ) : screen.kind === 'dm' ? (
            <LxmfThread key={screen.peer} peer={screen.peer} />
          ) : screen.kind === 'dms' ? (
            <LxmfInbox />
          ) : screen.kind === 'interfaces' ? (
            <InterfacesPage />
          ) : screen.kind === 'paths' ? (
            <PathsPage />
          ) : screen.kind === 'map' ? (
            <ReticulumMapPage />
          ) : screen.kind === 'dashboard' ? (
            <ReticulumDashboardPage />
          ) : screen.kind === 'info' ? (
            <ReticulumInfoPage />
          ) : (
            <DestinationsPage />
          )}
        </Suspense>
      </section>
    </RnsRuntimeContext.Provider>
  );
}
