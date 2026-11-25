/**
 * @vitest-environment jsdom
 *
 * Boards 13-05 (desktop) and 13-22 (phone), Task 6.4: Server › Map & tiles.
 * Today's tile servers, GeoJSON layers and map styles (settings:write) and,
 * for admins, the Carto key and the default map centre.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { autodetectTileServer, testTileServer } from '../../../utils/tileServerTest';
import { MAP_STYLES } from '../../__fixtures__/server';
import { grants, renderServer } from './serverHarness';

// Tile probes go to a tile server from the browser; here they answer from the test.
vi.mock('../../../utils/tileServerTest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/tileServerTest')>()),
  testTileServer: vi.fn(async () => ({ success: true, status: 'success', tileType: 'raster', message: 'Tile 13/4789/3150 loaded', errors: [], warnings: [], details: { tileSize: 2048 } })),
  autodetectTileServer: vi.fn(async (base: string) => ({ success: true, baseUrl: base, testedPatterns: 4, errors: [], detectedUrls: [{ url: `https://${base}/{z}/{x}/{y}.png`, type: 'raster' }] })),
}));

const PATH = '/server/map';

/** Every Leaflet map made while a test runs, so a test can move one (jsdom has no pointer dragging). */
function captureMaps() {
  const maps: L.Map[] = [];
  const init = L.Map.prototype.initialize;
  vi.spyOn(L.Map.prototype as unknown as { initialize: typeof init }, 'initialize').mockImplementation(function (this: L.Map, ...args: Parameters<typeof init>) {
    maps.push(this);
    return init.apply(this, args);
  });
  return maps;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(testTileServer).mockClear();
  vi.mocked(autodetectTileServer).mockClear();
});

const centreWrites = (log: { writes: Array<{ path: string; body?: unknown }> }) =>
  log.writes.filter((w) => w.path === '/api/settings' && JSON.stringify(w.body).includes('defaultMapCenterLat')).map((w) => w.body);

describe('13-05 / 13-22 map & tiles', () => {
  it.each([
    ['13-05-map-tiles', false],
    ['13-22-map-tiles', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findByDisplayValue('Athens dark (vector)');
    await screen.findByDisplayValue('Attica coverage');
    // The tile form (Test) opens from Add, as today.
    fireEvent.click(screen.getByRole('button', { name: 'Add Custom Tile Server' }));
    expectBoard(board, container);
  });

  it('deleting a tile server asks with today\'s words, then saves the list without it', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Athens topo' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Are you sure you want to delete this custom tileset?')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { customTilesets: '[]' } }));
  });

  it('a GeoJSON layer: Public on the row; Visible, no popup and style in its ⋯ (s13n5); delete asks with today\'s words', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('switch', { name: 'Public: Hiking trails' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-trails', body: { publiclyVisible: true } }));
    const row = screen.getAllByTestId('geojson-layer')[0];
    const more = () => fireEvent.click(within(row).getByRole('button', { name: 'More for Attica coverage' }));
    more();
    const visible = screen.getByRole('menuitemcheckbox', { name: 'Visible' });
    expect(visible).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(visible);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-attica', body: { visible: false } }));
    more();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Disable click popup' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-attica', body: { disablePopup: true } }));
    more();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Colour and style' }));
    const style = await screen.findByRole('dialog', { name: /Colour and style/ });
    fireEvent.change(within(style).getByLabelText('Color'), { target: { value: '#ff0000' } });
    await waitFor(() =>
      expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-attica', body: { style: { color: '#ff0000', opacity: 0.8, fillOpacity: 0.2, weight: 2 } } }),
    );
    fireEvent.click(within(style).getByRole('button', { name: 'Close' }));
    more();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Delete layer "Attica coverage"? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/geojson/layers/layer-attica', body: undefined }));
  });

  it('Test URL tests a tile URL as today, and autodetects from a server address first, then tests the URL picked (s13n5)', async () => {
    renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Custom Tile Server' }));
    const url = screen.getByRole('textbox', { name: /^Tile URL/ });
    fireEvent.change(url, { target: { value: 'hs.athensmesh.gr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test URL' }));
    expect(await screen.findByText('Found 1 working URL(s):')).toBeInTheDocument();
    expect(vi.mocked(autodetectTileServer)).toHaveBeenCalledWith('hs.athensmesh.gr', expect.any(Function));
    expect(vi.mocked(testTileServer)).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(await screen.findByText(/Tile 13\/4789\/3150 loaded/)).toBeInTheDocument();
    expect(vi.mocked(testTileServer)).toHaveBeenCalledWith('https://hs.athensmesh.gr/{z}/{x}/{y}.png');
    expect(url).toHaveValue('https://hs.athensmesh.gr/{z}/{x}/{y}.png');
    vi.mocked(autodetectTileServer).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Test URL' }));
    await waitFor(() => expect(vi.mocked(testTileServer)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(autodetectTileServer)).not.toHaveBeenCalled();
  });

  it('the active map style says so; delete asks with today\'s words', async () => {
    const { log } = renderServer(PATH);
    const row = (await screen.findAllByTestId('map-style'))[0];
    await waitFor(() => expect(within(row).getByText('Active')).toBeInTheDocument());
    fireEvent.click(within(row).getByRole('button', { name: 'More for Athens dark (vector)' }));
    // Activate is in ⋯ (s13n5), not offered for the active style.
    expect(screen.queryByRole('menuitem', { name: 'Activate' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Delete style "Athens dark (vector)"? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/map-styles/styles/style-athens-dark', body: undefined }));
  });

  it('a style that is not active offers Activate in its ⋯ (s13n5)', async () => {
    renderServer(PATH, {
      fixtures: {
        'GET /api/map-styles/styles': () => [...MAP_STYLES, { id: 'style-light', name: 'Light streets', filename: 'light.json', sourceType: 'upload', createdAt: 2, updatedAt: 2 }],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'More for Light streets' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Activate' }));
    await waitFor(() => expect(within(screen.getAllByTestId('map-style')[1]).getByText('Active')).toBeInTheDocument());
  });

  it('the Carto key saves only with its Save', async () => {
    const { log } = renderServer(PATH);
    const key = await screen.findByLabelText('Carto Basemap API Key');
    await waitFor(() => expect(key).toHaveValue('pk-example-3a1c'));
    fireEvent.change(key, { target: { value: ' pk-new ' } });
    fireEvent.blur(key);
    await new Promise((r) => setTimeout(r, 20));
    expect(log.writes.some((w) => JSON.stringify(w.body).includes('cartoApiKey'))).toBe(false);
    fireEvent.click(within(key.closest('[data-setting-id]') as HTMLElement).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { cartoApiKey: 'pk-new' } }));
  });

  it('the default map centre shows today\'s value and opens a map; Clear writes today\'s three empty keys', async () => {
    const { log } = renderServer(PATH);
    expect(await screen.findByText(/37\.9800, 23\.7300 · zoom 11/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));
    const sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    expect(sheet.querySelector('.leaflet-container')).not.toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear' }));
    await waitFor(() =>
      expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { defaultMapCenterLat: '', defaultMapCenterLon: '', defaultMapCenterZoom: '' } }),
    );
    expect(await screen.findByText(/No default center configured/)).toBeInTheDocument();
  });

  it('Save as Default writes the view the map shows', async () => {
    const maps = captureMaps();
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Pick on map' }));
    const sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    maps.at(-1)!.setView([10, 20], 5, { animate: false });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save as Default' }));
    await waitFor(() => expect(centreWrites(log)).toEqual([{ defaultMapCenterLat: '10', defaultMapCenterLon: '20', defaultMapCenterZoom: '5' }]));
  });

  it('a view left by Cancel is not saved by the next opening (6.4 I2)', async () => {
    const maps = captureMaps();
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Pick on map' }));
    let sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    maps.at(-1)!.setView([10, 20], 5, { animate: false });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Default map centre' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));
    sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save as Default' }));
    await waitFor(() => expect(centreWrites(log)).toHaveLength(1));
    expect(centreWrites(log)[0]).toEqual({ defaultMapCenterLat: '37.98', defaultMapCenterLon: '23.73', defaultMapCenterZoom: '11' });
  });

  it('after Clear, Save as Default writes the view the map shows (6.4 I2)', async () => {
    const maps = captureMaps();
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Pick on map' }));
    let sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    maps.at(-1)!.setView([10, 20], 5, { animate: false });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText(/No default center configured/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));
    sheet = await screen.findByRole('dialog', { name: 'Default map centre' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save as Default' }));
    await waitFor(() => expect(centreWrites(log)).toHaveLength(2));
    // Today's picker opens an unset centre on the world view (20, 0, zoom 2).
    expect(centreWrites(log)[1]).toEqual({ defaultMapCenterLat: '20', defaultMapCenterLon: '0', defaultMapCenterZoom: '2' });
  });

  it('a non-admin settings writer keeps the tile servers, layers and styles (6.3 I1), without the admin keys', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    await screen.findByDisplayValue('Athens dark (vector)');
    expect(screen.getByText('Custom Tile Servers')).toBeInTheDocument();
    expect(screen.queryByText('Keys and defaults')).toBeNull();
    expect(screen.queryByLabelText('Carto Basemap API Key')).toBeNull();
  });

  it('a settings:read viewer sees the tileset and GeoJSON lists, with every edit control disabled', async () => {
    renderServer(PATH, { permissions: grants({ read: true }) });
    expect(await screen.findByText('View only')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Athens dark (vector)')).toBeDisabled();
    expect(await screen.findByDisplayValue('Attica coverage')).toBeDisabled();
    expect(screen.queryByText('Keys and defaults')).toBeNull();
    // The tile servers: listed, not editable.
    expect(await screen.findByRole('button', { name: 'Edit Athens topo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Athens topo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Custom Tile Server' })).toBeDisabled();
    // The GeoJSON layers.
    expect(screen.getByRole('switch', { name: 'Public: Hiking trails' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'More for Attica coverage' }));
    for (const item of screen.getAllByRole('menuitem')) expect(item).toBeDisabled();
    for (const item of screen.getAllByRole('menuitemcheckbox')) expect(item).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /Upload Overlay/ })).toBeDisabled();
    // The map styles.
    expect(screen.getByRole('button', { name: /Upload Style/i })).toBeDisabled();
    expect(screen.getByLabelText('Style URL', { exact: false })).toBeDisabled();
  });

  it('the {z}/{x}/{y} error is linked to the URL field by aria-describedby', async () => {
    renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Custom Tile Server' }));
    const url = screen.getByRole('textbox', { name: /^Tile URL/ });
    fireEvent.change(url, { target: { value: 'https://tiles.example.com/map.png' } });
    const message = await screen.findByText('URL must contain {z}, {x}, and {y} placeholders');
    expect(url).toHaveAttribute('aria-describedby', message.id);
    expect(message.id).not.toBe('');
    // A description, not part of the accessible name.
    expect(screen.getByRole('textbox', { name: /^Tile URL/ })).not.toHaveAccessibleName(/URL must contain/);
  });

  it('a user without settings access gets none', async () => {
    renderServer(PATH, { permissions: grants({}) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });
});
