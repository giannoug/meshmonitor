/**
 * @vitest-environment jsdom
 *
 * Board s1-you, frame (Task 1.7): the account head and the You rows, each
 * leading to today's page or dialog until Phase 6 rebuilds them.
 */
import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
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
    expect(link('Language & units')).toHaveAttribute('href', '/preferences/language');
    expect(link('Appearance')).toHaveAttribute('href', '/preferences/appearance');
    expect(link('Map')).toHaveAttribute('href', '/preferences/map');
    expect(link('Global Settings')).toHaveAttribute('href', '/server/general');
    // No device opened yet: the first one in Server › Devices order.
    expect(link('Notifications')).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/settings/notifications`);
    expect(link('Help & about')).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/info`);
  });

  it('hides Global Settings from non-admins', async () => {
    renderYou({ permissions: { bySource: { [SOURCE_IDS.heltec]: { nodes: { read: true, write: false } } } } });
    await waitFor(() => expect(rows()).toContain('Notifications'));
    expect(rows()).not.toContain('Global Settings');
    expect(screen.getByRole('link', { name: /^Notifications/ })).toHaveAttribute('href', `/source/${SOURCE_IDS.heltec}/notifications`);
  });

  it('opens API Token and Sign-in & security in sheets', async () => {
    renderYou();
    fireEvent.click(await screen.findByRole('button', { name: /^API Token/ }));
    const sheet = await screen.findByRole('dialog', { name: 'API Token Management' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^Sign-in & security/ }));
    const security = await screen.findByRole('dialog', { name: 'Sign-in & security' });
    expect(within(security).getByRole('button', { name: /Change Password/ })).toBeInTheDocument();
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
