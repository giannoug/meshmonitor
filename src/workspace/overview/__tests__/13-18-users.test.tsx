/**
 * @vitest-environment jsdom
 *
 * Board 13-18-users (phone, s13n7): Overview › Users under Home, the list with
 * search and Add User, and a user's Manage sheet: Administrator, Password,
 * Password changes locked, Passkeys, Permissions (q4), and the Danger Zone.
 * Escape closes only the top layer (Ruling CR).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { openUser, renderUsers, writes } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function manage(user: string) {
  renderUsers('/overview/users', { phone: true });
  await openUser(user);
  return screen.findByRole('dialog', { name: user }, { timeout: 5000 });
}

const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

describe('13-18-users', () => {
  it('13-18-users shows the board', async () => {
    await manage('Field team');
    expectBoard('13-18-users', document.body);
  });

  it('the page has its own header and the count line; search narrows the list', async () => {
    renderUsers('/overview/users', { phone: true });
    expect(await screen.findByRole('link', { name: 'Overview' }, { timeout: 5000 })).toHaveAttribute('href', '/overview');
    expect(await screen.findByText('Overview · admins only · 6 users, 1 inactive')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search users' }), { target: { value: 'field' } });
    const list = screen.getByRole('list', { name: 'Users' });
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      expect.stringContaining('Field team'),
    ]);
  });

  it('the sheet carries today\'s summary and the rows', async () => {
    const sheet = await manage('Field team');
    expect(sheet).toHaveTextContent('Field team · field@athensmesh.gr');
    expect(sheet).toHaveTextContent('LOCAL · Active');
    expect(within(sheet).getByRole('button', { name: 'Make Admin' })).toBeInTheDocument();
    expect(within(sheet).getByRole('switch', { name: 'Password changes locked' })).toHaveAttribute('aria-checked', 'false');
  });

  it('Escape over the passkeys dialog closes only the dialog', async () => {
    const sheet = await manage('Field team');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Passkeys/ }));
    await screen.findByRole('dialog', { name: 'Passkeys for field-team' });
    escape();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Passkeys for field-team' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Field team' })).toBeInTheDocument();
  });

  it('Escape over the deactivate confirm closes only the confirm, and sends nothing', async () => {
    const sheet = await manage('Field team');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Deactivate User' }));
    await screen.findByRole('dialog', { name: 'Deactivate User?' });
    escape();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Deactivate User?' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Field team' })).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('Permissions opens the device chips page (q4)', async () => {
    const sheet = await manage('nikos');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Permissions/ }));
    expect(await screen.findByRole('heading', { name: 'nikos' })).toBeInTheDocument();
    expect(await screen.findByText('On Station G2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'nikos' })).toBeNull();
  });
});
