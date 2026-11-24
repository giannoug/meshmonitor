/**
 * Re-hosted Classic pages (spec §5.4): today's page inside
 * `ShellContext embedded`, so it hides its own chrome and the Workspace shell
 * draws it instead. One wrapper per page; each phase deletes its wrapper once
 * its Workspace area replaces the page.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, type To } from 'react-router-dom';
import { ShellContext } from '../../contexts/ShellContext';
import StateView from '../patterns/StateView';

// The same chunks Classic loads (main.tsx).
const DashboardPage = lazy(() => import('../../pages/DashboardPage.tsx'));

const EMBEDDED = { embedded: true };

export function Rehost({ children }: { children: ReactNode }) {
  return (
    <ShellContext.Provider value={EMBEDDED}>
      <Suspense fallback={<StateView kind="loading" page />}>{children}</Suspense>
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

