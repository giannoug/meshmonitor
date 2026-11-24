/**
 * Chooses between Classic and the Workspace for this user (spec §5.1–5.2).
 * Sits inside the router but above every auth provider, so its queries are
 * the anonymous-safe ones in `useLayout`. Classic draws at once; the gate
 * switches only when the answer (or the localStorage mirror) says Workspace.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RouteLoading from '../components/RouteLoading/RouteLoading';
import { useLayout } from './layout/useLayout';
import { classicFallback } from './layout/classicFallback';

// Their own chunks: Classic users never download Workspace code.
const WorkspaceApp = lazy(() => import('./WorkspaceApp'));
const PacketsPopout = lazy(() => import('./tools/PacketsPopout'));

// Router-relative, so the basename is already stripped. The public legal page
// is outside both layouts (§5.5). The packet monitor window has no shell in
// either layout: today's page in Classic, the 18-01 window in the Workspace.
const BYPASS = /^\/privacy\//;
const POPOUT = /^\/packet-monitor(\/|$)/;

export default function LayoutGate({ classic }: { classic: ReactNode }) {
  const { layout, ready } = useLayout();
  const { pathname, search } = useLocation();

  if (BYPASS.test(pathname)) return <>{classic}</>;
  if (POPOUT.test(pathname)) {
    if (layout !== 'workspace') return <>{classic}</>;
    return (
      <Suspense fallback={<RouteLoading />}>
        <PacketsPopout />
      </Suspense>
    );
  }
  if (layout === 'workspace') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <WorkspaceApp />
      </Suspense>
    );
  }
  // A Workspace-only URL waits until the layout is known, so a Workspace user
  // on a new browser keeps the deep link they opened (Classic's catch-all
  // would otherwise mount and could jump to the default landing page).
  // Classic URLs still render at once.
  const to = classicFallback(pathname, search);
  if (!to) return <>{classic}</>;
  return ready ? <Navigate replace to={to} /> : <RouteLoading />;
}
