/**
 * @vitest-environment jsdom
 *
 * Board g5-links (phone): the Links tab with the last route from this device
 * (today's traceroute strip) and the node's own neighbour report.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('g5-links', () => {
  it('g5-links shows the board', async () => {
    const { container } = renderChat(`${kifisia}/links`, { phone: true });
    await screen.findByText('Hymettus Relay', { selector: '[data-neighbour] *' }, { timeout: 5000 });
    await screen.findByText(/Last traced/);
    expectBoard('g5-links', container);
  });
});
