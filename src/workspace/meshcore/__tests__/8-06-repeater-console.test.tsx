/**
 * @vitest-environment jsdom
 *
 * Board 8-06 (desktop): Settings › Remote: Lycabettus Repeater › Console. The
 * settings list configures the remote target ("Configuring Remote: …"); the
 * page has today's login (guest or admin, remember, resume the remembered
 * session), the remote node status (Fetch stats, never automatic), the quick
 * actions and transcript on today's CliConsoleBody, today's command history,
 * and a destructive command that asks in a ConfirmSheet first (note s8n2).
 * Every control that sends carries its Sends line (note s8n1).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/console?node=${MC.lycabettus}`;
const ADMIN = '/api/sources/src-heltec/meshcore/admin';
const cliWrites = (log: { writes: Array<{ path: string; body: unknown }> }) => log.writes.filter((w) => w.path === `${ADMIN}/cli`);
const settle = () => new Promise((r) => setTimeout(r, 100));

async function resume() {
  fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
  await screen.findAllByText('Logged in');
}

describe('8-06-repeater-console', () => {
  it('8-06-repeater-console shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await screen.findByRole('button', { name: 'Resume session' });
    // Before logging in the login card shows Guest / Admin and Remember.
    const before = container.textContent ?? '';
    await resume();
    const unfetched = container.textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Fetch stats' }));
    await screen.findByText('4.11 V');
    await screen.findByRole('button', { name: 'Load more' });
    fireEvent.click(screen.getByRole('button', { name: 'reboot' }));
    await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    expectBoard('8-06-repeater-console', joined(before, unfetched, document.body));
  });

  it('the settings list configures the remote target and lists its Settings and Console', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    expect(await within(nav).findByText('On Lycabettus Repeater')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', `${HELTEC}/settings/node-settings`);
    expect(within(nav).getByRole('link', { name: 'Console' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Configuring Remote: Lycabettus Repeater/ })).toBeInTheDocument();
    expect(await screen.findByText(/Remote repeater · Lycabettus Repeater · 3fa1…0000 · direct · SNR 6.5 dB/)).toBeInTheDocument();
  });

  it('an admin login sends one request; the password stays out of the URL, the page and browser storage', async () => {
    const { log, container } = renderMeshCore(route);
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.change(field, { target: { value: 'hunter22' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remember this password on the server' }));
    expect(screen.getByText('Each attempt sends 1 login message to Lycabettus Repeater · up to 3 attempts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findAllByText('Logged in');
    const logins = log.writes.filter((w) => w.path === `${ADMIN}/login`);
    expect(logins).toHaveLength(1);
    expect(logins[0].body).toMatchObject({ publicKey: MC.lycabettus, password: 'hunter22', rememberPassword: true });
    for (const [url] of vi.mocked(fetch).mock.calls) expect(String(url)).not.toContain('hunter22');
    expect(container.textContent).not.toContain('hunter22');
    expect(JSON.stringify({ ...localStorage })).not.toContain('hunter22');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('hunter22');
  });

  it('a guest login sends an empty password, with no password field', async () => {
    const { log } = renderMeshCore(route);
    fireEvent.click(await screen.findByRole('button', { name: 'Guest' }));
    expect(screen.queryByLabelText('Password')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === `${ADMIN}/login`)).toHaveLength(1));
    expect(log.writes.find((w) => w.path === `${ADMIN}/login`)!.body).toMatchObject({ password: '' });
  });

  // F.2 D-M2: a guest login never overwrites a stored admin password.
  it('Guest turns Remember off and disables it, so a guest login stores nothing', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByLabelText('Password');
    const remember = screen.getByRole('checkbox', { name: 'Remember this password on the server' });
    await waitFor(() => expect(remember).toBeEnabled());
    fireEvent.click(remember);
    expect(remember).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Guest' }));
    expect(remember).not.toBeChecked();
    expect(remember).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === `${ADMIN}/login`)).toHaveLength(1));
    expect(log.writes.find((w) => w.path === `${ADMIN}/login`)!.body).toMatchObject({ password: '', rememberPassword: false });
  });

  // F.2 D-M3: Forget stored password shows only when one is stored.
  it('a logged-in session with no stored password has no Forget stored password', async () => {
    renderMeshCore(route, {
      meshcore: { adminSession: true },
      fixtures: { 'GET /api/sources/:id/meshcore/admin/credentials-capability': () => ({ success: true, data: { canRemember: true, rotatedCount: 0, rotated: [], stored: [] } }) },
    });
    await resume();
    expect(screen.getByRole('button', { name: /Log out/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Forget stored password' })).toBeNull();
  });

  it('resuming sends nothing; one console command sends one message and shows the reply', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    expect(log.writes).toHaveLength(0);
    expect(screen.getByText('Each command sends 1 encrypted message to Lycabettus Repeater and waits for its reply')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Type a command (e.g. ver, stats, neighbors)');
    fireEvent.change(input, { target: { value: 'ver' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('MeshCore v1.8.2 (Build: 14-Sep-2026)');
    expect(cliWrites(log)).toHaveLength(1);
    expect(cliWrites(log)[0].body).toEqual({ publicKey: MC.lycabettus, command: 'ver' });
  });

  it('a destructive command asks in a ConfirmSheet first; Enter sends nothing; the button sends it once', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const input = screen.getByPlaceholderText('Type a command (e.g. ver, stats, neighbors)');
    fireEvent.change(input, { target: { value: 'reboot' } });
    fireEvent.submit(input.closest('form')!);
    const sheet = await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    expect(within(sheet).getByText('Sends 1 reboot command to Lycabettus Repeater')).toBeInTheDocument();
    expect(cliWrites(log)).toHaveLength(0);
    // Today's typed word: the contact's name.
    const word = within(sheet).getByLabelText('Type Lycabettus Repeater to confirm');
    fireEvent.change(word, { target: { value: 'Lycabettus Repeater' } });
    fireEvent.keyDown(word, { key: 'Enter' });
    fireEvent.submit(sheet.querySelector('form')!);
    await settle();
    expect(cliWrites(log)).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send reboot' }));
    await waitFor(() => expect(cliWrites(log)).toHaveLength(1));
    expect(cliWrites(log)[0].body).toEqual({ publicKey: MC.lycabettus, command: 'reboot', confirm: true });
    await settle();
    expect(cliWrites(log)).toHaveLength(1);
  });

  it('Cancel on the danger confirm sends nothing', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    fireEvent.click(screen.getByRole('button', { name: 'reboot' }));
    const sheet = await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog', { name: 'Confirm destructive command' })).toBeNull();
    expect(cliWrites(log)).toHaveLength(0);
  });

  it('Fetch stats sends one status request per press; nothing fetches it on its own', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    expect(screen.getByText('Sends 1 status request')).toBeInTheDocument();
    expect(screen.getByText('Status is not fetched automatically.')).toBeInTheDocument();
    await settle();
    expect(requests('GET', `${ADMIN}/status/${MC.lycabettus}`)).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fetch stats' }));
    await screen.findByText('4.11 V');
    await settle();
    expect(requests('GET', `${ADMIN}/status/${MC.lycabettus}`)).toBe(1);
  });

  it('opening the console, re-rendering and picking another target send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await screen.findByRole('button', { name: 'Resume session' });
    const before = vi.mocked(fetch).mock.calls.length;
    rerenderWorkspace();
    rerenderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: /Configuring Remote: Lycabettus Repeater/ }));
    const picker = await screen.findByRole('dialog', { name: 'Configuring' });
    // Repeaters and room servers only: the ones today's console logs in to.
    expect(within(picker).getByRole('button', { name: /Athens Room/ })).toBeInTheDocument();
    expect(within(picker).queryByRole('button', { name: /Glyfada Beach/ })).toBeNull();
    expect(within(picker).getByText('Picking a node sends nothing; each category then reads from it')).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole('button', { name: /Penteli Repeater/ }));
    await screen.findByRole('button', { name: /Configuring Remote: Penteli Repeater/ });
    await settle();
    expect(log.writes).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.slice(before).filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toHaveLength(0);
    expect(requests('GET', /\/admin\/status\//)).toBe(0);
  });

  it('receive-only turns the login and the console off with today\'s reason', async () => {
    renderMeshCore(route, {
      meshcore: { adminSession: true },
      fixtures: { 'GET /api/device/tx-status': () => ({ txEnabled: false, canTransmit: false }) },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume session' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
    expect(screen.getAllByText(/Receive-only mode is on for this MeshCore source/).length).toBeGreaterThan(0);
  });

  it('the quick actions are exactly today\'s catalog, each labelled with its command', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const group = screen.getByRole('group', { name: 'Quick actions' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'ver', 'neighbors', 'discover.neighbors', 'clock', 'clock sync', 'advert', 'reboot',
    ]);
    // A chip fills the input; only Send sends.
    fireEvent.click(within(group).getByRole('button', { name: 'clock sync' }));
    expect(screen.getByPlaceholderText('Type a command (e.g. ver, stats, neighbors)')).toHaveValue('clock sync');
  });

  it('the reboot confirm lists what happens (ConfirmSheet consequences) and keeps today\'s typed name', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    fireEvent.click(screen.getByRole('button', { name: 'reboot' }));
    const sheet = await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    expect(within(sheet).getByText('What happens:')).toBeInTheDocument();
    expect(within(sheet).getByText('Lycabettus Repeater restarts; nodes that route through it lose it until it is back')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Send reboot' })).toBeDisabled();
  });

  it('re-renders fetch the credential capability and the session once each, not again', async () => {
    const { rerenderWorkspace } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await screen.findByRole('button', { name: 'Resume session' });
    await settle();
    const cap = () => requests('GET', `${ADMIN}/credentials-capability`);
    const session = () => requests('GET', `${ADMIN}/session/${MC.lycabettus}`);
    expect(cap()).toBe(1);
    expect(session()).toBe(1);
    rerenderWorkspace();
    rerenderWorkspace();
    await settle();
    expect(cap()).toBe(1);
    expect(session()).toBe(1);
  });

  it('Log out and Forget stored password each send one request and nothing to the node', async () => {
    const { log } = renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    fireEvent.click(screen.getByRole('button', { name: 'Forget stored password' }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'DELETE' && w.path === `${ADMIN}/credentials/${MC.lycabettus}`)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Log out/ }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'DELETE' && w.path === `${ADMIN}/session/${MC.lycabettus}`)).toHaveLength(1));
    await settle();
    expect(log.writes).toHaveLength(2);
    expect(cliWrites(log)).toHaveLength(0);
  });

  it('the settings list shows the admin session (8-06)', async () => {
    renderMeshCore(route, { meshcore: { adminSession: true } });
    await resume();
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(nav).getByText('Admin session')).toBeInTheDocument();
    expect(within(nav).getByText('Logged in · admin')).toBeInTheDocument();
  });

  it('without remote_admin:write the frame says so and links the node page; nothing redirects', async () => {
    renderMeshCore(route, {
      permissions: { bySource: { 'src-heltec': { connection: { read: true, write: false }, nodes: { read: true, write: true }, messages: { read: true, write: true } } } },
    });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    expect(screen.getByText('Needs remote_admin:write')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the node page' })).toHaveAttribute('href', `${HELTEC}/node/${MC.lycabettus}`);
    await settle();
    expect(screen.getByRole('link', { name: 'Open the node page' })).toBeInTheDocument();
  });

  it('a key that is no repeater or room server says not found and links the node page', async () => {
    renderMeshCore(`${HELTEC}/settings/console?node=${MC.glyfada}`);
    expect(await screen.findByText('Not found')).toBeInTheDocument();
    expect(screen.getByText("This key is not a repeater or room server in this radio's contacts.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the node page' })).toHaveAttribute('href', `${HELTEC}/node/${MC.glyfada}`);
  });
});
