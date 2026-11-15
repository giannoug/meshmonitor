/**
 * @vitest-environment jsdom
 *
 * Board 5-03-time-trails (desktop): Time turns on today's time slider (2D
 * only, as on Map Analysis) and a trail opens in the inspector with its
 * points, start, end and duration.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/** Athens Rover's trail: the interactive line in the trails pane. */
const trail = () =>
  waitFor(
    () => {
      const el = document.querySelector<SVGPathElement>('.leaflet-trails-pane path.leaflet-interactive');
      if (!el) throw new Error('no trail');
      return el;
    },
    { timeout: 5000 },
  );

describe('5-03-time-trails', () => {
  it('5-03-time-trails shows the board', async () => {
    const { container } = renderOverview('/overview/map', { layers: { trails: { enabled: true, lookbackHours: 6 } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Time Slider' }, { timeout: 5000 }));
    await screen.findByTestId('time-slider');
    fireEvent.click(await trail());
    await within(await screen.findByTestId('analysis-inspector')).findByText('Position Trail');
    expectBoard('5-03-time-trails', container);
  });

  it('Time is today\'s time slider toggle', async () => {
    renderOverview('/overview/map');
    const time = await screen.findByRole('button', { name: 'Time Slider' }, { timeout: 5000 });
    expect(time).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('time-slider')).toBeNull();
    fireEvent.click(time);
    expect(time).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByTestId('time-slider')).toBeInTheDocument();
    expect(storedConfig().timeSlider.enabled).toBe(true);
  });
});
