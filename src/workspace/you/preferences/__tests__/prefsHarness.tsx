/**
 * Renders a You › Preferences page (Task 6.3) inside the shell, under the
 * app's SettingsProvider, against `prefsFixtures`; returns the request log.
 */
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../../test/renderWorkspace';
import { newPrefsLog, prefsFixtures, PREF_SETTINGS } from '../../../__fixtures__/preferences';
import { ToastProvider } from '../../../../components/ToastContainer';
import { SettingsProvider } from '../../../../contexts/SettingsContext';
import { appBasename } from '../../../../init';
import WorkspaceShell from '../../../shell/WorkspaceShell';
import { PreferencesRoutes } from '../PreferencesRoutes';
import HelpAboutPage from '../HelpAboutPage';

// eslint-disable-next-line react-refresh/only-export-components -- #6365 a test harness, never hot-reloaded
function Where() {
  const { pathname, hash } = useLocation();
  return <output data-testid="where">{pathname + hash}</output>;
}

export interface PrefsRenderOptions extends RenderWorkspaceOptions {
  settings?: Record<string, string>;
}

/** Default: an admin who also holds themes:write (the auth status lists it; the theme UI reads only that grant). */
export function renderPrefs(route: string, { settings = PREF_SETTINGS, fixtures, permissions, isAdmin, ...opts }: PrefsRenderOptions = {}) {
  const log = newPrefsLog();
  const result = renderWorkspace(
    <ToastProvider>
      <SettingsProvider baseUrl={appBasename}>
        <WorkspaceShell>
          <Routes>
            <Route path="/preferences/*" element={<PreferencesRoutes />} />
            <Route path="/you/help" element={<HelpAboutPage />} />
          </Routes>
          <Where />
        </WorkspaceShell>
      </SettingsProvider>
    </ToastProvider>,
    {
      route,
      ...opts,
      permissions: permissions ?? { global: { themes: { read: true, write: true } } },
      isAdmin: isAdmin ?? !permissions,
      fixtures: { ...prefsFixtures(log, settings), ...fixtures },
    },
  );
  return { ...result, log };
}
