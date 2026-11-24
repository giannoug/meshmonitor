/**
 * @vitest-environment jsdom
 *
 * Boards 17-08-broker-presets (desktop) and 17-15-broker-presets (phone),
 * Task 9.2: the Broker preset picker's Save as preset and Manage saved presets
 * on Station G2's Modules › MQTT (today's section, Ruling 5.6, as the board
 * draws it) and on the MQTT bridge page (12-13), drawn as Workspace sheets on today's logic
 * (useSaveBrokerPresetForm / useManageBrokerPresets). One sheet at a time
 * (D9c; s17n4: 17-08 draws two side by side only to fit), so the board is
 * collected in turn. Edit and Duplicate open the form titled Edit preset /
 * Duplicate preset ("Copy of …"); Delete keeps today's inline "Delete this
 * preset?". A preset only fills in MQTT forms: opening sends nothing, and each
 * save or delete is one request to MeshMonitor.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { g2, renderSettings } from '../../settings/__tests__/renderSettings';
import { BRIDGE } from '../../settings/__tests__/meshmonitorFixtures';
import { brokerPresetFixtures, presetRoutes } from '../../__fixtures__/oddPages';
import { resetBrokerPresetsForTests } from '../../../hooks/useMqttBrokerPresets';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
vi.mock('../../../components/BBoxMapEditor', () => ({ default: () => <div data-testid="bbox-editor" /> }));

beforeEach(() => resetBrokerPresetsForTests());
afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const route = `/source/${BRIDGE}/settings/mqtt-bridge`;
const deviceMqtt = `${g2}/settings/modules/mqtt`;
const writes = () =>
  vi.mocked(fetch).mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([u, init]) => `${init?.method} ${new URL(String(u), 'http://x').pathname}`);

const open = async (name: string) => {
  const button = await screen.findByRole('button', { name }, T);
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.findByRole('dialog');
};
const row = (sheet: HTMLElement, name: string) => within(sheet).getByText(name).closest('li')!;
/** Clicks a button once it is enabled. */
const press = async (button: HTMLElement) => {
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
};

describe('17-08-broker-presets', () => {
  it('17-08-broker-presets shows the board (Modules › MQTT, then each sheet in turn)', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(deviceMqtt, { fixtures: presetRoutes() });
    await screen.findByText('Fills in the broker address, TLS and login. Nothing is sent until you save.', {}, T);
    await screen.findByText('Athens community', {}, T);
    const page = document.body.textContent ?? '';

    const manage = await open('Manage saved presets');
    expect(manage).toHaveAccessibleName('Saved broker presets');
    fireEvent.click(within(row(manage, 'Piraeus test broker')).getByRole('button', { name: 'Delete' }));
    expect(within(row(manage, 'Piraeus test broker')).getByText('Delete this preset?')).toBeInTheDocument();
    const list = manage.textContent ?? '';
    fireEvent.click(within(manage).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const save = await open('Save as preset');
    expect(save).toHaveAccessibleName('Save as preset');
    expect(within(save).getByLabelText('Broker host')).toHaveValue('mqtt.meshtastic.org');

    expectBoard('17-08-broker-presets', joined(page, list, save));
  });

  it('Modules › MQTT opens the Workspace sheets, not today\'s dialogs', async () => {
    renderSettings(deviceMqtt, { fixtures: presetRoutes() });
    await open('Manage saved presets');
    expect(screen.queryByTestId('manage-broker-presets-dialog')).toBeNull();
    expect(document.querySelector('.modal-overlay')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await open('Save as preset');
    expect(screen.queryByTestId('save-broker-preset-dialog')).toBeNull();
    expect(writes()).toEqual([]);
  });

  it('the bridge page (12-13) opens the same sheets', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Broker preset' })).toHaveDisplayValue('Athens community'));
    expect(await open('Manage saved presets')).toHaveAccessibleName('Saved broker presets');
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const save = await open('Save as preset');
    expect(within(save).getByLabelText('Broker host')).toHaveValue('mqtt.athensmesh.gr');
    expect(within(save).getByLabelText('Port')).toHaveValue(8883);
    expect(within(save).getByRole('checkbox', { name: 'Use TLS' })).toBeChecked();
  });

  it('17-15-broker-presets shows the board', async () => {
    renderSettings(deviceMqtt, { phone: true, fixtures: presetRoutes() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Piraeus test broker')).getByRole('button', { name: 'Delete' }));
    expectBoard('17-15-broker-presets', manage);
  });

  it('opening the sheets sends nothing', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Athens community')).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog', { name: 'Edit preset' });
    expect(writes()).toEqual([]);
  });

  it('Delete asks first in its row, then sends one DELETE per press', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    const piraeus = row(manage, 'Piraeus test broker');
    fireEvent.click(within(piraeus).getByRole('button', { name: 'Delete' }));
    expect(writes()).toEqual([]);
    // Cancel keeps it.
    fireEvent.click(within(piraeus).getByRole('button', { name: 'Cancel' }));
    expect(within(piraeus).queryByText('Delete this preset?')).toBeNull();
    fireEvent.click(within(piraeus).getByRole('button', { name: 'Delete' }));
    const confirm = within(piraeus).getByTestId('saved-broker-preset-confirm-delete-2');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(writes()).toEqual(['DELETE /api/mqtt-broker-presets/2']));
  });

  it('Edit opens the form titled Edit preset; Save preset is one PUT and goes back to the list', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Athens community')).getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit preset' });
    expect(within(form).getByLabelText('Preset name')).toHaveValue('Athens community');
    expect(within(form).getByLabelText('Root topic (optional)')).toHaveValue('msh/EU_868/GR');
    fireEvent.change(within(form).getByLabelText('Preset name'), { target: { value: 'Athens community (TLS)' } });
    await press(within(form).getByRole('button', { name: 'Save preset' }));
    await screen.findByRole('dialog', { name: 'Saved broker presets' });
    expect(writes()).toEqual(['PUT /api/mqtt-broker-presets/1']);
    const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(String(put[1]?.body))).toMatchObject({ name: 'Athens community (TLS)', host: 'mqtt.athensmesh.gr', port: 8883, tls: true });
  });

  it('Duplicate opens the form titled Duplicate preset with "Copy of …"; Save preset is one POST', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Meshtastic EU mirror')).getByRole('button', { name: 'Duplicate' }));
    const form = await screen.findByRole('dialog', { name: 'Duplicate preset' });
    expect(within(form).getByLabelText('Preset name')).toHaveValue('Copy of Meshtastic EU mirror');
    await press(within(form).getByRole('button', { name: 'Save preset' }));
    await screen.findByRole('dialog', { name: 'Saved broker presets' });
    expect(writes()).toEqual(['POST /api/mqtt-broker-presets']);
  });

  it('Cancel on the form goes back to the list; Esc closes only the form', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Athens community')).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Edit preset' })).getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('dialog', { name: 'Saved broker presets' });
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Athens community').closest('li')!.querySelector('button')!);
    await screen.findByRole('dialog', { name: 'Edit preset' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByRole('dialog', { name: 'Saved broker presets' })).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('Save as preset is one POST of the form\'s broker values', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const save = await open('Save as preset');
    fireEvent.change(within(save).getByLabelText('Preset name'), { target: { value: 'Athens community (TLS)' } });
    await press(within(save).getByRole('button', { name: 'Save preset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes()).toEqual(['POST /api/mqtt-broker-presets']);
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toMatchObject({ name: 'Athens community (TLS)', host: 'mqtt.athensmesh.gr', port: 8883, tls: true, username: 'athens' });
  });
  it('Edit and Duplicate keep today\'s intro above the form', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Athens community')).getByRole('button', { name: 'Duplicate' }));
    const form = await screen.findByRole('dialog', { name: 'Duplicate preset' });
    expect(within(form).getByText(/Changing or deleting a preset does not change any source or radio/)).toBeInTheDocument();
  });

  it('Esc in Find topics closes only the finder: the Edit form stays, with its typed values', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const manage = await open('Manage saved presets');
    fireEvent.click(within(row(manage, 'Athens community')).getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit preset' });
    fireEvent.change(within(form).getByLabelText('Preset name'), { target: { value: 'Athens (edited)' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Find topics' }));
    await screen.findByRole('dialog', { name: 'Find MQTT topics' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find MQTT topics' })).toBeNull());
    const still = screen.getByRole('dialog', { name: 'Edit preset' });
    expect(within(still).getByLabelText('Preset name')).toHaveValue('Athens (edited)');
    // The next Esc, with no finder open, goes back to the list.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByRole('dialog', { name: 'Saved broker presets' })).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('Esc in Find topics leaves Save as preset open', async () => {
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    const save = await open('Save as preset');
    fireEvent.change(within(save).getByLabelText('Preset name'), { target: { value: 'Mine' } });
    fireEvent.click(within(save).getByRole('button', { name: 'Find topics' }));
    await screen.findByRole('dialog', { name: 'Find MQTT topics' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find MQTT topics' })).toBeNull());
    expect(within(screen.getByRole('dialog', { name: 'Save as preset' })).getByLabelText('Preset name')).toHaveValue('Mine');
  });
});
