/**
 * Renders a device settings URL the way the Workspace does (shell +
 * WorkspaceSource), plus the real URL and a way to navigate, for the settings
 * board tests, with Station G2's device configuration served. Each test file mocks the socket and App itself, as renderChat's
 * callers do.
 */
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { deviceConfigFixtures } from '../../__fixtures__/deviceConfig';

export const g2 = `/source/${SOURCE_IDS.g2}`;
export const mqtt = `/source/${SOURCE_IDS.mqtt}`;

// eslint-disable-next-line react-refresh/only-export-components -- #6365 a test helper, never hot-reloaded
function RealUrl() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="real-url">{pathname + search + hash}</output>
      <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />
    </>
  );
}

export function renderSettings(route: string, opts: RenderWorkspaceOptions = {}) {
  Element.prototype.scrollIntoView ??= () => {};
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
      <RealUrl />
    </ToastProvider>,
    { route, ...opts, fixtures: { ...deviceConfigFixtures, ...opts.fixtures } },
  );
}

export const realUrl = () => screen.getByTestId('real-url').textContent;
export const goTo = (path: string) => fireEvent.change(screen.getByTestId('goto'), { target: { value: path } });

/** The URLs fetched so far. */
export const fetched = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));
