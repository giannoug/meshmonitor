/**
 * @vitest-environment jsdom
 *
 * Board o4-users (desktop, ds12, ds13, s13n0): Overview › Users, one user's
 * Permissions matrix: today's per-device resources down the side, the devices
 * across, None / Read / Write cells that save as you go through today's
 * per-source endpoint, the install-wide card, and today's virtual channel
 * permissions with their own Save. Admins only.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { cell, gets, openUser, renderUsers, writes } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function openMatrix(user = 'nikos') {
  renderUsers('/overview/users');
  await openUser(user);
  fireEvent.click(await screen.findByRole('tab', { name: 'Permissions' }));
  return screen.findByRole('table', { name: 'On each device' }, { timeout: 5000 });
}

describe('o4-users', () => {
  it('o4-users shows the board', async () => {
    await openMatrix();
    await cell('Node Details & DM', 'Station G2');
    expectBoard('o4-users', document.body);
  });

  it('lists every account with today\'s meta: @username, provider, passkeys, admin star, Inactive', async () => {
    renderUsers('/overview/users');
    const list = await screen.findByRole('list', { name: 'Users' }, { timeout: 5000 });
    const rows = within(list).getAllByRole('button').map((b) => b.textContent);
    expect(rows).toEqual([
      expect.stringContaining('Athens Ops @admin · LOCAL'),
      expect.stringContaining('giannoug @giannoug · LOCAL · 1 passkey'),
      expect.stringContaining('nikos@nikos · OIDC'),
      expect.stringContaining('Field team@field-team · LOCAL · 2 passkeys'),
      expect.stringContaining('viewer@viewer · LOCAL'),
      expect.stringContaining('Anonymous@anonymous · LOCAL'),
    ]);
    expect(within(list).getByRole('button', { name: /^giannoug/ })).toContainElement(within(list).getAllByLabelText('Administrator')[1]);
    expect(within(list).getByRole('button', { name: /^viewer/ })).toHaveTextContent('Inactive');
  });

  it('cells show each device\'s stored level; rows a device does not have are empty', async () => {
    await openMatrix();
    expect(await cell('Node Details & DM', 'Station G2')).toHaveTextContent('Write');
    expect(await cell('Node Details & DM', 'Heltec MeshCore')).toHaveTextContent('Read');
    expect(await cell('Node Details & DM', 'Reticulum node')).toHaveTextContent('None');
    expect(await cell('Channel 0 (Primary)', 'Station G2')).toHaveTextContent('Write');
    // MeshCore and Reticulum have no channel slots; MQTT's channels are keyed by name (today's hint).
    expect(screen.queryByRole('button', { name: /^Channel 0 \(Primary\) on Heltec MeshCore/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Channel 0 \(Primary\) on Athens MQTT/ })).toBeNull();
    expect(screen.getByText(/Channel permissions for MQTT sources are managed under Virtual Channel Permissions/)).toBeInTheDocument();
    // Channel 1 exists only on Station G2; its name is the cell's title.
    expect(await cell('Channel 1', 'Station G2')).toHaveAttribute('title', 'gauntlet');
    expect(screen.queryByRole('button', { name: /^Channel 1 on Rooftop RAK/ })).toBeNull();
  });

  it('View on Map stays reachable: channel cells everywhere, Nodes & map only on MeshCore', async () => {
    await openMatrix();
    expect(await screen.findByRole('button', { name: 'View on Map: Channel 0 (Primary) on Station G2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'View on Map: Nodes & map on Heltec MeshCore' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'View on Map: Nodes & map on Station G2' })).toBeNull();
  });

  it('a cell cycles None → Read → Write → None and saves each step', async () => {
    await openMatrix();
    fireEvent.click(await cell('Automation', 'Heltec MeshCore'));
    await waitFor(async () => expect(await cell('Automation', 'Heltec MeshCore')).toHaveTextContent('Read'));
    fireEvent.click(await cell('Automation', 'Heltec MeshCore'));
    await waitFor(async () => expect(await cell('Automation', 'Heltec MeshCore')).toHaveTextContent('Write'));
    fireEvent.click(await cell('Automation', 'Heltec MeshCore'));
    await waitFor(async () => expect(await cell('Automation', 'Heltec MeshCore')).toHaveTextContent('None'));
    const sent = writes().map((w) => (w.body as { sourceId: string; permissions: Record<string, unknown> }));
    expect(sent.map((b) => [b.sourceId, b.permissions.automation])).toEqual([
      [S.heltec, { read: true, write: false }],
      [S.heltec, { read: true, write: true }],
      [S.heltec, { read: false, write: false }],
    ]);
  });

  it('one write at a time: a second click while saving sends nothing', async () => {
    await openMatrix();
    const target = await cell('Node Details & DM', 'Heltec MeshCore');
    fireEvent.click(target);
    fireEvent.click(target);
    await waitFor(async () => expect(await cell('Node Details & DM', 'Heltec MeshCore')).toHaveTextContent('Write'));
    expect(writes()).toHaveLength(1);
  });

  it('Packet monitor is read-only, as today: None ↔ Read', async () => {
    await openMatrix();
    fireEvent.click(await cell('Packet monitor', 'Station G2'));
    await waitFor(async () => expect(await cell('Packet monitor', 'Station G2')).toHaveTextContent('None'));
  });

  it('a failed save keeps the stored level and shows today\'s error', async () => {
    renderUsers('/overview/users', {
      fixtures: { 'PUT /api/users/:id/permissions': () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 }) },
    });
    await openUser('nikos');
    fireEvent.click(await screen.findByRole('tab', { name: 'Permissions' }));
    fireEvent.click(await cell('Node Details & DM', 'Station G2'));
    expect(await screen.findByText('Failed to update permissions. Please try again.')).toBeInTheDocument();
    expect(await cell('Node Details & DM', 'Station G2')).toHaveTextContent('Write');
  });

  it('the install-wide card lists today\'s global resources as None / Read / Write', async () => {
    await openMatrix();
    const card = await screen.findByRole('region', { name: 'Across this MeshMonitor' });
    const groups = within(card).getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Source Status', 'Info', 'Automations (all rules)', 'Audit Log', 'Security', 'Custom Themes', 'Sources', 'Channel database']);
    expect(within(within(card).getByRole('group', { name: 'Automations (all rules)' })).getByRole('button', { name: 'Read' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('reads each device\'s grants and channels once, per device', async () => {
    await openMatrix();
    await cell('Node Details & DM', 'Athens MQTT');
    for (const id of Object.values(S)) {
      expect(gets().filter((u) => u === `/api/users/3/permissions?sourceId=${id}`)).toHaveLength(1);
      expect(gets().filter((u) => u === `/api/channels/all?sourceId=${id}`)).toHaveLength(1);
    }
    expect(writes()).toEqual([]);
  });

  it('a non-admin sees today\'s denial and nothing is fetched', async () => {
    renderUsers('/overview/users', { permissions: { global: { audit: { read: true, write: false } }, bySource: {} } });
    expect(await screen.findByText('Access denied. Admin privileges required.', {}, { timeout: 5000 })).toBeInTheDocument();
    // The shell reads the viewer's own channel-database grants; the page reads nothing.
    expect(gets().filter((u) => u === '/api/users' || /^\/api\/users\/\d+\/permissions/.test(u) || u.startsWith('/api/channels/all'))).toEqual([]);
  });
});
