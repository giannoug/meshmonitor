/**
 * @vitest-environment jsdom
 *
 * Board 11-07 (phone), Task 6.2: the phone sign-in page, rate limited: the
 * brand row, today's Login heading, the error first, then the same controls
 * as 11-01, and the footer.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { signInFixtures } from '../../__fixtures__/signIn';
import SignInPage from '../SignInPage';
import { renderSignIn, submitPassword } from './signInHarness';

describe('11-07-sign-in', () => {
  it('11-07-sign-in shows the board', async () => {
    const { container } = renderSignIn(<SignInPage />, { phone: true, fixtures: signInFixtures({ login: 'rate-limited' }) });
    await screen.findByText('Privacy Policy');
    await submitPassword();
    await screen.findByRole('alert');
    expectBoard('11-07-sign-in', container);
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(container.querySelector('[data-phone]')).not.toBeNull();
  });
});
