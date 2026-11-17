/**
 * @vitest-environment jsdom
 *
 * Board s1-you, frame (Task 1.7): the account head and the You rows. Since
 * Task 6.1 Sign-in & security and API Token are pages, and Preferences lists
 * today's categories (b-set-p5-you).
 */
import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import YouHome from '../YouHome';

function renderYou(opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <YouHome />
      </WorkspaceShell>
    </ToastProvider>,
    { route: '/you', phone: true, ...opts },
  );
}

const rows = () =>
  screen
    .getAllByTestId('you-row')
    .map((r) => r.querySelector('[data-row-title]')?.textContent);

describe('s1-you', () => {
  it('s1-you shows the board', async () => {
    const { container } = renderYou();
    await screen.findByText('Athens Ops');
    expectBoard('s1-you', container);
  });

  it('shows the account head and the rows in board order', async () => {
    renderYou();
    expect(await screen.findByText('Athens Ops')).toBeInTheDocument();
    expect(screen.getByText('Administrator · Local account')).toBeInTheDocument();
    await waitFor(() => expect(rows()).toContain('Notifications'));
    expect(rows()).toEqual([
      'Sign-in & security',
      'API Token',
      'Layout',
      'Language & units',
      'Appearance',
      'Map',
      'Notifications',
      'Global Settings',
      'Help & about',
      'Logout',
    ]);
    const link = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) });
    expect(link('Layout')).toHaveAttribute('href', '/you/layout');
    expect(link('Language')).toHaveAttribute('href', '/preferences/language');
    expect(link('Appearance')).toHaveAttribute('href', '/preferences/appearance');
    expect(link('Map')).toHaveAttribute('href', '/preferences/map');
    // The Server list (Task 6.4).
    expect(link('Global Settings')).toHaveAttribute('href', '/server');
    // Push per device for this browser (Task 5.8, s2).
    expect(link('Notifications')).toHaveAttribute('href', '/you/notifications');
    expect(link('Help & about')).toHaveAttribute('href', '/you/help');
  });

  it('hides Global Settings from non-admins', async () => {
    renderYou({ permissions: { bySource: { [SOURCE_IDS.heltec]: { nodes: { read: true, write: false } } } } });
    await waitFor(() => expect(rows()).toContain('Notifications'));
    expect(rows()).not.toContain('Global Settings');
    expect(screen.getByRole('link', { name: /^Notifications/ })).toHaveAttribute('href', '/you/notifications');
  });

  it('leads to Sign-in & security and API Token (Task 6.1)', async () => {
    renderYou();
    expect(await screen.findByRole('link', { name: /^Sign-in & security/ })).toHaveAttribute('href', '/you/security');
    expect(screen.getByRole('link', { name: /^API Token/ })).toHaveAttribute('href', '/you/token');
  });

  it('an OIDC account has no Sign-in & security, as the user menu', async () => {
    renderYou({ fixtures: { 'GET /api/auth/status': () => ({ ...athensFixture.authStatus, user: { ...athensFixture.authStatus.user!, authProvider: 'oidc' } }) } });
    expect(await screen.findByText('Administrator · OIDC account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^API Token/ })).toBeInTheDocument();
    expect(screen.queryByText('Sign-in & security')).toBeNull();
  });

  it('signs out with today\'s logout', async () => {
    let loggedOut = false;
    // Today's logout reloads the page; jsdom cannot.
    const location = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...location, reload }, writable: true });
    onTestFinished(() => Object.defineProperty(window, 'location', { value: location, writable: true }));
    renderYou({ fixtures: { 'POST /api/auth/logout': () => { loggedOut = true; return { success: true }; } } });
    fireEvent.click(await screen.findByRole('button', { name: /^Logout/ }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(loggedOut).toBe(true);
  });

  it('offers Login instead of the account rows to a guest', async () => {
    renderYou({ anonymous: true });
    fireEvent.click(await screen.findByRole('button', { name: /^Login/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('API Token')).toBeNull();
    expect(screen.queryByText('Logout')).toBeNull();
  });
});
