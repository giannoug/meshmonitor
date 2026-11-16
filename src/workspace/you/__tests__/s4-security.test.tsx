/**
 * @vitest-environment jsdom
 *
 * Board s4-security (Task 6.1): You › Sign-in & security on a phone, under
 * the tab bar, with the way back to You.
 */
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import SecurityPage from '../SecurityPage';
import { renderAccount } from './accountHarness';

describe('s4-security', () => {
  it('s4-security shows the board', async () => {
    const { container } = renderAccount(<SecurityPage />, '/you/security', { phone: true });
    await screen.findByText('Work laptop');
    await screen.findByText('Revoke Token');
    expectBoard('s4-security', container);
  });

  it('leads back to You and on to Change Password', async () => {
    renderAccount(<SecurityPage />, '/you/security', { phone: true });
    const head = (await screen.findByRole('heading', { level: 1, name: 'Sign-in & security' })).parentElement!;
    expect(within(head).getByRole('link', { name: 'You' })).toHaveAttribute('href', '/you');
    expect(await screen.findByRole('link', { name: /Change Password/ })).toHaveAttribute('href', '/you/password');
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
