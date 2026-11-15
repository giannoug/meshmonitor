/**
 * @vitest-environment jsdom
 *
 * Board 6-11-traceroute-explorer (phone, s6n2/s6n3): a one-line summary, a
 * Filters sheet holding today's filters, and one ≥52 px row per pair; a row
 * opens the pair's newest run in a sheet (strip, copy links, Pair history,
 * paths used). The map is one tap away (Show map).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../components/Analysis/tracerouteExplorer/ExplorerMap', () => ({
  ExplorerMap: ({ runs }: { runs: unknown[] }) => <div data-testid="explorer-map">{runs.length} runs</div>,
}));

const ROUTE = '/overview/reports/traceroute-explorer';

describe('6-11-traceroute-explorer', () => {
  it('6-11-traceroute-explorer shows the board', async () => {
    renderReports(ROUTE, { phone: true });
    const rows = await screen.findAllByTestId('explorer-pair-item', {}, { timeout: 5000 });
    fireEvent.click(within(rows[0]).getByRole('button'));
    await screen.findByTestId('traceroute-explorer-detail');
    expectBoard('6-11-traceroute-explorer', document.body);
  });

  it('heads with the one-line summary and lists pairs as rows, not the table', async () => {
    renderReports(ROUTE, { phone: true });
    const rows = await screen.findAllByTestId('explorer-pair-item');
    expect(rows).toHaveLength(6);
    expect(screen.getByText('10 traceroutes · 6 pairs · 90% answered')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByTestId('explorer-map')).toBeNull();
    expect(within(rows[0]).getByText('Route changed')).toBeInTheDocument();
  });

  it('a row opens its pair in a sheet; closing it clears the selection', async () => {
    renderReports(ROUTE, { phone: true });
    const rows = await screen.findAllByTestId('explorer-pair-item');
    fireEvent.click(within(rows[0]).getByRole('button'));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Pair history' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Filters opens today’s filters in a sheet, and its count follows them', async () => {
    renderReports(ROUTE, { phone: true });
    await screen.findAllByTestId('explorer-pair-item');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Answered' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Filters · 1' })).toBeInTheDocument();
  });

  it('Show map draws the map above the rows', async () => {
    renderReports(ROUTE, { phone: true });
    await screen.findAllByTestId('explorer-pair-item');
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }));
    expect(screen.getByTestId('explorer-map')).toBeInTheDocument();
  });
});
