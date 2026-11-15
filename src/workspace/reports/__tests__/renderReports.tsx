/**
 * Overview › Reports under the real Workspace routes, against the Athens
 * fixture. Leaflet sizes its maps from the container, so the report maps
 * (Coverage, the router-cluster map) get one; `meshIssuesView` presets
 * today's Mesh Issues view state (localStorage `meshIssues.viewState.v1`).
 */
import { vi, onTestFinished } from 'vitest';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { DEFAULT_MESH_ISSUES_VIEW_STATE, type MeshIssuesViewState } from '../../../components/Analysis/meshIssues/useMeshIssuesViewState';
import WorkspaceApp from '../../WorkspaceApp';

export interface ReportsOptions extends RenderWorkspaceOptions {
  meshIssuesView?: Partial<MeshIssuesViewState>;
}

export function renderReports(route: string, opts: ReportsOptions = {}) {
  localStorage.clear();
  if (opts.meshIssuesView) {
    localStorage.setItem('meshIssues.viewState.v1', JSON.stringify({ ...DEFAULT_MESH_ISSUES_VIEW_STATE, ...opts.meshIssuesView }));
  }
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  onTestFinished(() => {
    width.mockRestore();
    height.mockRestore();
    localStorage.clear();
  });
  return renderWorkspace(<WorkspaceApp />, { route, ...opts });
}

/** A JSON reply with `status`, for denied and failing calls. */
export function reply(status: number, body: unknown = { success: false, error: 'Forbidden', code: 'FORBIDDEN' }) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
