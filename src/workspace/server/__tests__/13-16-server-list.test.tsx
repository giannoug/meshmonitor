/**
 * @vitest-environment jsdom
 *
 * Board 13-16 (Task 6.4): on phone, Server is a page under You (s13n7) that
 * lists the categories the user can open, and says what a non-admin sees.
 */
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

describe('13-16-server-list', () => {
  it('13-16-server-list shows the board', async () => {
    const { container } = renderServer('/server', { phone: true });
    await screen.findByText('Notification services');
    expectBoard('13-16-server-list', container);
    expect(screen.getAllByRole('link', { name: /You/ }).some((a) => a.getAttribute('href') === '/you')).toBe(true);
    expect(screen.getByRole('link', { name: /Channel database/ })).toHaveAttribute('href', '/server/channel-database');
  });

  it('a settings viewer gets Security & privacy (the hosted documents) and Backup & maintenance', async () => {
    renderServer('/server', { phone: true, permissions: grants({ read: true }) });
    const row = await screen.findByRole('link', { name: /Backup & maintenance/ });
    const card = row.parentElement as HTMLElement;
    expect(within(card).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/server/security', '/server/backup']);
  });

  it('a phone category page goes back to the list', async () => {
    renderServer('/server/backup', { phone: true });
    expect(await screen.findByRole('link', { name: /Server/ })).toHaveAttribute('href', '/server');
  });
});
