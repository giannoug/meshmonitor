/**
 * @vitest-environment jsdom
 *
 * Board 5-06-route-segment (desktop): with Traceroutes on, a route segment
 * opens in the inspector: from, to, observations, average SNR.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('5-06-route-segment', () => {
  it('5-06-route-segment shows the board', async () => {
    const { container } = renderOverview('/overview/map', { layers: { traceroutes: { enabled: true, lookbackHours: 24 } } });
    const segment = await waitFor(
      () => {
        const el = document.querySelector<SVGPathElement>('.leaflet-paths-pane path.leaflet-interactive');
        if (!el) throw new Error('no segment');
        return el;
      },
      { timeout: 5000 },
    );
    fireEvent.click(segment);
    await within(await screen.findByTestId('analysis-inspector')).findByText('Route Segment');
    expectBoard('5-06-route-segment', container);
  });
});
