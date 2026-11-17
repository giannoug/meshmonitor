/**
 * @vitest-environment jsdom
 *
 * Board 8-04 (desktop): Athens Room logged in. Header (Logged in · posts ·
 * Last post, Mute, Log out), the posts with the Unread posts line, the
 * composer (Post to Athens Room, byte counter, Sends line), and the Rooms ⋯
 * menu (Sort rooms by …, Mark all as Read).
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { MC } from '../../__fixtures__/meshcore';
import { syncRoomSessionsOwner } from '../roomSessions';
import { HELTEC, renderMeshCore } from './renderMeshCore';

// Logins live for the session; each test starts logged out.
afterEach(() => syncRoomSessionsOwner('test-reset'));

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/room/${MC.athensRoom}`;

async function logIn() {
  const card = (await screen.findByRole('heading', { name: 'Log in to read posts' })).parentElement!;
  fireEvent.click(within(card).getByRole('button', { name: 'Login' }));
  await screen.findByRole('button', { name: 'Log out' });
}

describe('8-04-room-posts', () => {
  it('8-04-room-posts shows the board', async () => {
    const { container } = renderMeshCore(route);
    await logIn();
    await screen.findByText('Meetup Saturday 11:00 at the Psychiko park, bring radios.');
    const page = container.textContent ?? '';
    const side = screen.getByRole('complementary', { name: 'Heltec MeshCore' });
    fireEvent.click(within(side).getByRole('button', { name: 'Sort rooms by' }));
    const menu = await screen.findByRole('menu', { name: 'Sort rooms by' });
    // The composer's "Post to Athens Room" is its placeholder (Ruling 7.1 8-04).
    expect(screen.getByPlaceholderText('Post to Athens Room')).toBeInTheDocument();
    expectBoard('8-04-room-posts', joined(page, menu));
  });

  it('a guest login sends one request, then the composer posts once', async () => {
    const { log } = renderMeshCore(route);
    await logIn();
    expect(log.writes.filter((w) => w.path.endsWith('/rooms/login'))).toHaveLength(1);
    expect(screen.getByText('Sends 1 post to Athens Room; the room stores it for its members')).toBeInTheDocument();
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'Count me in for Saturday' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/rooms/post'))).toHaveLength(1));
    expect(log.writes.find((w) => w.path.endsWith('/rooms/post'))!.body).toEqual({ roomPublicKey: MC.athensRoom, text: 'Count me in for Saturday' });
  });

  it('logged in with configuration:write, Auto-sync is one tap away and saves once per change', async () => {
    const { log } = renderMeshCore(route);
    await logIn();
    fireEvent.click(screen.getByRole('button', { name: 'Auto-sync' }));
    const sheet = await screen.findByRole('dialog', { name: 'Auto-sync' });
    fireEvent.click(within(sheet).getByRole('switch'));
    expect(within(sheet).getByText('Sends 1 login to Athens Room every 1 h while on')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/rooms/sync-config'))).toHaveLength(1));
    expect(log.writes.find((w) => w.path.endsWith('/rooms/sync-config'))!.body).toEqual({ publicKey: MC.athensRoom, enabled: true, intervalMinutes: 60 });
    // Saved: no second PATCH until another change, and no login goes out.
    await waitFor(() => expect(within(sheet).queryByRole('button', { name: 'Save' })).toBeNull());
    expect(log.writes.filter((w) => w.path.endsWith('/rooms/login'))).toHaveLength(1);
  });

  it('without configuration:write there is no Auto-sync while logged in', async () => {
    renderMeshCore(route, {
      permissions: {
        bySource: {
          'src-heltec': {
            connection: { read: true, write: false },
            nodes: { read: true, write: false },
            messages: { read: true, write: true },
            configuration: { read: true, write: false },
          },
        },
      },
    });
    await logIn();
    expect(screen.queryByRole('button', { name: 'Auto-sync' })).toBeNull();
  });

  it('says Log out only forgets the login here', async () => {
    renderMeshCore(route);
    await logIn();
    expect(screen.getByText('Log out only forgets this login in MeshMonitor; nothing is sent to the room')).toBeInTheDocument();
  });

  it('Log out sends nothing and shows the login card again', async () => {
    const { log } = renderMeshCore(route);
    await logIn();
    const before = log.writes.length;
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in to read posts' })).toBeInTheDocument();
    expect(log.writes).toHaveLength(before);
  });
});
