/**
 * @vitest-environment jsdom
 *
 * Board 11-09 (phone), Task 6.2: "Lost your passkey? Use a recovery code"
 * opens today's username + code step; a code that works reloads the page, and
 * the reload lands on Task 6.1's forced "Choose a new password" sheet (no
 * close, no cancel). Built one at a time (D9c): the step, then the reload.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../you/__tests__/accountHarness';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture } from '../../__fixtures__/athens';
import { signInFixtures, TYPED_RECOVERY } from '../../__fixtures__/signIn';
import WorkspaceApp from '../../WorkspaceApp';
import SignInPage from '../SignInPage';
import { bodies, renderSignIn } from './signInHarness';

async function openRecovery(opts: { recover?: 'ok' | 'invalid' } = {}) {
  const r = renderSignIn(<SignInPage />, { phone: true, fixtures: signInFixtures(opts) });
  fireEvent.click(await screen.findByRole('button', { name: 'Lost your passkey? Use a recovery code' }));
  const form = await screen.findByRole('form', { name: 'Sign in with a recovery code' });
  return { ...r, form };
}

function fill(form: HTMLElement, username: string, code: string) {
  fireEvent.change(within(form).getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(within(form).getByLabelText('Recovery code'), { target: { value: code } });
  fireEvent.click(within(form).getByRole('button', { name: 'Sign in' }));
}

describe('11-09-recovery-code', () => {
  it('11-09-recovery-code shows the board', async () => {
    const texts: string[] = [];
    const step = await openRecovery();
    texts.push(step.container.textContent ?? '');
    step.unmount();
    // After the reload: the recovered session must choose a new password.
    renderWorkspace(<WorkspaceApp />, {
      route: '/you',
      phone: true,
      fixtures: { 'GET /api/auth/status': () => ({ ...athensFixture.authStatus, passwordChangeRequired: true }) },
    });
    const sheet = await screen.findByRole('dialog', { name: 'Choose a new password' });
    texts.push(sheet.textContent ?? '');
    expectBoard('11-09-recovery-code', joined(texts));
    expect(within(sheet).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('sends today\'s request, trimmed, and reloads', async () => {
    const { form, reload } = await openRecovery();
    fill(form, '  giannoug ', ` ${TYPED_RECOVERY} `);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(bodies('/api/auth/passkey/recover')).toEqual([{ username: 'giannoug', code: TYPED_RECOVERY }]);
  });

  it('a code that does not work: today\'s one message, and the code is cleared', async () => {
    const { form } = await openRecovery({ recover: 'invalid' });
    fill(form, 'giannoug', TYPED_RECOVERY);
    expect(await within(form).findByRole('alert')).toHaveTextContent('That username and code did not work.');
    expect(within(form).getByLabelText('Recovery code')).toHaveValue('');
  });

  it('Cancel goes back to the sign-in form and drops the code', async () => {
    const { form } = await openRecovery();
    fireEvent.change(within(form).getByLabelText('Recovery code'), { target: { value: TYPED_RECOVERY } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lost your passkey? Use a recovery code' }));
    const again = await screen.findByRole('form', { name: 'Sign in with a recovery code' });
    expect(within(again).getByLabelText('Recovery code')).toHaveValue('');
  });
});
