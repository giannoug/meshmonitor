/**
 * The Workspace layout (spec §5.3–5.5): providers, the shell, and the route
 * table. Deviation from the brief's provider order (Ruling N): as in Classic,
 * the app-level WebSocketProvider wraps only non-source routes; a source route
 * has just its per-source one, else a second, join-all-sources socket would
 * refetch the open source's poll on every event from any source. Until each area's phase replaces it, a route renders its re-host
 * wrapper: today's page inside `ShellContext embedded`. `/privacy/*` never
 * gets here (LayoutGate renders Classic for it), nor does `/packet-monitor`:
 * LayoutGate renders the Workspace pop-out window for it without the shell
 * (`tools/PacketsPopout`, 18-01 / 18-02). `/embed/:profileId` is a separate
 * server-rendered page.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import './styles/fonts.css';
import RouteLoading from '../components/RouteLoading/RouteLoading';
import { ToastProvider } from '../components/ToastContainer';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CsrfProvider } from '../contexts/CsrfContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import WorkspaceShell from './shell/WorkspaceShell';
import { useIsPhone } from './shell/useIsPhone';
import WorkspaceSource from './source/WorkspaceSource';
import YouHome from './you/YouHome';
import LayoutPage from './you/LayoutPage';
import GeneralLayoutCard from './server/GeneralLayoutCard';
import { workspaceRedirect } from './routes';
import { AutomationsRehost, GlobalSettingsRehost, OverviewRehost, UsersRehost } from './rehost/pages';

const OverviewMap = lazy(() => import('./overview/OverviewMap.tsx'));
const OverviewHome = lazy(() => import('./overview/OverviewHome.tsx'));
const OverviewMessages = lazy(() => import('./overview/OverviewMessages.tsx'));
const ExportMessagesPage = lazy(() => import('./overview/ExportMessagesPage.tsx'));
const OverviewTelemetry = lazy(() => import('./overview/OverviewTelemetry.tsx'));
const OverviewPackets = lazy(() => import('./overview/OverviewPackets.tsx'));
const ReportsRoute = lazy(() => import('./reports/ReportsRoute.tsx'));

/**
 * `/`, `/overview`, `/overview/map`, `/analysis` and `/overview/analysis`: the
 * all-devices map with Analysis (Tasks 4.1, 4.2), except the phone's
 * `/overview`, which is the Overview Home (5-07). One element type for all of
 * them, so moving between them (the rail's Overview square, the sidebar's
 * All-devices map and Map Analysis rows) keeps the one map mounted.
 */
function OverviewIndex({ landing = false }: { landing?: boolean }) {
  const isPhone = useIsPhone();
  const { pathname } = useLocation();
  return isPhone && /^\/overview\/?$/.test(pathname) ? <OverviewHome /> : <OverviewMap landing={landing} />;
}

function WorkspaceRoutes() {
  const location = useLocation();
  const { authStatus, loading } = useAuth();

  // Source URLs redirect inside WorkspaceSource, which knows the source type.
  if (!location.pathname.startsWith('/source/')) {
    const to = workspaceRedirect(location, { isAdmin: authStatus?.user?.isAdmin === true });
    // `/settings` depends on the role: wait for it.
    if (to) return loading ? <RouteLoading /> : <Navigate replace to={to} />;
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* The per-source socket only (renderSourceApp), as in Classic. */}
        <Route path="source/:sourceId/*" element={<WorkspaceSource />} />

        {/* Every other route shares one app-level socket, kept across navigation (Ruling N). */}
        <Route element={<WebSocketProvider><Outlet /></WebSocketProvider>}>
          {/* The all-devices map (Task 4.1); the admin's default landing page applies on `/` only. */}
          <Route index element={<OverviewIndex landing />} />
          <Route path="overview" element={<OverviewIndex />} />
          <Route path="overview/map" element={<OverviewIndex />} />
          {/* `/overview/dashboard` and `/overview/audit`, which have no cross-source Classic page:
              today's Dashboard until Phases 4 and 8. */}
          <Route path="overview/*" element={<OverviewRehost />} />
          {/* Overview › Messages and its export (Task 4.6), with no Classic page mounted (Ruling AD). */}
          <Route path="overview/messages" element={<OverviewMessages />} />
          <Route path="overview/messages/export" element={<ExportMessagesPage />} />
          {/* Overview › Telemetry and Packets (Task 4.7), with no Classic page mounted (Ruling AD). */}
          <Route path="overview/telemetry" element={<OverviewTelemetry />} />
          <Route path="overview/packets" element={<OverviewPackets />} />
          {/* Map Analysis is merged into the all-devices map (Task 4.2, s5n1): the same element, the Analysis group open. */}
          <Route path="overview/analysis" element={<OverviewIndex />} />
          {/* Reports (Task 4.4): the list, Mesh Issues, Coverage; the other reports re-hosted until 4.5. */}
          <Route path="overview/reports/:report?" element={<ReportsRoute />} />
          <Route path="overview/automations" element={<AutomationsRehost />} />
          <Route path="overview/users" element={<UsersRehost />} />

          <Route path="unified/messages" element={<OverviewMessages />} />
          <Route path="unified/telemetry" element={<OverviewTelemetry />} />
          <Route path="unified/packets" element={<OverviewPackets />} />
          <Route path="analysis" element={<OverviewIndex />} />
          <Route path="reports/:report?" element={<ReportsRoute />} />
          <Route path="automations/*" element={<AutomationsRehost />} />
          <Route path="users" element={<UsersRehost />} />

          <Route path="preferences/*" element={<GlobalSettingsRehost />} />
          {/* General's Layout and Sources cards sit above today's page (Task 1.8); 6.4 rebuilds the rest. */}
          <Route path="server/*" element={<GlobalSettingsRehost above={{ general: <GeneralLayoutCard /> }} />} />
          <Route path="you" element={<YouHome />} />
          {/* Other You categories are Phase 6's. */}
          <Route path="you/layout" element={<LayoutPage />} />
          <Route path="you/*" element={<OverviewRehost />} />

          <Route path="*" element={<OverviewRehost />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function WorkspaceApp() {
  return (
    <CsrfProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <WorkspaceShell>
              <WorkspaceRoutes />
            </WorkspaceShell>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </CsrfProvider>
  );
}
