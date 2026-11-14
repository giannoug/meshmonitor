/**
 * `/source/:sourceId/*` in the Workspace (spec §5.3–5.5). Renders the source
 * through the same dispatch as Classic (`renderSourceApp`), re-hosted:
 *
 * - Meshtastic-family sources (App): Classic URLs redirect to their Workspace
 *   form, and App sees the Classic location of a Workspace-only URL
 *   (`classicSourceLocation`), since it picks its tab from the path. A
 *   channel (`channel/<n>[/beacons]`) is the Workspace's own ChannelThread,
 *   a DM (`dm/<nodeId>`) its own DmConversation, the DM inbox (`dms`) its
 *   DmInbox, and the bare source URL on a phone its PhoneHome (Task 2.6), with
 *   App not mounted (Ruling AD: one owner of the message state per screen).
 *   A desktop bare source URL keeps the re-hosted App.
 * - MeshCore / Reticulum: the view comes from the URL and view changes
 *   navigate. A MeshCore view the viewer may not open is replaced in the URL
 *   by the one the page shows.
 * - An unknown source shows the Overview with a "not found" note.
 */
import { lazy, useCallback } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import { useDashboardSources } from '../../hooks/useDashboardData';
import {
  MESHCORE_FALLBACK_VIEW,
  resolveMeshCoreView,
  visibleMeshCoreViews,
  type MeshCoreView,
} from '../../components/MeshCore/meshCoreViewAccess';
import type { ReticulumView } from '../../types/reticulum';
import { renderSourceApp, type SourcePages } from '../../sourceDispatch';
import {
  classicSourceLocation,
  meshcoreViewForPath,
  RETICULUM_DEFAULT_VIEW,
  reticulumViewForPath,
  workspaceRedirect,
} from '../routes';
import { OverviewRehost, Redirect, Rehost } from '../rehost/pages';
import { useHashTarget } from '../rehost/useHashTarget';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './WorkspaceSource.module.css';

// The same chunks Classic loads (main.tsx).
const PAGES: SourcePages = {
  App: lazy(() => import('../../App.tsx')),
  MeshCoreSourcePage: lazy(() => import('../../pages/MeshCoreSourcePage.tsx')),
  MeshCoreIngestSourcePage: lazy(() => import('../../pages/MeshCoreIngestSourcePage.tsx')),
  ReticulumSourcePage: lazy(() => import('../../pages/ReticulumSourcePage.tsx')),
};

const ChannelThread = lazy(() => import('../chat/ChannelThread.tsx'));
const DmConversation = lazy(() => import('../chat/DmConversation.tsx'));
/** `channel/<n>` and `channel/<n>/beacons`: the Workspace chat (Task 2.3). */
const CHAT_PATH = /^channel\/(\d+)(\/beacons)?\/?$/;
/** `dm/<nodeId>`: the Workspace DM (Task 2.4). */
const DM_PATH = /^dm\/([^/]+)\/?$/;
const DmInbox = lazy(() => import('../chat/DmInbox.tsx'));
const PhoneHome = lazy(() => import('../chat/PhoneHome.tsx'));
/** `dms`: the Workspace DM inbox (Task 2.6). */
const DMS_PATH = /^dms\/?$/;

export default function WorkspaceSource() {
  const { t } = useTranslation();
  const { sourceId = '', '*': splat = '' } = useParams<{ sourceId: string; '*': string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: sources, isLoading } = useDashboardSources();
  const { authStatus, loading: authLoading, hasPermission } = useAuth();
  const isPhone = useIsPhone();
  const source = sources?.find((s) => s.id === sourceId);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const goToView = useCallback((view: string) => void navigate(`${base}/${view}`), [navigate, base]);
  // What the re-hosted App sees (Meshtastic family), and the hash the real URL needs for it.
  const classic = classicSourceLocation(location, source?.type);
  const hashTarget = useHashTarget(classic.hash);

  // Every branch below renders its page next to any <Redirect>, never in its
  // place, so a URL fix-up does not remount the page.
  if (isLoading && !source) return <RouteLoading />;
  if (sources && !source) {
    // The Overview's own socket, as on every non-source route (Ruling N).
    return (
      <WebSocketProvider>
        <OverviewRehost notice={<p className={styles.notice} role="status">{t('workspace.source.not_found')}</p>} />
      </WebSocketProvider>
    );
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
    const fix = requested !== view || (splat === '' && location.hash === '#configuration');
    const onViewChange = (next: MeshCoreView) => next !== view && goToView(next);
    return (
      <Redirect to={fix ? `${base}/${view}` : null}>
        <Rehost>{renderSourceApp(PAGES, sourceId, source, splat, { meshcore: { view, onViewChange } })}</Rehost>
      </Redirect>
    );
  }

  if (source?.type === 'reticulum') {
    const requested = reticulumViewForPath(splat);
    const view = requested ?? RETICULUM_DEFAULT_VIEW;
    const onViewChange = (next: ReticulumView) => next !== view && goToView(next);
    return (
      <Redirect to={requested ? null : `${base}/${view}`}>
        <Rehost>{renderSourceApp(PAGES, sourceId, source, splat, { reticulum: { view, onViewChange } })}</Rehost>
      </Redirect>
    );
  }

  if (source?.type === 'meshcore_mqtt') return <Rehost>{renderSourceApp(PAGES, sourceId, source, splat)}</Rehost>;

  const chat = source && splat.match(CHAT_PATH);
  if (chat) {
    return (
      <Rehost>
        <ChannelThread key={sourceId} sourceId={sourceId} source={source} channel={Number(chat[1])} view={chat[2] ? 'beacons' : 'thread'} />
      </Rehost>
    );
  }

  const dm = source && splat.match(DM_PATH);
  if (dm) {
    return (
      <Rehost>
        <DmConversation key={sourceId} sourceId={sourceId} source={source} nodeId={dm[1]} />
      </Rehost>
    );
  }

  if (source && DMS_PATH.test(splat)) {
    return (
      <Rehost>
        <DmInbox key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  // The phone device Home (c-home-e1). A `#section` deep link still goes to App, which serves it.
  if (source && isPhone && splat === '' && !location.hash) {
    return (
      <Rehost>
        <PhoneHome key={sourceId} sourceId={sourceId} source={source} />
      </Rehost>
    );
  }

  // Meshtastic family: App. A Classic URL redirects to its Workspace form;
  // meanwhile App already shows that URL's Classic tab.
  const classicSplat = classic.pathname.replace(/^\/source\/[^/]+\/?/, '');
  return (
    <Redirect to={workspaceRedirect(location) ?? hashTarget}>
      <Rehost>
        {/* App reads its tab from the location; hand it the Classic one. */}
        <Routes location={{ ...location, pathname: classic.pathname, hash: classic.hash }}>
          <Route path="*" element={renderSourceApp(PAGES, sourceId, source, classicSplat)} />
        </Routes>
      </Rehost>
    </Redirect>
  );
}
