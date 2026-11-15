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
    renderReports(ROUTE, {
      phone: true,
      meshIssuesView: { expandedTypes: ['B1_router_cluster'], filters: { ...DEFAULT_MESH_ISSUES_FILTERS, includeDismissed: true } },
    });
    const list = await screen.findByRole('list', { name: 'B1 Router cluster' }, { timeout: 5000 });
    fireEvent.click(within(list).getByText('Cluster of 2'));
    await screen.findByRole('dialog');
    // The page and its finding sheet (portalled to <body>), as the board draws them.
    expectBoard('6-09-mesh-issues', document.body);
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
