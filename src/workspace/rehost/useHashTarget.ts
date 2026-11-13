import { useLocation, type To } from 'react-router-dom';

/**
 * The URL with `hash`, when it does not carry it yet: Classic's SectionNav
 * scrolls to the `#section` it finds in `window.location`, so a category URL
 * carries the section of the Classic page it re-hosts.
 */
export function useHashTarget(hash: string): To | null {
  const { pathname, search, hash: current } = useLocation();
  return hash && current !== hash ? { pathname, search, hash } : null;
}
