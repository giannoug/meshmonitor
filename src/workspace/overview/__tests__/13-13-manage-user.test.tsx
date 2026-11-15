/**
 * @vitest-environment jsdom
 *
 * Board 13-13-manage-user (desktop, s13n0, s13n4, s13n5): the Account half of
 * a user's page beside o4's Permissions matrix. Every control is today's, on
 * today's endpoint and body: Make / Remove Admin, Set Password, Password
 * changes locked, Passkeys (today's AdminPasskeysDialog), Deactivate User and
 * Permanently Delete in a Danger Zone (ConfirmSheet with today's words), and
 * Add User (today's create form).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { gets, openUser, renderUsers, requests, writes } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function account(user: string) {
  renderUsers('/overview/users');
  await openUser(user);
  return screen.findByRole('tabpanel', { name: 'Account' }, { timeout: 5000 });
}

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

describe('13-13-manage-user', () => {
  it('13-13-manage-user shows the board', async () => {
    await account('Field team');
    expectBoard('13-13-manage-user', document.body);
  });

  it('shows today\'s fields: @username, Display Name, Email, Auth Provider, Status, Administrator', async () => {
    const pane = await account('Field team');
    expect(pane).toHaveTextContent('Username@field-team');
    expect(pane).toHaveTextContent('Display NameField team');
    expect(pane).toHaveTextContent('Emailfield@athensmesh.gr');
    expect(pane).toHaveTextContent('Auth ProviderLOCAL');
    expect(pane).toHaveTextContent('StatusActive');
    expect(pane).toHaveTextContent('Passkeys2 passkeys');
  });

  it('Make Admin sends today\'s request at once (granting has no confirm today)', async () => {
    const pane = await account('Field team');
    fireEvent.click(within(pane).getByRole('button', { name: 'Make Admin' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'PUT', url: '/api/users/4/admin', body: { isAdmin: true } }]));
  });

  it('Remove Admin asks first; Cancel sends nothing, the confirm sends today\'s request', async () => {
    const pane = await account('giannoug');
    fireEvent.click(within(pane).getByRole('button', { name: 'Remove Admin' }));
    const sheet = await dialog('Remove Admin');
    expect(sheet).toHaveTextContent('giannoug will lose administrator privileges.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove Admin' })).toBeNull());
    expect(writes()).toEqual([]);
    fireEvent.click(within(pane).getByRole('button', { name: 'Remove Admin' }));
    fireEvent.click(within(await dialog('Remove Admin')).getByRole('button', { name: 'Remove Admin' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'PUT', url: '/api/users/2/admin', body: { isAdmin: false } }]));
  });

  it('you cannot change your own admin status, deactivate or delete yourself', async () => {
    const pane = await account('Athens Ops');
    expect(within(pane).getByRole('button', { name: 'Remove Admin' })).toBeDisabled();
    expect(within(pane).getByText('This is you, so it cannot change')).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: 'Deactivate User' })).toBeDisabled();
    expect(within(pane).getByRole('button', { name: 'Permanently Delete' })).toBeDisabled();
  });

  it('the anonymous user cannot be deactivated or deleted, with today\'s reasons', async () => {
    const pane = await account('Anonymous');
    expect(pane).toHaveTextContent('Special User');
    expect(pane).toHaveTextContent('Defines permissions for unauthenticated users');
    expect(within(pane).getByRole('button', { name: 'Deactivate User' })).toHaveAttribute('title', 'Cannot deactivate anonymous user');
    expect(within(pane).getByRole('button', { name: 'Permanently Delete' })).toHaveAttribute('title', 'Cannot delete the anonymous user');
  });

  it('Set Password: today\'s checks, then the password goes only into today\'s request body', async () => {
    const pane = await account('Field team');
    fireEvent.click(within(pane).getByRole('button', { name: 'Set Password' }));
    const sheet = await dialog('Set Password for field-team');
    const submit = within(sheet).getByRole('button', { name: 'Set Password' });
    expect(submit).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/^New Password/), { target: { value: 'short' } });
    fireEvent.change(within(sheet).getByLabelText(/^Confirm Password/), { target: { value: 'short' } });
    fireEvent.click(submit);
    expect(await within(sheet).findByText('Password must be at least 8 characters')).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText(/^New Password/), { target: { value: 'correct horse 42' } });
    fireEvent.change(within(sheet).getByLabelText(/^Confirm Password/), { target: { value: 'correct horse 43' } });
    fireEvent.click(submit);
    expect(await within(sheet).findByText('Passwords do not match')).toBeInTheDocument();
    expect(writes()).toEqual([]);
    fireEvent.change(within(sheet).getByLabelText(/^Confirm Password/), { target: { value: 'correct horse 42' } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(writes()).toEqual([{ method: 'POST', url: '/api/users/4/set-password', body: { newPassword: 'correct horse 42' } }]));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Password for field-team' })).toBeNull());
    // Nowhere but that body: not in a URL, not left in the page.
    expect(requests().filter((r) => r.url.includes('correct'))).toEqual([]);
    expect(document.body.innerHTML).not.toContain('correct horse');
  });

  it('Set Password is off while password changes are locked, with today\'s reason', async () => {
    renderUsers('/overview/users', {
      fixtures: {
        'GET /api/users': () => ({
          users: [{ id: 4, username: 'field-team', email: null, displayName: null, authProvider: 'local', isAdmin: false, isActive: true, passwordLocked: true, createdAt: 0, lastLoginAt: null }],
        }),
      },
    });
    await openUser('field-team');
    const pane = await screen.findByRole('tabpanel', { name: 'Account' });
    expect(within(pane).getByRole('button', { name: 'Set Password' })).toBeDisabled();
    expect(within(pane).getByRole('button', { name: 'Set Password' })).toHaveAttribute('title', 'Password changes are locked for this account');
    fireEvent.click(within(pane).getByRole('switch', { name: 'Password changes locked' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'PUT', url: '/api/users/4', body: { passwordLocked: false } }]));
  });

  it('Passkeys opens today\'s admin passkey list', async () => {
    const pane = await account('Field team');
    fireEvent.click(within(pane).getByRole('button', { name: 'Passkeys' }));
    const modal = await dialog('Passkeys for field-team');
    expect(await within(modal).findByText('MacBook')).toBeInTheDocument();
    expect(gets()).toContain('/api/auth/passkey/admin/users/4');
  });

  it('Deactivate User asks with today\'s words, then sends today\'s request', async () => {
    const pane = await account('Field team');
    fireEvent.click(within(pane).getByRole('button', { name: 'Deactivate User' }));
    const sheet = await dialog('Deactivate User?');
    expect(sheet).toHaveTextContent('Are you sure you want to deactivate user field-team?');
    expect(sheet).toHaveTextContent('This will revoke their access to MeshMonitor.');
    expect(writes()).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Deactivate User' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'DELETE', url: '/api/users/4', body: undefined }]));
  });

  it('Permanently Delete asks with today\'s words, then sends today\'s request', async () => {
    const pane = await account('Field team');
    fireEvent.click(within(pane).getByRole('button', { name: 'Permanently Delete' }));
    const sheet = await dialog('Permanently Delete User?');
    expect(sheet).toHaveTextContent('Are you sure you want to permanently delete user field-team?');
    expect(sheet).toHaveTextContent('This action cannot be undone!');
    expect(sheet).toHaveTextContent('This will remove the user and all associated data including permissions, preferences, and notification subscriptions.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Permanently Delete' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'DELETE', url: '/api/users/4/permanent', body: undefined }]));
  });

  it('Add User opens today\'s create form and sends today\'s body', async () => {
    renderUsers('/overview/users');
    fireEvent.click(await screen.findByRole('button', { name: 'Add User' }, { timeout: 5000 }));
    const sheet = await dialog('Create New User');
    const create = within(sheet).getByRole('button', { name: 'Create User' });
    fireEvent.click(create);
    expect(await within(sheet).findByText('Username and password are required')).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText(/^Username/), { target: { value: 'eleni' } });
    fireEvent.change(within(sheet).getByLabelText(/^Password/), { target: { value: 'kalimera-2026' } });
    fireEvent.change(within(sheet).getByLabelText('Display Name'), { target: { value: 'Eleni' } });
    fireEvent.change(within(sheet).getByLabelText('Email'), { target: { value: 'eleni@athensmesh.gr' } });
    fireEvent.click(create);
    await waitFor(() => expect(writes()).toEqual([{
      method: 'POST', url: '/api/users',
      body: { username: 'eleni', password: 'kalimera-2026', email: 'eleni@athensmesh.gr', displayName: 'Eleni', isAdmin: false },
    }]));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create New User' })).toBeNull());
  });
});
