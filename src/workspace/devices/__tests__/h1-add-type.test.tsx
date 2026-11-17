/**
 * @vitest-environment jsdom
 *
 * Boards h1 (desktop) and i1 (phone), Task 6.6: Add device, step 1. The six
 * source types today's form offers; desktop picks a card and goes on with
 * Next, phone goes on from the row.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderDevices } from './devicesHarness';

const ADD = '/server/devices?add=1';

describe('h1 / i1 add type', () => {
  it.each([
    ['h1-add-type', false],
    ['i1-add-type', true],
  ])('%s shows the board', async (board, phone) => {
    renderDevices(ADD, { phone });
    await screen.findByText('What are you connecting?');
    expectBoard(board, document.body);
  });

  it('desktop: Meshtastic node is picked first; another card and Next go to its connection step', async () => {
    renderDevices(ADD);
    const dialog = await screen.findByRole('dialog', { name: 'Add device' });
    expect(within(dialog).getByRole('radio', { name: 'Meshtastic node' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getAllByRole('radio')).toHaveLength(6);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Reticulum' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText('Through the meshmonitor-rns-bridge sidecar.')).toBeInTheDocument();
    expect(within(dialog).getByRole('listitem', { current: 'step' })).toHaveTextContent('Connection');
  });

  it('phone: a row goes straight to step 2, and Back returns', async () => {
    renderDevices(ADD, { phone: true });
    const dialog = await screen.findByRole('dialog', { name: 'Add device' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'MeshCore' }));
    expect(await within(dialog).findByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(await within(dialog).findByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('Cancel closes the flow and sends nothing', async () => {
    const { log } = renderDevices(ADD);
    const dialog = await screen.findByRole('dialog', { name: 'Add device' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Add device' })).toBeNull();
    expect(log.writes).toHaveLength(0);
  });
});
