/**
 * @vitest-environment jsdom
 *
 * Task 6.2: with anonymous viewing off and no session, the Workspace renders
 * SignInPage outside the shell: no rail, no sidebar, and none of the shell's
 * data requests (sources, poll, nodes, unread …) before sign-in. After sign-in
 * the page reloads where it was, as today.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { signedOut, signInFixtures } from '../../__fixtures__/signIn';
import WorkspaceApp from '../../WorkspaceApp';
import { requests, stubLocation, submitPassword } from './signInHarness';

// Auth, CSRF and the privacy links, plus SettingsProvider's reads (settings, themes, map styles and
// preferences, the locale), which sit above the shell as in Classic's main.tsx and also run on its login page.
const BEFORE_SIGN_IN = new Set([
  'GET /api/auth/status',
  'GET /api/csrf-token',
  'GET /api/privacy/links',
  'GET /api/settings',
  'GET /api/themes',
  'GET /api/map-styles/styles',
  'GET /api/push/preferences',
  'GET /api/user/map-preferences',
  'GET /locales/en.json',
]);

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

const ROUTE = `/source/${SOURCE_IDS.g2}/nodes`;

describe('sign-in gate', () => {
  it('renders the sign-in page outside the shell, with no shell requests', async () => {
    renderWorkspace(<><WorkspaceApp /><Where /></>, { route: ROUTE, anonymous: true, fixtures: signInFixtures() });
    expect(await screen.findByRole('heading', { name: 'Athens Mesh Watch' })).toBeInTheDocument();
    await screen.findByText('Privacy Policy');
    // Give any stray query a chance to fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-workspace-shell]')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Devices' })).toBeNull();
    const all = requests();
    expect(all.filter((r) => !BEFORE_SIGN_IN.has(r))).toEqual([]);
    expect(all.some((r) => /\/api\/(poll|sources|nodes|unified|messages|channels|telemetry)/.test(r))).toBe(false);
  });

  it('keeps the URL, and a sign-in that works reloads it there', async () => {
    const reload = stubLocation();
    renderWorkspace(<><WorkspaceApp /><Where /></>, { route: ROUTE, anonymous: true, fixtures: signInFixtures({ login: 'ok' }) });
    await submitPassword();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTE);
  });

  it('with guests allowed, the shell renders for a signed-out viewer', async () => {
    renderWorkspace(<WorkspaceApp />, {
      route: '/you',
      anonymous: true,
      fixtures: { ...signInFixtures({ status: signedOut({ anonymousDisabled: false }) }) },
    });
    expect(await screen.findByRole('navigation', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Athens Mesh Watch' })).toBeNull();
  });

  it('a signed-in user gets the shell even with anonymous viewing off', async () => {
    renderWorkspace(<WorkspaceApp />, {
      route: '/you',
      fixtures: { 'GET /api/auth/status': () => ({ ...athensFixture.authStatus, anonymousDisabled: true }) },
    });
    expect(await screen.findByRole('navigation', { name: 'Devices' })).toBeInTheDocument();
  });
});
