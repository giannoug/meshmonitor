/**
 * @vitest-environment jsdom
 *
 * Board 11-06 (Task 6.1): You › Change password, today's checks and words
 * over POST /api/auth/change-password, and the forced "Choose a new password"
 * after a recovery-code sign-in: no current password, no Cancel, no close.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture } from '../../__fixtures__/athens';
import ChangePasswordPage from '../ChangePasswordPage';
import { joined, renderAccount } from './accountHarness';

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole('button', { name: 'Change Password' }).closest('form')!);

describe('11-06-change-password', () => {
  it('11-06-change-password shows the board', async () => {
    const texts: string[] = [];
    const forced = renderAccount(<ChangePasswordPage />, '/you/password', { passwordChangeRequired: true });
    await screen.findByText(/signed in with a recovery code/);
    texts.push(forced.container.textContent ?? '');
    forced.unmount();

    const { container } = renderAccount(<ChangePasswordPage />, '/you/password');
    await screen.findByLabelText('Current Password');
    submit();
    texts.push(container.textContent ?? '');
    fill('Current Password', 'old-password');
    fill('New Password', 'short');
    fill('Confirm New Password', 'short');
    submit();
    texts.push(container.textContent ?? '');
    fill('New Password', 'brand-new-pass');
    fill('Confirm New Password', 'brand-new-pas');
    submit();
    texts.push(container.textContent ?? '');
    fill('New Password', 'old-password');
    fill('Confirm New Password', 'old-password');
    submit();
    texts.push(container.textContent ?? '');
    expectBoard('11-06-change-password', joined(texts));
  });

  it('sends today\'s request and shows today\'s success', async () => {
    const bodies: unknown[] = [];
    renderAccount(<ChangePasswordPage />, '/you/password', {
      fixtures: { 'POST /api/auth/change-password': (_u, init) => { bodies.push(JSON.parse(String(init?.body))); return { success: true }; } },
    });
    const button = await screen.findByRole('button', { name: 'Change Password' });
    expect(button).toBeDisabled();
    fill('Current Password', 'old-password');
    fill('New Password', 'brand-new-pass');
    fill('Confirm New Password', 'brand-new-pass');
    fireEvent.click(button);
    await waitFor(() => expect(bodies).toEqual([{ currentPassword: 'old-password', newPassword: 'brand-new-pass' }]));
    expect(await screen.findByText('Password changed successfully!')).toBeInTheDocument();
  });

  it('forced: only the new password, no Cancel, and the shell adds no second form', async () => {
    const bodies: unknown[] = [];
    renderAccount(<ChangePasswordPage />, '/you/password', {
      passwordChangeRequired: true,
      fixtures: { 'POST /api/auth/change-password': (_u, init) => { bodies.push(JSON.parse(String(init?.body))); return { success: true }; } },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Current Password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fill('New Password', 'brand-new-pass');
    fill('Confirm New Password', 'brand-new-pass');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await waitFor(() => expect(bodies).toEqual([{ newPassword: 'brand-new-pass' }]));
  });

  it('forced elsewhere: the shell\'s sheet cannot be dismissed', async () => {
    renderAccount(<div />, '/you', { passwordChangeRequired: true, phone: true });
    const sheet = await screen.findByRole('dialog', { name: 'Choose a new password' });
    expect(within(sheet).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.keyDown(sheet, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.getByRole('dialog', { name: 'Choose a new password' })).toBeInTheDocument();
    // The sheet portals outside .page: its own data-phone gives Change Password the 44 px target (6.1 I1).
    const content = sheet.querySelector('[data-phone]');
    expect(content).not.toBeNull();
    expect(content).toContainElement(within(sheet).getByRole('button', { name: 'Change Password' }));
  });

  it('forced elsewhere: success sends only the new password, then closes after today\'s 2 s', async () => {
    let required = true;
    const bodies: unknown[] = [];
    renderAccount(<div />, '/you', {
      phone: true,
      fixtures: {
        'GET /api/auth/status': () => ({ ...athensFixture.authStatus, passwordChangeRequired: required }),
        'POST /api/auth/change-password': (_u, init) => {
          bodies.push(JSON.parse(String(init?.body)));
          required = false;
          return { success: true };
        },
      },
    });
    const sheet = await screen.findByRole('dialog', { name: 'Choose a new password' });
    fireEvent.change(within(sheet).getByLabelText('New Password'), { target: { value: 'brand-new-pass' } });
    fireEvent.change(within(sheet).getByLabelText('Confirm New Password'), { target: { value: 'brand-new-pass' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Change Password' }));
    expect(await within(sheet).findByText('Password changed successfully!')).toBeInTheDocument();
    expect(bodies).toEqual([{ newPassword: 'brand-new-pass' }]);
    // Still up for the 2 s, then refreshAuth reads the cleared flag and the sheet goes.
    await new Promise((r) => setTimeout(r, 1500));
    expect(screen.getByRole('dialog', { name: 'Choose a new password' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
  });
});

describe('/you/password gate (6.1 I2)', () => {
  const routed = () => (
    <Routes>
      <Route path="/you/password" element={<ChangePasswordPage />} />
      <Route path="/you/security" element={<p>security page</p>} />
    </Routes>
  );

  it.each([
    ['an OIDC account', { authProvider: 'oidc' }],
    ['a password-locked account', { passwordLocked: true }],
    ['a passkey-only account', { passwordLoginDisabled: true }],
  ])('%s goes to Sign-in & security', async (_, user) => {
    renderAccount(routed(), '/you/password', { user });
    expect(await screen.findByText('security page')).toBeInTheDocument();
    expect(screen.queryByLabelText('New Password')).toBeNull();
  });

  it('a local account gets the form', async () => {
    renderAccount(routed(), '/you/password');
    expect(await screen.findByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.queryByText('security page')).toBeNull();
  });

  it('forced, even a passkey-only account gets the forced form', async () => {
    renderAccount(routed(), '/you/password', { user: { passwordLoginDisabled: true }, passwordChangeRequired: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.queryByText('security page')).toBeNull();
  });
});
