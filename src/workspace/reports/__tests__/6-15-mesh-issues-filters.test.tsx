/**
 * @vitest-environment jsdom
 *
 * Board 6-15-mesh-issues-filters (phone, s6n3): the Mesh Issues filter sheet
 * holds today's filter bar — search, severity, tier, source, show closed,
 * show dismissed, clear — and a button that shows the matching issues.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { DEFAULT_MESH_ISSUES_FILTERS } from '../../../components/Analysis/meshIssues/grouping';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const open = async () => {
  renderReports('/overview/reports/mesh-issues', {
    phone: true,
    meshIssuesView: { filters: { ...DEFAULT_MESH_ISSUES_FILTERS, includeDismissed: true, tiers: ['B'] } },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Filters · 2' }, { timeout: 5000 }));
  return screen.findByRole('dialog', { name: 'Filters' });
};

describe('6-15-mesh-issues-filters', () => {
  it('6-15-mesh-issues-filters shows the board', async () => {
    const sheet = await open();
    await within(sheet).findByText('Station G2');
    expectBoard('6-15-mesh-issues-filters', sheet);
  });

  it('a filter applies from the sheet; Show N issues closes it', async () => {
    const sheet = await open();
    const closed = within(sheet).getByRole('checkbox', { name: 'Show closed' });
    fireEvent.click(closed);
    expect(closed).toBeChecked();
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Show 13 issues' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull());
    expect(await screen.findByRole('button', { name: 'Filters · 3' })).toBeInTheDocument();
  });
});
