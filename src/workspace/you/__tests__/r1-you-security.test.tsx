/**
 * @vitest-environment jsdom
 *
 * Board r1-you-security (Task 6.1): You › Sign-in & security on desktop, with
 * the You sidebar. Password, Two-Factor Authentication, Passkeys and API Token
 * over today's endpoints; OIDC accounts see only the API Token.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import SecurityPage from '../SecurityPage';
import { renderAccount } from './accountHarness';

const page = () => <SecurityPage />;

describe('r1-you-security', () => {
  it('r1-you-security shows the board', async () => {
    const { container } = renderAccount(page(), '/you/security');
    await screen.findByText('Work laptop');
    await screen.findByText('Disable Two-Factor Authentication');
    await screen.findByText('Revoke Token');
    expectBoard('r1-you-security', container);
  });

  it('the sidebar leads to each You page', async () => {
    renderAccount(page(), '/you/security');
    const side = await screen.findByRole('complementary', { name: 'You' });
    expect(within(side).getByText('Athens Ops')).toBeInTheDocument();
    expect(within(side).getByText('Administrator · Local account')).toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Sign-in & security' })).toHaveAttribute('href', '/you/security');
    expect(within(side).getByRole('link', { name: 'Sign-in & security' })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getByRole('link', { name: 'API Token' })).toHaveAttribute('href', '/you/token');
    expect(within(side).getByRole('link', { name: 'Layout' })).toHaveAttribute('href', '/you/layout');
    expect(within(side).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change Password' })).toHaveAttribute('href', '/you/password');
  });

  it('OIDC accounts see only the API Token', async () => {
    renderAccount(page(), '/you/security', { user: { authProvider: 'oidc' } });
    await screen.findByText('Revoke Token');
    expect(screen.queryByText('Change Password')).toBeNull();
    expect(screen.queryByText('Two-Factor Authentication')).toBeNull();
    expect(screen.queryByText('Passkeys')).toBeNull();
    expect(screen.queryByText('Password sign-in')).toBeNull();
    // The sidebar drops the row, as YouHome does.
    expect(within(screen.getByRole('complementary', { name: 'You' })).queryByText('Sign-in & security')).toBeNull();
  });

  it('a local account sees password, two-factor and passkeys', async () => {
    renderAccount(page(), '/you/security');
    expect(await screen.findByRole('link', { name: 'Change Password' })).toBeInTheDocument();
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(await screen.findByText('Password sign-in')).toBeInTheDocument();
    expect(screen.getByText('Passkeys')).toBeInTheDocument();
  });

  it('a passkey-only account has no Change Password, as the user menu', async () => {
    renderAccount(page(), '/you/security', { user: { passwordLoginDisabled: true }, account: { passwordLoginDisabled: true, recoveryCodesLeft: 10 } });
    expect(await screen.findByText('Turn password sign-in back on')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Change Password' })).toBeNull();
  });

  it('turning two-factor off asks for a code (or a backup code) in a ConfirmSheet', async () => {
    const bodies: unknown[] = [];
    renderAccount(page(), '/you/security', {
      fixtures: { 'POST /api/mfa/disable': (_u, init) => { bodies.push(JSON.parse(String(init?.body))); return { success: true }; } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Disable Two-Factor Authentication' }));
    const sheet = await screen.findByRole('dialog', { name: 'Disable Two-Factor Authentication' });
    expect(within(sheet).getByText('Enter your current authenticator code to disable two-factor authentication.')).toBeInTheDocument();
    const confirm = within(sheet).getByRole('button', { name: 'Disable Two-Factor Authentication' });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Use a backup code' }));
    const field = within(sheet).getByLabelText('Backup Code');
    fireEvent.change(field, { target: { value: 'k7m2x9qa' } });
    // Enter does not confirm a destructive sheet (submitOnEnter false).
    fireEvent.submit(field.closest('form')!);
    expect(bodies).toEqual([]);
    fireEvent.click(confirm);
    await waitFor(() => expect(bodies).toEqual([{ backupCode: 'k7m2x9qa' }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Enable Two-Factor Authentication' })).toBeInTheDocument();
  });

  it('Revoke on the token row confirms with today\'s words', async () => {
    let revoked = false;
    renderAccount(page(), '/you/security', { fixtures: { 'DELETE /api/token': () => { revoked = true; return { success: true }; } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Token' }));
    const sheet = await screen.findByRole('dialog', { name: 'Revoke Token' });
    expect(within(sheet).getByText('Are you sure you want to revoke this token? This action cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes, Revoke' }));
    await waitFor(() => expect(revoked).toBe(true));
    expect(await screen.findByRole('button', { name: /Generate API Token/ })).toBeInTheDocument();
    expect(screen.queryByText('Regenerate')).toBeNull();
  });
});
