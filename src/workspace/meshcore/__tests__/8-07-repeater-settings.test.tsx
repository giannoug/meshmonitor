/**
 * @vitest-environment jsdom
 *
 * Board 8-07 (desktop): Settings › Remote: Lycabettus Repeater › Settings.
 * Today's remote settings form (RepeaterSettingsForm, remote mode): each group
 * reads only when asked (Read / Read again), a save sends only the changed
 * fields, Import / Export settings; and the access list form (setperm, one
 * command per Apply). It needs an admin login, as today, and never logs in on
 * its own.
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
  await screen.findByTestId('repeater-read-identity');
}

async function readAll() {
  for (const g of ['identity', 'adverts', 'access']) {
    fireEvent.click(screen.getByTestId(`repeater-read-${g}`));
    await waitFor(() => expect(screen.getByTestId(`repeater-read-${g}`)).toHaveTextContent('Read again'));
  }
}

describe('8-07-repeater-settings', () => {
  it('8-07-repeater-settings shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    await readAll();
    expectBoard('8-07-repeater-settings', container);
  });

  it('logged out, Settings shows the login and today\'s words, and reads nothing', async () => {
    const { log } = renderMeshCore(route);
    expect(await screen.findByText('Log in as admin first. Settings never log in on their own.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByTestId('repeater-read-identity')).toBeNull();
    await settle();
    expect(log.writes).toHaveLength(0);
  });

  it('each Read sends one request; a save sends only the changed field, once', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    expect(screen.getByText('Read: sends 1 request per value over the mesh')).toBeInTheDocument();
    expect(screen.getByText('Sends 1 message over the mesh per changed field')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByTestId('repeater-read-adverts'));
    await waitFor(() => expect(screen.getByTestId('repeater-read-adverts')).toHaveTextContent('Read again'));
    expect(log.writes.filter((w) => w.path === `${ADMIN}/settings/${MC.lycabettus}/read`)).toHaveLength(1);
    expect(log.writes[0].body).toEqual({ groups: ['adverts'] });
    fireEvent.change(screen.getByLabelText('Flood advert interval'), { target: { value: '12' } });
    fireEvent.blur(screen.getByLabelText('Flood advert interval'));
    fireEvent.click(screen.getByTestId('repeater-save'));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(1));
    expect(log.writes.find((w) => w.method === 'PATCH')!.body).toEqual({ floodAdvertInterval: 12 });
    await settle();
    expect(log.writes.filter((w) => w.method === 'PATCH')).toHaveLength(1);
  });

  it('the access list form sends one setperm per Apply, with its Sends line', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const acl = screen.getByRole('region', { name: 'Manage access list' });
    expect(screen.getByText('Apply: sends 1 setperm command to Lycabettus Repeater')).toBeInTheDocument();
    fireEvent.change(within(acl).getByPlaceholderText('0123456789abcdef…'), { target: { value: MC.nikos } });
    fireEvent.click(within(acl).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === `${ADMIN}/cli`)).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ publicKey: MC.lycabettus, command: `setperm ${MC.nikos} 1` });
    expect(await screen.findByText('OK')).toBeInTheDocument();
  });

  it('opening Settings and re-rendering send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await screen.findByRole('button', { name: 'Resume session' });
    const before = vi.mocked(fetch).mock.calls.length;
    rerenderWorkspace();
    rerenderWorkspace();
    await settle();
    expect(log.writes).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.slice(before).filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toHaveLength(0);
  });

  it('the values read stay when moving to the Console and back', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    fireEvent.click(screen.getByTestId('repeater-read-identity'));
    await waitFor(() => expect(screen.getByTestId('repeater-read-identity')).toHaveTextContent('Read again'));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: 'Console' }));
    await screen.findByPlaceholderText('Type a command (e.g. ver, stats, neighbors)');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: 'Settings' }));
    await waitFor(() => expect(screen.getByTestId('repeater-read-identity')).toHaveTextContent('Read again'));
    expect(log.writes.filter((w) => w.path.endsWith('/read'))).toHaveLength(1);
  });
});
