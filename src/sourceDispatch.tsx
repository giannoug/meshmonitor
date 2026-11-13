/**
 * The per-source page for a source, by `source.type` (#6365, Rule X).
 *
 * Moved out of `main.tsx`'s `SourceAppDispatch` unchanged so Classic and the
 * Workspace render a source the same way. Meshcore sources render the
 * dedicated MeshCoreSourcePage, which talks to the `/api/sources/:id/meshcore/*`
 * routes; Reticulum sources (#3960 Phase 1b WP2) render ReticulumSourcePage
 * the same way, talking to `/api/sources/:id/reticulum/*`; everything else
 * falls through to the legacy Meshtastic <App>.
 *
 * Each is wrapped in SourceProvider then WebSocketProvider so that
 * useWebSocket() can call useSource() and get the real sourceId for room
 * subscription and cache key targeting. WebSocketProvider must be INSIDE
 * SourceProvider.
 */
import type { ComponentType } from 'react';
import type { DashboardSource } from './hooks/useDashboardData';
import { preloadAppTabForPath } from './appTabs';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { SourceProvider } from './contexts/SourceContext';
import type { MeshCoreView } from './components/MeshCore/meshCoreViewAccess';
import type { ReticulumView } from './types/reticulum';

/**
 * The page components, passed in by each layout. They are not declared here:
 * the eager-CSS plugin (vite.config.ts) reads main.tsx's own lazy() imports to
 * keep the stylesheet cascade, so main.tsx must keep declaring them.
 */
export interface SourcePages {
  App: ComponentType;
  MeshCoreSourcePage: ComponentType<Partial<NonNullable<SourceViews['meshcore']>>>;
  MeshCoreIngestSourcePage: ComponentType;
  ReticulumSourcePage: ComponentType<Partial<NonNullable<SourceViews['reticulum']>>>;
}

/** Controlled views for the MeshCore/Reticulum pages; the Workspace drives them from the URL. Classic passes none. */
export interface SourceViews {
  meshcore?: { view: MeshCoreView; onViewChange(view: MeshCoreView): void };
  reticulum?: { view: ReticulumView; onViewChange(view: ReticulumView): void };
}

export function renderSourceApp(
  { App, MeshCoreSourcePage, MeshCoreIngestSourcePage, ReticulumSourcePage }: SourcePages,
  sourceId: string,
  source: DashboardSource | undefined,
  splat: string | undefined,
  views: SourceViews = {},
) {
  if (source?.type === 'meshcore') {
    return (
      <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
        <WebSocketProvider>
          <MeshCoreSourcePage key={sourceId} {...views.meshcore} />
        </WebSocketProvider>
      </SourceProvider>
    );
  }

  // A meshcore_mqtt ingest source is MeshCore, but has no device — it gets its
  // own read-only page rather than MeshCorePage (whose useMeshCore hook polls
  // ~20 device endpoints the route guard refuses for it) and rather than
  // falling through to the Meshtastic <App /> shell below, which is what it did
  // before #5096 and why it showed Meshtastic tabs for a MeshCore source.
  if (source?.type === 'meshcore_mqtt') {
    return (
      <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
        <WebSocketProvider>
          <MeshCoreIngestSourcePage key={sourceId} />
        </WebSocketProvider>
      </SourceProvider>
    );
  }

  if (source?.type === 'reticulum') {
    return (
      <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
        <WebSocketProvider>
          <ReticulumSourcePage key={sourceId} {...views.reticulum} />
        </WebSocketProvider>
      </SourceProvider>
    );
  }

  // Fetch the landing tab's chunk alongside App's own, rather than after App
  // has loaded and rendered its (lazy) tab. Idempotent, so a re-render is free.
  preloadAppTabForPath(splat);

  return (
    <SourceProvider sourceId={sourceId} sourceName={source?.name ?? null} sourceType={source?.type ?? null}>
      <WebSocketProvider>
        {/* key={sourceId} forces full remount when switching sources, resetting all DataContext/MessagingContext state */}
        <App key={sourceId} />
      </WebSocketProvider>
    </SourceProvider>
  );
}
