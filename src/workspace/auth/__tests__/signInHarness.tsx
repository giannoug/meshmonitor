/**
 * Renders the Workspace sign-in (Task 6.2) against `signInFixtures`, with
 * WebAuthn on (the passkey button shows) and `location.reload` stubbed:
 * every sign-in that works reloads the page, which jsdom cannot.
 */
import type { ReactElement } from 'react';
import { onTestFinished, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { withWebAuthn } from '../../you/__tests__/accountHarness';
import { signInFixtures } from '../../__fixtures__/signIn';
import SignInPage from '../SignInPage';

export function stubLocation() {
  const location = window.location;
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { ...location, reload }, writable: true });
  onTestFinished(() => void Object.defineProperty(window, 'location', { value: location, writable: true }));
  return reload;
}

export function renderSignIn(
  ui: ReactElement = <SignInPage />,
  { fixtures = signInFixtures(), webauthn = true, ...opts }: RenderWorkspaceOptions & { webauthn?: boolean } = {},
) {
  if (webauthn) withWebAuthn();
  const reload = stubLocation();
  return { reload, ...renderWorkspace(ui, { anonymous: true, ...opts, fixtures }) };
}

/** Types the username and password and presses today's Login. */
export async function submitPassword(username = 'giannoug', pass = 'pw') {
  fireEvent.change(await screen.findByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: pass } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
}

/** Every request the page made, as `METHOD /path` (no query). */
export function requests(): string[] {
  return (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls.map(([input, init]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://x');
    return `${init?.method ?? 'GET'} ${url.pathname}`;
  });
}

/** Request bodies sent to `path`. */
export function bodies(path: string): unknown[] {
  return (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls
    .filter(([input]) => String(input).includes(path))
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
}
