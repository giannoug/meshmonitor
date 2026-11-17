/**
 * `/server/*` (Task 6.4). The Workspace's own pages for General,
 * Notification services, Map & tiles, Embed, Backup & maintenance and Channel
 * database; today's section ids that now live on one of them redirect there,
 * so settings search and old links keep working. Every other category
 * (Devices, Security & privacy, Scripts, Background jobs, Integrations,
 * Analytics) stays on today's re-hosted page until Tasks 6.5 and 6.6.
 *
 * `/server` itself is the Server list on phone (13-16); on desktop it opens
 * General, else the first category the user can open.
 */
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GlobalSettingsRehost } from '../rehost/pages';
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
      {Object.entries(SERVER_ALIASES).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate replace to={`/server/${to}`} />} />
      ))}
      <Route path="*" element={<GlobalSettingsRehost />} />
    </Routes>
  );
}
