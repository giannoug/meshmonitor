/**
 * @vitest-environment jsdom
 *
 * Overview › Reports routes: the Traceroute Explorer, Solar, ok_to_mqtt and
 * NodeInfo Enrichment slugs open their Workspace pages (Task 4.5) under
 * either prefix. An unknown report goes back to the list.
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
vi.mock('../SolarPage', () => ({ default: () => <div>Solar page</div> }));
vi.mock('../EnrichmentPage', () => ({ default: () => <div>Enrichment page</div> }));
vi.mock('../MqttViolationsPage', () => ({ default: () => <div>ok_to_mqtt page</div> }));
vi.mock('../TracerouteExplorerPage', () => ({ default: () => <div>Traceroute explorer page</div> }));

describe('reports routes', () => {
  it.each([
    ['/overview/reports/solar', 'Solar page'],
    ['/reports/nodeinfo-enrichment', 'Enrichment page'],
    ['/overview/reports/mqtt-violations', 'ok_to_mqtt page'],
    ['/reports/traceroute-explorer', 'Traceroute explorer page'],
  ])('%s opens its Workspace page', async (route, text) => {
    renderReports(route);
    expect(await screen.findByText(text, {}, { timeout: 5000 })).toBeInTheDocument();
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
