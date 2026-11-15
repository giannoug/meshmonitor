/**
 * @vitest-environment jsdom
 *
 * Board 6-13-mqtt-violations (phone, s6n3): Run in the header, today's
 * filters in a Filters sheet, one ≥52 px row per gateway, and a gateway's
 * packets in a sheet with CSV.
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

const ROUTE = '/overview/reports/mqtt-violations';

async function runReport() {
  fireEvent.click(await screen.findByRole('button', { name: 'Run report' }, { timeout: 5000 }));
  return screen.findAllByTestId('mqtt-gateway-item');
}

describe('6-13-mqtt-violations', () => {
  it('6-13-mqtt-violations shows the board', async () => {
    renderReports(ROUTE, { phone: true });
    // Include unproven, as the board does (its rows count Suspected).
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }, { timeout: 5000 }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Filters' })).getByRole('checkbox', { name: 'Include unproven (unreadable bit)' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Filters' })).getByRole('button', { name: 'Close' }));
    const rows = await runReport();
    fireEvent.click(within(rows[0]).getByRole('button'));
    await within(await screen.findByRole('dialog')).findByText('Nikos T-Echo');
    expectBoard('6-13-mqtt-violations', document.body);
  });

  it('lists gateways as rows, not the table', async () => {
    renderReports(ROUTE, { phone: true });
    const rows = await runReport();
    expect(rows).toHaveLength(4);
    expect(screen.queryByRole('table')).toBeNull();
    expect(rows[0]).toHaveTextContent('Athens MQTT gw');
    expect(rows[0]).toHaveTextContent('Confirmed 38');
  });

  it('a gateway opens its packets in a sheet with CSV; closing it collapses the gateway', async () => {
    const packets = vi.fn((url: URL) => ({ success: true, data: { total: 0, limit: 100, offset: 0, since: 0, until: 0, includeUnknown: false, suspectedAvailable: false, suspectedWindowMs: 0, sources: [], capApplied: false, scanCap: 2000, violations: [], gateway: url.searchParams.get('gateway') } }));
    renderReports(ROUTE, { phone: true, fixtures: { 'GET /api/analysis/mqtt-violations/packets': packets } });
    const rows = await runReport();
    fireEvent.click(within(rows[1]).getByRole('button'));
    const sheet = await screen.findByRole('dialog', { name: 'Kifisia Rooftop' });
    await waitFor(() => expect(packets).toHaveBeenCalled());
    expect(new URL(String((packets.mock.calls[0] as unknown[])[0])).searchParams.get('gateway')).toBe('!a3f9c2e1');
    expect(within(sheet).getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Filters opens today’s window and toggles in a sheet', async () => {
    renderReports(ROUTE, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }, { timeout: 5000 }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Include unproven (unreadable bit)' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Filters · 1' })).toBeInTheDocument();
  });
});
