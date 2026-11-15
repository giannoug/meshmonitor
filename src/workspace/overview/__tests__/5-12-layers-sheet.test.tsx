/**
 * @vitest-environment jsdom
 *
 * Board 5-12-layers-sheet (phone): Layers opens a bottom sheet with the
 * desktop drawer's groups (Analysis first, each analysis layer with today's
 * lookback, the traceroute filters while Traceroutes is on), Reset, and the
 * parts that sit on the desktop bar or the map: the device, node-type,
 * transport and node filters (Filters) and today's legend (Legend).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { ON_24H, openPhoneSheet, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('5-12-layers-sheet', () => {
  it('5-12-layers-sheet shows the board', async () => {
    renderOverview('/overview/map', { phone: true, layers: { traceroutes: ON_24H, neighbors: ON_24H } });
    const sheet = within(await openPhoneSheet('Layers'));
    fireEvent.click(sheet.getByRole('button', { name: /^Traceroute filters/ }));
    await sheet.findByText('Min occurrences');
    expectBoard('5-12-layers-sheet', document.body);
  });

  it('opens with the Analysis group first; a row turns its layer on with today\'s lookback', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = within(await openPhoneSheet('Layers'));
    expect(sheet.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Analysis');
    fireEvent.click(sheet.getByRole('switch', { name: 'Heatmap' }));
    expect(storedConfig().layers.heatmap.enabled).toBe(true);
    fireEvent.change(sheet.getByRole('combobox', { name: 'Heatmap lookback' }), { target: { value: '168' } });
    expect(storedConfig().layers.heatmap.lookbackHours).toBe(168);
  });

  it.each(['/analysis', '/overview/analysis'])('%s opens with the Layers sheet', async (route) => {
    renderOverview(route, { phone: true });
    expect(await screen.findByRole('dialog', { name: 'Layers' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('Filters holds the desktop bar\'s filters: devices, node types, transports and the node picker', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = within(await openPhoneSheet('Layers'));
    const filters = within(sheet.getByRole('region', { name: 'Filters' }));
    for (const name of [/^All sources \(5\)/, /^All node types/, /^All transports/, /^All nodes/]) {
      expect(filters.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('Legend shows today\'s Map Analysis legend on the map', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = within(await openPhoneSheet('Layers'));
    expect(screen.queryByRole('button', { name: 'Collapse legend' })).toBeNull();
    fireEvent.click(sheet.getByRole('switch', { name: 'Legend' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Collapse legend' })).toBeInTheDocument();
  });

  it('Reset is today\'s Map Analysis reset', async () => {
    renderOverview('/overview/map', { phone: true, layers: { heatmap: ON_24H } });
    const sheet = within(await openPhoneSheet('Layers'));
    fireEvent.click(sheet.getByRole('button', { name: 'Reset' }));
    expect(storedConfig().layers.heatmap.enabled).toBe(false);
  });
});
