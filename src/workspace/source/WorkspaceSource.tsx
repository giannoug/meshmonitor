/**
 * `/source/:sourceId/*` in the Workspace (spec §5.3–5.5). Renders the source
 * through the same dispatch as Classic (`renderSourceApp`), re-hosted:
 *
 * - Meshtastic-family sources (App): Classic URLs redirect to their Workspace
 *   form, and App sees the Classic location of a Workspace-only URL
 *   (`classicSourceLocation`), since it picks its tab from the path.
 * - MeshCore / Reticulum: the view comes from the URL and view changes
 *   navigate. A MeshCore view the viewer may not open is replaced in the URL
 *   by the one the page shows.
 * - An unknown source shows the Overview with a "not found" note.
 */
import { lazy, useCallback } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardSources } from '../../hooks/useDashboardData';
import {
  MESHCORE_FALLBACK_VIEW,
  resolveMeshCoreView,
  visibleMeshCoreViews,
  type MeshCoreView,
} from '../../components/MeshCore/meshCoreViewAccess';
import type { ReticulumView } from '../../types/reticulum';
import { renderSourceApp, type SourcePages } from '../../sourceDispatch';
import { classicSourceLocation, meshcoreViewForPath, reticulumViewForPath, workspaceRedirect } from '../routes';
import { OverviewRehost, Rehost, WithHash } from '../rehost/pages';
import styles from './WorkspaceSource.module.css';

// The same chunks Classic loads (main.tsx).
const PAGES: SourcePages = {
  App: lazy(() => import('../../App.tsx')),
  MeshCoreSourcePage: lazy(() => import('../../pages/MeshCoreSourcePage.tsx')),
  MeshCoreIngestSourcePage: lazy(() => import('../../pages/MeshCoreIngestSourcePage.tsx')),
  ReticulumSourcePage: lazy(() => import('../../pages/ReticulumSourcePage.tsx')),
};

export default function WorkspaceSource() {
  const { t } = useTranslation();
  const { sourceId = '', '*': splat = '' } = useParams<{ sourceId: string; '*': string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: sources, isLoading } = useDashboardSources();
  const { authStatus, loading: authLoading, hasPermission } = useAuth();
  const source = sources?.find((s) => s.id === sourceId);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const goToView = useCallback((view: string) => void navigate(`${base}/${view}`), [navigate, base]);

  if (isLoading && !source) return <RouteLoading />;
  if (sources && !source) {
    return <OverviewRehost notice={<p className={styles.notice} role="status">{t('workspace.source.not_found')}</p>} />;
  }

  if (source?.type === 'meshcore') {
    // The access rules need the grants; wait for them rather than redirect on an empty set.
    if (authLoading) return <RouteLoading />;
    const requested = meshcoreViewForPath(splat, location.hash);
    const visible = visibleMeshCoreViews({
      canRead: (resource) => hasPermission(resource, 'read', { sourceId }),
      isAuthenticated: authStatus?.authenticated ?? false,
    });
    const view = resolveMeshCoreView(requested ?? MESHCORE_FALLBACK_VIEW, visible);
    // Keep the URL on the view the page shows: a forbidden or unknown view, or
    // the `#configuration` deep link, becomes `/source/:id/<view>`.
    if (requested !== view || (splat === '' && location.hash === '#configuration')) {
      return <Navigate replace to={`${base}/${view}`} />;
    }
    const onViewChange = (next: MeshCoreView) => next !== view && goToView(next);
    return <Rehost>{renderSourceApp(PAGES, sourceId, source, splat, { meshcore: { view, onViewChange } })}</Rehost>;
  }

  if (source?.type === 'reticulum') {
    const view = reticulumViewForPath(splat);
    const onViewChange = (next: ReticulumView) => next !== view && goToView(next);
    return <Rehost>{renderSourceApp(PAGES, sourceId, source, splat, { reticulum: { view, onViewChange } })}</Rehost>;
  }

  if (source?.type === 'meshcore_mqtt') return <Rehost>{renderSourceApp(PAGES, sourceId, source, splat)}</Rehost>;

  // Meshtastic family: App.
  const to = workspaceRedirect(location);
  if (to) return <Navigate replace to={to} />;
  const classic = classicSourceLocation(location, source?.type);
  const classicSplat = classic.pathname.replace(/^\/source\/[^/]+\/?/, '');
  return (
    <WithHash hash={classic.hash}>
      <Rehost>
        {/* App reads its tab from the location; hand it the Classic one. */}
        <Routes location={{ ...location, pathname: classic.pathname, hash: classic.hash }}>
          <Route path="*" element={renderSourceApp(PAGES, sourceId, source, classicSplat)} />
        </Routes>
      </Rehost>
    </WithHash>
  );
}
