/**
 * @vitest-environment jsdom
 *
 * Task 5.9: what a remote target reads and sends per category, as today's
 * Admin Commands does. Security asks today's "Save security config to …?"
 * first and never sends a keypair; Channels reads all eight slots and saves
 * one slot with setChannel; a send the node never answers shows No reply and
 * stays queued, with nothing retried.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { clearRemote } from '../remote/remoteTargetStore';
import { g2, renderSettings } from './renderSettings';
import { HILLTOP, NODE, meshRequests, remoteFixtures } from './remoteFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => clearRemote(SOURCE_IDS.g2));
afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const page = (category: string) => `${g2}/settings/${category}?node=${NODE}`;
const commands = () => meshRequests().filter((r) => r.what === 'POST /api/admin/commands').map((r) => r.body);
const sidebar = () => screen.getByRole('navigation', { name: 'Settings' });
const sendAll = async () => {
  const bar = await screen.findByRole('region', { name: 'Unsaved radio changes' }, T);
  fireEvent.click(within(bar).getByRole('button', { name: 'Send to node' }));
};

describe('remote sends', () => {
  it('Security asks today’s overwrite question first and sends no keypair', async () => {
    renderSettings(page('security'), { fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
    const serial = await screen.findByRole('switch', { name: 'Serial Console Enabled' }, T);
    expect(screen.queryByText('Public Key')).toBeNull();
    fireEvent.click(serial);
    await sendAll();
    const sheet = await screen.findByRole('dialog', { name: 'Save security config to Hilltop Relay (!7c3e10a2)?' }, T);
    expect(commands()).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send to node' }));
    await waitFor(() => expect(commands()).toHaveLength(1), T);
    const config = commands()[0]!.config as Record<string, unknown>;
    expect(commands()[0]).toMatchObject({ command: 'setSecurityConfig', nodeNum: HILLTOP });
    expect(config).toMatchObject({ serialEnabled: false, adminKeys: ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='] });
    expect(config).not.toHaveProperty('privateKey');
    expect(config).not.toHaveProperty('publicKey');
    expect(config).not.toHaveProperty('packetSignaturePolicy');
  });

  it('declining the overwrite question sends nothing and keeps the edit', async () => {
    renderSettings(page('security'), { fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
    fireEvent.click(await screen.findByRole('switch', { name: 'Serial Console Enabled' }, T));
    await sendAll();
    const sheet = await screen.findByRole('dialog', { name: /Save security config/ }, T);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(commands()).toEqual([]);
    expect(screen.getByRole('region', { name: 'Unsaved radio changes' })).toHaveTextContent('1 change in Security');
  });

  it('Channels reads its eight slots and saves one with setChannel', async () => {
    renderSettings(page('channels'), { fixtures: remoteFixtures() });
    expect(await screen.findByText(/Sends 8 requests to Hilltop Relay over the mesh, 3 hops/, {}, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read from node' }));
    fireEvent.click(await screen.findByRole('link', { name: /Slot 0 LongFast|LongFast/ }, T));
    expect(meshRequests().filter((r) => r.what === 'POST /api/admin/get-channel')).toHaveLength(8);
    // Reorder, sharing and JSON are this radio's.
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
    const name = await screen.findByLabelText('Channel Name', {}, T);
    fireEvent.change(name, { target: { value: 'Hilltop' } });
    const dock = await screen.findByRole('region', { name: 'Unsaved channel changes' }, T);
    expect(within(dock).getAllByText('Sends 1 admin packet to Hilltop Relay over the mesh').length).toBeGreaterThan(0);
    fireEvent.click(within(dock).getAllByRole('button').find((b) => /Save/.test(b.textContent ?? ''))!);
    await waitFor(() => expect(commands()).toHaveLength(1), T);
    expect(commands()[0]).toMatchObject({ command: 'setChannel', nodeNum: HILLTOP, channelIndex: 0, config: { name: 'Hilltop', role: 1 } });
  });

  it('Identity reads the owner and sends setOwner', async () => {
    renderSettings(page('identity'), { fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
    const short = await screen.findByDisplayValue('HTR', {}, T);
    fireEvent.change(short, { target: { value: 'HIL' } });
    await sendAll();
    await waitFor(() => expect(commands()).toEqual([expect.objectContaining({ command: 'setOwner', nodeNum: HILLTOP, shortName: 'HIL', longName: 'Hilltop Relay' })]), T);
  });

  it('a send the node never answers shows No reply, stays queued and is not retried', async () => {
    renderSettings(page('device/position'), {
      fixtures: remoteFixtures({
        'POST /api/admin/commands': () =>
          new Response(JSON.stringify({ success: false, error: 'Failed to obtain session passkey', code: 'PASSKEY_TIMEOUT' }), {
            status: 504,
            headers: { 'content-type': 'application/json' },
          }),
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
    fireEvent.change(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T), { target: { value: '3600' } });
    await sendAll();
    await within(sidebar()).findByText('No reply', {}, T);
    expect(commands()).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Unsaved radio changes' })).toHaveTextContent('Not saved: Position');
  });

  it('with transmit off on this radio, today’s notice replaces Read from node and nothing goes out', async () => {
    renderSettings(page('device/position'), {
      fixtures: remoteFixtures({ 'GET /api/device/tx-status': () => ({ txEnabled: false, udpRelayEnabled: false, canTransmit: false }) }),
    });
    expect(await screen.findByText(/Remote-node admin is unavailable while Transmit is disabled/, {}, T)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read from node' })).toBeNull();
    expect(meshRequests()).toEqual([]);
  });
});
