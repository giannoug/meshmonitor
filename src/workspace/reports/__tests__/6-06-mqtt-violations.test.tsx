/**
 * @vitest-environment jsdom
 *
 * Board 6-06-mqtt-violations (desktop, s6n0): ok_to_mqtt Violations under
 * Reports with today's parts — the window, From / To, Include unproven, Hide
 * expected, Run report and Export CSV; the pre-run, caveat and broker
 * banners; the summary tiles; the gateway table with its packet drill-down
 * and CSV. Nothing is read until Run report; nothing sends on the mesh.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/mqtt-violations';

describe('6-06-mqtt-violations', () => {
  it('6-06-mqtt-violations shows the board', async () => {
    const { container } = renderReports(ROUTE);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Include unproven (unreadable bit)' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));
    fireEvent.click(await screen.findByText('Athens MQTT gw'));
    await screen.findByText('Nikos T-Echo');
    expectBoard('6-06-mqtt-violations', container);
  });

  it('heads the page with today’s title; the pre-run banner shows until Run report, which reads the window', async () => {
    const gateways = vi.fn(() => ({ success: true, data: { total: 0, limit: 50, offset: 0, since: 0, until: 0, includeUnknown: false, suspectedAvailable: false, suspectedWindowMs: 0, sources: [], capApplied: false, scanCap: 2000, gateways: [] } }));
    renderReports(ROUTE, { fixtures: { 'GET /api/analysis/mqtt-violations/gateways': gateways } });
    expect(await screen.findByRole('heading', { level: 1, name: 'ok_to_mqtt Violations' })).toBeInTheDocument();
    expect(screen.getByText(/nothing is queried until you do/)).toBeInTheDocument();
    expect(gateways).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '30 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));
    await waitFor(() => expect(gateways).toHaveBeenCalledTimes(1));
    expect(new URL(String((gateways.mock.calls[0] as unknown[])[0])).searchParams.get('lookbackDays')).toBe('30');
  });
});
