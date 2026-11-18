/**
 * The Workspace-native MeshCore screens (Task 7.1): a channel
 * (`/source/:id/channel/:idx`), a room (`room/:key`) and the phone Home (the
 * bare device URL below 768 px); Nodes (`nodes`) and a node's page
 * (`node/:key[/<tab>]`, Task 7.2); a remote target's settings
 * (`settings[/…]?node=<key>`, Task 7.3, through SettingsFrame); Info (`info`),
 * the packet monitor (`packets`) and Automations (`automations[/<built-in>]`,
 * Task 7.5); the Dashboard (`telemetry`, Task 8.1). Every other MeshCore view stays re-hosted (WorkspaceSource).
 *
 * One owner per screen (Ruling AD): today's MeshCoreSourcePage is not mounted
 * here. This runs today's `useMeshCore` once for the device, inside the
 * providers that page mounts for itself (Source, socket, Settings, Map), with
 * today's receive-only flag (tx-status) and read-state sync. Moving between
 * native screens keeps the one runtime. As today: without `connection:read`
 * the body is a permission note, and an error shows in a bar under the
 * status line with Dismiss.
 */
import { lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { MapProvider } from '../../contexts/MapContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useTxStatus } from '../../hooks/useTxStatus';
import { appBasename } from '../../init';
import { useMeshCore } from '../../components/MeshCore/hooks/useMeshCore';
import { useReadStateSync } from '../../components/MeshCore/hooks/useReadStateSync';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import MeshCoreChannelThread from './MeshCoreChannelThread';
import MeshCoreHome from './MeshCoreHome';
import MeshCoreRoom from './MeshCoreRoom';
import MeshCoreNodesTable from './MeshCoreNodesTable';
import ContactPage from './ContactPage';
import { mcKeys } from './useMeshCoreLists';
import { RuntimeContext } from './runtime';
import PhoneDeviceHeader from './PhoneDeviceHeader';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './MeshCoreScreen.module.css';

/** A repeater's or room server's Settings and Console (Task 7.3), in the settings frame's parts. */
const MeshCoreSettingsFrame = lazy(() => import('./remote/MeshCoreSettingsFrame.tsx'));
/** Info, the packet monitor and Automations (Task 7.5). */
const MeshCoreInfoPage = lazy(() => import('./MeshCoreInfoPage.tsx'));
const MeshCorePacketsPage = lazy(() => import('./MeshCorePacketsPage.tsx'));
const MeshCoreAutomationsPage = lazy(() => import('./automations/MeshCoreAutomationsPage.tsx'));
/** The Dashboard (today's `telemetry` view, Task 8.1). */
const MeshCoreDashboard = lazy(() => import('./MeshCoreDashboard.tsx'));

export type MeshCoreScreenKind =
  | { kind: 'home' }
  | { kind: 'channel'; idx: number }
  | { kind: 'room'; key: string }
  | { kind: 'nodes' }
  | { kind: 'node'; key: string; tab: string }
  /** Device settings with a remote target (Task 7.3): `path` follows `/settings/`. */
  | { kind: 'settings'; path: string }
  /** Info, the packet monitor, Automations and one built-in's page (Task 7.5). */
  | { kind: 'info' }
  | { kind: 'packets' }
  | { kind: 'automations'; builtin: string | null }
  /** The Dashboard (Task 8.1). */
  | { kind: 'dashboard' };

export interface MeshCoreScreenProps {
  sourceId: string;
  source: DashboardSource;
  screen: MeshCoreScreenKind;
}

export default function MeshCoreScreen({ sourceId, source, screen }: MeshCoreScreenProps) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <WebSocketProvider>
        <SettingsProvider baseUrl={appBasename}>
          <MapProvider>
            <Gate sourceId={sourceId} deviceName={source.name} screen={screen} />
          </MapProvider>
        </SettingsProvider>
      </WebSocketProvider>
    </SourceProvider>
  );
}

function Gate({ sourceId, deviceName, screen }: { sourceId: string; deviceName: string; screen: MeshCoreScreenKind }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const isPhone = useIsPhone();
  if (!hasPermission('connection', 'read', { sourceId })) {
    // The phone shell hides its header on these URLs: keep the device header (and its switcher) here.
    return (
      <section className={styles.page}>
        {isPhone && <PhoneDeviceHeader sourceId={sourceId} />}
        <p className={styles.note} role="note">{t('meshcore.no_permission', 'You do not have permission to view this MeshCore source.')}</p>
      </section>
    );
  }
  return <Runtime sourceId={sourceId} deviceName={deviceName} screen={screen} />;
}

function Runtime({ sourceId, deviceName, screen }: { sourceId: string; deviceName: string; screen: MeshCoreScreenKind }) {
  const meshCore = useMeshCore({ baseUrl: appBasename, sourceId });
  const { isTxDisabled: receiveOnly } = useTxStatus({ baseUrl: appBasename, sourceId });
  // The unread line is pinned on entry: wait for this user's read state first.
  const readReady = useReadStateSync({ sourceId });
  // The sidebar reads the same contacts; hand it the live list rather than fetch it again.
  const queryClient = useQueryClient();
  const { contacts, hasLoadedOnce } = meshCore;
  useEffect(() => {
    if (hasLoadedOnce && contacts.length > 0) queryClient.setQueryData(mcKeys.contacts(sourceId), contacts);
  }, [contacts, hasLoadedOnce, queryClient, sourceId]);

  return (
    <RuntimeContext.Provider value={{ sourceId, deviceName, meshCore, receiveOnly }}>
      {screen.kind === 'settings' ? (
        <MeshCoreSettingsFrame path={screen.path} />
      ) : screen.kind === 'info' ? (
        <MeshCoreInfoPage />
      ) : screen.kind === 'packets' ? (
        <MeshCorePacketsPage sourceId={sourceId} contacts={meshCore.contacts} />
      ) : screen.kind === 'automations' ? (
        <MeshCoreAutomationsPage builtin={screen.builtin} />
      ) : screen.kind === 'dashboard' ? (
        <MeshCoreDashboard />
      ) : screen.kind === 'nodes' ? (
        <MeshCoreNodesTable />
      ) : screen.kind === 'node' ? (
        <ContactPage key={screen.key} publicKey={screen.key} tab={screen.tab} />
      ) : !readReady ? (
        <RouteLoading />
      ) : screen.kind === 'channel' ? (
        <MeshCoreChannelThread idx={screen.idx} />
      ) : screen.kind === 'room' ? (
        <MeshCoreRoom key={screen.key} roomKey={screen.key} />
      ) : (
        <MeshCoreHome />
      )}
    </RuntimeContext.Provider>
  );
}
