/**
 * @vitest-environment jsdom
 *
 * Board 6-05-solar (desktop, s6n0/s6n2): Solar Monitoring under Reports with
 * today's parts — the lookback, Run forecast and Run analysis in the header,
 * the summary tiles, the forecast table with the nodes at risk and the manual
 * classification on the left, and the node cards (chart, daily patterns) on
 * the right. Runs read stored telemetry; the classification is a
 * `settings:write` database write. Nothing sends on the mesh.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/solar';

async function runBoth() {
  fireEvent.click(await screen.findByRole('button', { name: 'Run analysis' }, { timeout: 5000 }));
  fireEvent.click(screen.getByRole('button', { name: 'Run forecast' }));
  await screen.findByText('Solar Forecast');
  return screen.findAllByRole('button', { name: /Glyfada Beach/ });
}

describe('6-05-solar', () => {
  it('6-05-solar shows the board', async () => {
    const { container } = renderReports(ROUTE);
    const [card] = await runBoth();
    fireEvent.click(card);
    await screen.findByText('Recent daily patterns');
    expectBoard('6-05-solar', container);
  });

  it('heads the page with the lookback, Run forecast and Run analysis; nothing is read until a run', async () => {
    const nodes = vi.fn(() => ({ lookback_days: 7, total_nodes_analyzed: 0, solar_nodes_count: 0, solar_nodes: [], solar_production: [], avg_charging_hours_per_day: null, avg_discharge_hours_per_day: null }));
    renderReports(ROUTE, { fixtures: { 'GET /api/analysis/solar-nodes': nodes } });
    const heading = await screen.findByRole('heading', { level: 1, name: 'Solar Monitoring Analysis' });
    const head = heading.closest('div')!.parentElement!;
    expect(within(head).getByRole('button', { name: 'Run analysis' })).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Run forecast' })).toBeInTheDocument();
    expect(within(head).getByText('Lookback (days):')).toBeInTheDocument();
    expect(nodes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    await waitFor(() => expect(nodes).toHaveBeenCalledTimes(1));
    expect(new URL(String((nodes.mock.calls[0] as unknown[])[0])).searchParams.get('lookback_days')).toBe('7');
    expect(await screen.findByRole('button', { name: 'Re-run analysis' })).toBeInTheDocument();
  });

  it('Use auto-detection clears a classification (today’s PUT)', async () => {
    const put = vi.fn((_url: URL, _init?: RequestInit) => ({ success: true }));
    renderReports(ROUTE, { fixtures: { 'PUT /api/analysis/solar-overrides/:nodeNum': put } });
    await runBoth();
    const panel = screen.getByText('Manual solar classification').parentElement!;
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Use auto-detection' })[0]);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(String(put.mock.calls[0][0])).toContain(`/api/analysis/solar-overrides/${0xa1b2c301}`);
    expect(JSON.parse(String(put.mock.calls[0][1]?.body))).toEqual({ isSolar: null });
  });

  it('a viewer without settings:write sees the classification but cannot change it', async () => {
    renderReports(ROUTE, { permissions: { global: { settings: { read: true, write: false } } } });
    await runBoth();
    expect(screen.getByText('Manual solar classification')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as solar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use auto-detection' })).toBeNull();
  });
});
