/**
 * @vitest-environment jsdom
 *
 * Board 8-19 (phone): #athens with the heard-by sheet of our message open:
 * which repeaters relayed it, the required one not yet, and Resend with its
 * Sends line.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-19-channel-thread', () => {
  it('8-19-channel-thread shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/channel/1`, { phone: true });
    const own = (await screen.findByText('Heading to Glyfada, will report back on the coast road')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(own).getByRole('button', { name: /^Heard by 1/ }));
    const sheet = await screen.findByRole('dialog', { name: /Heard by 1 of 2 repeaters/ });
    expect(sheet).toHaveTextContent('Penteli Repeater');
    expect(sheet).toHaveTextContent('Resend: sends it again as a new flood · asks first · 2 of 3 resends left');
    expectBoard('8-19-channel-thread', joined(container, sheet));
  });
});
