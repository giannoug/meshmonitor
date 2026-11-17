/**
 * @vitest-environment jsdom
 *
 * Boards 13-04 (desktop) and 13-21 (phone), Task 6.3: You › Map. Tilesets
 * follow the viewer (today's setMapTilesets → user_map_preferences); the
 * other rows save today's keys as you go; numbers save on blur, never per
 * keystroke.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../../test/boardChecks';
import { SOURCE_IDS } from '../../../__fixtures__/athens';
import { renderPrefs } from './prefsHarness';

describe('13-04-map-prefs', () => {
  it('13-04-map-prefs shows the board', async () => {
    const { container } = renderPrefs('/preferences/map');
    await screen.findByText('Map Click Zoom Gate');
    expectBoard('13-04-map-prefs', container);
    // The preview composes BaseMap with today's tileset (13-04 draws it on desktop only).
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('13-21-map-prefs shows the board', async () => {
    const { container } = renderPrefs('/preferences/map', { phone: true });
    await screen.findByText('Map Click Zoom Gate');
    expectBoard('13-21-map-prefs', container);
    expect(container.querySelector('.leaflet-container')).toBeNull();
  });

  it('a tileset saves to the viewer\'s map preferences and, for a settings writer, the install key', async () => {
    const { log } = renderPrefs('/preferences/map');
    const dark = await screen.findByLabelText('Dark Mode Tileset');
    fireEvent.change(dark, { target: { value: 'esriDarkGray' } });
    await waitFor(() => expect(log.mapPrefs).toHaveLength(1));
    expect(log.mapPrefs[0]).toMatchObject({ mapTilesetDark: 'esriDarkGray' });
    expect(log.settings).toContainEqual({ mapTilesetDark: 'esriDarkGray' });
  });

  it('a viewer without settings:write still picks a tileset (it follows them); the rest is View only', async () => {
    const { log } = renderPrefs('/preferences/map', { permissions: { global: {}, bySource: {} } });
    const light = await screen.findByLabelText('Light Mode Tileset');
    expect(screen.getByRole('switch', { name: 'Cluster overlapping markers' })).toBeDisabled();
    fireEvent.change(light, { target: { value: 'openTopo' } });
    await waitFor(() => expect(log.mapPrefs).toHaveLength(1));
    expect(log.settings).toEqual([]);
  });

  it('the zoom gate saves on blur, not per keystroke; 0 is allowed', async () => {
    const { log } = renderPrefs('/preferences/map');
    await screen.findByText('Map Click Zoom Gate');
    const gate = screen.getByLabelText('Map Click Zoom Gate');
    fireEvent.change(gate, { target: { value: '0' } });
    expect(log.settings).toEqual([]);
    fireEvent.blur(gate);
    await waitFor(() => expect(log.settings).toContainEqual({ mapZoomGateThreshold: '0' }));
  });

  it.each([
    ['an admin', {}],
    ['a non-admin settings writer (today: custom tilesets, GeoJSON, map styles)', { permissions: { global: {}, bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: true } } } } }],
  ])('%s gets the way to Server › Map & tiles', async (_who, opts) => {
    renderPrefs('/preferences/map', opts);
    expect(await screen.findByRole('link', { name: /Map & tiles/ })).toHaveAttribute('href', '/server/map');
  });

  it('a viewer without settings:write does not', async () => {
    renderPrefs('/preferences/map', { permissions: { global: {}, bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: false } } } } });
    await screen.findByText('Map Click Zoom Gate');
    expect(screen.queryByRole('link', { name: /Map & tiles/ })).toBeNull();
  });

  it('a settings writer\'s tileset goes through the shared settings cache (one save path)', async () => {
    const { log } = renderPrefs('/preferences/map');
    fireEvent.change(await screen.findByLabelText('Light Mode Tileset'), { target: { value: 'openTopo' } });
    await waitFor(() => expect(log.settings).toContainEqual({ mapTilesetLight: 'openTopo' }));
    await waitFor(() => expect(log.mapPrefs).toHaveLength(1));
    // useAutosaveSetting reads the settings again after its write (Ruling DM).
    await waitFor(() => expect(log.reads.filter((r) => r === '/api/settings').length).toBeGreaterThanOrEqual(2));
  });
});
