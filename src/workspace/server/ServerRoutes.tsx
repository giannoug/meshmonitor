/**
 * `/server/*` (Tasks 6.4–6.6). The Workspace's own page for every category;
 * today's section ids redirect to the page that holds them now, so settings
 * search and old links keep working. Devices (6.6) opens Add device from
 * `?add=1` (the rail's and the switcher's "+"). Nothing under `/server`
 * re-hosts a Classic page.
 *
 * `/server` itself is the Server list on phone (13-16); on desktop it opens
 * General, else the first category the user can open.
 */
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { ServerList } from './ServerSidebar';
import { SERVER_ALIASES, useServerAccess, useServerEntries } from './serverEntries';

const GeneralPage = lazy(() => import('./GeneralPage.tsx'));
const NotificationServicesPage = lazy(() => import('./NotificationServicesPage.tsx'));
const MapTilesPage = lazy(() => import('./MapTilesPage.tsx'));
const EmbedPage = lazy(() => import('./EmbedPage.tsx'));
const BackupMaintenancePage = lazy(() => import('./BackupMaintenancePage.tsx'));
const ChannelDatabasePage = lazy(() => import('./ChannelDatabasePage.tsx'));
const RetentionPage = lazy(() => import('./RetentionPage.tsx'));
const ScriptsPage = lazy(() => import('./ScriptsPage.tsx'));
const BackgroundJobsPage = lazy(() => import('./BackgroundJobsPage.tsx'));
const SolarPage = lazy(() => import('./SolarPage.tsx'));
const IntegrationsPage = lazy(() => import('./IntegrationsPage.tsx'));
const IntegrationPage = lazy(() => import('./IntegrationPage.tsx'));
const SecurityPrivacyPage = lazy(() => import('./SecurityPrivacyPage.tsx'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage.tsx'));
const DevicesPage = lazy(() => import('../devices/DevicesPage.tsx'));


function ServerIndex() {
  const isPhone = useIsPhone();
  const { ready } = useServerAccess();
  const entries = useServerEntries();
  if (isPhone) return <ServerList />;
  if (!ready) return <StateView kind="loading" />;
  // General is where the list starts on the boards (r4); else the first the user can open.
  const first = entries.find((e) => e.key === 'general') ?? entries[0];
  return first ? <Navigate replace to={`/server/${first.path}`} /> : <StateView kind="noPermission" />;
}

export function ServerRoutes() {
  return (
    <Routes>
      <Route index element={<ServerIndex />} />
      <Route path="general" element={<GeneralPage />} />
      <Route path="notification-services" element={<NotificationServicesPage />} />
      <Route path="map" element={<MapTilesPage />} />
      <Route path="embed" element={<EmbedPage />} />
      <Route path="backup" element={<BackupMaintenancePage />} />
      {/* Phone: the retention periods as a page of their own (s13n7). */}
      <Route path="backup/retention" element={<RetentionPage />} />
      <Route path="channel-database" element={<ChannelDatabasePage />} />
      <Route path="scripts" element={<ScriptsPage />} />
      <Route path="background-jobs" element={<BackgroundJobsPage />} />
      {/* Phone: Solar as a page of its own (s13n7); it works on desktop too. */}
      <Route path="background-jobs/solar" element={<SolarPage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      {/* Phone: ADS-B, Elevation and MeshWars as pages of their own (s13n7). */}
      <Route path="integrations/:service" element={<IntegrationPage />} />
      <Route path="security" element={<SecurityPrivacyPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="devices" element={<DevicesPage />} />
      {Object.entries(SERVER_ALIASES).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate replace to={`/server/${to}`} />} />
      ))}
      <Route path="*" element={<Navigate replace to="/server" />} />
    </Routes>
  );
}
