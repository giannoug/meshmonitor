/**
 * @vitest-environment jsdom
 *
 * Board 5-01-overview-analysis (desktop, s5n1): the all-devices map is today's
 * Map Analysis canvas. Over it: today's filters (sources, node types,
 * transports, the node filter, the node picker), Tools, Time and Layers; a
 * chip for each analysis layer that is on, with its lookback; and the
 * inspector beside it, here on a node, with "Open node page".
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { marker, openLayers, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ON = { enabled: true, lookbackHours: 24 };
const preset = { layers: { traceroutes: ON, neighbors: ON, hopShading: { enabled: true } } };

describe('5-01-overview-analysis', () => {
  it('5-01-overview-analysis shows the board', async () => {
    const { container } = renderOverview('/overview/map', preset);
    fireEvent.click(await marker('KFR'));
    const inspector = await screen.findByTestId('analysis-inspector');
    await within(inspector).findByText('Traceroute Links', {}, { timeout: 5000 });
    expectBoard('5-01-overview-analysis', container);
  });

  it('today\'s filters sit over the map', async () => {
    renderOverview('/overview/map', preset);
    expect(await screen.findByRole('button', { name: /^All sources/ }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All node types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All transports' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Filter nodes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All nodes' })).toBeInTheDocument();
  });

  it('the node filter is Map Analysis\'s node search: it narrows the pins', async () => {
    renderOverview('/overview/map', preset);
    await marker('KFR');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter nodes' }), { target: { value: 'Station' } });
    await waitFor(() => expect(Array.from(document.querySelectorAll('.leaflet-marker-icon')).some((m) => m.textContent?.includes('KFR'))).toBe(false));
    await marker('G2');
  });

  it('a chip per analysis layer that is on: its lookback changes the layer, × turns it off', async () => {
    renderOverview('/overview/map', preset);
    const chips = await screen.findByRole('group', { name: 'Analysis layers on' }, { timeout: 5000 });
    expect(within(chips).getAllByRole('combobox').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Traceroutes lookback',
      'Neighbors lookback',
    ]);
    fireEvent.change(within(chips).getByRole('combobox', { name: 'Traceroutes lookback' }), { target: { value: '6' } });
    expect(storedConfig().layers.traceroutes.lookbackHours).toBe(6);
    fireEvent.click(within(chips).getByRole('button', { name: 'Turn off Neighbors' }));
    expect(storedConfig().layers.neighbors.enabled).toBe(false);
    expect(within(chips).queryByRole('combobox', { name: 'Neighbors lookback' })).toBeNull();
  });

  it('the inspector opens the node\'s page on its device', async () => {
    renderOverview('/overview/map', preset);
    fireEvent.click(await marker('KFR'));
    const link = await screen.findByRole('link', { name: /Open node page/ }, { timeout: 5000 });
    expect(link).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/node/${encodeURIComponent('!a1b2c301')}`);
  });

  it('the Hop Shading switch shows and hides the legend\'s Role Badges (markers replace them)', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    const legend = document.querySelector<HTMLElement>('.map-analysis-legend')!;
    expect(within(legend).getByText('Role Badges')).toBeInTheDocument();
    const hop = within(await openLayers()).getByRole('switch', { name: 'Hop Shading' });
    fireEvent.click(hop);
    await waitFor(() => expect(within(legend).queryByText('Role Badges')).toBeNull());
    fireEvent.click(hop);
    await waitFor(() => expect(within(legend).getByText('Role Badges')).toBeInTheDocument());
  });

  it('opening the map and the analysis layers sends nothing', async () => {
    renderOverview('/overview/map', preset);
    fireEvent.click(await marker('KFR'));
    await screen.findByTestId('analysis-inspector');
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET');
    expect(writes).toEqual([]);
  });
});
