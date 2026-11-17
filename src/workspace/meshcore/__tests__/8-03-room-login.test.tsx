/**
 * @vitest-environment jsdom
 *
 * Board 8-03 (desktop): Kifisia BBS, not logged in, password saved. The login
 * card (password, Remember, Login / Log in with saved password, Forget),
 * today's progress (attempt N of 3 with its countdown and Cancel) with its
 * Sends line, the refused-login hint, and Auto-sync bound to today's setting.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/room/${MC.kifisia}`;

describe('8-03-room-login', () => {
  it('8-03-room-login shows the board', async () => {
    const { container } = renderMeshCore(route, { meshcore: { login: 'hang' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Log in with saved password' }));
    await screen.findByText(/Attempt 2 of 3: waiting for a reply \(1[0-4] s left\)/, undefined, { timeout: 3000 });
    expectBoard('8-03-room-login', container);
  });

  it('the password is a password field, and Login is off while the saved one would be used', async () => {
    renderMeshCore(route);
    const field = await screen.findByLabelText('Password (empty for guest)');
    expect(field).toHaveAttribute('type', 'password');
    const card = field.closest('div')!.parentElement!;
    expect(within(card).getByRole('button', { name: 'Login' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'hunter2' } });
    expect(within(card).getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  it('a login sends one request, and the password never reaches the URL or the page', async () => {
    const { log } = renderMeshCore(route, { meshcore: { login: 'no_reply' } });
    const field = await screen.findByLabelText('Password (empty for guest)');
    fireEvent.change(field, { target: { value: 'hunter2' } });
    fireEvent.click(within(screen.getByRole('heading', { name: 'Log in to read posts' }).parentElement!).getByRole('button', { name: 'Login' }));
    await screen.findByText(/no longer in the room’s access list/);
    expect(log.writes.filter((w) => w.path.endsWith('/rooms/login'))).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('hunter2'))).toBe(false);
    expect(document.body.textContent).not.toContain('hunter2');
  });

  it('auto-sync shows today\'s interval with its Sends line, and saving it arms nothing', async () => {
    const { log } = renderMeshCore(route);
    const card = await screen.findByRole('region', { name: 'Auto-sync' });
    expect(await within(card).findByText('Sends 1 login to Kifisia BBS every 6 h while on')).toBeInTheDocument();
    expect(within(card).getByRole('combobox', { name: /Re-login every/ })).toHaveDisplayValue('Every 6 h');
    fireEvent.change(within(card).getByRole('combobox', { name: /Re-login every/ }), { target: { value: '480' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/rooms/sync-config'))).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ publicKey: MC.kifisia, enabled: true, intervalMinutes: 480 });
    // A save is a settings write: no login goes out, now or on a re-render.
    expect(requests('POST', /\/rooms\/login/)).toBe(0);
  });
});
