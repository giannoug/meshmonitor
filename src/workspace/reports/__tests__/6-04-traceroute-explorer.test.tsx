/**
 * @vitest-environment jsdom
 *
 * Board 6-04-traceroute-explorer (desktop, s6n0/s6n2): the Traceroute
 * Explorer under Reports with today's parts — Refresh, the filters (range,
 * source, protocol, result, transport, node search, Through chip, max hops),
 * the summary tiles, the layout / rows / map-lines toolbar, the linked map and
 * table, and the selected run's detail (strip, copy links, Pair history,
 * paths used). Reads only.
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
// Leaflet's canvas renderer needs a 2D context jsdom lacks; today's map has its own tests and the Playwright shot draws it.
vi.mock('../../../components/Analysis/tracerouteExplorer/ExplorerMap', () => ({
  ExplorerMap: ({ runs, onNodeClick }: { runs: unknown[]; onNodeClick(key: string): void }) => (
    <div data-testid="explorer-map">
      {runs.length} runs
      <button type="button" onClick={() => onNodeClick(`mt:${0xa1b2c30a}`)}>Halandri on the map</button>
    </div>
  ),
}));

const ROUTE = '/overview/reports/traceroute-explorer';

const pairRow = (short: string) => screen.getAllByTestId('explorer-pair-row').find((r) => r.textContent?.includes(short))!;

/** Expands Station G2 → Kifisia Rooftop and selects its newest run. */
async function selectKifisiaRun() {
  await screen.findAllByTestId('explorer-pair-row', {}, { timeout: 5000 });
  const kif = pairRow('KIF');
  fireEvent.click(kif);
  fireEvent.click(kif.nextElementSibling as HTMLElement);
  return screen.findByTestId('traceroute-explorer-detail');
}

describe('6-04-traceroute-explorer', () => {
  it('6-04-traceroute-explorer shows the board', async () => {
    renderReports(ROUTE);
    await screen.findByTestId('explorer-map', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Halandri on the map' }));
    // Station G2 → Marousi Mobile comes back another way (Asymmetric).
    await screen.findAllByTestId('explorer-pair-row');
    fireEvent.click(pairRow('MAR2'));
    await selectKifisiaRun();
    expectBoard('6-04-traceroute-explorer', document.body);
  });

  it('heads the page as a live report with Refresh, which re-reads the window', async () => {
    const explorer = vi.fn(() => ({ success: true, data: { sources: [], runs: [], nodes: [], truncated: false, scanLimit: 5000, retentionPerPair: 50 } }));
    renderReports(ROUTE, { fixtures: { 'GET /api/traceroutes/explorer': explorer } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Traceroute Explorer' })).toBeInTheDocument();
    expect(screen.getByText('Live · reads stored data when opened')).toBeInTheDocument();
    await waitFor(() => expect(explorer).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(explorer).toHaveBeenCalledTimes(2));
    expect(new URL(String((explorer.mock.calls[1] as unknown[])[0])).searchParams.get('hours')).toBe('24');
  });

  it('a map node narrows the table to routes through it, and the chip clears it', async () => {
    renderReports(ROUTE);
    await screen.findByTestId('explorer-map');
    expect(await screen.findAllByTestId('explorer-pair-row')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Halandri on the map' }));
    expect(screen.getByText('Through Halandri Relay')).toBeInTheDocument();
    expect(screen.getAllByTestId('explorer-pair-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear node filter' }));
    expect(screen.getAllByTestId('explorer-pair-row')).toHaveLength(6);
  });

  it('a selected run shows its detail with Pair history and the paths the pair used', async () => {
    renderReports(ROUTE);
    const detail = await selectKifisiaRun();
    expect(within(detail).getByRole('button', { name: 'Pair history' })).toBeInTheDocument();
    expect(within(detail).getByText('Paths this pair has used')).toBeInTheDocument();
  });
});
