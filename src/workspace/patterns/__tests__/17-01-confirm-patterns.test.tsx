/**
 * @vitest-environment jsdom
 *
 * Board 17-01-confirm-patterns (desktop, Task 9.1): the one confirm, shown one
 * state at a time (D9c) and collected for one board check: Reboot (plain, it
 * names what happens), Purge node database (typed PURGE, the red button off
 * until the word is typed), Discard unsaved changes (Keep editing), and the
 * busy state (Reset config: the field, Cancel and the red button off, with a
 * spinner). Today's words; every one transmits, so Enter never confirms (BH).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { g2, renderSettings } from '../../settings/__tests__/renderSettings';
import { boardChannels, pollWith } from '../../settings/__tests__/categoryFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const open = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name }, { timeout: 10_000 }));
  return screen.findByRole('dialog');
};
const close = async (sheet: HTMLElement) => {
  fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
};

describe('17-01-confirm-patterns', () => {
  it('17-01-confirm-patterns shows the board (each state in turn)', async () => {
    const texts: string[] = [];
    // Hold the reset so its sheet stays busy.
    renderSettings(`${g2}/settings/maintenance/danger`, { fixtures: { 'POST /api/admin/commands': () => new Response(new ReadableStream({ start() {} })) } });

    // A plain confirm that names what happens.
    const reboot = await open('Reboot Device');
    expect(within(reboot).getByText('What happens:')).toBeInTheDocument();
    expect(within(reboot).getByText('MeshMonitor reconnects by itself and reads its config again')).toBeInTheDocument();
    texts.push(reboot.textContent ?? '');
    await close(reboot);

    // A typed confirm: the red button stays off until today's word is typed.
    const purge = await open('Purge Node Database');
    fireEvent.change(within(purge).getByRole('textbox', { name: 'Type PURGE to confirm' }), { target: { value: 'PUR' } });
    expect(within(purge).getByRole('button', { name: 'Purge Node Database' })).toBeDisabled();
    texts.push(purge.textContent ?? '');
    await close(purge);

    // Busy: today's typed confirm dialog turns off both buttons and the field while it runs.
    const reset = await open('Reset config (keeps identity key and BLE bonds)');
    const word = within(reset).getByRole('textbox', { name: 'Type G2 to confirm' });
    fireEvent.change(word, { target: { value: 'G2' } });
    fireEvent.click(within(reset).getByRole('button', { name: 'Reset config' }));
    expect(await within(reset).findByTestId('confirm-spinner')).toBeInTheDocument();
    expect(word).toBeDisabled();
    expect(within(reset).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(within(reset).getByRole('button', { name: 'Reset config' })).toBeDisabled();
    texts.push(reset.textContent ?? '');
    cleanup();

    // Discard unsaved changes, with Keep editing (today's LeaveGuard).
    renderSettings(`${g2}/settings/channels/2`, { fixtures: pollWith(boardChannels) });
    const name = await screen.findByLabelText('Channel Name', {}, { timeout: 5000 });
    await waitFor(() => expect(name).toHaveValue('Athens Ops'));
    fireEvent.change(name, { target: { value: 'Athens' } });
    fireEvent.click(screen.getByRole('link', { name: 'Security' }));
    const discard = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(within(discard).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    texts.push(discard.textContent ?? '');

    expectBoard('17-01-confirm-patterns', joined(...texts));
  });
});
