/**
 * @vitest-environment jsdom
 *
 * Board 6-14-nodeinfo-enrichment (phone, s6n1/s6n3): the push card with its
 * Sends line, Fix All full width, and one ≥52 px row per target with its own
 * Fix; tapping a row opens the copy preview as a bottom sheet.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/nodeinfo-enrichment';

describe('6-14-nodeinfo-enrichment', () => {
  it('6-14-nodeinfo-enrichment shows the board', async () => {
    const { container } = renderReports(ROUTE, { phone: true });
    await screen.findByText('Marousi Mobile', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also push to device NodeDB' }));
    expectBoard('6-14-nodeinfo-enrichment', container);
  });

  it('lists targets as rows, not the desktop table, each with its own Fix', async () => {
    renderReports(ROUTE, { phone: true });
    await screen.findByText('Marousi Mobile');
    expect(screen.queryByRole('table')).toBeNull();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByRole('button', { name: 'Fix' })).toBeInTheDocument();
    expect(within(rows[0]).getByText('Rooftop RAK', { exact: false })).toBeInTheDocument();
  });

  it('a row’s Fix posts that row; tapping the row opens the copy preview sheet', async () => {
    const apply = vi.fn((_url: URL, _init?: RequestInit) => ({ success: true, data: { applied: [], totalFieldsCopied: 1 } }));
    renderReports(ROUTE, { phone: true, fixtures: { 'POST /api/nodes/enrichment/apply': apply } });
    await screen.findByText('Hymettus Relay');
    const row = screen.getByText('Hymettus Relay').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Fix' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(apply.mock.calls[0][1]?.body))).toEqual({
      items: [{ nodeNum: 0xa1b2c306, targetSourceId: 'src-rak', donorSourceId: 'src-mqtt' }],
      pushToNodeDb: false,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: /Hymettus Relay/ }));
    expect(await screen.findByRole('dialog', { name: 'Copy NodeInfo' })).toBeInTheDocument();
  });
});
