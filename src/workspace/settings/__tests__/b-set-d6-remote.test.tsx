/**
 * @vitest-environment jsdom
 *
 * Board b-set-d6-remote, Task 5.9: Station G2's settings configuring Hilltop
 * Relay (`?node=`). The list is the node's (ON HILLTOP RELAY, REMOTE ONLY, no
 * In MeshMonitor); a category opens empty with Read from node, and saves with
 * Send to node, one admin command per changed category, shown in the list.
 *
 * Mesh checklist 1: opening a remote category sends nothing until Read from
 * node is pressed; the passkey status is read once and only counted down.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { clearRemote } from '../remote/remoteTargetStore';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, realUrl, renderSettings } from './renderSettings';
import { HILLTOP, NODE, meshRequests, remoteFixtures, requests } from './remoteFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => clearRemote(SOURCE_IDS.g2));
afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const POSITION = `${g2}/settings/device/position?node=${NODE}`;
const sidebar = () => screen.getByRole('navigation', { name: 'Settings' });
const read = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
  return screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T);
};

describe('b-set-d6-remote', () => {
  it('b-set-d6-remote shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(POSITION, { fixtures: remoteFixtures() });
    await screen.findByText(/session passkey acquired \(212s remaining\)/, {}, T);
    await screen.findByText('No changes yet', {}, T);
    expect(within(sidebar()).getByText('On Hilltop Relay')).toBeInTheDocument();
    expect(within(sidebar()).queryByText('In MeshMonitor')).toBeNull();
    expectBoard('b-set-d6-remote', container);
  });

  it('opening a remote category sends nothing on the mesh until Read from node is pressed', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    await screen.findByRole('button', { name: 'Read from node' }, T);
    // The rows wait for a read: nothing from nowhere can be sent back.
    expect(screen.queryByLabelText('Position Broadcast Interval (seconds)')).toBeNull();
    // Opening another remote category sends nothing either.
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'LoRa' }));
    await screen.findByRole('heading', { level: 1, name: 'LoRa' }, T);
    expect(realUrl()).toBe(`${g2}/settings/lora?node=${NODE}`);
    expect(meshRequests()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Read from node' }));
    await screen.findByText(/Showing values read/, {}, T);
    // ensureSessionPasskey first, then the one load request for this category.
    expect(meshRequests().map((r) => [r.what, r.body?.configType])).toEqual([
      ['POST /api/admin/ensure-session-passkey', undefined],
      ['POST /api/admin/load-config', 'lora'],
    ]);
    expect(meshRequests()[1].body).toMatchObject({ nodeNum: HILLTOP, sourceId: SOURCE_IDS.g2 });
  });

  it('reads the passkey status once and only counts it down, with no request on the timer', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    await screen.findByText(/\(212s remaining\)/, {}, T);
    await screen.findByText(/\(210s remaining\)/, {}, { timeout: 4000 });
    expect(requests().filter((r) => r.what === 'POST /api/admin/session-passkey-status')).toHaveLength(1);
    expect(meshRequests()).toEqual([]);
  });

  it('shows the read values, and Send to node sends one admin command for the changed category', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    const interval = await read();
    expect(interval).toHaveValue(1800);
    expect(screen.getByText(/Sends 1 request to Hilltop Relay over the mesh, 3 hops/)).toBeInTheDocument();
    fireEvent.change(interval, { target: { value: '3600' } });
    const bar = await screen.findByRole('region', { name: 'Unsaved radio changes' }, T);
    expect(within(bar).getByText(/1 change in Position/)).toBeInTheDocument();
    expect(within(bar).getByText('Sends 1 admin packet per changed category')).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: 'Send to node' }));
    // Today's server awaits no routing ACK for a config write: Sent, never Acknowledged (Ruling GA).
    await within(sidebar()).findByText('Sent', {}, T);
    expect(within(sidebar()).queryByText('Acknowledged')).toBeNull();
    const sends = meshRequests().filter((r) => r.what === 'POST /api/admin/commands');
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toMatchObject({ command: 'setPositionConfig', nodeNum: HILLTOP, config: { positionBroadcastSecs: 3600, gpsMode: 2 } });
    expect(sends[0].body).not.toHaveProperty('retryAttempts');
    await screen.findByText('No changes yet', {}, T);
  });

  it('switching back to This radio shows the local values untouched', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    fireEvent.change(await read(), { target: { value: '3600' } });
    fireEvent.click(screen.getByRole('button', { name: /Configuring/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Configuring' }, T);
    fireEvent.click(within(sheet).getByRole('button', { name: /This radio/ }));
    // The switch would drop the node's unsent edit: today's discard question first (I3).
    const ask = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }, T);
    expect(ask).toHaveTextContent('Position · Hilltop Relay');
    fireEvent.click(within(ask).getByRole('button', { name: 'Discard changes' }));
    // An empty `?node=` is this radio, over the node picked before.
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/device/position?node=`), T);
    expect(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T)).toHaveValue(900);
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
    expect(within(sidebar()).getByText('In MeshMonitor')).toBeInTheDocument();
  });

  it('Keep editing keeps the node and its unsent edit', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    fireEvent.change(await read(), { target: { value: '3600' } });
    fireEvent.click(screen.getByRole('button', { name: /Configuring/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Configuring' }, T)).getByRole('button', { name: /Psychiko Base/ }));
    const ask = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }, T);
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(realUrl()).toBe(POSITION);
    expect(screen.getByLabelText('Position Broadcast Interval (seconds)')).toHaveValue(3600);
  });

  it('leaving the settings asks for this radio’s queued edits while a node is the target', async () => {
    renderSettings(`${g2}/settings/device/position`, { fixtures: remoteFixtures() });
    fireEvent.change(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: /Configuring/ }));
    // The picker reads the node list when it opens.
    fireEvent.click(await within(await screen.findByRole('dialog', { name: 'Configuring' }, T)).findByRole('button', { name: /Hilltop Relay/ }, T));
    await screen.findByRole('button', { name: 'Read from node' }, T);
    fireEvent.click(screen.getByTestId('settings-back'));
    const ask = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }, T);
    expect(ask).toHaveTextContent('Position');
    expect(realUrl()).toMatch(/\/settings\/device\/position/);
  });

  it('keeps the node across the settings list links', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    await screen.findByRole('button', { name: 'Read from node' }, T);
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Remote console' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/remote-console?node=${NODE}`), T);
  });

  it('a viewer who is not an admin gets this radio, with no picker', async () => {
    renderSettings(POSITION, {
      fixtures: remoteFixtures(),
      permissions: { global: {}, bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: true }, settings: { read: true, write: true } } } },
    });
    expect(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T)).toHaveValue(900);
    expect(screen.queryByRole('button', { name: /Configuring/ })).toBeNull();
    expect(requests().filter((r) => r.what.includes('/api/admin/'))).toEqual([]);
  });

  it('Search lists the remote node’s categories only', async () => {
    renderSettings(POSITION, { fixtures: remoteFixtures() });
    await screen.findByRole('button', { name: 'Read from node' }, T);
    await act(async () => {
      fireEvent.keyDown(window, { key: ',', ctrlKey: true });
    });
    const dialog = await screen.findByRole('dialog', { name: 'Search settings' }, T);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Search settings' }), { target: { value: 'telemetry' } });
    const g2Group = await within(dialog).findByRole('group', { name: 'Station G2' }, T);
    // Modules › Telemetry is offered on a remote node; In MeshMonitor › Telemetry is not.
    const hrefs = within(g2Group).getAllByRole('option').map((l) => l.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('/settings/modules/telemetry'))).toBe(true);
    expect(hrefs.some((h) => /\/settings\/telemetry(#|$)/.test(h))).toBe(false);
    expect(within(g2Group).queryByText(/In MeshMonitor/)).toBeNull();
  });
});
