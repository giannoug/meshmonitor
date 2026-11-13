/**
 * Workspace breakpoints (D8): phone layout below 768 px; from 768 px the
 * desktop shell, whose sidebar is an overlay drawer up to 1023 px. Live: a
 * resize or rotation re-renders.
 */
import { useMediaQuery } from '../../hooks/useIsMobileViewport';

export const PHONE_QUERY = '(max-width: 767.98px)';
export const DRAWER_QUERY = '(max-width: 1023.98px)';

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** 768–1023 px with the phone check: the sidebar is a drawer. */
export function useIsNarrowDesktop(): boolean {
  return useMediaQuery(DRAWER_QUERY);
}
