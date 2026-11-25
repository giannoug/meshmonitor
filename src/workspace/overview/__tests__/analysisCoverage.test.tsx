/**
 * @vitest-environment jsdom
 *
 * s5n1 "nothing from /analysis is dropped": every Map Analysis layer and every
 * control of today's Map Analysis toolbar is reachable on the Overview map,
 * in the Layers drawer, the Tools menu or the bar over the map.
 *
 * The expected lists come from the source of truth, not from a copy here:
 * the layer keys from today's config (`DEFAULT_CONFIG.layers`, one entry per
 * `LayerKey`), and the toolbar's controls by rendering today's toolbar and
 * reading every control it draws, its menus opened. A layer or toolbar control
 * added later fails these tests until the Overview places it (or the table
 * below says where it went, or why it is not there).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { MapAnalysisProvider } from '../../../components/MapAnalysis/MapAnalysisContext';
import MapAnalysisToolbar from '../../../components/MapAnalysis/MapAnalysisToolbar';
import { TIMED_LAYERS, UNTIMED_LAYERS } from '../../../components/MapAnalysis/analysisControls';
import { MapProvider } from '../../../contexts/MapContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import DashboardMap from '../../../components/Dashboard/DashboardMap';
import { UNIFIED_SOURCE_ID } from '../../../hooks/useDashboardData';
import { athensFixture as A, SOURCE_IDS } from '../../__fixtures__/athens';
import { dbRow } from '../../__fixtures__/fixtureApi';
import { DEFAULT_CONFIG, type LayerKey } from '../../../hooks/useMapAnalysisConfig';
import { openLayers, openPhoneSheet, openTools, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/** A layer's switch label: the toolbar's own list, plus the polar grid, which the toolbar labels inline. */
const LABEL_OF: Partial<Record<LayerKey, string>> = {
  ...Object.fromEntries([...TIMED_LAYERS, ...UNTIMED_LAYERS].map((l) => [l.key, l.label])),
  polarGrid: 'Polar Grid',
};

describe('every Map Analysis layer has a switch in the Overview Layers drawer', () => {
  const keys = Object.keys(DEFAULT_CONFIG.layers) as LayerKey[];

  it.each(keys)('%s', async (key) => {
    const label = LABEL_OF[key];
    expect(label, `no Overview control for layer "${key}"`).toBeDefined();
    renderOverview('/overview/map');
    const drawer = within(await openLayers());
    const toggle = drawer.getByRole('switch', { name: label });
    const before = storedConfig().layers[key].enabled;
    fireEvent.click(toggle);
    expect(storedConfig().layers[key].enabled).toBe(!before);
  });
});

type Place = 'bar' | 'drawer' | 'tools';
/**
 * Where each of today's toolbar controls is on the Overview map: its place
 * and its accessible name there. `null` = not carried over, with the reason.
 */
const WHERE: Record<string, [Place, string] | { notHere: string }> = {
  'Back to Sources': { notHere: 'the Workspace shell owns navigation (1.4); the toolbar hides it when embedded' },
  'All sources (5)': ['bar', 'All sources (5)'],
  'All node types': ['bar', 'All node types'],
  'All transports': ['bar', 'All transports'],
  'Search nodes': ['bar', 'Filter nodes'],
  'All nodes': ['bar', 'All nodes'],
  View: { notHere: 'a menu heading: its items are Follow, Auto-zoom, Time Slider and 3D View, below' },
  Tools: ['bar', 'Tools'],
  Layers: ['bar', 'Layers'],
  Analysis: { notHere: 'a menu heading: its items are the Analysis group of the Layers drawer, below' },
  Follow: ['drawer', 'Follow'],
  'Auto-zoom': ['drawer', 'Auto-zoom'],
  'Time Slider': ['bar', 'Time Slider'],
  '3D View': ['drawer', '3D View'],
  Measure: ['tools', 'Measure'],
  'Link Profile': ['tools', 'Link Profile'],
  'Site Planner': ['tools', 'Site Planner'],
  'Add Waypoint': ['tools', 'Add Waypoint'],
  'Add Local Marker': ['tools', 'Add Local Marker'],
  'Polar Grid': ['drawer', 'Polar Grid'],
  'GNSS DOP': ['drawer', 'GNSS DOP'],
  'Traceroute filters': ['drawer', 'Traceroute filters'],
  Reset: ['drawer', 'Reset'],
  ...Object.fromEntries(UNTIMED_LAYERS.map((l) => [l.label, ['drawer', l.label] as [Place, string]])),
  ...Object.fromEntries(TIMED_LAYERS.flatMap((l) => [
    [l.label, ['drawer', l.label] as [Place, string]],
    [`${l.label} lookback`, ['drawer', `${l.label} lookback`] as [Place, string]],
  ])),
};

/** The accessible name of every control today's toolbar draws, every menu opened, Traceroutes on. */
async function toolbarControls(): Promise<string[]> {
  localStorage.setItem('mapAnalysis.config.v1', JSON.stringify({
    ...DEFAULT_CONFIG, layers: { ...DEFAULT_CONFIG.layers, traceroutes: { ...DEFAULT_CONFIG.layers.traceroutes, enabled: true } },
  }));
  const { container, unmount } = renderWorkspace(
    <MapProvider>
      <MapAnalysisProvider>
        <MapAnalysisToolbar />
      </MapAnalysisProvider>
    </MapProvider>,
  );
  await screen.findByRole('button', { name: /^All sources \(5\)/ });
  const names = new Set<string>();
  for (const trigger of screen.getAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'menu')) {
    names.add(trigger.textContent!.replace(/\d+$/, '').trim());
    fireEvent.click(trigger);
    for (const el of container.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"], select')) {
      names.add(el.getAttribute('aria-label') ?? '');
    }
    fireEvent.click(trigger);
  }
  for (const el of container.querySelectorAll<HTMLElement>('button, input')) {
    if (el.getAttribute('aria-haspopup') === 'menu') continue;
    names.add(el.getAttribute('aria-label') ?? el.textContent!.replace('▾', '').trim());
  }
  unmount();
  localStorage.clear();
  return [...names].filter(Boolean);
}

describe('every control of today\'s Map Analysis toolbar is on the Overview map', () => {
  it('each one is in the bar, the Layers drawer or the Tools menu', async () => {
    const controls = await toolbarControls();
    // The read must have found the toolbar's menus and their rows.
    expect(controls).toEqual(expect.arrayContaining(['Measure', 'Markers', 'Traceroutes lookback', 'Traceroute filters']));
    const unplaced = controls.filter((name) => !(name in WHERE));
    expect(unplaced, 'toolbar controls with no place on the Overview map').toEqual([]);

    renderOverview('/overview/map', { layers: { traceroutes: { enabled: true, lookbackHours: 24 } } });
    await screen.findByRole('button', { name: /^Layers/ }, { timeout: 5000 });
    const bar = screen.getByRole('toolbar', { name: 'Map' });
    const missing: string[] = [];
    const has = (scope: HTMLElement, name: string) =>
      within(scope).queryAllByLabelText(name).length > 0 || within(scope).queryAllByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).length > 0
      || within(scope).queryAllByRole('menuitemradio', { name }).length > 0 || within(scope).queryAllByRole('switch', { name }).length > 0;
    for (const name of controls) {
      const place = WHERE[name];
      if (!Array.isArray(place)) continue;
      const [where, there] = place;
      const scope = where === 'bar' ? bar : where === 'drawer' ? await openLayers() : await openTools();
      if (!has(scope, there)) missing.push(`${name} → ${where} "${there}"`);
      if (where === 'tools') fireEvent.keyDown(document, { key: 'Escape' });
    }
    expect(missing).toEqual([]);
  });
});

/** DashboardMap names whose Overview control is named otherwise, with where it is. */
const DASHBOARD_ELSEWHERE: Record<string, { place: 'bar' | 'drawer' | 'tools' | 'map'; name: string; why: string }> = {
  'Measure Distance': { place: 'tools', name: 'Measure', why: 'the same MeasureDistanceController, as Map Analysis\'s Measure tool' },
  '3D Terrain': { place: 'drawer', name: '3D View', why: 'the map\'s one 2D/3D switch (Map Analysis\'s, same DEM gate)' },
  'Show Neighbors': { place: 'drawer', name: 'Show Neighbor Info', why: 'the same MapContext flag; en.json\'s label for it (D9b)' },
  'Show RF': { place: 'bar', name: 'All transports', why: 'the map\'s Transport filter holds Show RF / UDP / MQTT' },
  'Show UDP': { place: 'bar', name: 'All transports', why: 'as Show RF' },
  'Show MQTT': { place: 'bar', name: 'All transports', why: 'as Show RF' },
  'Show Waypoints': { place: 'drawer', name: 'Waypoints', why: 'Map Analysis\'s waypoints layer is the map\'s waypoints' },
  'Show Local Markers': { place: 'drawer', name: 'Local Markers', why: 'as Waypoints' },
  'Show ATAK Contacts': { place: 'drawer', name: 'ATAK Contacts', why: 'as Waypoints' },
  'Show Accuracy Regions': { place: 'drawer', name: 'Accuracy Regions', why: 'as Waypoints' },
  'Show Polar Grid': { place: 'drawer', name: 'Polar Grid', why: 'as Waypoints' },
  'Show Tile Selection': { place: 'drawer', name: 'Tiles', why: 'the Base map group\'s Tiles row opens the same TilesetSelector' },
  'Show Legend': { place: 'map', name: 'Collapse legend', why: 'today\'s Map Analysis legend shows and folds itself' },
};

/** The accessible name of every control in today's Dashboard map panel (Unified, a MeshCore node on it, DEM tiles on). */
const MESHCORE_NODE = {
  sourceId: SOURCE_IDS.heltec, isMeshCore: true, nodeNum: 900_001, publicKey: 'a'.repeat(64), nodeId: 'a'.repeat(64),
  shortName: 'MC', longName: 'MeshCore', latitude: 37.97, longitude: 23.7, lastHeard: Math.floor(Date.now() / 1000),
};

async function dashboardControls(): Promise<string[]> {
  const nodes = [...A.nodes.map((n) => dbRow(n, SOURCE_IDS.g2)), MESHCORE_NODE];
  const { container, unmount } = renderWorkspace(
    <SettingsProvider>
      <ToastProvider>
        <MapProvider>
          <DashboardMap
            nodes={nodes} neighborInfo={[]} meshcoreNeighbors={[]} traceroutes={[]} channels={[]}
            tilesetId="osm" customTilesets={[]} defaultCenter={{ lat: 37.98, lng: 23.72 }}
            sourceId={UNIFIED_SOURCE_ID} maxNodeAgeHours={24} maxInfraNodeAgeHours={720}
          />
        </MapProvider>
      </ToastProvider>
    </SettingsProvider>,
    { fixtures: { 'GET /api/elevation/capabilities': () => ({ success: true, data: { enabled: true, terrainTiles: true } }) } },
  );
  await screen.findByText('3D Terrain', {}, { timeout: 5000 });
  const panel = container.querySelector<HTMLElement>('.map-controls-body')!;
  const names = new Set<string>();
  for (const el of panel.querySelectorAll<HTMLElement>('input, button, select')) {
    const label = el.closest('label');
    const name = el.getAttribute('aria-label') ?? (label ? label.textContent!.trim() : el.textContent!.trim());
    if (name) names.add(name);
  }
  unmount();
  localStorage.clear();
  return [...names];
}

describe('every control of today\'s Dashboard map is on the Overview map (Ruling CE)', () => {
  it('each one is there under its name, or the name the table gives', async () => {
    const controls = await dashboardControls();
    // The read must have found the panel's controls.
    expect(controls).toEqual(expect.arrayContaining(['Zoom to fit all nodes', 'Show Route Segments', 'Show Traceroute', 'Spread Nodes']));

    // The same conditions: a MeshCore node on the map (Hide nodes without a current position advert).
    renderOverview('/overview/map', {
      fixtures: {
        'GET /api/unified/dashboard': (url: URL) =>
          (url.searchParams.get('sources') ?? '').split(',').filter(Boolean).map((sourceId) => ({
            sourceId,
            nodes: sourceId === SOURCE_IDS.g2 ? A.nodes.map((n) => dbRow(n, sourceId)) : sourceId === SOURCE_IDS.heltec ? [MESHCORE_NODE] : [],
            traceroutes: [], neighborInfo: [], channels: [],
          })),
      },
    });
    await screen.findByRole('button', { name: /^Layers/ }, { timeout: 5000 });
    const bar = screen.getByRole('toolbar', { name: 'Map' });
    const drawer = await openLayers();
    await within(drawer).findByRole('switch', { name: 'Hide nodes without a current position advert' }, { timeout: 5000 });
    const has = (scope: HTMLElement, name: string) =>
      within(scope).queryAllByLabelText(name).length > 0
      || within(scope).queryAllByRole('button', { name }).length > 0
      || within(scope).queryAllByRole('radio', { name }).length > 0
      || within(scope).queryAllByRole('switch', { name }).length > 0
      || within(scope).queryAllByText(name).length > 0;
    const missing: string[] = [];
    for (const name of controls) {
      const elsewhere = DASHBOARD_ELSEWHERE[name];
      if (!elsewhere) {
        if (!has(document.body, name)) missing.push(`${name} (same name)`);
        continue;
      }
      const scope = elsewhere.place === 'bar' ? bar : elsewhere.place === 'drawer' ? drawer : elsewhere.place === 'map' ? document.body : await openTools();
      if (!has(scope, elsewhere.name)) missing.push(`${name} → ${elsewhere.place} "${elsewhere.name}"`);
      if (elsewhere.place === 'tools') fireEvent.keyDown(document, { key: 'Escape' });
    }
    expect(missing).toEqual([]);
  });
});

/*
 * The phone (Task 4.3): the same lists, the same tables, and every control is
 * reachable on the phone map too. The phone has three places: the map itself
 * (Back, the node filter, and the bar under it: Tools, Time, Layers, Zoom to
 * fit), the Layers sheet and the Tools sheet. What moves on the phone is
 * listed here, with why; everything else stays where the desktop puts it.
 */
type PhonePlace = 'map' | 'layers' | 'tools';
const ON_PHONE: Record<Place, PhonePlace> = { bar: 'map', drawer: 'layers', tools: 'tools' };

/** Toolbar controls placed otherwise on the phone. */
const PHONE_TOOLBAR_MOVES: Record<string, [PhonePlace, string]> = {
  // The bar's filters do not fit across a phone: the Layers sheet's Filters group holds them.
  'All sources (5)': ['layers', 'All sources (5)'],
  'All node types': ['layers', 'All node types'],
  'All transports': ['layers', 'All transports'],
  'All nodes': ['layers', 'All nodes'],
  // The Tools sheet's Time section (board 5-09).
  'Time Slider': ['tools', 'Time Slider'],
};

/** DashboardMap controls placed otherwise on the phone. */
const PHONE_DASHBOARD_MOVES: Record<string, [PhonePlace, string]> = {
  'Show RF': ['layers', 'All transports'],
  'Show UDP': ['layers', 'All transports'],
  'Show MQTT': ['layers', 'All transports'],
  // A phone map has no room for a standing legend: Layers › Legend draws today's on the map.
  'Show Legend': ['layers', 'Legend'],
};

/** Opens the phone place (closing any open sheet first) and returns where to look. */
async function phonePlace(place: PhonePlace): Promise<HTMLElement> {
  const open = screen.queryByRole('dialog');
  if (open) fireEvent.click(within(open).getByRole('button', { name: 'Close' }));
  if (place === 'map') return document.body;
  return openPhoneSheet(place === 'layers' ? 'Layers' : 'Tools');
}

const reachable = (scope: HTMLElement, name: string) =>
  within(scope).queryAllByLabelText(name).length > 0
  || within(scope).queryAllByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).length > 0
  || within(scope).queryAllByRole('radio', { name }).length > 0
  || within(scope).queryAllByRole('menuitemradio', { name }).length > 0
  || within(scope).queryAllByRole('switch', { name }).length > 0
  || within(scope).queryAllByText(name).length > 0;

describe('on the phone, every Map Analysis layer has a switch in the Layers sheet', () => {
  const keys = Object.keys(DEFAULT_CONFIG.layers) as LayerKey[];

  it.each(keys)('%s', async (key) => {
    renderOverview('/overview/map', { phone: true });
    const toggle = within(await openPhoneSheet('Layers')).getByRole('switch', { name: LABEL_OF[key] });
    const before = storedConfig().layers[key].enabled;
    fireEvent.click(toggle);
    expect(storedConfig().layers[key].enabled).toBe(!before);
  });
});

describe('on the phone, every control of today\'s Map Analysis toolbar is reachable', () => {
  it('each one is on the map, in the Layers sheet or in the Tools sheet', async () => {
    const controls = await toolbarControls();
    expect(controls).toEqual(expect.arrayContaining(['Measure', 'Markers', 'Traceroutes lookback', 'Traceroute filters']));
    renderOverview('/overview/map', { phone: true, layers: { traceroutes: { enabled: true, lookbackHours: 24 } } });
    await screen.findByRole('toolbar', { name: 'Map tools' }, { timeout: 5000 });
    const missing: string[] = [];
    for (const name of controls) {
      const place = WHERE[name];
      if (!Array.isArray(place)) continue;
      const [where, there] = PHONE_TOOLBAR_MOVES[name] ?? [ON_PHONE[place[0]], place[1]];
      if (!reachable(await phonePlace(where), there)) missing.push(`${name} → ${where} "${there}"`);
    }
    expect(missing).toEqual([]);
  });
});

describe('on the phone, every control of today\'s Dashboard map is reachable (Ruling CE)', () => {
  it('each one is there under its name, or the name the tables give', async () => {
    const controls = await dashboardControls();
    expect(controls).toEqual(expect.arrayContaining(['Zoom to fit all nodes', 'Show Route Segments', 'Show Traceroute', 'Spread Nodes']));
    renderOverview('/overview/map', {
      phone: true,
      fixtures: {
        'GET /api/unified/dashboard': (url: URL) =>
          (url.searchParams.get('sources') ?? '').split(',').filter(Boolean).map((sourceId) => ({
            sourceId,
            nodes: sourceId === SOURCE_IDS.g2 ? A.nodes.map((n) => dbRow(n, sourceId)) : sourceId === SOURCE_IDS.heltec ? [MESHCORE_NODE] : [],
            traceroutes: [], neighborInfo: [], channels: [],
          })),
      },
    });
    await within(await openPhoneSheet('Layers')).findByRole('switch', { name: 'Hide nodes without a current position advert' }, { timeout: 5000 });
    const missing: string[] = [];
    for (const name of controls) {
      const elsewhere = DASHBOARD_ELSEWHERE[name];
      // Same-named controls: in the Layers sheet or on the map.
      const [where, there]: [PhonePlace, string] = PHONE_DASHBOARD_MOVES[name]
        ?? (elsewhere ? [elsewhere.place === 'tools' ? 'tools' : elsewhere.place === 'drawer' ? 'layers' : 'map', elsewhere.name] : ['layers', name]);
      let found = reachable(await phonePlace(where), there);
      if (!found && !elsewhere && !PHONE_DASHBOARD_MOVES[name]) found = reachable(await phonePlace('map'), there);
      if (!found) missing.push(`${name} → ${where} "${there}"`);
    }
    expect(missing).toEqual([]);
  });
});
