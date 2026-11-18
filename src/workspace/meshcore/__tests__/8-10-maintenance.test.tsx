/**
 * @vitest-environment jsdom
 *
 * Boards 8-10 (desktop) and 8-27 (phone): Settings › Maintenance (Task 7.4):
 * the radio contact list, Purge non-favourite nodes, Backups and the danger
 * zone, whose confirms dock beside the page (desktop) or rise from the bottom
 * (phone). Today's guards: Reboot asks plainly; Shut down, Restore Private Key
 * and Factory Reset ask for the device name; Remove and Purge say what and how
 * many. Each sends once, from the sheet's button only.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { MC_PRIVATE_KEY } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/maintenance`;
const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const sent = (log: { writes: Array<{ method: string; path: string; body: unknown }> }, tail: string) => log.writes.filter((w) => w.path.endsWith(tail));

async function openDanger(name: RegExp | string) {
  fireEvent.click(await screen.findByRole('button', { name }));
}

describe('8-10-maintenance', () => {
  it('8-10-maintenance shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(route);
    await screen.findByText('Add only these types');
    await openDanger('Factory Reset…');
    const sheet = await screen.findByRole('dialog', { name: 'Factory reset this device?' });
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'Heltec Mesh' } });
    expect(within(sheet).getByRole('button', { name: 'Factory Reset' })).toBeDisabled();
    // On desktop it is docked beside the page (s8n2).
    expect(sheet.closest('[data-side]')).toHaveAttribute('data-side', 'right');
    expectBoard('8-10-maintenance', joined(container, sheet));
  });

  it('Factory Reset: nothing until the device name is typed and the button pressed, then one request with confirm', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Factory Reset…');
    const sheet = await screen.findByRole('dialog', { name: 'Factory reset this device?' });
    // Today's first sentence (meshcore.factory_reset.dialog_body).
    expect(within(sheet).getByText('Heltec MeshCore erases its own storage and restarts. This cannot be undone.')).toBeInTheDocument();
    const word = within(sheet).getByRole('textbox');
    fireEvent.change(word, { target: { value: 'Heltec MeshCore' } });
    // Enter does not confirm (submitOnEnter={false}).
    fireEvent.submit(word.closest('form')!);
    await pause();
    expect(sent(log, '/config/factory-reset')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Factory Reset' }));
    await waitFor(() => expect(sent(log, '/config/factory-reset')).toHaveLength(1));
    expect(sent(log, '/config/factory-reset')[0].body).toEqual({ confirm: true });
    await pause();
    expect(log.writes).toHaveLength(1);
  });

  it('Shut down asks for the device name, then sends one power-off with confirm', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Shut down…');
    const sheet = await screen.findByRole('dialog', { name: 'Power off Heltec MeshCore?' });
    expect(within(sheet).getByRole('button', { name: 'Shut down' })).toBeDisabled();
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'Heltec MeshCore' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shut down' }));
    await waitFor(() => expect(sent(log, '/config/power-off')).toHaveLength(1));
    expect(sent(log, '/config/power-off')[0].body).toEqual({ confirm: true });
    expect(log.writes).toHaveLength(1);
  });

  it('Reboot asks plainly (today) and sends one reboot', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Reboot Device');
    const sheet = await screen.findByRole('dialog', { name: 'Reboot the device?' });
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot Device' }));
    await waitFor(() => expect(sent(log, '/config/reboot')).toHaveLength(1));
  });

  it('Purge non-favourite nodes: reads the count, asks with it, then one request', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Purge…');
    const sheet = await screen.findByRole('dialog', { name: 'Purge non-favourite nodes?' });
    expect(within(sheet).getByText(/deletes 12 non-favourite nodes/)).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 12 nodes' }));
    await waitFor(() => expect(sent(log, '/nodes/purge-non-favourites')).toHaveLength(1));
    await pause();
    expect(log.writes).toHaveLength(1);
  });

  it('Remove non-favourite contacts asks with what and how many, with no typed word', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Remove…');
    const sheet = await screen.findByRole('dialog', { name: 'Remove non-favourite contacts?' });
    expect(within(sheet).getByText('This removes 38 contacts from the radio and keeps 3 favourites.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(sent(log, '/contacts/remove-non-favorites')).toHaveLength(1));
  });

  it('a backup Delete confirm does not submit on Enter (Ruling BH)', async () => {
    renderMeshCore(route);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Delete' })).toHaveAttribute('type', 'button');
  });

  it('Backup Private Key shows the key once with today\'s warning; nothing keeps it', async () => {
    renderMeshCore(route);
    await openDanger('Backup Private Key');
    expect(await screen.findByText(MC_PRIVATE_KEY)).toBeInTheDocument();
    expect(screen.getByText('Store this key securely. Anyone with it can impersonate this device.')).toBeInTheDocument();
    expect(window.location.href).not.toContain(MC_PRIVATE_KEY);
    expect(JSON.stringify({ ...localStorage })).not.toContain(MC_PRIVATE_KEY);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(MC_PRIVATE_KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText(MC_PRIVATE_KEY)).toBeNull());
  });

  it('Restore Private Key: the key and the device name, then one import with confirm', async () => {
    const { log } = renderMeshCore(route);
    await openDanger('Restore Private Key…');
    const sheet = await screen.findByRole('dialog', { name: 'Replace the device identity?' });
    const confirm = within(sheet).getByRole('button', { name: 'Import Key' });
    fireEvent.change(within(sheet).getByLabelText('Private key (hex)'), { target: { value: 'cd'.repeat(64) } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText(/Type Heltec MeshCore to confirm/), { target: { value: 'Heltec MeshCore' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(sent(log, '/config/private-key')).toHaveLength(1));
    expect(sent(log, '/config/private-key')[0].body).toEqual({ privateKey: 'cd'.repeat(64), confirm: true });
  });

  it('opening the page sends nothing to the radio', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText('Add only these types');
    await pause();
    expect(log.writes).toHaveLength(0);
  });

  it('Factory Reset needs a Companion on firmware v7 or later (today)', async () => {
    renderMeshCore(route, { meshcore: { deviceType: 2 } });
    await screen.findByRole('button', { name: 'Reboot Device' });
    // A local repeater offers no factory reset.
    expect(screen.queryByRole('button', { name: 'Factory Reset…' })).toBeNull();
  });
});

describe('8-27-maintenance', () => {
  it('8-27-maintenance shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true });
    await screen.findByText('Add only these types');
    await openDanger('Factory Reset…');
    const sheet = await screen.findByRole('dialog', { name: 'Factory reset this device?' });
    // On the phone the confirm is a bottom sheet (s8n2).
    expect(sheet.closest('[data-side]')).toHaveAttribute('data-side', 'bottom');
    expectBoard('8-27-maintenance', joined(container, sheet));
  });
});
