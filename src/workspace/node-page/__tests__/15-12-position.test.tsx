/**
 * @vitest-environment jsdom
 *
 * Board 15-12 (phone): the Position tab under the collapsible header, the
 * map with its playback bar, then the history switches and the facts.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { rover } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('15-12-position', () => {
  it('15-12-position shows the board', async () => {
    const { container } = renderChat(`${rover}/position`, { phone: true });
    await screen.findByTestId('asset-playback-bar', {}, { timeout: 5000 });
    expectBoard('15-12-position', container);
  });
});
