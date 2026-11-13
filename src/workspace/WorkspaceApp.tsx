/**
 * The Workspace layout (spec §5.3–5.5): providers, the shell, and the route
 * table. Until each area's phase replaces it, a route renders its re-host
 * wrapper: today's page inside `ShellContext embedded`. `/privacy/*` and
 * `/packet-monitor` never get here (LayoutGate renders Classic for them);
 * `/embed/:profileId` is a separate server-rendered page.
 */
import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles/fonts.css';
import RouteLoading from '../components/RouteLoading/RouteLoading';
import { ToastProvider } from '../components/ToastContainer';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CsrfProvider } from '../contexts/CsrfContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import WorkspaceShell from './shell/WorkspaceShell';
import WorkspaceSource from './source/WorkspaceSource';
import { workspaceRedirect } from './routes';
import {
  AnalysisRehost,
  AutomationsRehost,
  GlobalSettingsRehost,
  OverviewRehost,
  ReportsRehost,
  UnifiedMessagesRehost,
  UnifiedPacketsRehost,
  UnifiedTelemetryRehost,
  UsersRehost,
} from './rehost/pages';

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
        <Route index element={<OverviewRehost landing />} />
        <Route path="overview" element={<OverviewRehost />} />
        <Route path="overview/map" element={<OverviewRehost />} />
        {/* Not cross-source pages in Classic: the Overview until Phases 4 and 8. */}
        <Route path="overview/dashboard" element={<OverviewRehost />} />
        <Route path="overview/audit" element={<OverviewRehost />} />
        <Route path="overview/messages" element={<UnifiedMessagesRehost />} />
        <Route path="overview/telemetry" element={<UnifiedTelemetryRehost />} />
        <Route path="overview/packets" element={<UnifiedPacketsRehost />} />
        <Route path="overview/analysis" element={<AnalysisRehost />} />
        <Route path="overview/reports/*" element={<ReportsRehost />} />
        <Route path="overview/automations" element={<AutomationsRehost />} />
        <Route path="overview/users" element={<UsersRehost />} />

        <Route path="unified/messages" element={<UnifiedMessagesRehost />} />
        <Route path="unified/telemetry" element={<UnifiedTelemetryRehost />} />
        <Route path="unified/packets" element={<UnifiedPacketsRehost />} />
        <Route path="analysis" element={<AnalysisRehost />} />
        <Route path="reports" element={<ReportsRehost />} />
        <Route path="automations/*" element={<AutomationsRehost />} />
        <Route path="users" element={<UsersRehost />} />

        <Route path="source/:sourceId/*" element={<WorkspaceSource />} />

        <Route path="preferences/*" element={<GlobalSettingsRehost />} />
        <Route path="server/*" element={<GlobalSettingsRehost />} />
        {/* The You frame lands in Task 1.7. */}
        <Route path="you/*" element={<OverviewRehost />} />

        <Route path="*" element={<OverviewRehost />} />
      </Routes>
    </Suspense>
  );
}

export default function WorkspaceApp() {
  return (
    <CsrfProvider>
      <AuthProvider>
        <WebSocketProvider>
          <SettingsProvider>
            <ToastProvider>
              <WorkspaceShell>
                <WorkspaceRoutes />
              </WorkspaceShell>
            </ToastProvider>
          </SettingsProvider>
        </WebSocketProvider>
      </AuthProvider>
    </CsrfProvider>
  );
}
