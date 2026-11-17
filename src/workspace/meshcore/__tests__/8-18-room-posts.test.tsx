/**
 * @vitest-environment jsdom
 *
 * Board 8-18 (phone): Athens Room's posts after a login, with the composer.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { syncRoomSessionsOwner } from '../roomSessions';
import { HELTEC, renderMeshCore } from './renderMeshCore';

// Logins live for the session; each test starts logged out.
afterEach(() => syncRoomSessionsOwner('test-reset'));

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-18-room-posts', () => {
  it('8-18-room-posts shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/room/${MC.athensRoom}`, { phone: true });
    const card = (await screen.findByRole('heading', { name: 'Log in to read posts' })).parentElement!;
    fireEvent.click(within(card).getByRole('button', { name: 'Login' }));
    await screen.findByRole('button', { name: 'Log out' });
    await screen.findByText('Meetup Saturday 11:00 at the Psychiko park, bring radios.');
    expect(screen.getByPlaceholderText('Post to Athens Room')).toBeInTheDocument();
    expectBoard('8-18-room-posts', container);
  });
});
