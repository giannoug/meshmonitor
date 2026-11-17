/**
 * @vitest-environment jsdom
 *
 * Board 8-07 (desktop): Settings › Remote: Lycabettus Repeater › Settings, on
 * the settings row kit (Ruling 7.3 HH): Read again / Import / Export in the
 * header, two columns of rows (a value and a chevron that opens its field,
 * "was …" while edited, the hop-limit stepper, switches), the access list,
 * and the dock "N changes · Save repeater settings" with its Sends line,
 * Discard changes and Send to node. Today's logic: a read only when asked,
 * a save of the changed fields only, never a login of its own.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/node-settings?node=${MC.lycabettus}`;
const ADMIN = '/api/sources/src-heltec/meshcore/admin';
const settle = () => new Promise((r) => setTimeout(r, 100));

async function resume() {
  fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
  return screen.findByRole('button', { name: /^Read$/ });
}

async function readAll() {
  fireEvent.click(await resume());
  await screen.findByRole('button', { name: /Read again/ });
}

/** Opens a row's field (its value + chevron), types a value, and closes the sheet with Done. */
async function edit(label: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  const sheet = await screen.findByRole('dialog', { name: label });
  const field = within(sheet).getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
  fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: label })).toBeNull());
}

describe('8-07-repeater-settings', () => {
  it('8-07-repeater-settings shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await readAll();
    await edit('Flood advert interval', '12');
    expect(await screen.findByText('was 24 h')).toBeInTheDocument();
    expectBoard('8-07-repeater-settings', container);
  });

  it('logged out, Settings shows the login and today\'s words, and reads nothing', async () => {
    const { log } = renderMeshCore(route);
    expect(await screen.findByText('Log in as admin first. Settings never log in on their own.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Read$/ })).toBeNull();
    await settle();
    expect(log.writes).toHaveLength(0);
  });

  it('Read sends one request for all three groups; Send to node sends only the changed field, once', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    const read = await resume();
    expect(screen.getByText('Read again: sends 1 request per value over the mesh')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    // Nothing changed yet: the dock waits, Send to node off.
    expect(screen.getByText('No changes yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to node' })).toBeDisabled();
    fireEvent.click(read);
    await screen.findByRole('button', { name: /Read again/ });
    expect(log.writes).toEqual([
      { method: 'POST', path: `${ADMIN}/settings/${MC.lycabettus}/read`, body: { groups: ['identity', 'adverts', 'access'] } },
    ]);
    await edit('Flood advert interval', '12');
    expect(screen.getByText('1 change · Save repeater settings')).toBeInTheDocument();
    expect(screen.getByText('Sends 1 message over the mesh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to node' }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(1));
    expect(log.writes.find((w) => w.method === 'PATCH')!.body).toEqual({ floodAdvertInterval: 12 });
    await settle();
    expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(1);
    expect(log.writes).toHaveLength(2);
  });

  it('the hop limit is a stepper; Discard changes puts the read value back and sends nothing', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await readAll();
    const hop = screen.getByRole('group', { name: 'Adverts & forwarding' });
    fireEvent.click(within(hop).getByRole('button', { name: 'Increase' }));
    expect(await screen.findByText('was 8 hops')).toBeInTheDocument();
    expect(screen.getByText('Sends 1 message over the mesh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.queryByText('was 8 hops')).toBeNull());
    expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(0);
  });

  it('the access list form sends one setperm per Apply, with its Sends line', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const acl = screen.getByRole('region', { name: 'Manage access list' });
    expect(within(acl).getByText('Apply: sends 1 setperm command to Lycabettus Repeater')).toBeInTheDocument();
    fireEvent.change(within(acl).getByLabelText('Public key (64 hex)'), { target: { value: MC.nikos } });
    fireEvent.click(within(acl).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === `${ADMIN}/cli`)).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ publicKey: MC.lycabettus, command: `setperm ${MC.nikos} 1` });
    expect(await within(acl).findByText('OK')).toBeInTheDocument();
  });

  it('opening Settings and re-rendering send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const before = vi.mocked(fetch).mock.calls.length;
    rerenderWorkspace();
    rerenderWorkspace();
    await settle();
    expect(log.writes).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.slice(before)).toHaveLength(0);
  });

  it('an unsaved draft and the values read survive Settings → Console → Settings', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await readAll();
    await edit('Flood advert interval', '12');
    const nav = () => screen.getByRole('navigation', { name: 'Settings' });
    // Inside the device's settings the leave guard does not ask.
    fireEvent.click(within(nav()).getByRole('link', { name: 'Console' }));
    await screen.findByPlaceholderText('Type a command (e.g. ver, stats, neighbors)');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(nav()).getByRole('link', { name: 'Settings' }));
    expect(await screen.findByText('was 24 h')).toBeInTheDocument();
    expect(screen.getByText('1 change · Save repeater settings')).toBeInTheDocument();
    expect(log.writes.filter((w) => w.path.endsWith('/read'))).toHaveLength(1);
    expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(0);
  });

  it('leaving the device\'s settings with a draft asks first, with today\'s words', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    await readAll();
    await edit('Flood advert interval', '12');
    fireEvent.click(screen.getByTestId('settings-back'));
    const sheet = await screen.findByRole('dialog', { name: /Discard/ });
    expect(within(sheet).getByText(/Flood advert interval/)).toBeInTheDocument();
  });
});
