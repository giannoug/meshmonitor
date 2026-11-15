/**
 * @vitest-environment jsdom
 *
 * Board 5-02-layers-analysis (desktop, s5n1): the Layers drawer on the
 * Overview map. Its Analysis group holds Map Analysis's time-windowed layers,
 * each with today's lookback, and the traceroute filters while Traceroutes is
 * on. Base map, Nodes, Links and Overlays hold the rest of Map Analysis's
 * View and Layers menus beside today's all-devices toggles. `/analysis` and
 * `/overview/analysis` open on this drawer.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { openLayers, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ON = { enabled: true, lookbackHours: 24 };

describe('5-02-layers-analysis', () => {
  it('5-02-layers-analysis shows the board', async () => {
    const { container } = renderOverview('/overview/analysis', { layers: { traceroutes: ON, neighbors: ON } });
    const drawer = within(await screen.findByTestId('layers-drawer', {}, { timeout: 5000 }));
    fireEvent.click(drawer.getByRole('button', { name: /^Traceroute filters/ }));
    await drawer.findByText('Min occurrences');
    expectBoard('5-02-layers-analysis', container);
  });

  it.each(['/analysis', '/overview/analysis'])('%s opens with the Layers drawer and its Analysis group first', async (route) => {
    renderOverview(route);
    const drawer = await screen.findByTestId('layers-drawer', {}, { timeout: 5000 });
    expect(within(drawer).getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Analysis');
  });

  it('/overview/map opens with the drawer closed', async () => {
    renderOverview('/overview/map');
    await screen.findByRole('button', { name: /^Layers/ }, { timeout: 5000 });
    expect(screen.queryByTestId('layers-drawer')).toBeNull();
  });

  it('an Analysis row turns its layer on, with today\'s lookback choices', async () => {
    renderOverview('/overview/map');
    const drawer = within(await openLayers());
    fireEvent.click(drawer.getByRole('switch', { name: 'Heatmap' }));
    expect(storedConfig().layers.heatmap.enabled).toBe(true);
    const lookback = drawer.getByRole('combobox', { name: 'Heatmap lookback' });
    expect(within(lookback).getAllByRole('option').map((o) => o.textContent)).toEqual(['1h', '6h', '24h', '72h', '168h', '720h']);
    fireEvent.change(lookback, { target: { value: '168' } });
    expect(storedConfig().layers.heatmap.lookbackHours).toBe(168);
    expect(within(drawer.getByRole('combobox', { name: 'SNR Overlay lookback' })).getAllByRole('option')[0]).toHaveTextContent('Last');
  });

  it('the traceroute filters show only while Traceroutes is on', async () => {
    renderOverview('/overview/map');
    const drawer = within(await openLayers());
    expect(drawer.queryByRole('button', { name: /^Traceroute filters/ })).toBeNull();
    fireEvent.click(drawer.getByRole('switch', { name: 'Traceroutes' }));
    expect(drawer.getByRole('button', { name: /^Traceroute filters/ })).toBeInTheDocument();
  });

  it('Reset is today\'s Map Analysis reset', async () => {
    renderOverview('/overview/map', { layers: { trails: ON } });
    const drawer = within(await openLayers());
    expect(drawer.getByRole('switch', { name: 'Trails' })).toBeChecked();
    fireEvent.click(drawer.getByRole('button', { name: 'Reset' }));
    expect(drawer.getByRole('switch', { name: 'Trails' })).not.toBeChecked();
  });

  it('the Layers button counts the analysis layers that are on', async () => {
    renderOverview('/overview/map', { layers: { traceroutes: ON, neighbors: ON } });
    expect(await screen.findByRole('button', { name: 'Layers, 2 on' }, { timeout: 5000 })).toBeInTheDocument();
  });
});
