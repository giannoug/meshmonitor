/**
 * @vitest-environment jsdom
 *
 * Board 8-24 (phone): the Message Route sheet for Glyfada Beach's message.
 */
import { describe, expect, it, vi } from 'vitest';
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

  it('the phone Scope menu\'s field, Use and Reset are phone targets', async () => {
    renderMeshCore(`${HELTEC}/channel/1`, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: /^Scope: gr-att/ }));
    const menu = await screen.findByRole('menu', { name: /Send scope/ });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Unscoped flood/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Scope: unscoped/ }));
    const again = await screen.findByRole('menu', { name: /Send scope/ });
    expect(within(again).getByRole('textbox')).toHaveAttribute('data-phone');
    expect(within(again).getByRole('button', { name: 'Use' })).toHaveAttribute('data-phone');
    expect(within(again).getByRole('menuitem', { name: 'Reset to default' })).toHaveAttribute('data-phone');
  });
});
