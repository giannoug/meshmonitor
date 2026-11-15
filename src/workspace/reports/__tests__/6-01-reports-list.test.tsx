/**
 * @vitest-environment jsdom
 *
 * Board 6-01-reports-list (desktop, s6n0): Overview › Reports lists every
 * report with its last run, status and a one-line result. Mesh Issues is the
 * only report with a stored last run (`/status`) and keeps its Run button;
 * the others read stored data when opened. Rows come from the AnalysisTab
 * registry, so a new report cannot go missing (spec §2 anti-goal).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { ANALYSIS_REPORTS } from '../../../components/Analysis/analysisReports';
import { meshIssuesStatus } from '../../__fixtures__/reports';
import { renderReports, reply } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const en = JSON.parse(readFileSync(join(process.cwd(), 'public/locales/en.json'), 'utf8')) as Record<string, string>;
const meshRow = () => screen.findByTestId('report-row-mesh-issues', {}, { timeout: 5000 });

describe('6-01-reports-list', () => {
  it('6-01-reports-list shows the board', async () => {
    const { container } = renderReports('/overview/reports');
    await within(await meshRow()).findByText(/3 new findings/);
    expectBoard('6-01-reports-list', container);
  });

  it.each(['/overview/reports', '/reports'])('%s lists every registry report, each opening its page', async (route) => {
    renderReports(route);
    const list = await screen.findByRole('table', { name: 'Analysis & Reports' });
    for (const r of ANALYSIS_REPORTS) {
      const link = within(list).getByRole('link', { name: en[r.titleKey] ?? r.title });
      expect(link).toHaveAttribute('href', `${route}/${r.slug}`);
    }
    expect(within(list).getAllByRole('row')).toHaveLength(ANALYSIS_REPORTS.length + 1);
  });

  it.each(['/overview/reports/mesh-issues', '/reports', '/reports/coverage'])('%s marks Reports as the current Overview row', async (route) => {
    renderReports(route);
    const sidebar = await screen.findByRole('complementary', { name: 'Overview' });
    expect(await within(sidebar).findByRole('link', { name: 'Analysis & Reports' })).toHaveAttribute('aria-current', 'page');
  });

  it('Mesh Issues shows its stored last run and status, and keeps Run', async () => {
    renderReports('/overview/reports');
    const row = await meshRow();
    expect(await within(row).findByText('from storage')).toBeInTheDocument();
    expect(within(row).getByText(new Date(meshIssuesStatus.lastRunTime!).toLocaleString())).toBeInTheDocument();
    expect(within(row).getByText('Needs a look')).toBeInTheDocument();
    expect(within(row).getByText('3 new findings · 1 reopened · 12 found')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Run analysis now' })).toBeEnabled();
  });

  it('Run posts today’s run-now; nothing is sent on the mesh', async () => {
    const run = vi.fn(() => ({ success: true, data: { findingCount: 12, newCount: 0, reopenedCount: 0, updatedCount: 12, closedCount: 0 } }));
    renderReports('/overview/reports', { fixtures: { 'POST /api/analysis/mesh-issues/run-now': run } });
    fireEvent.click(await within(await meshRow()).findByRole('button', { name: 'Run analysis now' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Reports send nothing on the mesh/)).toBeInTheDocument();
  });

  it('the other reports read stored data when opened, with an Open link', async () => {
    renderReports('/overview/reports');
    const row = await screen.findByTestId('report-row-coverage');
    expect(within(row).getByText('Live')).toBeInTheDocument();
    expect(within(row).getByText('On open')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/overview/reports/coverage');
    const solar = screen.getByTestId('report-row-solar-monitoring');
    expect(within(solar).getByText('Not run yet')).toBeInTheDocument();
    expect(within(solar).getByText('Reads stored data when you run it')).toBeInTheDocument();
  });

  it('denied: without a readable source, Mesh Issues shows no last run and no Run', async () => {
    renderReports('/overview/reports', { fixtures: { 'GET /api/analysis/mesh-issues/status': () => reply(403) } });
    const row = await meshRow();
    await waitFor(() => expect(within(row).getAllByText('—').length).toBeGreaterThan(0));
    expect(within(row).queryByRole('button', { name: 'Run analysis now' })).toBeNull();
  });

  it('denied: a 403 from Run hides the button, as today', async () => {
    renderReports('/overview/reports', { fixtures: { 'POST /api/analysis/mesh-issues/run-now': () => reply(403) } });
    fireEvent.click(await within(await meshRow()).findByRole('button', { name: 'Run analysis now' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Run analysis now' })).toBeNull());
  });
});
