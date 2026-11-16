/**
 * @vitest-environment jsdom
 *
 * Boards 12-25-remote-console and 12-29-target-actions (phone), Task 5.9:
 * Hilltop Relay's Remote console on the shared CliConsoleBody, and its header
 * ⋯ sheet with today's Target node actions, each with what it sends.
 * A console command goes out only when sent; nothing repeats.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { clearRemote } from '../remote/remoteTargetStore';
import { g2, renderSettings } from './renderSettings';
import { HILLTOP, NODE, hold, meshRequests, remoteFixtures } from './remoteFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => clearRemote(SOURCE_IDS.g2));
afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const CONSOLE = `${g2}/settings/remote-console?node=${NODE}`;
const cli = (output: string) => ({
  'POST /api/sources/:id/meshtastic/admin/cli': () => ({ success: true, data: { output, stdout: '', stderr: '', exitCode: 0, elapsedMs: 900 } }),
});
const send = async (text: string) => {
  const input = await screen.findByPlaceholderText('CLI arguments (e.g. --set device.role CLIENT)', {}, T);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
};

describe('12-25-remote-console', () => {
  it('12-25-remote-console shows the board', async () => {
    renderSettings(CONSOLE, { phone: true, fixtures: remoteFixtures(cli('Set device.role to ROUTER\nAcknowledged · node restarts to apply')) });
    await send('--set device.role ROUTER');
    await screen.findByText(/Acknowledged · node restarts to apply/, {}, T);
    expect(screen.getByText('Each command sends its admin packets to Hilltop Relay over the mesh; destructive flags ask first')).toBeInTheDocument();
    expectBoard('12-25-remote-console', document.body);
  });

  it('sends one request per command, only when sent, to the remote node', async () => {
    renderSettings(CONSOLE, { phone: true, fixtures: remoteFixtures(cli('lora.hop_limit: 3')) });
    await screen.findByText('meshtastic --dest !7c3e10a2', {}, T);
    expect(meshRequests()).toEqual([]);
    await send('--get lora.hop_limit');
    await screen.findByText(/lora.hop_limit: 3/, {}, T);
    const sent = meshRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ what: `POST /api/sources/${SOURCE_IDS.g2}/meshtastic/admin/cli`, body: { destNodeId: NODE } });
  });
});

describe('12-29-target-actions', () => {
  it('12-29-target-actions shows the board', async () => {
    renderSettings(CONSOLE, { phone: true, fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Node actions' }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Hilltop Relay' }, T);
    fireEvent.click(within(sheet).getByRole('button', { name: /Retrieve Device Metadata/ }));
    await within(sheet).findByText(/2\.7\.15/, {}, T);
    hold((path, body) => path === '/api/admin/load-config' && body?.configType === 'lora');
    fireEvent.click(within(sheet).getByRole('button', { name: /Load All Config/ }));
    await within(sheet).findByText(/Loading LoRa \(2\/14\)/, {}, T);
    expectBoard('12-29-target-actions', sheet);
  });

  it('Set Time sends today’s request; Attempts goes with each command, blank leaves it to the server', async () => {
    renderSettings(CONSOLE, { phone: true, fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Node actions' }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Hilltop Relay' }, T);
    fireEvent.click(within(sheet).getByRole('button', { name: /Set Time/ }));
    await waitFor(() => expect(meshRequests().map((r) => r.what)).toEqual(['POST /api/admin/set-time']), T);
    expect(meshRequests()[0].body).toEqual({ nodeNum: HILLTOP, sourceId: SOURCE_IDS.g2 });
    fireEvent.change(within(sheet).getByLabelText('Attempts for this command'), { target: { value: '3' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    // The Danger zone's Reboot carries it, as today's executeCommand does.
    fireEvent.click(screen.getByRole('link', { name: /Settings/ }));
    fireEvent.click(await screen.findByRole('link', { name: /Maintenance/ }, T));
    fireEvent.click(await screen.findByRole('button', { name: 'Reboot Device' }, T));
    const reboot = await screen.findByRole('dialog', { name: 'Reboot the device?' }, T);
    fireEvent.click(within(reboot).getByRole('button', { name: 'Reboot Device' }));
    await waitFor(() => expect(meshRequests().at(-1)?.body).toMatchObject({ command: 'reboot', nodeNum: HILLTOP, retryAttempts: 3 }), T);
  });
});
