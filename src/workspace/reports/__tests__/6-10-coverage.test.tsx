/**
 * @vitest-environment jsdom
 *
 * Board 6-10-coverage (phone, s6n3): the survey bar over the map, then the
 * summary and filters in one panel; Receivers opens today's own list with
 * search and select all / none, under the MQTT recording status; Export
 * offers CSV or GeoJSON.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
// Leaflet's canvas renderer needs a 2D context jsdom lacks; today's map has its own tests and the Playwright shot draws it.
vi.mock('../../../components/Analysis/CoverageMap', () => ({
  CoverageMap: ({ fixes }: { fixes: unknown[] }) => <div data-testid="coverage-map">{fixes.length} fixes</div>,
}));

const ROUTE = '/overview/reports/coverage?report=coverage&sender=!a1b2c302';

describe('6-10-coverage', () => {
  it('6-10-coverage shows the board', async () => {
    const { container } = renderReports(ROUTE, { phone: true });
    await screen.findByText('Distance vs SNR (direct receptions)', {}, { timeout: 5000 });
    expectBoard('6-10-coverage', container);
  });

  it('Receivers opens its own list with search, select all / none and the recording status', async () => {
    renderReports(ROUTE, { phone: true });
    expect(await screen.findByText('Turn on in source settings')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'All receivers' }));
    expect(screen.getByRole('textbox', { name: 'Search receivers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select none' })).toBeInTheDocument();
  });

  it('has its own header back to Reports', async () => {
    renderReports(ROUTE, { phone: true });
    expect(await screen.findByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/overview/reports');
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });
});
