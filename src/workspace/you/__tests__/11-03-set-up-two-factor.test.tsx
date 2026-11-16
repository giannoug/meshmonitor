/**
 * @vitest-environment jsdom
 *
 * Boards 11-03 (desktop) and 11-10 (phone), Task 6.1: Set up two-factor in
 * place of Sign-in & security, today's three steps over /api/mfa/*. The key,
 * QR and backup codes are shown once and are gone from the page once setup
 * ends, whichever way.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { BACKUP_CODES, TOTP_KEY } from '../../__fixtures__/account';
import SecurityPage from '../SecurityPage';
import { renderAccount } from './accountHarness';

const posts: Array<{ path: string; body: unknown }> = [];
const record = (path: string) => (_u: URL, init?: RequestInit) => {
  posts.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  return path.endsWith('setup') && !path.includes('verify') ? undefined : { success: true };
};

async function openSetup(phone: boolean) {
  posts.length = 0;
  const r = renderAccount(<SecurityPage />, '/you/security', {
    phone,
    account: { mfa: false },
    fixtures: { 'POST /api/mfa/verify-setup': record('/api/mfa/verify-setup') },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Enable Two-Factor Authentication' }));
  await screen.findByText(TOTP_KEY);
  return r;
}

describe('11-03-set-up-two-factor', () => {
  it('11-03-set-up-two-factor shows the board', async () => {
    const { container } = await openSetup(false);
    expectBoard('11-03-set-up-two-factor', container);
  });

  it('11-10-set-up-two-factor shows the board', async () => {
    const { container } = await openSetup(true);
    expectBoard('11-10-set-up-two-factor', container);
  });

  it('shows the key and the backup codes once, each with Copy', async () => {
    await openSetup(false);
    expect(screen.getByRole('img', { name: 'QR Code for authenticator app' })).toBeInTheDocument();
    for (const code of BACKUP_CODES) expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getAllByText('Shown once')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Copy All Codes' })).toBeInTheDocument();
    // The backup codes stay until Verify: no Done on their card.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('Verify sends the code and turns two-factor on; the secrets leave the page', async () => {
    await openSetup(false);
    const verify = screen.getByRole('button', { name: 'Verify' });
    expect(verify).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '482913' } });
    fireEvent.click(verify);
    await waitFor(() => expect(posts).toEqual([{ path: '/api/mfa/verify-setup', body: { token: '482913' } }]));
    expect(await screen.findByRole('button', { name: 'Disable Two-Factor Authentication' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TOTP_KEY);
    expect(document.body.textContent).not.toContain(BACKUP_CODES[0]);
  });

  it('Cancel drops the setup and its secrets', async () => {
    await openSetup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Enable Two-Factor Authentication' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TOTP_KEY);
    expect(document.body.textContent).not.toContain(BACKUP_CODES[0]);
    expect(posts).toEqual([]);
  });

  it('phone: the back control cancels the setup', async () => {
    await openSetup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sign-in & security' }));
    expect(await screen.findByRole('button', { name: 'Enable Two-Factor Authentication' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TOTP_KEY);
  });
});
