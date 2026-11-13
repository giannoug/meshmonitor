/**
 * Chooses between Classic and the Workspace for this user (spec §5.1–5.2).
 * Sits inside the router but above every auth provider, so its queries are
 * the anonymous-safe ones in `useLayout`.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RouteLoading from '../components/RouteLoading/RouteLoading';
import { useLayout } from './layout/useLayout';
import { classicFallback } from './layout/classicFallback';

// Its own chunk: Classic users never download Workspace code.
const WorkspaceApp = lazy(() => import('./WorkspaceApp'));

export default function LayoutGate({ classic }: { classic: ReactNode }) {
  const { layout, ready } = useLayout();
  const { pathname } = useLocation();

  if (!ready) return <RouteLoading />;
  if (layout === 'workspace') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <WorkspaceApp />
      </Suspense>
    );
  }
  const to = classicFallback(pathname);
  // Redirect instead of drawing Classic's catch-all (the dashboard) for one frame.
  return to ? <Navigate replace to={to} /> : <>{classic}</>;
}
