/**
 * @vitest-environment jsdom
 *
 * Board 10-10 (phone): Message details as a sheet, opened from the long-press
 * actions sheet.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`;
const OURS = 'Running one now, should be 2 hops via Hymettus';

describe('10-10-message-details', () => {
  it('10-10-message-details shows the board', async () => {
    renderChat(route, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
    fireEvent.contextMenu((await screen.findByText(OURS)).closest('[data-message-id]')!);
    const actions = await screen.findByRole('dialog', { name: /^You · / });
    fireEvent.click(within(actions).getByRole('button', { name: /^Details/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Delivery Details' });
    await within(sheet).findByText('Attempt 2');
    expectBoard('10-10-message-details', sheet);
  });
});
