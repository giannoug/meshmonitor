/**
 * Renders a source URL the way the Workspace does (shell + WorkspaceSource),
 * for the chat board tests. Each test file mocks the socket and App itself:
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
 *     ...(await orig<object>()),
 *     WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
 *   }));
 *   vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
 */
import { Route, Routes } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';

export function renderChat(route: string, opts: RenderWorkspaceOptions = {}) {
  // jsdom has no scrolling; useMessagingView scrolls to the "New" line on entry.
  Element.prototype.scrollIntoView ??= () => {};
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
    </ToastProvider>,
    { route, ...opts },
  );
}

/** The text of several renders (or a render plus its portaled sheets) as one element, for a board that compares states side by side. */
export function joined(...parts: Array<HTMLElement | string>): HTMLElement {
  const el = document.createElement('div');
  el.textContent = parts.map((p) => (typeof p === 'string' ? p : p.textContent ?? '')).join(' ');
  return el;
}
