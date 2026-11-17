/**
 * @vitest-environment jsdom
 *
 * Board 11-08 (phone), Task 6.2: the two-factor step on the phone page, the
 * same controls as 11-02 at phone size (44 px targets).
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { signInFixtures } from '../../__fixtures__/signIn';
import SignInPage from '../SignInPage';
import { renderSignIn, submitPassword } from './signInHarness';

describe('11-08-two-factor-step', () => {
  it('11-08-two-factor-step shows the board', async () => {
    const { container } = renderSignIn(<SignInPage />, { phone: true, fixtures: signInFixtures({ login: 'mfa' }) });
    await submitPassword();
    await screen.findByText('Enter the 6-digit code from your authenticator app.');
    expectBoard('11-08-two-factor-step', container);
    expect(container.querySelector('[data-phone]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeInTheDocument();
  });
});
