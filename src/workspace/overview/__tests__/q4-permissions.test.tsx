/**
 * @vitest-environment jsdom
 *
 * Board q4-permissions (phone, ds13, s13n7): one user's permissions on the
 * phone: a device chip, then None / Read / Write per resource on that device
 * (saved as you go through today's per-source endpoint), and today's
 * install-wide resources in their own card.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { openUser, renderUsers, writes } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function permissions(user = 'nikos') {
  renderUsers('/overview/users', { phone: true });
  await openUser(user);
  fireEvent.click(within(await screen.findByRole('dialog', { name: user })).getByRole('button', { name: /^Permissions/ }));
  return screen.findByRole('group', { name: 'Node Details & DM' }, { timeout: 5000 });
}

const pressed = (group: HTMLElement) => within(group).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent;

describe('q4-permissions', () => {
  it('q4-permissions shows the board', async () => {
    await permissions();
    expectBoard('q4-permissions', document.body);
  });

  it('a device chip picks the device; its rows show its stored levels', async () => {
    expect(pressed(await permissions())).toBe('Write');
    fireEvent.click(screen.getByRole('button', { name: 'Heltec MeshCore' }));
    expect(await screen.findByText('On Heltec MeshCore')).toBeInTheDocument();
    await waitFor(() => expect(pressed(screen.getByRole('group', { name: 'Node Details & DM' }))).toBe('Read'));
    expect(screen.queryByRole('group', { name: 'Channel 0 (Primary)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View on Map: Nodes & map on Heltec MeshCore' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a segment saves only that device\'s set', async () => {
    await permissions();
    fireEvent.click(screen.getByRole('button', { name: 'Rooftop RAK' }));
    await screen.findByText('On Rooftop RAK');
    fireEvent.click(within(screen.getByRole('group', { name: 'Traceroute' })).getByRole('button', { name: 'None' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'PUT', url: '/api/users/3/permissions', body: { sourceId: S.rak } });
    expect((writes()[0].body as { permissions: Record<string, unknown> }).permissions.traceroute).toEqual({ read: false, write: false });
  });

  it('Across this MeshMonitor opens today\'s install-wide resources (Security among them)', async () => {
    await permissions();
    const toggle = screen.getByRole('button', { name: /^Across this MeshMonitor/ });
    expect(toggle).toHaveTextContent('3 rules');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(pressed(screen.getByRole('group', { name: 'Security' }))).toBe('None');
    expect(pressed(screen.getByRole('group', { name: 'Info' }))).toBe('Read');
  });

  it('Virtual Channel Permissions are on the phone page too, with today\'s Save', async () => {
    await permissions();
    const card = await screen.findByRole('region', { name: 'Virtual Channel Permissions' });
    fireEvent.click(within(within(card).getByRole('group', { name: '#athens' })).getByLabelText('Read Messages'));
    fireEvent.click(within(card).getByRole('button', { name: 'Save Virtual Channel Permissions' }));
    await waitFor(() => expect(writes()).toEqual([{
      method: 'PUT', url: '/api/users/3/channel-database-permissions',
      body: { permissions: [
        { channelDatabaseId: 11, canViewOnMap: true, canRead: true, canWrite: false },
        { channelDatabaseId: 12, canViewOnMap: false, canRead: true, canWrite: false },
      ] },
    }]));
  });

  it('the back link returns to the list', async () => {
    await permissions();
    fireEvent.click(screen.getByRole('button', { name: 'Users' }));
    expect(await screen.findByRole('list', { name: 'Users' })).toBeInTheDocument();
  });
});
