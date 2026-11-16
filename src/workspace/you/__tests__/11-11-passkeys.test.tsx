/**
 * @vitest-environment jsdom
 *
 * Board 11-11 (Task 6.1): Passkeys, renamed in place (64 characters, with a
 * counter) and deleted behind a ConfirmSheet with today's words. The server
 * decides what may go: the last passkey while password sign-in is off is
 * refused with today's LAST_PASSKEY message, and the sheet stays open.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { PASSKEYS } from '../../__fixtures__/account';
import SecurityPage from '../SecurityPage';
import { joined, renderAccount } from './accountHarness';

const lastPasskey = () =>
  new Response(JSON.stringify({ success: false, error: 'Last passkey', code: 'LAST_PASSKEY' }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

const passwordOff = {
  phone: true,
  user: { passwordLoginDisabled: true },
  account: { passwordLoginDisabled: true, recoveryCodesLeft: 10, passkeys: [PASSKEYS[1]] },
  fixtures: { 'DELETE /api/auth/passkey/:id': lastPasskey },
};

describe('11-11-passkeys', () => {
  it('11-11-passkeys shows the board', async () => {
    const texts: string[] = [];
    const { container } = renderAccount(<SecurityPage />, '/you/security', passwordOff);
    const row = await screen.findByTestId('passkey-row');
    texts.push(container.textContent ?? '');
    fireEvent.click(within(row).getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Passkey name'), { target: { value: 'Pixel 9 work phone' } });
    texts.push(container.textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(await screen.findByTestId('passkey-row')).getByRole('button', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete this passkey?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await screen.findByText(/This is your only passkey/);
    texts.push(document.body.textContent ?? '');
    expectBoard('11-11-passkeys', joined(texts));
  });

  it('rename counts to 64 and saves today\'s request', async () => {
    const bodies: unknown[] = [];
    renderAccount(<SecurityPage />, '/you/security', {
      fixtures: { 'PATCH /api/auth/passkey/:id': (u, init) => { bodies.push([u.pathname, JSON.parse(String(init?.body))]); return { success: true, data: PASSKEYS[0] }; } },
    });
    const [row] = await screen.findAllByTestId('passkey-row');
    fireEvent.click(within(row).getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Passkey name');
    expect(input).toHaveAttribute('maxLength', '64');
    expect(screen.getByText('11 / 64')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: ' Desk laptop ' } });
    expect(screen.getByText('13 / 64')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bodies).toEqual([['/api/auth/passkey/1', { nickname: 'Desk laptop' }]]));
  });

  it('delete confirms first, then sends today\'s request', async () => {
    const deleted: string[] = [];
    renderAccount(<SecurityPage />, '/you/security', {
      fixtures: { 'DELETE /api/auth/passkey/:id': (u) => { deleted.push(u.pathname); return { success: true }; } },
    });
    const [, second] = await screen.findAllByTestId('passkey-row');
    fireEvent.click(within(second).getByRole('button', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete this passkey?' });
    expect(deleted).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toEqual(['/api/auth/passkey/2']));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Passkey deleted')).toBeInTheDocument();
  });

  it('the last passkey with password sign-in off: today\'s LAST_PASSKEY message, the sheet stays', async () => {
    renderAccount(<SecurityPage />, '/you/security', passwordOff);
    fireEvent.click(within(await screen.findByTestId('passkey-row')).getByRole('button', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete this passkey?' });
    // Not blocked on the client: the server's refusal says why.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('This is your only passkey and password sign-in is off. Turn password sign-in back on first.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete this passkey?' })).toBeInTheDocument();
    expect(screen.getByText('Pixel 9')).toBeInTheDocument();
  });

  it('Add a passkey asks for a nickname first', async () => {
    renderAccount(<SecurityPage />, '/you/security');
    fireEvent.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    expect(screen.getByLabelText('Passkey name')).toHaveAttribute('placeholder', 'Name (e.g. Work laptop)');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});
