/**
 * Re-hosted Classic pages (spec §5.4): today's page inside
 * `ShellContext embedded`, so it hides its own chrome and the Workspace shell
 * draws it instead. One wrapper per page; each phase deletes its wrapper once
 * its Workspace area replaces the page.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, type To } from 'react-router-dom';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { ShellContext } from '../../contexts/ShellContext';
import { globalSettingsHash } from '../routes';
import { useHashTarget } from './useHashTarget';

// The same chunks Classic loads (main.tsx).
const DashboardPage = lazy(() => import('../../pages/DashboardPage.tsx'));
const MapAnalysisPage = lazy(() => import('../../pages/MapAnalysisPage.tsx'));
const ReportsPage = lazy(() => import('../../pages/ReportsPage.tsx'));
const AutomationsPage = lazy(() => import('../../components/automations/AutomationsPage.tsx'));
const UnifiedMessagesPage = lazy(() => import('../../pages/UnifiedMessagesPage.tsx'));
const UnifiedTelemetryPage = lazy(() => import('../../pages/UnifiedTelemetryPage.tsx'));
const UnifiedPacketMonitorPage = lazy(() => import('../../pages/UnifiedPacketMonitorPage.tsx'));
const GlobalSettingsPage = lazy(() => import('../../pages/GlobalSettingsPage.tsx'));
const UsersPage = lazy(() => import('../../pages/UsersPage.tsx'));

const EMBEDDED = { embedded: true };

export function Rehost({ children }: { children: ReactNode }) {
  return (
    <ShellContext.Provider value={EMBEDDED}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ShellContext.Provider>
  );
}

/**
 * Renders `children` and, when `to` is set, replaces the URL with it. The
 * page stays mounted while the URL changes: returning the <Navigate> in its
 * place would unmount it, and App would lose its data and reconnect.
 */
export function Redirect({ to, children }: { to: To | null; children: ReactNode }) {
  return (
    <>
      {to && <Navigate replace to={to} />}
      {children}
    </>
  );
}

/**
 * Overview › Map: today's DashboardPage. It jumps to the admin's default
 * landing page unless the location state says `showList`; only `/`
 * (`landing`) should jump, so every other Overview URL hands the page a
 * location with `showList`. The real URL is untouched.
 */
export function OverviewRehost({ landing = false, notice }: { landing?: boolean; notice?: ReactNode }) {
  const location = useLocation();
  const page = (
    <Rehost>
      {notice}
      <DashboardPage />
    </Rehost>
  );
  if (landing) return page;
  return (
    // Parent routes of this wrapper end in `/*`, as React Router requires for descendant <Routes>.
    <Routes location={{ ...location, state: { ...(location.state as object | null), showList: true } }}>
      <Route path="*" element={page} />
    </Routes>
  );
}

/**
 * `/preferences/<x>` and `/server/<x>`: today's global settings page, scrolled
 * to the category. `above[category]` draws above the page; it sits beside the
 * page, so moving between categories keeps the page mounted.
 */
export function GlobalSettingsRehost({ above }: { above?: Record<string, ReactNode> }) {
  const category = (useParams()['*'] ?? '').split('/')[0];
  const to = useHashTarget(globalSettingsHash(category));
  return (
    <Redirect to={to}>
      {above && Object.hasOwn(above, category) && above[category]}
      <Rehost>
        <GlobalSettingsPage />
      </Rehost>
    </Redirect>
  );
}

export const AnalysisRehost = () => <Rehost><MapAnalysisPage /></Rehost>;
export const ReportsRehost = () => <Rehost><ReportsPage /></Rehost>;
export const AutomationsRehost = () => <Rehost><AutomationsPage /></Rehost>;
export const UnifiedMessagesRehost = () => <Rehost><UnifiedMessagesPage /></Rehost>;
export const UnifiedTelemetryRehost = () => <Rehost><UnifiedTelemetryPage /></Rehost>;
export const UnifiedPacketsRehost = () => <Rehost><UnifiedPacketMonitorPage /></Rehost>;
export const UsersRehost = () => <Rehost><UsersPage /></Rehost>;
