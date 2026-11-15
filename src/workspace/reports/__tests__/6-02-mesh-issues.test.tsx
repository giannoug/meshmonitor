/**
 * @vitest-environment jsdom
 *
 * Board 6-02-mesh-issues (desktop, s6n0): Mesh Issues opens full width under
 * Reports with today's parts — Run, "Last run … · from storage", the evidence
 * preface, the summary tiles, the filter bar, By issue / By node and the
 * findings tables with their bulk menus and Mute rule. Gates are today's:
 * Run, Dismiss and the bulk actions show once `/status` answers, and hide
 * after a 401/403 (settings:write on the server).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { DEFAULT_MESH_ISSUES_FILTERS } from '../../../components/Analysis/meshIssues/grouping';
import { meshIssuesStatus } from '../../__fixtures__/reports';
import { renderReports, reply, type ReportsOptions } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/mesh-issues';
/** The board's state: three sections open, dismissed findings shown. */
const BOARD_VIEW: ReportsOptions['meshIssuesView'] = {
  expandedTypes: ['B1_router_cluster', 'B3_asymmetric_link', 'C2_over_broadcasting'],
  filters: { ...DEFAULT_MESH_ISSUES_FILTERS, includeDismissed: true },
};
/** A By-issue section, by its header (the tiles above share the label). */
const section = async (label: string) =>
  (await screen.findAllByRole('button', { name: new RegExp(`^${label}`), expanded: true }, { timeout: 5000 }))[0].closest('section')!;

describe('6-02-mesh-issues', () => {
  it('6-02-mesh-issues shows the board', async () => {
    const { container } = renderReports(ROUTE, { meshIssuesView: BOARD_VIEW });
    const cluster = await section('B1 Router cluster');
    fireEvent.click(await within(cluster).findByRole('button', { name: 'Show details' }));
    const oneWay = await section('B3 Asymmetric link');
    fireEvent.click(await within(oneWay).findByRole('button', { name: 'Show details' }));
    // One menu and one dialog at a time on the board (D9c); the test opens both for its strings.
    fireEvent.click(within(cluster).getByRole('button', { name: /^Bulk actions for/ }));
    fireEvent.click(within(cluster).getByRole('menuitem', { name: 'Mute this rule' }));
    const broadcast = await section('C2 Broadcasting too often');
    fireEvent.click(within(broadcast).getByRole('button', { name: /^Bulk actions for/ }));
    await screen.findByRole('menuitem', { name: /Restore all/ });
    expectBoard('6-02-mesh-issues', container);
  });

  it('keeps Run and "Last run … · from storage"', async () => {
    renderReports(ROUTE);
    const time = new Date(meshIssuesStatus.lastRunTime!).toLocaleString();
    expect(await screen.findByText(`Last run ${time} · from storage · took 41 s (from the last completed run before restart)`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Mesh Issues' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run analysis now' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/overview/reports');
  });

  it('Run posts today’s run-now and reads the status again', async () => {
    const run = vi.fn(() => ({ success: true, data: { findingCount: 12, newCount: 0, reopenedCount: 0, updatedCount: 12, closedCount: 0 } }));
    const status = vi.fn(() => ({ success: true, data: meshIssuesStatus }));
    renderReports(ROUTE, { fixtures: { 'POST /api/analysis/mesh-issues/run-now': run, 'GET /api/analysis/mesh-issues/status': status } });
    fireEvent.click(await screen.findByRole('button', { name: 'Run analysis now' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
  });

  it('Dismiss posts the finding’s dismiss', async () => {
    const dismiss = vi.fn(() => ({ success: true }));
    renderReports(ROUTE, { meshIssuesView: BOARD_VIEW, fixtures: { 'POST /api/analysis/mesh-issues/:id/dismiss': dismiss } });
    const cluster = await section('B1 Router cluster');
    fireEvent.click(await within(cluster).findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(1));
  });

  it('Mute rule opens today’s mute dialog', async () => {
    renderReports(ROUTE, { meshIssuesView: BOARD_VIEW });
    const cluster = await section('B1 Router cluster');
    fireEvent.click(await within(cluster).findByRole('button', { name: /^Bulk actions for/ }));
    fireEvent.click(within(cluster).getByRole('menuitem', { name: 'Mute this rule' }));
    expect(await screen.findByText('Mute B1 Router cluster?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute rule' })).toBeInTheDocument();
  });

  it('By node lists the Mesh-wide group', async () => {
    renderReports(ROUTE);
    fireEvent.click(await screen.findByRole('button', { name: 'By node' }));
    expect(await screen.findByRole('button', { name: /Mesh-wide/ })).toBeInTheDocument();
  });

  it('denied: with /status refused there is no Run and no Dismiss; the findings still read', async () => {
    renderReports(ROUTE, { meshIssuesView: BOARD_VIEW, fixtures: { 'GET /api/analysis/mesh-issues/status': () => reply(403) } });
    const cluster = await section('B1 Router cluster');
    await within(cluster).findByText('Kifisia Rooftop, Halandri Relay');
    expect(screen.queryByRole('button', { name: 'Run analysis now' })).toBeNull();
    expect(within(cluster).queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});
