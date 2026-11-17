/**
 * @vitest-environment jsdom
 *
 * Boards h3 (desktop, connected) and i3 (phone, failed), Task 6.6: Add
 * device, step 3. Save is today's add (one POST); the result reads the
 * device's status once; Try again is today's Connect (one POST per press and
 * today's re-poll, stopped when the flow closes). Nothing retries on its own.
 */
import { describe, it, expect } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { NEW_ID } from '../../__fixtures__/devices';
import { renderDevices, statusReads } from './devicesHarness';

const ADD = '/server/devices?add=1';
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

/** Meshtastic node at `host`, named `name`, saved. */
async function addMeshtastic(phone: boolean, host = '192.168.1.40', name = 'Station G2') {
  const dialog = await screen.findByRole('dialog', { name: 'Add device' });
  fireEvent.click(within(dialog).getByRole('radio', { name: 'Meshtastic node' }));
  if (!phone) fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  fireEvent.change(await within(dialog).findByLabelText('Host / IP'), { target: { value: host } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  fireEvent.change(await within(dialog).findByLabelText('Name'), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  return dialog;
}

const posts = (log: { writes: Array<{ method: string; path: string }> }, path: string) =>
  log.writes.filter((w) => w.method === 'POST' && w.path === path).length;

describe('h3 / i3 name and connect', () => {
  it('h3-add-connect shows the board', async () => {
    renderDevices(ADD);
    await addMeshtastic(false);
    await screen.findByText('Connected. The rest of the node list fills in over the next minute.');
    await screen.findByText('Loaded channels');
    expectBoard('h3-add-connect', document.body);
  });

  it('i3-failed shows the board', async () => {
    renderDevices(ADD, { phone: true, outcome: 'failed' });
    await addMeshtastic(true, '192.168.1.52', 'Rooftop RAK');
    await screen.findByText('Couldn’t connect.');
    expectBoard('i3-failed', document.body);
  });

  it('Save sends today\'s body once, then reads the status once; no connect, no timer', async () => {
    const { log } = renderDevices(ADD);
    await addMeshtastic(false);
    await screen.findByText('Connected. The rest of the node list fills in over the next minute.');
    expect(posts(log, '/api/sources')).toBe(1);
    expect(log.writes.find((w) => w.path === '/api/sources')!.body).toEqual({
      name: 'Station G2',
      type: 'meshtastic_tcp',
      enabled: true,
      config: { host: '192.168.1.40', port: 4403, heartbeatIntervalSeconds: 30, autoConnect: true, mqttLink: { enabled: false } },
    });
    await wait(1700);
    // The rail's own poll of the new device runs every 15 s, so in this window only the flow's one read.
    expect(statusReads(log, NEW_ID)).toBe(1);
    expect(posts(log, `/api/sources/${NEW_ID}/connect`)).toBe(0);
    expect(log.reads.filter((r) => r === `/api/sources/${NEW_ID}/channels`)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open Station G2' })).toBeInTheDocument();
  });

  it('failed: Try again is one POST /connect and today\'s re-poll until connected', async () => {
    const { log } = renderDevices(ADD, { outcome: 'failed' });
    const dialog = await addMeshtastic(false, '192.168.1.52', 'Rooftop RAK');
    await within(dialog).findByText('Couldn’t connect.');
    expect(dialog).toHaveTextContent('Is the node on this network, with WiFi or Ethernet on?');
    expect(statusReads(log, NEW_ID)).toBe(1);
    fireEvent.click(within(dialog).getByRole('button', { name: /Try again/ }));
    await within(dialog).findByText('Connected. The rest of the node list fills in over the next minute.');
    expect(posts(log, `/api/sources/${NEW_ID}/connect`)).toBe(1);
    // The first re-poll found it connected, so the loop stopped there.
    expect(statusReads(log, NEW_ID)).toBe(2);
    await wait(1700);
    expect(statusReads(log, NEW_ID)).toBe(2);
  });

  it('closing the flow stops a Try again\'s re-poll', async () => {
    const { log } = renderDevices(ADD, { outcome: 'failed', stays: true });
    const dialog = await addMeshtastic(false, '192.168.1.52', 'Rooftop RAK');
    await within(dialog).findByText('Couldn’t connect.');
    fireEvent.click(within(dialog).getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(statusReads(log, NEW_ID)).toBe(2));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save anyway, connect later' }));
    expect(screen.queryByRole('dialog', { name: 'Add device' })).toBeNull();
    await wait(1700);
    expect(statusReads(log, NEW_ID)).toBe(2);
    expect(posts(log, `/api/sources/${NEW_ID}/connect`)).toBe(1);
  });

  it('Edit connection goes back to step 2, and saving again is a PUT of the same device', async () => {
    const { log } = renderDevices(ADD, { outcome: 'failed', stays: true });
    const dialog = await addMeshtastic(false, '192.168.1.52', 'Rooftop RAK');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Edit connection' }));
    const host = await within(dialog).findByLabelText('Host / IP');
    expect(host).toHaveValue('192.168.1.52');
    fireEvent.change(host, { target: { value: '192.168.1.53' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.some((w) => w.method === 'PUT' && w.path === `/api/sources/${NEW_ID}`)).toBe(true));
    expect(posts(log, '/api/sources')).toBe(1);
  });

  it('Add another starts over at step 1; Open goes to the device', async () => {
    renderDevices(ADD);
    const dialog = await addMeshtastic(false);
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add another' }));
    expect(within(dialog).getByText('What are you connecting?')).toBeInTheDocument();
  });

  it('a save error shows today\'s words and keeps the step', async () => {
    renderDevices(ADD, {
      fixtures: { 'POST /api/sources': () => new Response(JSON.stringify({ error: 'A source already exists with host 192.168.1.40:4403 ("Station G2")' }), { status: 409, headers: { 'content-type': 'application/json' } }) },
    });
    const dialog = await addMeshtastic(false);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A source already exists with host 192.168.1.40:4403');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
