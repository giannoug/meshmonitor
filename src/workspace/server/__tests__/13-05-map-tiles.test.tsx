/**
 * @vitest-environment jsdom
 *
 * Boards 13-05 (desktop) and 13-22 (phone), Task 6.4: Server › Map & tiles.
 * Today's tile servers, GeoJSON layers and map styles (settings:write) and,
 * for admins, the Carto key and the default map centre.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/map';

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

  it('a GeoJSON layer\'s switch and options write today\'s fields; delete asks with today\'s words', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('switch', { name: 'Visible: Hiking trails' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-trails', body: { visible: true } }));
    const row = screen.getAllByTestId('geojson-layer')[0];
    fireEvent.click(within(row).getByRole('checkbox', { name: 'Public' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/geojson/layers/layer-attica', body: { publiclyVisible: false } }));
    fireEvent.click(within(row).getByRole('button', { name: 'More for Attica coverage' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Delete layer "Attica coverage"? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/geojson/layers/layer-attica', body: undefined }));
  });

  it('the active map style says so; delete asks with today\'s words', async () => {
    const { log } = renderServer(PATH);
    const row = (await screen.findAllByTestId('map-style'))[0];
    await waitFor(() => expect(within(row).getByText('Active')).toBeInTheDocument());
    fireEvent.click(within(row).getByRole('button', { name: 'More for Athens dark (vector)' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Delete style "Athens dark (vector)"? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/map-styles/styles/style-athens-dark', body: undefined }));
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

  it('a non-admin settings writer keeps the tile servers, layers and styles (6.3 I1), without the admin keys', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    await screen.findByDisplayValue('Athens dark (vector)');
    expect(screen.getByText('Custom Tile Servers')).toBeInTheDocument();
    expect(screen.queryByText('Keys and defaults')).toBeNull();
    expect(screen.queryByLabelText('Carto Basemap API Key')).toBeNull();
  });

  it('a settings viewer without write gets no access', async () => {
    renderServer(PATH, { permissions: grants({ read: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });
});
