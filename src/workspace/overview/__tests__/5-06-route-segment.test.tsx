/**
 * @vitest-environment jsdom
 *
 * Board 5-06-route-segment (desktop): with Traceroutes on and a node
 * selected, a route segment opens in the inspector: from, to, direction,
 * observations, average SNR and the endpoints' terrain.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { marker, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('5-06-route-segment', () => {
  it('5-06-route-segment shows the board', async () => {
    const { container } = renderOverview('/overview/map', { layers: { traceroutes: { enabled: true, lookbackHours: 24 } } });
    // A node first: its segments then carry a direction (outbound / inbound), as on Map Analysis.
    fireEvent.click(await marker('KFR'));
    await within(await screen.findByTestId('analysis-inspector')).findByText('Traceroute Links', {}, { timeout: 5000 });
    const segment = await waitFor(
      () => {
        const el = document.querySelector<SVGPathElement>('.leaflet-paths-pane path.leaflet-interactive');
        if (!el) throw new Error('no segment');
        return el;
      },
      { timeout: 5000 },
    );
    fireEvent.click(segment);
    const inspector = within(await screen.findByTestId('analysis-inspector'));
    await inspector.findByText('Route Segment');
    // The endpoints' terrain, from the elevation service (fixture).
    await waitFor(() => expect(inspector.getByText('From Elevation').nextElementSibling?.textContent).toMatch(/^\d+ m$/), { timeout: 5000 });
    expectBoard('5-06-route-segment', container);
  });
});
