/**
 * @vitest-environment jsdom
 *
 * Board 6-09-mesh-issues (phone, s6n3): the same report under a "‹ Back to
 * reports" header, Run beside the title, today's tiles, By issue / By node,
 * and a Filters button that opens the filter sheet (6-15).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { DEFAULT_MESH_ISSUES_FILTERS } from '../../../components/Analysis/meshIssues/grouping';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/mesh-issues';

describe('6-09-mesh-issues', () => {
  it('6-09-mesh-issues shows the board', async () => {
    const { container } = renderReports(ROUTE, {
      phone: true,
      meshIssuesView: { expandedTypes: ['B1_router_cluster'], filters: { ...DEFAULT_MESH_ISSUES_FILTERS, includeDismissed: true } },
    });
    const header = await screen.findAllByRole('button', { name: /^B1 Router cluster/, expanded: true }, { timeout: 5000 });
    const cluster = header[0].closest('section')!;
    fireEvent.click(await within(cluster).findByRole('button', { name: 'Show details' }));
    fireEvent.click(within(cluster).getByRole('button', { name: /^Bulk actions for/ }));
    fireEvent.click(within(cluster).getByRole('menuitem', { name: 'Mute this rule' }));
    await screen.findByRole('button', { name: 'Mute rule' });
    // The bulk menu's items, as the sheet's Dismiss (one menu at a time on the board, D9c).
    fireEvent.click(within(cluster).getByRole('button', { name: /^Bulk actions for/ }));
    await within(cluster).findByRole('menuitem', { name: /^Dismiss all/ });
    expectBoard('6-09-mesh-issues', container);
  });

  it('has its own header back to Reports, and no device header', async () => {
    renderReports(ROUTE, { phone: true });
    expect(await screen.findByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/overview/reports');
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });

  it('the filter bar lives in the Filters sheet, not on the page', async () => {
    renderReports(ROUTE, { phone: true });
    const filters = await screen.findByRole('button', { name: 'Filters' });
    expect(screen.queryByText('Show closed')).toBeNull();
    fireEvent.click(filters);
    expect(within(await screen.findByRole('dialog', { name: 'Filters' })).getByText('Show closed')).toBeInTheDocument();
  });
});
