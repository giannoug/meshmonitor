/**
 * @vitest-environment jsdom
 *
 * Board 12-11-remote-node-cli (desktop), Task 5.9: Hilltop Relay's remote-only
 * pages, Node management and the Remote console, under today's Target node
 * actions, and the remote Danger zone. The board carries them side by side to
 * fit the canvas (s12n0); each is its own page, so the test joins their texts.
 *
 * Every control that sends says so; Reboot, Purge and Shut down go to the
 * remote node with today's confirms; DFU and the resets are off.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { clearRemote } from '../remote/remoteTargetStore';
import { g2, goTo, renderSettings } from './renderSettings';
import { HILLTOP, NODE, PSYCHIKO, hold, meshRequests, remoteFixtures } from './remoteFixtures';

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

async function pageText(category: string, ready: string, act?: () => Promise<void>) {
  const view = renderSettings(page(category), { fixtures: remoteFixtures() });
  await screen.findAllByText(ready, {}, T);
  await act?.();
  const text = document.body.textContent ?? '';
  view.unmount();
  clearRemote(SOURCE_IDS.g2);
  return text;
}

describe('12-11-remote-node-cli', () => {
  it('12-11-remote-node-cli shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const texts = [
      await pageText('node-management', 'Kifisia Rooftop', async () => {
        // A favourite set this session, and Load All Config held on LoRa, as drawn.
        fireEvent.click(screen.getByRole('button', { name: 'Set as Favorite: Kifisia Rooftop' }));
        await screen.findByText('Favorite, from this session', {}, T);
        fireEvent.click(screen.getByRole('button', { name: 'Retrieve Device Metadata' }));
        await screen.findByText('Device Metadata', {}, T);
        hold((path, body) => path === '/api/admin/load-config' && body?.configType === 'lora');
        fireEvent.click(screen.getByRole('button', { name: /Load All Config/ }));
        await screen.findByText(/Loading LoRa \(2\/14\)/, {}, T);
      }),
      await pageText('remote-console', 'Command prefix'),
      await pageText('maintenance/danger', 'Purge Node Database'),
    ];
    const all = document.createElement('div');
    all.textContent = texts.join(' ');
    expectBoard('12-11-remote-node-cli', all);
  });

  it('Set and Remove send one admin command each, with today’s ACK reading', async () => {
    renderSettings(page('node-management'), {
      fixtures: remoteFixtures({
        'POST /api/admin/commands': (_u, init) => {
          const body = JSON.parse(String(init?.body)) as { command: string };
          // Psychiko rejects its ignore: nothing changes for it.
          return body.command === 'setIgnoredNode'
            ? { success: true, ack: { acked: false, timedOut: false, errorReason: 8, status: 'NO_CHANNEL' } }
            : { success: true, ack: { acked: true, timedOut: false, errorReason: null, status: 'confirmed' } };
        },
      }),
    });
    expect(await screen.findByText('Each Set or Remove sends 1 admin packet, 3 hops', {}, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set as Ignored: Psychiko Base' }));
    await screen.findByText(/rejected the ignore command/, {}, T);
    expect(screen.getAllByText('current status unknown').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Favorite: Psychiko Base' }));
    await screen.findByText(/confirmed the favorite|ACK received/, {}, T);
    expect(commands()).toEqual([
      expect.objectContaining({ command: 'setIgnoredNode', nodeNum: HILLTOP, targetNodeNum: PSYCHIKO }),
      expect.objectContaining({ command: 'removeFavoriteNode', nodeNum: HILLTOP, favoriteNodeNum: PSYCHIKO }),
    ]);
  });

  it('Run Cycle Now asks first with today’s words; Save Settings sends nothing on the mesh', async () => {
    renderSettings(page('node-management'), { fixtures: remoteFixtures({ 'POST /api/admin/auto-favorite-targets/:n/run': () => ({ ran: true, discoveredNeighbors: 2, newlyFavorited: [1], reFavorited: [] }), 'PUT /api/admin/auto-favorite-targets/:n': () => ({ success: true }) }) });
    fireEvent.click(await screen.findByRole('button', { name: /Run Cycle Now/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Run Cycle Now' }, T);
    expect(within(sheet).getByText(/This sends several packets over the mesh/)).toBeInTheDocument();
    expect(within(sheet).getByText(/up to 2 favorite packets/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run Cycle Now' }));
    await screen.findByText(/Cycle complete/, {}, T);
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await screen.findByText('Auto-favorite settings saved', {}, T);
    expect(meshRequests()).toEqual([]);
  });

  it('Reboot goes to the remote node after today’s delay; Purge types PURGE', async () => {
    renderSettings(page('maintenance/danger'), { fixtures: remoteFixtures() });
    expect(await screen.findAllByText('Sends 1 admin packet to Hilltop Relay over the mesh', {}, T)).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reboot Device' }));
    let sheet = await screen.findByRole('dialog', { name: 'Reboot the device?' }, T);
    fireEvent.change(within(sheet).getByLabelText('Reboot delay (seconds)'), { target: { value: '30' } });
    expect(within(sheet).getByText(/It will reboot in 30 seconds/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot Device' }));
    await waitFor(() => expect(commands()).toEqual([expect.objectContaining({ command: 'reboot', nodeNum: HILLTOP, seconds: 30 })]), T);

    fireEvent.click(await screen.findByRole('button', { name: 'Purge Node Database' }));
    sheet = await screen.findByRole('dialog', { name: 'Purge the node database?' }, T);
    const confirm = within(sheet).getByRole('button', { name: 'Purge Node Database' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'PURGE' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(commands()[1]).toMatchObject({ command: 'purgeNodeDb', nodeNum: HILLTOP, seconds: 0 }), T);
  });

  it('Shut down types the remote node’s short name; DFU and the resets are off with today’s reason', async () => {
    renderSettings(page('maintenance/danger'), { fixtures: remoteFixtures() });
    expect(await screen.findByRole('button', { name: 'Reboot into DFU mode' }, T)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset config/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Full device reset/ })).toBeDisabled();
    expect(screen.getAllByText(/Only for the node this source is connected to/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Shut down' }));
    const sheet = await screen.findByRole('dialog', {}, T);
    expect(within(sheet).getByText(/stays off until someone presses its button/)).toBeInTheDocument();
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'HTR' } });
    fireEvent.click(within(sheet).getAllByRole('button').find((b) => !b.hasAttribute('disabled') && /Shut down/.test(b.textContent ?? ''))!);
    await waitFor(() => expect(commands()).toEqual([expect.objectContaining({ command: 'shutdown', nodeNum: HILLTOP, seconds: 5 })]), T);
  });

  it('Shut down is off when the remote node’s metadata says it cannot shut down', async () => {
    renderSettings(page('node-management'), {
      fixtures: remoteFixtures({ 'POST /api/admin/get-device-metadata': () => ({ deviceMetadata: { firmwareVersion: '2.7.15', canShutdown: false, role: 2, hwModel: 9, positionFlags: 0, deviceStateVersion: 23 } }) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retrieve Device Metadata' }, T));
    await screen.findByText('Device Metadata', {}, T);
    // The node's metadata stays with its target while the settings stay open.
    goTo(page('maintenance/danger'));
    expect(await screen.findByRole('button', { name: 'Shut down' }, T)).toBeDisabled();
  });

  it('Load All Config reads every category in today’s order, 200 ms apart, once each', async () => {
    renderSettings(page('node-management'), { fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: /Load All Config/ }, T));
    const started = Date.now();
    await screen.findByText(/configs loaded/, {}, { timeout: 15_000 });
    // 14 reads, 13 gaps of today's 200 ms.
    expect(Date.now() - started).toBeGreaterThanOrEqual(13 * 200);
    const loads = meshRequests().map((r) => (r.what.endsWith('load-config') ? r.body?.configType : r.what.split('/').pop()));
    expect(loads).toEqual([
      'device', 'lora', 'position', 'mqtt', 'security', 'network', 'neighborinfo', 'telemetry', 'statusmessage', 'trafficmanagement',
      'meshbeacon', 'tak', 'load-owner', ...Array(8).fill('get-channel'),
    ]);
  }, 20_000);
});
