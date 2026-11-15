/**
 * @vitest-environment jsdom
 *
 * Board 6-03-coverage (desktop, s6n0/s6n2): the Coverage Report full width
 * under Reports with today's parts — Refresh and Export, the range, sender,
 * hops, cross-source, colour and view controls, the survey bar, the
 * receivers list beside the map, the summary and receivers table, the
 * distance chart, then the cross-source table and setup guidance below.
 * `?report=coverage&…` deep links keep working.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { coverageSurveys } from '../../__fixtures__/reports';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
// Leaflet's canvas renderer needs a 2D context jsdom lacks; today's map has its own tests and the Playwright shot draws it.
vi.mock('../../../components/Analysis/CoverageMap', () => ({
  CoverageMap: ({ fixes }: { fixes: unknown[] }) => <div data-testid="coverage-map">{fixes.length} fixes</div>,
}));

const SURVEY = coverageSurveys[0].id;

describe('6-03-coverage', () => {
  it('6-03-coverage shows the board', async () => {
    const { container } = renderReports(`/overview/reports/coverage?report=coverage&sender=!a1b2c302&survey=${SURVEY}`);
    // The linked survey applies once the list loads; the report then reads its window.
    await screen.findByRole('button', { name: 'Stop survey' }, { timeout: 5000 });
    await screen.findByText('Distance vs SNR (direct receptions)', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'All receivers' }));
    expectBoard('6-03-coverage', container);
  });

  it('heads the page as a live report that reads stored data, with Refresh and Back', async () => {
    renderReports('/overview/reports/coverage');
    expect(await screen.findByRole('heading', { level: 1, name: 'Coverage Report' })).toBeInTheDocument();
    expect(screen.getByText('Live · reads stored data when opened')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(await screen.findByTestId('coverage-map')).toHaveTextContent('18 fixes');
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/overview/reports');
  });

  it('/reports?report=coverage&… opens Coverage with the linked sender and range', async () => {
    const receptions = vi.fn(() => ({ success: true, data: { items: [], pageSize: 1000, hasMore: false, nextCursor: null } }));
    renderReports('/reports?report=coverage&sender=!a1b2c302&range=6h', { fixtures: { 'GET /api/analysis/coverage/receptions': receptions } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Coverage Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6 h' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(receptions).toHaveBeenCalled());
    const url = new URL(receptions.mock.calls[0][0] as URL);
    expect(url.searchParams.get('sender')).toBe('!a1b2c302');
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/reports');
  });
});
