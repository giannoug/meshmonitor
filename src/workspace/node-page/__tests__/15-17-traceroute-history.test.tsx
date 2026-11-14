/**
 * @vitest-environment jsdom
 *
 * Board 15-17 (phone): the Links tab, stacked: the traceroute strip, the
 * history and the neighbour report.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('15-17-traceroute-history', () => {
  it('15-17-traceroute-history shows the board', async () => {
    const { container } = renderChat(`${kifisia}/links`, { phone: true });
    const card = await screen.findByRole('region', { name: 'Traceroute History' }, { timeout: 5000 });
    await within(card).findByText(/Showing 4 traceroute/);
    await screen.findByText(/Last traced/);
    expectBoard('15-17-traceroute-history', container);
  });
});
