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
import { DEFAULT_CONFIG, type LayerKey } from '../../../hooks/useMapAnalysisConfig';
import { openLayers, openTools, renderOverview, storedConfig } from './renderOverview';

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
  await screen.findByRole('menuitemcheckbox', { name: 'Add Waypoint' }).catch(() => undefined);
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
