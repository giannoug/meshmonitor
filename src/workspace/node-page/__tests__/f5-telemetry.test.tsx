/**
 * @vitest-environment jsdom
 *
 * Board f5-telemetry (desktop): the node page's Telemetry tab is today's
 * TelemetryGraphs as it is (time range, the per-chart ⋯ menu, the star).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('f5-telemetry', () => {
  it('f5-telemetry shows the board', async () => {
    const { container } = renderChat(`${kifisia}/telemetry`);
    await screen.findByText(/Battery Level/, {}, { timeout: 5000 });
    expectBoard('f5-telemetry', container);
  });

  it('the Telemetry tab is current and the charts keep today\'s range selector', async () => {
    renderChat(`${kifisia}/telemetry`);
    await screen.findByText(/Battery Level/, {}, { timeout: 5000 });
    expect(screen.getByRole('link', { name: 'Telemetry' })).toHaveAttribute('aria-current', 'page');
    const range = screen.getByRole('group', { name: /time range/i });
    fireEvent.click(within(range).getByRole('button', { name: '7d' }));
    expect(within(range).getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true');
  });
});
