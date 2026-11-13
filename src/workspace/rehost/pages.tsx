/**
 * Re-hosted Classic pages (spec §5.4): today's page inside
 * `ShellContext embedded`, so it hides its own chrome and the Workspace shell
 * draws it instead. One wrapper per page; each phase deletes its wrapper once
 * its Workspace area replaces the page.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { ShellContext } from '../../contexts/ShellContext';
import { globalSettingsHash } from '../routes';

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
 * Puts `hash` in the URL before rendering `children`: Classic's SectionNav
 * scrolls to the `#section` it finds in `window.location`, so a category URL
 * carries the section of the Classic page it re-hosts.
 */
export function WithHash({ hash, children }: { hash: string; children: ReactNode }) {
  const { pathname, search, hash: current } = useLocation();
  if (hash && current !== hash) return <Navigate replace to={{ pathname, search, hash }} />;
  return <>{children}</>;
}

/**
 * Overview › Map: today's DashboardPage. It jumps to the admin's default
 * landing page unless the history entry says `showList`; only `/` (`landing`)
 * should jump, so every other Overview URL gets `showList` first.
 */
export function OverviewRehost({ landing = false, notice }: { landing?: boolean; notice?: ReactNode }) {
  const { pathname, search, hash, state } = useLocation();
  const showList = (state as { showList?: boolean } | null)?.showList === true;
  if (!landing && !showList) {
    return <Navigate replace to={{ pathname, search, hash }} state={{ ...(state as object | null), showList: true }} />;
  }
  return (
    <Rehost>
      {notice}
      <DashboardPage />
    </Rehost>
  );
}

/** `/preferences/<x>` and `/server/<x>`: today's global settings page, scrolled to the category. */
export function GlobalSettingsRehost() {
  const category = (useParams()['*'] ?? '').split('/')[0];
  return (
    <WithHash hash={globalSettingsHash(category)}>
      <Rehost>
        <GlobalSettingsPage />
      </Rehost>
    </WithHash>
  );
}

export const AnalysisRehost = () => <Rehost><MapAnalysisPage /></Rehost>;
export const ReportsRehost = () => <Rehost><ReportsPage /></Rehost>;
export const AutomationsRehost = () => <Rehost><AutomationsPage /></Rehost>;
export const UnifiedMessagesRehost = () => <Rehost><UnifiedMessagesPage /></Rehost>;
export const UnifiedTelemetryRehost = () => <Rehost><UnifiedTelemetryPage /></Rehost>;
export const UnifiedPacketsRehost = () => <Rehost><UnifiedPacketMonitorPage /></Rehost>;
export const UsersRehost = () => <Rehost><UsersPage /></Rehost>;
