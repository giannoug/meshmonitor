/**
 * Stand-ins for the Classic pages in WorkspaceApp tests: each prints its name,
 * whether it was rendered embedded (re-hosted without its chrome), and the
 * location it sees. Real chrome hiding is covered by Task 1.4's
 * classicChrome.snapshot test; this checks the routing and the wrappers.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShellEmbedded } from '../../contexts/ShellContext';

/** Mounts per page name, so a test can tell a re-render from a remount. */
export const mounts: Record<string, number> = {};

export function pageStub(name: string) {
  return function PageStub(props: { view?: string; screen?: { kind: string }; onViewChange?: (v: string) => void; dmContact?: string | null; dmRequest?: string; dmDraft?: string | null; mapNode?: string | null }) {
    useEffect(() => {
      mounts[name] = (mounts[name] ?? 0) + 1;
    }, []);
    const embedded = useShellEmbedded();
    const { pathname, hash, state } = useLocation();
    const showList = (state as { showList?: boolean } | null)?.showList === true;
    return (
      <div data-testid={`page-${name}`} data-embedded={String(embedded)} data-show-list={String(showList)}>
        {`${name} body`}
        <span data-testid="seen-location">{pathname + hash}</span>
        {(props.view ?? props.screen?.kind) && <span data-testid="view">{props.view ?? props.screen?.kind}</span>}
        {props.dmContact && <span data-testid="dm-contact">{props.dmContact}</span>}
        {props.dmRequest && <span data-testid="dm-request">{props.dmRequest}</span>}
        {props.dmDraft && <span data-testid="dm-draft">{props.dmDraft}</span>}
        {props.mapNode && <span data-testid="map-node">{props.mapNode}</span>}
        {props.onViewChange && (
          <button type="button" onClick={() => props.onViewChange?.('channels')}>
            go-channels
          </button>
        )}
      </div>
    );
  };
}
