/**
 * @vitest-environment jsdom
 *
 * Phone Mesh Issues findings (board 6-09, s6n3): By issue lists each finding
 * as a row of at least 52 px (severity bar, subject, "type · time", state),
 * not today's wide table. A row opens a bottom detail sheet with today's
 * finding body, Dismiss (or Restore) and Mute rule, gated as today
 * (`canAct`). One sheet or dialog at a time.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_MESH_ISSUES_FILTERS } from '../../../components/Analysis/meshIssues/grouping';
import { renderReports, reply, type ReportsOptions } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/mesh-issues';
const VIEW: ReportsOptions['meshIssuesView'] = {
  expandedTypes: ['B1_router_cluster', 'C2_over_broadcasting'],
  filters: { ...DEFAULT_MESH_ISSUES_FILTERS, includeDismissed: true },
};
const clusterList = () => screen.findByRole('list', { name: 'B1 Router cluster' }, { timeout: 5000 });
async function openCluster() {
  fireEvent.click(within(await clusterList()).getByText('Cluster of 2'));
  return screen.findByRole('dialog');
}

describe('phone Mesh Issues findings', () => {
  it('lists findings as rows, not today’s table', async () => {
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW });
    const [row] = within(await clusterList()).getAllByRole('listitem');
    expect(row).toHaveTextContent('Cluster of 2');
    expect(row).toHaveTextContent(/Router cluster · /);
    expect(within(row).getByText('New')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a row opens the detail sheet with today’s finding body', async () => {
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW });
    const sheet = await openCluster();
    expect(within(sheet).getByText('B1 Router cluster · Critical')).toBeInTheDocument();
    expect(within(sheet).getByText(/Set one to CLIENT, or move it/)).toBeInTheDocument();
    expect(within(sheet).getByText('New · Station G2, Athens MQTT')).toBeInTheDocument();
  });

  it('Dismiss sends today’s dismiss for that finding and closes the sheet', async () => {
    const dismiss = vi.fn(() => ({ success: true }));
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW, fixtures: { 'POST /api/analysis/mesh-issues/:id/dismiss': dismiss } });
    fireEvent.click(within(await openCluster()).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(1));
    expect(new URL(dismiss.mock.calls[0][0] as URL).pathname).toBe('/api/analysis/mesh-issues/1/dismiss');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a dismissed finding offers Restore', async () => {
    const restore = vi.fn(() => ({ success: true }));
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW, fixtures: { 'POST /api/analysis/mesh-issues/:id/restore': restore } });
    const list = await screen.findByRole('list', { name: 'C2 Broadcasting too often' }, { timeout: 5000 });
    fireEvent.click(await within(list).findByText('Piraeus Base'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
  });

  it('Mute rule closes the sheet and opens today’s mute dialog', async () => {
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW });
    fireEvent.click(within(await openCluster()).getByRole('button', { name: 'Mute rule' }));
    expect(await screen.findByText('Mute B1 Router cluster?')).toBeInTheDocument();
    expect(screen.queryByText('B1 Router cluster · Critical')).toBeNull();
  });

  it('denied: without canAct the sheet has no Dismiss and no Mute rule', async () => {
    renderReports(ROUTE, { phone: true, meshIssuesView: VIEW, fixtures: { 'GET /api/analysis/mesh-issues/status': () => reply(403) } });
    const sheet = await openCluster();
    expect(within(sheet).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Mute rule' })).toBeNull();
  });
});
