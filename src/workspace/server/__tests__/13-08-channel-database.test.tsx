/**
 * @vitest-environment jsdom
 *
 * Boards 13-08 (desktop) and 13-17 (phone), Task 6.4: Server › Channel
 * database, admins only, on today's requests and checks (useChannelDatabase).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { CHANNEL_DB } from '../../__fixtures__/server';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/channel-database';

async function decryptAthensOps() {
  fireEvent.click(await screen.findByRole('button', { name: 'More for Athens Ops' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Decrypt' }));
  await screen.findByText('Retroactive Decryption');
}

describe('13-08 / 13-17 channel database', () => {
  it('13-08-channel-database shows the board', async () => {
    const { container } = renderServer(PATH);
    await decryptAthensOps();
    fireEvent.click(screen.getByRole('button', { name: 'Add Channel' }));
    await screen.findByRole('radiogroup', { name: 'Protocol' });
    expectBoard('13-08-channel-database', container);
  });

  it('13-17-channel-database shows the board', async () => {
    const { container } = renderServer(PATH, { phone: true });
    await decryptAthensOps();
    expectBoard('13-17-channel-database', container);
  });

  it('lists both protocols with today\'s masked key line, never the key itself', async () => {
    renderServer(PATH);
    const rows = await screen.findAllByTestId('channel-db-row');
    ['Athens Ops', 'Regional Emergency', '#athens', 'Old club key'].forEach((name, i) => expect(rows[i]).toHaveTextContent(name));
    expect(within(rows[0]).getByText(/PSK: AbCd… \(AES-256\)/)).toBeInTheDocument();
    expect(within(rows[2]).getByText('MeshCore')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(CHANNEL_DB[0].psk);
  });

  it('the switch turns a key off with today\'s request', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('switch', { name: 'Enabled: Athens Ops' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/channel-database/1', body: { isEnabled: false } }));
  });

  it('Add: today\'s checks run before anything is sent; a valid key is posted in the body, never in a URL', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Channel' }));
    fireEvent.change(screen.getByLabelText('Channel Name'), { target: { value: 'Coast' } });
    fireEvent.change(screen.getByLabelText('Pre-Shared Key (PSK)'), { target: { value: 'not base64!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('PSK must be valid Base64')).toBeInTheDocument();
    expect(log.writes.filter((w) => w.path === '/api/channel-database')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
    const psk = (screen.getByLabelText('Pre-Shared Key (PSK)') as HTMLInputElement).value;
    expect(atob(psk)).toHaveLength(32);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.some((w) => w.method === 'POST' && w.path === '/api/channel-database')).toBe(true));
    expect(log.writes.find((w) => w.path === '/api/channel-database')!.body).toEqual({ name: 'Coast', psk, isEnabled: true, enforceNameValidation: false, useAead: false });
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes(encodeURIComponent(psk)) || String(u).includes(psk))).toBe(false);
  });

  it('Delete asks with today\'s "Delete Channel?"', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'More for Old club key' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete Channel?' });
    expect(within(sheet).getByText(/This will permanently delete this channel configuration/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/channel-database/4', body: undefined }));
  });

  it('Decrypt is offered only for an enabled Meshtastic key', async () => {
    renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'More for #athens' }));
    expect(screen.queryByRole('menuitem', { name: 'Decrypt' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'More for Old club key' }));
    expect(screen.queryByRole('menuitem', { name: 'Decrypt' })).toBeNull();
  });

  it('Import from URL decodes, preselects the importable rows and adds them', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Import from URL' }));
    const sheet = await screen.findByRole('dialog', { name: 'Import from URL' });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Meshtastic Channel URL' }), { target: { value: 'https://meshtastic.org/e/#abc' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Decode URL' }));
    expect(await within(sheet).findByRole('checkbox', { name: 'Include LongFast' })).toBeChecked();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add 2 channel(s)' }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'POST' && w.path === '/api/channel-database')).toHaveLength(2));
  });

  it('a non-admin gets no access and nothing is read', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/channel-database'))).toBe(false);
  });
});
