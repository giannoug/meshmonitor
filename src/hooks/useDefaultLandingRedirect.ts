/**
 * Applies the admin-configured default landing page (issue #2917, expanded
 * for issue #3183 to allow cross-source unified pages) to the page at `/`:
 *   - `'unified'` (or unset / unknown): stay here.
 *   - Other reserved values: redirect to the matching unified route
 *     (e.g. `unified-messages` → `/unified/messages`).
 *   - Source UUID: redirect to `/source/<id>/`.
 * `skip` leaves the user where they are (Classic's "Sources" button passes
 * `location.state.showList`). Shared by Classic's DashboardPage and the
 * Workspace's all-devices map.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReservedLandingPath, isReservedLandingValue } from '../utils/defaultLandingPage';

export function useDefaultLandingRedirect({
  skip,
  isSuccess,
  defaultLandingPage,
  sources,
}: {
  skip: boolean;
  /** The source list has loaded, so a source UUID can be looked up. */
  isSuccess: boolean;
  defaultLandingPage: string | null | undefined;
  sources: ReadonlyArray<{ id: string }>;
}): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (skip) return;
    if (!isSuccess) return;
    if (!defaultLandingPage || defaultLandingPage === 'unified') return;

    // Reserved values (built-in unified routes) take precedence over the
    // source-id lookup so a legitimate keyword can't be shadowed by a
    // hypothetical source whose UUID happens to collide.
    if (isReservedLandingValue(defaultLandingPage)) {
      const reservedPath = getReservedLandingPath(defaultLandingPage);
      if (reservedPath) void navigate(reservedPath, { replace: true });
      return;
    }

    const target = sources.find((s) => s.id === defaultLandingPage);
    if (!target) return;
    void navigate(`/source/${target.id}/`, { replace: true });
  }, [skip, isSuccess, defaultLandingPage, sources, navigate]);
}
