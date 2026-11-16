/**
 * @vitest-environment jsdom
 *
 * Board 11-06 (Task 6.1): You › Change password, today's checks and words
 * over POST /api/auth/change-password, and the forced "Choose a new password"
 * after a recovery-code sign-in: no current password, no Cancel, no close.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
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
  });
});
