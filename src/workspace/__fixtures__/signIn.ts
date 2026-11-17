/**
 * Task 6.2 sign-in fixtures: an install with anonymous viewing off, the
 * boards' custom title, OIDC on, and the three hosted privacy documents.
 * `signInFixtures` answers the auth API the way the server does for each of
 * today's outcomes (11-01 states, 11-02 invalid code, 11-09 recovery code).
 */
import type { AuthStatus } from '../../contexts/AuthContext';
import { athensFixture } from './athens';
import type { FixtureHandler } from './fixtureApi';

export const CUSTOM_TITLE = 'Athens Mesh Watch';
/** Test-only values typed into the forms; never real secrets. */
export const TYPED_PASS = 'pw-typed-in-test';
export const TYPED_CODE = '482913';
export const TYPED_RECOVERY = '7KQ2-M9XD';

export const signedOut = (over: Partial<AuthStatus> = {}): AuthStatus => ({
  ...athensFixture.authStatus,
  authenticated: false,
  user: null,
  anonymousDisabled: true,
  oidcEnabled: true,
  customTitle: CUSTOM_TITLE,
  ...over,
});

export const PRIVACY_LINKS = {
  success: true,
  data: [
    { slug: 'privacy', kind: 'hosted' },
    { slug: 'terms', kind: 'hosted' },
    { slug: 'contact', kind: 'hosted' },
  ],
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** How `POST /api/auth/login` answers. */
export type LoginOutcome = 'ok' | 'mfa' | 'invalid' | 'rate-limited' | 'csrf' | 'cookie';

export function signInFixtures({
  status = signedOut(),
  login = 'invalid',
  mfa = 'invalid',
  recover = 'ok',
}: {
  status?: AuthStatus;
  login?: LoginOutcome;
  mfa?: 'ok' | 'invalid';
  recover?: 'ok' | 'invalid';
} = {}): Record<string, FixtureHandler> {
  // A sign-in that worked sets the session; 'cookie' answers success but the browser never sends it back.
  let session: AuthStatus | null = null;
  const signIn = (over: Partial<AuthStatus> = {}) => void (session = { ...athensFixture.authStatus, ...over });
  return {
    'GET /api/auth/status': () => session ?? status,
    'GET /api/privacy/links': () => PRIVACY_LINKS,
    'POST /api/auth/login': () => {
      switch (login) {
        case 'ok':
          signIn();
          return { success: true, user: athensFixture.authStatus.user };
        case 'cookie':
          return { success: true, user: athensFixture.authStatus.user };
        case 'mfa':
          return { requireMfa: true };
        case 'rate-limited':
          return json(429, { error: 'Too many requests', retryAfterSeconds: 840 });
        case 'csrf':
          return json(403, { error: 'Invalid CSRF token', code: 'CSRF_TOKEN_INVALID' });
        default:
          return json(401, { error: 'Invalid credentials' });
      }
    },
    'POST /api/auth/verify-mfa': () => {
      if (mfa !== 'ok') return json(401, { error: 'Invalid code' });
      signIn();
      return { success: true, user: athensFixture.authStatus.user };
    },
    'POST /api/auth/passkey/recover': () => {
      if (recover !== 'ok') return json(401, { error: 'Invalid' });
      signIn({ passwordChangeRequired: true });
      return { success: true };
    },
    'GET /api/auth/oidc/login': () => ({ authUrl: '#oidc-provider' }),
  };
}
