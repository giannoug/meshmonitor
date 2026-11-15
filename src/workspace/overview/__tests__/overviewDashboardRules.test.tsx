/**
 * @vitest-environment jsdom
 *
 * Ruling CE: the Overview map keeps today's Dashboard map rules and controls
 * on top of Map Analysis — the age window asked of the server and the
 * per-node age gate (MeshCore infrastructure by its own window, #4899), the
 * map age filter, Colour nodes by (#6125/#6175), Hide nodes without a current
 * position advert (#5578), Zoom to fit (#4898), and DashboardMap's own route
 * segments, traceroute highlight and neighbour links.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture as A, SOURCE_IDS } from '../../__fixtures__/athens';
import { dbRow } from '../../__fixtures__/fixtureApi';
import { marker, openLayers, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const NOW_S = Math.floor(Date.now() / 1000);
const HOURS_48 = 48 * 3600;

/** A MeshCore node on Heltec MeshCore at Athens. */
function meshcore(short: string, key: string, extra: Record<string, unknown> = {}) {
  return {
    sourceId: SOURCE_IDS.heltec, isMeshCore: true, nodeNum: 900_000 + key.charCodeAt(0), nodeId: key.repeat(64).slice(0, 64),
    publicKey: key.repeat(64).slice(0, 64), longName: `MeshCore ${short}`, shortName: short,
    latitude: 37.97, longitude: 23.70, lastHeard: NOW_S - 600, advType: 1, ...extra,
  };
}

/** The unified bundles with Glyfada Beach heard 48 h ago, and `heltec` MeshCore nodes. */
function bundles(heltec: unknown[]) {
  return {
    'GET /api/unified/dashboard': (url: URL) =>
      (url.searchParams.get('sources') ?? '').split(',').filter(Boolean).map((sourceId) => ({
        sourceId,
        nodes: sourceId === SOURCE_IDS.g2
          ? A.nodes.map((n) => dbRow(n.user?.shortName === 'GLYF' ? { ...n, lastHeard: NOW_S - HOURS_48 } : n, sourceId))
          : sourceId === SOURCE_IDS.heltec ? heltec : [],
        traceroutes: [],
        neighborInfo: [],
        channels: [],
      })),
  };
}

const markerShown = (short: string) =>
  Array.from(document.querySelectorAll('.leaflet-marker-icon')).some((m) => m.textContent?.includes(short));

describe('Overview map keeps the Dashboard map\'s age rules (I1)', () => {
  it('asks the server for the Dashboard\'s age window', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    const calls = vi.mocked(fetch).mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/api/unified/dashboard'));
    expect(calls.length).toBeGreaterThan(0);
    for (const u of calls) expect(u).toContain('ageWindow=settings');
  });

  it('a node heard longer ago than the map\'s age window is not drawn; a MeshCore repeater keeps its own window', async () => {
    renderOverview('/overview/map', {
      fixtures: bundles([meshcore('RPTR', 'a', { advType: 2, lastHeard: NOW_S - HOURS_48 }), meshcore('MCOLD', 'b', { lastHeard: NOW_S - HOURS_48 })]),
    });
    await marker('KFR');
    await marker('RPTR');
    expect(markerShown('GLYF')).toBe(false);
    expect(markerShown('MCOLD')).toBe(false);
  });
});

describe('Overview map keeps the Dashboard map\'s controls (I2)', () => {
  it('the map age filter is in Nodes', async () => {
    renderOverview('/overview/map');
    const drawer = within(await openLayers());
    expect(drawer.getByText('Map age filter')).toBeInTheDocument();
  });

  it('Colour nodes by source rings every pin, with its key', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    expect(document.querySelector('.leaflet-marker-icon [data-source-ring]')).toBeNull();
    fireEvent.click(within(await openLayers()).getByRole('radio', { name: 'Colour nodes by source' }));
    await waitFor(() => expect(document.querySelector('.leaflet-markers-pane [data-source-ring]')).not.toBeNull());
    expect(screen.getByRole('note', { name: 'Colour nodes by source' })).toHaveTextContent('Station G2');
  });

  it('Hide nodes without a current position advert takes that MeshCore pin off the map', async () => {
    renderOverview('/overview/map', { fixtures: bundles([meshcore('NOADV', 'c', { lastAdvertHadPosition: false })]) });
    await marker('NOADV');
    fireEvent.click(within(await openLayers()).getByRole('switch', { name: 'Hide nodes without a current position advert' }));
    await waitFor(() => expect(markerShown('NOADV')).toBe(false));
    expect(markerShown('KFR')).toBe(true);
  });

  it('Zoom to fit is a map button, off with no positioned node', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    const fit = screen.getByRole('button', { name: 'Zoom to fit all nodes' });
    expect(fit).toBeEnabled();
    fireEvent.click(fit);
  });

  it('Show Route Segments and Show Traceroute draw the Dashboard\'s traceroute hops', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    const overlayPaths = () => document.querySelectorAll('.leaflet-overlay-pane path').length;
    const before = overlayPaths();
    const drawer = within(await openLayers());
    fireEvent.click(drawer.getByRole('switch', { name: 'Show Route Segments' }));
    await waitFor(() => expect(overlayPaths()).toBeGreaterThan(before));
    const segments = overlayPaths();
    // Show Traceroute is on by default (MapContext): its highlight is drawn over the same hops, and goes with it.
    const route = drawer.getByRole('switch', { name: 'Show Traceroute' });
    const wasOn = (route as HTMLInputElement).checked;
    fireEvent.click(route);
    await waitFor(() => (wasOn ? expect(overlayPaths()).toBeLessThan(segments) : expect(overlayPaths()).toBeGreaterThan(segments)));
  });

  it('Show Neighbor Info draws the Dashboard\'s neighbour links', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    const before = document.querySelectorAll('.leaflet-overlay-pane path').length;
    fireEvent.click(within(await openLayers()).getByRole('switch', { name: 'Show Neighbor Info' }));
    await waitFor(() => expect(document.querySelectorAll('.leaflet-overlay-pane path').length).toBeGreaterThan(before));
  });
});

describe('a pin popup\'s "seen by" row (I3)', () => {
  it('opens the device\'s Workspace node page, not the re-hosted Classic page', async () => {
    renderOverview('/overview/map');
    fireEvent.click(await marker('KFR'));
    const popup = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.leaflet-popup');
      if (!el) throw new Error('no popup');
      return el;
    });
    fireEvent.click(within(popup).getByText('Station G2').closest('button')!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 })).toBeInTheDocument();
  });
});
