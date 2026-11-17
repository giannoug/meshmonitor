/**
 * @vitest-environment jsdom
 *
 * Boards 13-11 (desktop) and 13-27 (phone), Task 6.5: Server › Integrations,
 * admins only. Keys and connection fields keep their own Save and Test
 * (s13n1): typing writes nothing, a key travels only in a request body.
 * Toggles save as you go in today's stored format.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/integrations';
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));
const settingsWrites = (log: { writes: Array<{ path: string; body?: unknown }> }) => log.writes.filter((w) => w.path === '/api/settings').map((w) => w.body);

async function tested() {
  fireEvent.click(await screen.findByRole('button', { name: /Test Translation Connection/ }));
  await screen.findByText(/Translation service connected successfully!/);
}

describe('13-11 / 13-27 integrations', () => {
  it.each([
    ['13-11-integrations', false],
    ['13-27-integrations', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await tested();
    await screen.findByText(/MQTT root directory refresh/);
    expectBoard(board, container);
  });

  it('the translation key writes nothing while typed; Test uses the typed key; Save writes it trimmed, in the body only', async () => {
    const { log } = renderServer(PATH);
    const key = await screen.findByLabelText('DeepL Auth Key');
    fireEvent.change(key, { target: { value: '  new-deepl-key:fx ' } });
    fireEvent.blur(key);
    await new Promise((r) => setTimeout(r, 20));
    expect(settingsWrites(log)).toHaveLength(0);
    await tested();
    const test = log.writes.find((w) => w.path === '/api/translate/test');
    expect(test?.body).toMatchObject({ provider: 'deepl', apiKey: '  new-deepl-key:fx ', sourceLanguage: 'en', targetLanguage: 'el' });
    fireEvent.click(within(screen.getByRole('group', { name: 'DeepL API (Free / Pro)' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ translationDeeplApiKey: 'new-deepl-key:fx' }));
    expect(urls().some((u) => u.includes('new-deepl-key'))).toBe(false);
  });

  it('toggles save as you go in today\'s stored format', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('switch', { name: 'Enable the ducting overlay (contacts NOAA)' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ ductingOverlayEnabled: 'false' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable CoT feed' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ cotFeedEnabled: '1' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Replay missed messages on reconnect' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ virtualNodeReplayEnabled: '0' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Refresh the community root list (contacts api.meshtastic.org)' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ mqttRootDirectoryRefreshEnabled: 'true' }));
  });

  it('elevation: Test sends the typed URL once; Save writes it trimmed', async () => {
    const { log } = renderServer(PATH);
    const url = await screen.findByRole('textbox', { name: 'Elevation Source URL' });
    fireEvent.change(url, { target: { value: 'https://dem.example.org/{z}/{x}/{y}.png ' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Elevation / Terrain' })).getByRole('button', { name: 'Test' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/elevation/test')).toHaveLength(1));
    expect(log.writes.find((w) => w.path === '/api/elevation/test')?.body).toMatchObject({ url: 'https://dem.example.org/{z}/{x}/{y}.png' });
    expect(await screen.findByText(/OK — open-elevation, 112 m in 80 ms/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Elevation / Terrain' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ elevationSourceUrl: 'https://dem.example.org/{z}/{x}/{y}.png' }));
  });

  it('MeshWars: the key is never shown, Save sends it only when typed, and the location note sits by the source', async () => {
    const { log } = renderServer(PATH);
    const key = await screen.findByLabelText('MeshWars API key');
    expect(key).toHaveValue('');
    expect(key).toHaveAttribute('placeholder', 'Saved. Enter a new key to replace it.');
    expect(screen.getByText(/Sends this radio's position to MeshWars, at most once every 5 minutes/)).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'MeshWars' });
    expect(within(group).getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(key, { target: { value: 'mw-secret ' } });
    fireEvent.click(within(group).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ meshwarsBaseUrl: 'https://meshwars.gr/api', meshwars_api_token: 'mw-secret' }));
    const url = within(group).getByLabelText(/MeshWars URL/);
    fireEvent.change(url, { target: { value: 'https://meshwars.com ' } });
    fireEvent.click(within(group).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ meshwarsBaseUrl: 'https://meshwars.com' }));
    expect(urls().some((u) => u.includes('mw-secret'))).toBe(false);
  });

  it('ADS-B: the OpenSky credentials keep their own Save', async () => {
    const { log } = renderServer(PATH);
    const id = await screen.findByLabelText('OpenSky client ID');
    fireEvent.change(id, { target: { value: 'athens-client ' } });
    fireEvent.blur(id);
    await new Promise((r) => setTimeout(r, 20));
    expect(settingsWrites(log)).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('group', { name: 'Flight matching (ADS-B)' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ adsb_opensky_client_id: 'athens-client' }));
  });

  it('on phone ADS-B, Elevation and MeshWars open a page of their own', async () => {
    renderServer(PATH, { phone: true });
    fireEvent.click(await screen.findByRole('link', { name: /Flight matching \(ADS-B\)/ }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/integrations/adsb'));
    expect(await screen.findByLabelText('OpenSky client ID')).toBeInTheDocument();
  });

  it('MeshWars: after Save the form shows the saved URL from a fresh status read, as today', async () => {
    const { log } = renderServer(PATH);
    await screen.findByLabelText('MeshWars API key');
    const group = within(screen.getByRole('group', { name: 'MeshWars' }));
    const url = group.getByLabelText(/MeshWars URL/);
    fireEvent.change(url, { target: { value: 'https://meshwars.com' } });
    fireEvent.click(group.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.reads.filter((r) => r === '/api/settings/meshwars/status')).toHaveLength(2));
    await waitFor(() => expect(group.getByLabelText(/MeshWars URL/)).toHaveValue('https://meshwars.com'));
    expect(group.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('MeshWars: after a first key is saved the field says a key is saved', async () => {
    const { SERVER_SETTINGS } = await import('../../__fixtures__/server');
    const { log } = renderServer(PATH, { settings: { ...SERVER_SETTINGS, meshwars_api_token: '' } });
    const key = await screen.findByLabelText('MeshWars API key');
    expect(key).toHaveAttribute('placeholder', '');
    fireEvent.change(key, { target: { value: 'first-key' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'MeshWars' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('MeshWars API key')).toHaveAttribute('placeholder', 'Saved. Enter a new key to replace it.'));
    expect(screen.getByLabelText('MeshWars API key')).toHaveValue('');
    expect(log.reads.filter((r) => r === '/api/settings/meshwars/status')).toHaveLength(2);
  });

  it('a settings writer who is not an admin sees today\'s Virtual Node replay, view only, and nothing admin-only is read', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    const replay = await screen.findByRole('switch', { name: 'Replay missed messages on reconnect' });
    expect(replay).toBeDisabled();
    expect(screen.getByLabelText('Never replay to these IPs')).toBeDisabled();
    expect(screen.getByText(/Only an administrator can change integrations/)).toBeInTheDocument();
    expect(screen.queryByText('Message Translation')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Enable CoT feed' })).toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().some((u) => u.includes('/meshwars/status'))).toBe(false);
  });

  it('a writer cannot open the admin services\' own pages', async () => {
    renderServer('/server/integrations/meshwars', { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });

  it('a settings viewer cannot open Integrations', async () => {
    renderServer(PATH, { permissions: grants({ read: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });
});
