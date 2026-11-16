/**
 * Renders a You account page (Task 6.1) inside the shell against
 * `accountFixtures`, and makes this jsdom a secure context with WebAuthn so
 * the passkey controls show (the browser prompt itself is mocked per file).
 */
import type { ReactElement } from 'react';
import { onTestFinished } from 'vitest';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture } from '../../__fixtures__/athens';
import { accountFixtures, type AccountOptions } from '../../__fixtures__/account';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';

export function withWebAuthn() {
  const prev = { secure: window.isSecureContext, pkc: (window as { PublicKeyCredential?: unknown }).PublicKeyCredential };
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(window, 'PublicKeyCredential', { value: function PublicKeyCredential() {}, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(window, 'isSecureContext', { value: prev.secure, configurable: true });
    Object.defineProperty(window, 'PublicKeyCredential', { value: prev.pkc, configurable: true });
  });
}

export interface AccountRenderOptions extends RenderWorkspaceOptions {
  account?: AccountOptions;
  /** Overrides on the signed-in user (authProvider, passwordLoginDisabled …). */
  user?: Record<string, unknown>;
  passwordChangeRequired?: boolean;
}

export function renderAccount(page: ReactElement, route: string, { account, user, passwordChangeRequired, fixtures, ...opts }: AccountRenderOptions = {}) {
  withWebAuthn();
  const base = athensFixture.authStatus;
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>{page}</WorkspaceShell>
    </ToastProvider>,
    {
      route,
      ...opts,
      fixtures: {
        ...accountFixtures(account),
        ...(user || passwordChangeRequired
          ? { 'GET /api/auth/status': () => ({ ...base, user: { ...base.user!, ...user }, passwordChangeRequired }) }
          : {}),
        ...fixtures,
      },
    },
  );
}

/** Collects text across a board's states (D9c, Ruling 2.3's way) for one expectBoard check. */
export function joined(texts: string[]): HTMLElement {
  const all = document.createElement('div');
  all.textContent = texts.join(' ');
  return all;
}
