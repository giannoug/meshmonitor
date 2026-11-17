/**
 * @vitest-environment jsdom
 *
 * Boards h2 (Meshtastic, desktop), i2 (MeshCore, phone), 18-09 (Reticulum
 * attach, desktop) and 18-10 (Reticulum TCP peer, phone), Task 6.6: Add
 * device, step 2. Today's per-type fields and checks (`useSourceForm`).
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderDevices } from './devicesHarness';

const ADD = '/server/devices?add=1';

async function toConnection(type: string, phone = false) {
  const dialog = await screen.findByRole('dialog', { name: 'Add device' });
  fireEvent.click(within(dialog).getByRole('radio', { name: type }));
  if (!phone) fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  await within(dialog).findByText(phone ? 'Step 2 of 3' : 'Connection');
  return dialog;
}

describe('step 2: connection', () => {
  it('h2-add-connection shows the board', async () => {
    renderDevices(ADD);
    await toConnection('Meshtastic node');
    await screen.findByText('Meshtastic node over the network');
    expectBoard('h2-add-connection', document.body);
  });

  it('i2-meshcore shows the board', async () => {
    renderDevices(ADD, { phone: true });
    await toConnection('MeshCore', true);
    await screen.findByText('Connected by');
    expectBoard('i2-meshcore', document.body);
  });

  it('18-09-add-reticulum shows the board', async () => {
    renderDevices(ADD);
    await toConnection('Reticulum');
    await screen.findByText('Config directory');
    expectBoard('18-09-add-reticulum', document.body);
  });

  it('18-10-add-reticulum shows the board', async () => {
    renderDevices(ADD, { phone: true });
    const dialog = await toConnection('Reticulum', true);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'TCP peer' }));
    fireEvent.change(within(dialog).getByLabelText('Host / IP'), { target: { value: 'amsterdam.connect.reticulum.network' } });
    expectBoard('18-10-add-reticulum', document.body);
    expect(within(dialog).getByLabelText('TCP Port')).toHaveValue(4965);
    expect(within(dialog).queryByLabelText('Config directory')).toBeNull();
  });

  it('Next checks today\'s connection fields first, with today\'s words', async () => {
    const { log } = renderDevices(ADD);
    const dialog = await toConnection('Meshtastic node');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Host is required');
    fireEvent.change(within(dialog).getByLabelText('Host / IP'), { target: { value: '192.168.1.40' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByLabelText('Name')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
  });

  it('MeshCore: today\'s fields, and Repeater turns the untouched heartbeat off (#5563)', async () => {
    renderDevices(ADD);
    const dialog = await toConnection('MeshCore');
    expect(within(dialog).getByLabelText('Serial port')).toHaveAttribute('placeholder', '/dev/ttyACM0');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Network' }));
    expect(within(dialog).getByLabelText('TCP Port')).toHaveValue(5000);
    fireEvent.click(within(dialog).getByText('Advanced · heartbeat, virtual node'));
    const heartbeat = within(dialog).getByLabelText('Heartbeat (seconds, 0 = off)');
    expect(heartbeat).toHaveValue(30);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Repeater' }));
    expect(heartbeat).toHaveValue(0);
    expect(within(dialog).getByText('Repeaters have no chat. You get their console, stats and neighbours.')).toBeInTheDocument();
  });

  it('the Bridge token is a masked field', async () => {
    renderDevices(ADD);
    const dialog = await toConnection('Reticulum');
    expect(within(dialog).getByLabelText('Bridge token')).toHaveAttribute('type', 'password');
  });
});
