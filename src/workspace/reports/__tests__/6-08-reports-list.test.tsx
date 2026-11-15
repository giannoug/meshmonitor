/**
 * @vitest-environment jsdom
 *
 * Board 6-08-reports-list (phone, s6n3): the same list as rows of at least
 * 52 px under a "‹ Overview" header, each with its result, status and last
 * run; Mesh Issues keeps Run.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { ANALYSIS_REPORTS } from '../../../components/Analysis/analysisReports';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('6-08-reports-list', () => {
  it('6-08-reports-list shows the board', async () => {
    const { container } = renderReports('/overview/reports', { phone: true });
    await screen.findByText(/3 new findings/);
    expectBoard('6-08-reports-list', container);
  });

  it('has its own header back to the Overview, and no device header', async () => {
    renderReports('/overview/reports', { phone: true });
    expect(await screen.findByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });

  it('lists every registry report as a row', async () => {
    renderReports('/overview/reports', { phone: true });
    const list = await screen.findByRole('list', { name: 'Analysis & Reports' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(ANALYSIS_REPORTS.length);
    expect(within(await screen.findByTestId('report-row-mesh-issues')).getByRole('button', { name: 'Run analysis now' })).toBeInTheDocument();
  });
});
