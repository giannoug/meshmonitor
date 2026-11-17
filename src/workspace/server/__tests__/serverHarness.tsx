/**
 * Renders a Server page (Task 6.4) inside the shell, under the app's
 * SettingsProvider, against `serverFixtures`; returns the request log.
 */
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { newServerLog, serverFixtures, SERVER_SETTINGS } from '../../__fixtures__/server';
import { ToastProvider } from '../../../components/ToastContainer';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { appBasename } from '../../../init';
import WorkspaceShell from '../../shell/WorkspaceShell';
import { ServerRoutes } from '../ServerRoutes';

// eslint-disable-next-line react-refresh/only-export-components -- #6365 a test harness, never hot-reloaded
function Where() {
  const { pathname, hash } = useLocation();
  return <output data-testid="where">{pathname + hash}</output>;
}

export interface ServerRenderOptions extends RenderWorkspaceOptions {
  settings?: Record<string, string>;
}

export function renderServer(route: string, { settings = SERVER_SETTINGS, fixtures, ...opts }: ServerRenderOptions = {}) {
  const log = newServerLog();
  const result = renderWorkspace(
    <ToastProvider>
      <SettingsProvider baseUrl={appBasename}>
        <WorkspaceShell>
          <Routes>
            <Route path="/server/*" element={<ServerRoutes />} />
            <Route path="*" element={null} />
          </Routes>
          <Where />
        </WorkspaceShell>
      </SettingsProvider>
    </ToastProvider>,
    { route, ...opts, fixtures: { ...serverFixtures(log, settings), ...fixtures } },
  );
  return { ...result, log };
}

/** A non-admin with these grants on Station G2. */
export const grants = (settings: { read?: boolean; write?: boolean }, extra: Record<string, { read?: boolean; write?: boolean }> = {}) => ({
  bySource: { 'src-g2': { settings: { read: !!settings.read || !!settings.write, write: !!settings.write }, ...extra } },
});
