/**
 * @vitest-environment jsdom
 *
 * Board h4 (Task 6.6): Server › Devices. Every device, disabled ones too, in
 * today's order; reorder by ↑/↓ (today's POST /reorder with the whole order);
 * enable at once, disable after a plain confirm; ⋯ holds today's Edit,
 * Resync (with what it sends), Prune Outside ROI and Delete (today's words).
 * Admins only.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderDevices } from './devicesHarness';
import { grants } from '../../server/__tests__/serverHarness';

const rows = () => screen.getAllByTestId('device-row');
const row = (name: string) => rows().find((r) => within(r).queryByText(name))!;

async function menu(name: string, item: string) {
  fireEvent.click(within(row(name)).getByRole('button', { name: `More for ${name}` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: item }));
}

describe('h4 server devices', () => {
  it('h4-server-devices shows the board', async () => {
    renderDevices();
    await screen.findByText('Test bench T-Beam');
    expectBoard('h4-server-devices', document.body);
  });

  it('lists every device in today\'s order, the disabled ones greyed, with today\'s status words', async () => {
    renderDevices();
    await screen.findByText('Old bridge');
    expect(rows()).toHaveLength(7);
    expect(rows()[0]).toHaveTextContent('Station G2');
    expect(rows()[0]).toHaveTextContent('Primary');
    expect(rows()[0]).toHaveTextContent('Meshtastic node · 192.168.1.40:4403');
    expect(row('Heltec MeshCore')).toHaveTextContent('MeshCore · /dev/ttyACM0');
    expect(row('Athens MQTT')).toHaveTextContent('MQTT broker · port 1883');
    expect(row('Rooftop RAK')).toHaveTextContent('Connecting');
    expect(row('Old bridge')).toHaveAttribute('data-off');
    expect(row('Old bridge')).toHaveTextContent('Disabled');
    expect(within(row('Old bridge')).getByRole('switch', { name: 'Enabled: Old bridge' })).not.toBeChecked();
    // The stored upstream URL carries `meshdev:large4cats@`; the row shows only its host and port.
    expect(row('Old bridge')).toHaveTextContent('MQTT bridge · mqtt.meshtastic.org:1883');
    expect(row('Old bridge').textContent).not.toMatch(/meshdev|large4cats/);
  });

  it('↑ and ↓ save today\'s order with one POST each', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    expect(within(rows()[0]).getByRole('button', { name: 'Move Station G2 up' })).toBeDisabled();
    fireEvent.click(within(row('Rooftop RAK')).getByRole('button', { name: 'Move Rooftop RAK up' }));
    await waitFor(() =>
      expect(log.writes).toContainEqual({
        method: 'POST',
        path: '/api/sources/reorder',
        body: { order: ['src-g2', 'src-rak', 'src-heltec', 'src-rns', 'src-mqtt', 'src-tbeam', 'src-oldbridge'] },
      }),
    );
    await waitFor(() => expect(rows()[1]).toHaveTextContent('Rooftop RAK'));
    fireEvent.click(within(row('Old bridge')).getByRole('button', { name: 'Move Old bridge down' }));
    expect(log.writes.filter((w) => w.path === '/api/sources/reorder')).toHaveLength(1);
  });

  it('enables at once; disabling asks with a plain confirm that Enter does not answer', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    fireEvent.click(within(row('Test bench T-Beam')).getByRole('switch'));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/sources/src-tbeam', body: { enabled: true } }));

    fireEvent.click(within(row('Rooftop RAK')).getByRole('switch'));
    const sheet = await screen.findByRole('dialog', { name: 'Disable' });
    expect(sheet).toHaveTextContent('Rooftop RAK keeps its history but leaves the strip and the switcher');
    fireEvent.submit(sheet.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 20));
    expect(log.writes.some((w) => w.path === '/api/sources/src-rak')).toBe(false);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/sources/src-rak', body: { enabled: false } }));
  });

  it('Delete asks with today\'s words and sends one DELETE', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    await menu('Rooftop RAK', 'Delete');
    const sheet = await screen.findByRole('dialog', { name: 'Delete Source' });
    expect(sheet).toHaveTextContent('Are you sure you want to delete this source? This will remove the source and all its data.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/sources/src-rak', body: undefined }));
    expect(log.writes.filter((w) => w.method === 'DELETE')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText('Rooftop RAK')).toBeNull());
  });

  it('Resync is offered on a connected Meshtastic node only, and says what it sends', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    fireEvent.click(within(row('Rooftop RAK')).getByRole('button', { name: 'More for Rooftop RAK' }));
    expect(screen.queryByRole('menuitem', { name: 'Resync' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await menu('Station G2', 'Resync');
    const sheet = await screen.findByRole('dialog', { name: 'Resync' });
    expect(sheet).toHaveTextContent('Force a fresh config/NodeDB sync from the device. Respects a 30s cooldown.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Resync' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/sources/src-g2/resync', body: undefined }));
  });

  it('Prune Outside ROI is offered on a bridge with a geofence and reports the count', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    await menu('Old bridge', 'Prune Outside ROI');
    const sheet = await screen.findByRole('dialog', { name: 'Prune Outside ROI' });
    expect(sheet).toHaveTextContent('Delete every node from this bridge whose last-known position is outside the configured bounding box.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Prune Outside ROI' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/sources/src-oldbridge/prune-outside-roi', body: undefined }));
    expect(await screen.findByText('Pruned 4 node(s) outside the ROI.')).toBeInTheDocument();
  });

  it('Edit opens the flow on the device; a stored password stays out of the field and out of the save', async () => {
    const { log } = renderDevices();
    await screen.findByText('Old bridge');
    await menu('Old bridge', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit device' });
    const password = within(dialog).getByLabelText('Password');
    expect(password).toHaveValue('');
    expect(password).toHaveAttribute('placeholder', 'Unchanged (leave blank to keep)');
    // The edit form shows the URL as stored, as today's modal does for an admin.
    expect(within(dialog).getByLabelText('Upstream URL')).toHaveValue('mqtt://meshdev:large4cats@mqtt.meshtastic.org:1883');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Old bridge');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.some((w) => w.method === 'PUT' && w.path === '/api/sources/src-oldbridge')).toBe(true));
    const put = log.writes.find((w) => w.method === 'PUT' && w.path === '/api/sources/src-oldbridge')!;
    expect(JSON.stringify(put.body)).not.toContain('password');
    // `enabled: true` is today's DashboardPage body, kept on purpose (Rule X): saving an edit
    // re-enables a disabled device, exactly as today's Edit Source does.
    expect(put.body).toMatchObject({ name: 'Old bridge', type: 'mqtt_bridge', enabled: true });
  });

  it('Add device in the head opens the flow (?add=1), and closing it leaves the list', async () => {
    renderDevices();
    await screen.findByText('Old bridge');
    fireEvent.click(screen.getAllByRole('link', { name: /Add device/ }).find((l) => l.textContent?.includes('Add device'))!);
    await screen.findByRole('dialog', { name: 'Add device' });
    expect(screen.getByTestId('where')).toHaveTextContent('/server/devices');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add device' })).toBeNull());
  });

  it('a settings writer who is not an admin: no permission, and no Add device', async () => {
    renderDevices('/server/devices?add=1', { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add device' })).toBeNull();
  });

  it('Edit fills the form before its first render: no default Meshtastic form flashes', async () => {
    renderDevices();
    await screen.findByText('Old bridge');
    fireEvent.click(within(row('Old bridge')).getByRole('button', { name: 'More for Old bridge' }));
    const item = await screen.findByRole('menuitem', { name: 'Edit' });
    const seen = new MutationObserver(() => {});
    seen.observe(document.body, { childList: true, subtree: true });
    fireEvent.click(item);
    // A first render of the default form would show up as nodes removed by the fill that follows.
    const removed = seen.takeRecords().flatMap((r) => Array.from(r.removedNodes)).map((n) => n.textContent ?? '');
    seen.disconnect();
    expect(removed.some((text) => text.includes('Meshtastic node over the network') || text.includes('Host / IP'))).toBe(false);
    expect(within(screen.getByRole('dialog', { name: 'Edit device' })).getByLabelText('Upstream URL')).toBeInTheDocument();
  });

  it('phone: the head\'s Add device is a phone target', async () => {
    renderDevices('/server/devices', { phone: true });
    await screen.findByText('Old bridge');
    const add = screen.getAllByRole('link', { name: /Add device/ }).find((l) => l.textContent?.includes('Add device'))!;
    // Devices.module.css: `.button[data-phone] { min-height: 44px }` (jsdom computes no CSS).
    expect(add).toHaveAttribute('data-phone');
  });
});
