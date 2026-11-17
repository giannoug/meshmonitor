/**
 * @vitest-environment jsdom
 *
 * Board 8-24 (phone): the Message Route sheet for Glyfada Beach's message.
 */
import { describe, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-24-route-details', () => {
  it('8-24-route-details shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/channel/1`, { phone: true });
    const row = (await screen.findByText('Morning, anyone on the coast road? Testing a new antenna.')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Route details' }));
    const sheet = await screen.findByRole('dialog', { name: 'Message Route' });
    expectBoard('8-24-route-details', joined(container, sheet));
  });
});
