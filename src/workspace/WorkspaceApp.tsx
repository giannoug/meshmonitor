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
import { appBasename } from '../init';
import WorkspaceShell from './shell/WorkspaceShell';
import { useIsPhone } from './shell/useIsPhone';
import WorkspaceSource from './source/WorkspaceSource';
import YouHome from './you/YouHome';
import SignInPage from './auth/SignInPage';
import LayoutPage from './you/LayoutPage';
import { workspaceRedirect } from './routes';
import { AutomationsRehost, OverviewRehost } from './rehost/pages';
import { ServerRoutes } from './server/ServerRoutes';
import { PreferencesRoutes } from './you/preferences/PreferencesRoutes';

const OverviewMap = lazy(() => import('./overview/OverviewMap.tsx'));
const OverviewHome = lazy(() => import('./overview/OverviewHome.tsx'));
const OverviewMessages = lazy(() => import('./overview/OverviewMessages.tsx'));
const ExportMessagesPage = lazy(() => import('./overview/ExportMessagesPage.tsx'));
const OverviewTelemetry = lazy(() => import('./overview/OverviewTelemetry.tsx'));
const OverviewPackets = lazy(() => import('./overview/OverviewPackets.tsx'));
const ReportsRoute = lazy(() => import('./reports/ReportsRoute.tsx'));
const UsersPage = lazy(() => import('./overview/users/UsersPage.tsx'));
const AuditPage = lazy(() => import('./overview/audit/AuditPage.tsx'));
const YouNotifications = lazy(() => import('./you/NotificationsPage.tsx'));
const YouSecurity = lazy(() => import('./you/SecurityPage.tsx'));
const YouToken = lazy(() => import('./you/ApiTokenPage.tsx'));
const YouPassword = lazy(() => import('./you/ChangePasswordPage.tsx'));
const YouHelp = lazy(() => import('./you/preferences/HelpAboutPage.tsx'));

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
          {/* `/overview/dashboard`, which has no cross-source Classic page: today's Dashboard until Phase 8. */}
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
          {/* Users and Audit log (Task 4.8), with no Classic page mounted (Ruling AD). */}
          <Route path="overview/users" element={<UsersPage />} />
          <Route path="overview/audit" element={<AuditPage />} />

          <Route path="unified/messages" element={<OverviewMessages />} />
          <Route path="unified/telemetry" element={<OverviewTelemetry />} />
          <Route path="unified/packets" element={<OverviewPackets />} />
          <Route path="analysis" element={<OverviewIndex />} />
          <Route path="reports/:report?" element={<ReportsRoute />} />
          <Route path="automations/*" element={<AutomationsRehost />} />
          <Route path="users" element={<UsersPage />} />

          {/* You › Preferences (Task 6.3), with no Classic page mounted (Ruling AD). */}
          <Route path="preferences/*" element={<PreferencesRoutes />} />
          {/* Server (Task 6.4): the Workspace's own pages; the categories 6.5 and 6.6 rebuild stay re-hosted. */}
          <Route path="server/*" element={<ServerRoutes />} />
          <Route path="you" element={<YouHome />} />
          {/* Other You categories are Phase 6's. */}
          <Route path="you/layout" element={<LayoutPage />} />
          <Route path="you/notifications" element={<YouNotifications />} />
          {/* Sign-in & security, API Token and Change password (Task 6.1), with no Classic dialog mounted (Ruling AD). */}
          <Route path="you/security" element={<YouSecurity />} />
          <Route path="you/token" element={<YouToken />} />
          <Route path="you/password" element={<YouPassword />} />
          {/* Help & about (Task 6.3), for everyone. */}
          <Route path="you/help" element={<YouHelp />} />
          <Route path="you/*" element={<OverviewRehost />} />

          <Route path="*" element={<OverviewRehost />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

/**
 * Anonymous viewing off and no session: today's LoginPage case (App.tsx),
 * the Workspace sign-in page outside the shell (Task 6.2, s11n0). The shell
 * waits for the auth answer, so it fires none of its data requests first.
 */
function SignInGate() {
  const { authStatus } = useAuth();
  if (!authStatus) return <RouteLoading />;
  if (authStatus.anonymousDisabled && !authStatus.authenticated) return <SignInPage />;
  return (
    <WorkspaceShell>
      <WorkspaceRoutes />
    </WorkspaceShell>
  );
}

export default function WorkspaceApp() {
  return (
    <CsrfProvider>
      <AuthProvider>
        {/* The basename, not a guess from the URL: a Workspace path such as /preferences/map is no Classic route (Task 6.3). */}
        <SettingsProvider baseUrl={appBasename}>
          <ToastProvider>
            <SignInGate />
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </CsrfProvider>
  );
}
