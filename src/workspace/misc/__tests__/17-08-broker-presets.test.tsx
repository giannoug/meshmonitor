/**
 * @vitest-environment jsdom
 *
 * Boards 17-08-broker-presets (desktop) and 17-15-broker-presets (phone),
 * Task 9.2: the MQTT bridge's Broker preset picker (12-13) with Save as preset
 * and Manage saved presets, drawn as Workspace sheets on today's logic
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
import { renderSettings } from '../../settings/__tests__/renderSettings';
import { BRIDGE } from '../../settings/__tests__/meshmonitorFixtures';
import { brokerPresetFixtures } from '../../__fixtures__/oddPages';
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

describe('17-08-broker-presets', () => {
  it('17-08-broker-presets shows the board (the page, then each sheet in turn)', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(route, { fixtures: brokerPresetFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Broker preset' })).toHaveDisplayValue('Athens community'));
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
    expect(within(save).getByLabelText('Broker host')).toHaveValue('mqtt.athensmesh.gr');
    expect(within(save).getByLabelText('Port')).toHaveValue(8883);
    expect(within(save).getByRole('checkbox', { name: 'Use TLS' })).toBeChecked();

    expectBoard('17-08-broker-presets', joined(page, list, save));
  });

  it('17-15-broker-presets shows the board', async () => {
    renderSettings(route, { phone: true, fixtures: brokerPresetFixtures() });
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
    fireEvent.click(within(form).getByRole('button', { name: 'Save preset' }));
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
    fireEvent.click(within(form).getByRole('button', { name: 'Save preset' }));
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
    fireEvent.click(within(save).getByRole('button', { name: 'Save preset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes()).toEqual(['POST /api/mqtt-broker-presets']);
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toMatchObject({ name: 'Athens community (TLS)', host: 'mqtt.athensmesh.gr', port: 8883, tls: true, username: 'athens' });
  });
});
