/**
 * @vitest-environment jsdom
 *
 * Board 11-01 (desktop), Task 6.2: the full-page sign-in when anonymous
 * viewing is off (s11n0). Today's LoginPage, redrawn: the custom title and
 * logo, the passkey first, Username / Password, today's Login, the recovery
 * code, Login with OIDC, then the version, GitHub and the privacy links.
 * Errors are today's, word for word, one at a time (the board's side panel).
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../you/__tests__/accountHarness';
import { CUSTOM_TITLE, signedOut, signInFixtures, TYPED_PASS, type LoginOutcome } from '../../__fixtures__/signIn';
import SignInPage from '../SignInPage';
import { bodies, renderSignIn, requests, submitPassword } from './signInHarness';

const SESSION_EXPIRED = 'Your session has expired. Please refresh the page and try again.';

async function errorFor(login: LoginOutcome) {
  const r = renderSignIn(<SignInPage />, { fixtures: signInFixtures({ login }) });
  await screen.findByText('Privacy Policy');
  await submitPassword('giannoug', TYPED_PASS);
  const alert = await screen.findByRole('alert');
  return { ...r, alert };
}

describe('11-01-sign-in', () => {
  it('11-01-sign-in shows the board', async () => {
    const texts: string[] = [];
    for (const login of ['invalid', 'rate-limited', 'csrf', 'cookie'] as const) {
      const { container, unmount } = await errorFor(login);
      texts.push(container.textContent ?? '');
      unmount();
    }
    const off = renderSignIn(<SignInPage />, { fixtures: signInFixtures({ status: signedOut({ localAuthDisabled: true, oidcEnabled: false }) }) });
    await screen.findByText(/OIDC is not configured/);
    texts.push(off.container.textContent ?? '');
    expectBoard('11-01-sign-in', joined(texts));
  });

  it('shows the custom title, the passkey first, and the footer', async () => {
    const { container } = renderSignIn();
    expect(await screen.findByRole('heading', { name: CUSTOM_TITLE })).toBeInTheDocument();
    await screen.findByText('Privacy Policy');
    const buttons = within(container).getAllByRole('button').map((b) => b.textContent);
    expect(buttons[0]).toBe('Sign in with a passkey');
    expect(screen.getByRole('link', { name: /View on GitHub/ })).toHaveAttribute('href', 'https://github.com/yeraze/meshmonitor');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/privacy/terms');
    expect(screen.getByText(/^Version /)).toBeInTheDocument();
    // The username field offers saved passkeys (conditional UI), as today.
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username webauthn');
  });

  it('uses the custom logo when set, else today\'s mark', async () => {
    renderSignIn(<SignInPage />, { fixtures: signInFixtures({ status: signedOut({ customLogoUrl: 'https://example.org/logo.png' }) }) });
    expect(await screen.findByRole('img', { name: CUSTOM_TITLE })).toHaveAttribute('src', 'https://example.org/logo.png');
  });

  it('falls back to MeshMonitor without a custom title', async () => {
    renderSignIn(<SignInPage />, { fixtures: signInFixtures({ status: signedOut({ customTitle: null }) }) });
    expect(await screen.findByRole('heading', { name: 'MeshMonitor' })).toBeInTheDocument();
  });

  it('sends today\'s login request and shows today\'s words for each error', async () => {
    const invalid = await errorFor('invalid');
    expect(invalid.alert).toHaveTextContent('Invalid username or password');
    expect(bodies('/api/auth/login')).toEqual([{ username: 'giannoug', password: TYPED_PASS }]);
    invalid.unmount();

    expect((await errorFor('rate-limited')).alert).toHaveTextContent('Too many login attempts. Please try again in 14 minute(s).');
  });

  it('session expired offers Reload, which reloads the page', async () => {
    const { alert, reload } = await errorFor('csrf');
    expect(alert).toHaveTextContent(SESSION_EXPIRED);
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a cookie the browser did not keep shows today\'s message, and no Reload', async () => {
    const { alert } = await errorFor('cookie');
    expect(alert).toHaveTextContent(/Session cookie not working/);
    expect(within(alert).queryByRole('button')).toBeNull();
  });

  it('a sign-in that works reloads the page, as today', async () => {
    const { reload } = renderSignIn(<SignInPage />, { fixtures: signInFixtures({ login: 'ok' }) });
    await submitPassword();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(requests().filter((r) => r.startsWith('POST'))).toEqual(['POST /api/auth/login']);
  });

  it('Login with OIDC redirects to the provider, and shows only when OIDC is on', async () => {
    renderSignIn();
    fireEvent.click(await screen.findByRole('button', { name: 'Login with OIDC' }));
    await waitFor(() => expect(window.location.href).toBe('#oidc-provider'));
    expect(requests()).toContain('GET /api/auth/oidc/login');
  });

  it('no OIDC, no OIDC button; no WebAuthn, no passkey button', async () => {
    renderSignIn(<SignInPage />, { webauthn: false, fixtures: signInFixtures({ status: signedOut({ oidcEnabled: false }) }) });
    await screen.findByLabelText('Username');
    expect(screen.queryByRole('button', { name: 'Login with OIDC' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in with a passkey' })).toBeNull();
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username');
  });

  it('local sign-in off: only OIDC, no passkey and no recovery code', async () => {
    renderSignIn(<SignInPage />, { fixtures: signInFixtures({ status: signedOut({ localAuthDisabled: true }) }) });
    expect(await screen.findByRole('button', { name: 'Login with OIDC' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in with a passkey' })).toBeNull();
    expect(screen.queryByText('Lost your passkey? Use a recovery code')).toBeNull();
  });

  it('never puts the password in a URL or in storage', async () => {
    await errorFor('invalid');
    const calls = (globalThis.fetch as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls;
    expect(calls.some(([u]) => String(u).includes(TYPED_PASS))).toBe(false);
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) expect(store.getItem(store.key(i)!)).not.toContain(TYPED_PASS);
    }
  });
});
