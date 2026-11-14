/**
 * @vitest-environment jsdom
 *
 * Board 15-16 (phone): the Admin tab, stacked, under the collapsible header.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia, renumberedFixtures } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('15-16-admin', () => {
  it('15-16-admin shows the board', async () => {
    const { container } = renderChat(`${kifisia}/admin`, { phone: true, fixtures: renumberedFixtures });
    await screen.findByRole('button', { name: /Merge history…/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Create QR code' }));
    await screen.findByRole('button', { name: /Copy URL/ });
    expectBoard('15-16-admin', container);
  });
});
