/**
 * @vitest-environment jsdom
 *
 * Overview › Reports routes: until Task 4.5 rebuilds them, the Traceroute
 * Explorer, Solar, ok_to_mqtt and NodeInfo Enrichment rows open today's
 * report under the Reports frame. An unknown report goes back to the list.
 * A Classic user following a Workspace report link lands on Classic's
 * Reports page.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { classicFallback } from '../../layout/classicFallback';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../components/Analysis/SolarMonitoringReport', () => ({ default: () => <div>Classic solar report</div> }));
vi.mock('../../../components/Analysis/NodeInfoEnrichmentReport', () => ({ default: () => <div>Classic enrichment report</div> }));
vi.mock('../../../components/Analysis/MqttViolationsReport', () => ({ default: () => <div>Classic ok_to_mqtt report</div> }));
vi.mock('../../../components/Analysis/tracerouteExplorer/TracerouteExplorerReport', () => ({
  default: () => <div>Classic traceroute explorer</div>,
}));

describe('reports routes', () => {
  it.each([
    ['/overview/reports/solar', 'Classic solar report', '/overview/reports'],
    ['/reports/nodeinfo-enrichment', 'Classic enrichment report', '/reports'],
    ['/overview/reports/mqtt-violations', 'Classic ok_to_mqtt report', '/overview/reports'],
    ['/reports/traceroute-explorer', 'Classic traceroute explorer', '/reports'],
  ])('%s opens today’s report under the Reports frame', async (route, text, back) => {
    renderReports(route);
    expect(await screen.findByText(text, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', back);
  });

  it('an unknown report goes back to the list', async () => {
    renderReports('/overview/reports/nope');
    expect(await screen.findByTestId('report-row-mesh-issues', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each([
    ['/reports/coverage', '/reports'],
    ['/reports/mesh-issues', '/reports'],
    ['/overview/reports/solar', '/reports'],
  ])('a Classic user at %s lands on %s', (path, to) => {
    expect(classicFallback(path)).toBe(to);
  });
});
