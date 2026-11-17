/**
 * @vitest-environment jsdom
 *
 * Board 11-02 (desktop), Task 6.2: the two-factor step after a password the
 * server accepted with MFA on. Today's order and words: the 6-digit code (or a
 * backup code), Verify, the toggle, Back. A wrong code shows today's "Invalid
 * code" and clears the field; Back clears the password and the code.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../you/__tests__/accountHarness';
import { signInFixtures, TYPED_CODE, TYPED_PASS } from '../../__fixtures__/signIn';
import SignInPage from '../SignInPage';
import { bodies, renderSignIn, requests, submitPassword } from './signInHarness';

async function toMfa(opts: { phone?: boolean; mfa?: 'ok' | 'invalid' } = {}) {
  const r = renderSignIn(<SignInPage />, { phone: opts.phone, fixtures: signInFixtures({ login: 'mfa', mfa: opts.mfa }) });
  await submitPassword('giannoug', TYPED_PASS);
  await screen.findByText('Enter the 6-digit code from your authenticator app.');
  return r;
}

function verify(code: string) {
  fireEvent.change(screen.getByLabelText(/Authenticator Code|Backup Code/), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('11-02-two-factor-step', () => {
  it('11-02-two-factor-step shows the board', async () => {
    const texts: string[] = [];
    const { container } = await toMfa();
    verify(TYPED_CODE);
    await screen.findByRole('alert');
    texts.push(container.textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'Use a backup code' }));
    await screen.findByLabelText('Backup Code');
    texts.push(container.textContent ?? '');
    expectBoard('11-02-two-factor-step', joined(texts));
  });

  it('sends the code as today: token, or backupCode after the toggle', async () => {
    await toMfa();
    verify(TYPED_CODE);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code. Please try again.');
    // A wrong code clears the field.
    expect(screen.getByLabelText('Authenticator Code')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Use a backup code' }));
    // The toggle clears the error.
    expect(screen.queryByRole('alert')).toBeNull();
    verify('k7m2x9qa');
    await screen.findByRole('alert');
    expect(bodies('/api/auth/verify-mfa')).toEqual([{ token: TYPED_CODE }, { backupCode: 'k7m2x9qa' }]);
    expect(requests().filter((r) => r.startsWith('POST'))).toEqual(['POST /api/auth/login', 'POST /api/auth/verify-mfa', 'POST /api/auth/verify-mfa']);
  });

  it('a 6-digit field, an 8-character backup field', async () => {
    await toMfa();
    const code = screen.getByLabelText('Authenticator Code');
    expect(code).toHaveAttribute('maxLength', '6');
    expect(code).toHaveAttribute('inputMode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use a backup code' }));
    expect(screen.getByLabelText('Backup Code')).toHaveAttribute('maxLength', '8');
    expect(screen.getByText('8 characters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use authenticator code' }));
    expect(screen.getByLabelText('Authenticator Code')).toBeInTheDocument();
  });

  it('Back returns to the form with the password and code cleared', async () => {
    await toMfa();
    fireEvent.change(screen.getByLabelText('Authenticator Code'), { target: { value: '48' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('giannoug');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await screen.findByLabelText('Authenticator Code');
    expect(screen.getByLabelText('Authenticator Code')).toHaveValue('');
  });

  it('a right code reloads the page', async () => {
    const { reload } = await toMfa({ mfa: 'ok' });
    verify(TYPED_CODE);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});
