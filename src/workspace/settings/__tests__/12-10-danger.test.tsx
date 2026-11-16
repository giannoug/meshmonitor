/**
 * @vitest-environment jsdom
 *
 * Boards 12-10-danger-confirm (desktop) and 12-28-purge-confirm (phone), Task
 * 5.7: the danger zone with today's actions and words. Reboot, Shut down and
 * Reboot into DFU ask plainly; Purge node database types PURGE; the two resets
 * type the short name. Shut down, DFU and the resets moved here from Admin
 * Commands (admins only, as today's route); DFU and the resets are for the
 * local node only. Every confirm transmits, so Enter never confirms (BH).
 */
import { useState, type ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import { DataProvider } from '../../../contexts/DataContext';
import { DeviceConfigContext, type SharedDeviceConfig } from '../sharedDeviceConfig';
import DangerCategory from '../categories/DangerCategory';
import { g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const sent = () =>
  vi.mocked(fetch).mock.calls.map(([u, init]) => ({
    what: `${(init?.method ?? 'GET').toUpperCase()} ${new URL(String(u), 'http://x').pathname}`,
    body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
  }));


/** DangerCategory over a config whose short name a test can blank, with no node id in the poll. */
const harness = { blank: () => {} };
function Harness() {
  const [shortName, setShortName] = useState('G2');
  harness.blank = () => setShortName('');
  const config = {
    state: { loading: false, isSaving: false, shortName, longName: 'Station G2' },
    saves: { reboot: vi.fn(), purgeNodeDb: vi.fn() },
  } as unknown as SharedDeviceConfig;
  return (
    <DeviceConfigContext.Provider value={config}>
      <DangerCategory sourceId={SOURCE_IDS.g2} target={{ kind: 'local' }} readOnly={false} />
    </DeviceConfigContext.Provider>
  );
}
const renderHarness = (fixtures = {}) =>
  renderWorkspace(
    <ToastProvider>
      <DataProvider>
        <Harness />
      </DataProvider>
    </ToastProvider>,
    {
      route: `${g2}/settings/maintenance/danger`,
      fixtures: { 'GET /api/poll': () => ({ ...athensFixture.poll, config: { ...athensFixture.poll.config, localNodeInfo: undefined } }), ...fixtures },
    },
  );

const adminCommand = () => sent().find((r) => r.what === 'POST /api/admin/commands')?.body;
const commandFixtures = { 'POST /api/admin/commands': () => ({ success: true, message: 'Command sent' }) };

const open = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name }, { timeout: 10_000 }));
  return screen.findByRole('dialog');
};

describe('12-10-danger-confirm', () => {
  it('12-10-danger-confirm shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(`${g2}/settings/maintenance/danger`);
    const sheet = await open('Purge Node Database');
    expect(within(sheet).getByRole('heading', { name: 'Purge the node database?' })).toBeInTheDocument();
    expectBoard('12-10-danger-confirm', document.body);
    // The page's header: Maintenance › Danger zone.
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Maintenance' })).toHaveAttribute('href', `${g2}/settings/maintenance`);
  });

  it('12-28-purge-confirm shows the board (the Maintenance page on phone)', async () => {
    renderSettings(`${g2}/settings/maintenance`, { phone: true });
    await open('Purge Node Database');
    expectBoard('12-28-purge-confirm', document.body);
  });
});

describe('the danger zone', () => {
  it('Reboot asks plainly with today\'s words, then sends today\'s reboot', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, { fixtures: { 'POST /api/device/reboot': () => ({ success: true }) } });
    const sheet = await open('Reboot Device');
    expect(within(sheet).getByRole('heading', { name: 'Reboot the device?' })).toBeInTheDocument();
    expect(within(sheet).getByText('The device restarts and is offline for about 30 to 60 seconds.')).toBeInTheDocument();
    expect(within(sheet).getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot Device' }));
    await waitFor(() => expect(sent().some((r) => r.what === 'POST /api/device/reboot')).toBe(true));
  });

  it('Purge needs PURGE typed; Enter does not confirm; the sheet is busy while it runs', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`);
    // Hold the purge's reply until the test lets it go.
    let finish: (r: Response) => void = () => {};
    const held = new Promise<Response>((r) => { finish = r; });
    const served = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => (String(input).includes('/api/device/purge-nodedb') ? held : served(input, init)));
    const sheet = await open('Purge Node Database');
    const confirm = within(sheet).getByRole('button', { name: 'Purge Node Database' });
    expect(confirm).toBeDisabled();
    const word = within(sheet).getByRole('textbox', { name: 'Type PURGE to confirm' });
    fireEvent.change(word, { target: { value: 'PURGE' } });
    fireEvent.submit(word.closest('form')!);
    expect(sent().some((r) => r.what === 'POST /api/device/purge-nodedb')).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(sent().some((r) => r.what === 'POST /api/device/purge-nodedb')).toBe(true));
    // TypedConfirmDialog's busy (Ruling DL): the field, Cancel and the confirm are off, with a spinner.
    expect(await within(sheet).findByTestId('confirm-spinner')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(word).toBeDisabled();
    finish(new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Shut down asks plainly for the local node and sends one shutdown in 5 s', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, { fixtures: commandFixtures });
    const sheet = await open('Shut down');
    expect(within(sheet).getByRole('heading', { name: 'Shut down G2?' })).toBeInTheDocument();
    expect(within(sheet).getByText('G2 powers off in 5 seconds and leaves the mesh.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shut down' }));
    await waitFor(() => expect(adminCommand()).toEqual({ command: 'shutdown', sourceId: SOURCE_IDS.g2, seconds: 5 }));
    expect(await screen.findByText('Shutdown sent to G2')).toBeInTheDocument();
  });

  it('Reboot into DFU mode asks plainly with today\'s words', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, { fixtures: commandFixtures });
    const sheet = await open('Reboot into DFU mode');
    expect(within(sheet).getByRole('heading', { name: 'Reboot G2 into DFU mode?' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot into DFU' }));
    await waitFor(() => expect(adminCommand()).toEqual({ command: 'enterDfuMode', sourceId: SOURCE_IDS.g2 }));
  });

  it.each([
    ['Reset config (keeps identity key and BLE bonds)', 'Reset the config of G2?', 'Reset config', 'factoryResetConfig'],
    ['Full device reset (new identity)', 'Fully reset G2?', 'Reset device', 'factoryResetDevice'],
  ])('%s types the short name, lists what it wipes, then sends %s', async (button, title, label, command) => {
    renderSettings(`${g2}/settings/maintenance/danger`, { fixtures: commandFixtures });
    const sheet = await open(button);
    expect(within(sheet).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(sheet).getByText('This wipes:')).toBeInTheDocument();
    const confirm = within(sheet).getByRole('button', { name: label });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Type G2 to confirm' }), { target: { value: 'G2' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(adminCommand()).toEqual({ command, sourceId: SOURCE_IDS.g2 }));
  });

  it('without configuration:write it is View only: Reboot and Purge are off', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false } } } },
    });
    expect(await screen.findByRole('button', { name: 'Reboot Device' }, { timeout: 10_000 })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Purge Node Database' })).toBeDisabled();
    expect(within(screen.getByRole('main')).getByText('View only')).toBeInTheDocument();
  });

  it('Shut down, DFU and the resets are admins only, as today\'s Admin Commands', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: true } } } },
    });
    expect(await screen.findByRole('button', { name: 'Reboot Device' }, { timeout: 10_000 })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Shut down' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reboot into DFU mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reset config/ })).toBeNull();
  });

  it('on a remote target DFU and both resets are off with today\'s reason', async () => {
    const config = {
      state: { loading: false, isSaving: false, shortName: 'G2', longName: 'Station G2' },
      saves: { reboot: vi.fn(), purgeNodeDb: vi.fn() },
    } as unknown as SharedDeviceConfig;
    renderWorkspace(
      <ToastProvider>
        <DataProvider>
          <DeviceConfigContext.Provider value={config}>
            <DangerCategory sourceId={SOURCE_IDS.g2} target={{ kind: 'remote', nodeNum: 0xa1b2c301 }} readOnly={false} />
          </DeviceConfigContext.Provider>
        </DataProvider>
      </ToastProvider>,
      { route: `${g2}/settings/maintenance/danger` },
    );
    for (const name of ['Reboot into DFU mode', 'Reset config (keeps identity key and BLE bonds)', 'Full device reset (new identity)']) {
      expect(await screen.findByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getAllByText('Only for the node this source is connected to. Select the local node to use it.')).toHaveLength(2);
  });

  it('Shut down is off with today\'s note when the node says it cannot shut down (cached metadata, no packet)', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      fixtures: { 'POST /api/admin/get-device-metadata': () => ({ deviceMetadata: { canShutdown: false } }) },
    });
    expect(await screen.findByText('This node\'s metadata says it cannot shut down.', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shut down' })).toBeDisabled();
    // The local node's cached answer: no nodeNum, so the route reads the manager's cache and sends nothing.
    expect(sent().filter((r) => r.what === 'POST /api/admin/get-device-metadata').map((r) => r.body)).toEqual([{ sourceId: SOURCE_IDS.g2 }]);
  });

  it('Shut down stays on while the node has said nothing (canShutdown null), as Admin Commands', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      fixtures: { 'POST /api/admin/get-device-metadata': () => ({ deviceMetadata: { canShutdown: null } }) },
    });
    await waitFor(() => expect(sent().some((r) => r.what === 'POST /api/admin/get-device-metadata')).toBe(true), { timeout: 10_000 });
    expect(await screen.findByRole('button', { name: 'Shut down' })).toBeEnabled();
    expect(screen.queryByText('This node\'s metadata says it cannot shut down.')).toBeNull();
  });

  it('a TX-disabled refusal toasts today\'s words (Admin Commands\' mapping)', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      fixtures: {
        'POST /api/admin/commands': () =>
          new Response(JSON.stringify({ success: false, error: 'TX disabled', code: 'TX_DISABLED' }), { status: 409, headers: { 'content-type': 'application/json' } }),
      },
    });
    const sheet = await open('Reboot into DFU mode');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot into DFU' }));
    expect(await screen.findByText('Transmit is disabled on this source — nothing was sent.')).toBeInTheDocument();
    expect(screen.queryByText(/DFU request sent/)).toBeNull();
  });

  it('a reset sheet keeps the word it opened with, so a blank name never turns it plain', async () => {
    renderHarness();
    const sheet = await open('Reset config (keeps identity key and BLE bonds)');
    act(() => harness.blank());
    expect(within(sheet).getByRole('textbox', { name: 'Type G2 to confirm' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Reset config' })).toBeDisabled();
    // The page's buttons are off now that there is no word to type.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Reset config (keeps identity key and BLE bonds)' })).toBeDisabled();
  });

  it('the sent notice names the node as it was when the command went out', async () => {
    renderHarness(commandFixtures);
    const sheet = await open('Shut down');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shut down' }));
    expect(await screen.findByText('Shutdown sent to G2')).toBeInTheDocument();
    act(() => harness.blank());
    expect(screen.getByText('Shutdown sent to G2')).toBeInTheDocument();
  });
});
