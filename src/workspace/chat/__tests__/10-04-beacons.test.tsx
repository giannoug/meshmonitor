/**
 * @vitest-environment jsdom
 *
 * Boards 10-04 (desktop) and 10-13 (phone): Beacons as a page under the
 * channel header, and the join step as a Sheet. Joining an occupied slot
 * turns the button into "Replace and join" in red, with today's warning.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/channel/0/beacons`;
const GLYFADA = 0xa1b2c303;

/** Opens the list on All and starts a join from Glyfada Beach's offer. */
async function startJoin(phone: boolean) {
  renderChat(route, { phone });
  fireEvent.click(await screen.findByTestId('beacons-filter-all'));
  const row = await screen.findByTestId(`beacon-offer-${GLYFADA}`);
  fireEvent.click(within(row).getByRole('button', { name: 'Join channel' }));
  return screen.findByRole('dialog', { name: 'Join this channel?' });
}

describe.each([
  ['10-04-beacons', false],
  ['10-13-beacons', true],
])('%s', (board, phone) => {
  it(`${board} shows the board`, async () => {
    const sheet = await startJoin(phone);
    // The board shows the slot in use.
    fireEvent.click(within(sheet).getByRole('radio', { name: '1 — in use by "gauntlet"' }));
    await within(sheet).findByRole('button', { name: 'Replace and join' });
    expectBoard(board, document.body);
  });
});

describe('beacon join', () => {
  it('preselects the first free slot, and says it sends nothing on the mesh', async () => {
    const sheet = within(await startJoin(false));
    expect(sheet.getByRole('radio', { name: '3 — empty' })).toBeChecked();
    expect(sheet.getByRole('button', { name: 'Join channel' })).toBeInTheDocument();
    expect(sheet.getByText('Sends nothing on the mesh; writes channel slot 3 on Station G2 over the connection')).toBeInTheDocument();
  });

  it("an occupied slot shows Replace and join in red with today's warning, and accepts with overwrite", async () => {
    const sheet = within(await startJoin(false));
    fireEvent.click(sheet.getByRole('radio', { name: '1 — in use by "gauntlet"' }));
    expect(
      sheet.getByText('Slot 1 currently holds "gauntlet". Joining here replaces it, and any messages on that channel will no longer decrypt.', { exact: false }),
    ).toBeInTheDocument();
    const go = sheet.getByRole('button', { name: 'Replace and join' });
    expect(go.className).toMatch(/danger/);
    fireEvent.click(go);
    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(([u, i]) => String(u).includes(`/beacon-offers/${GLYFADA}/accept`) && i?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ slot: 1, confirm: true, overwrite: true });
    });
  });

  it('without nodes:write the list has no actions, as today', async () => {
    renderChat(route, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: true }, nodes: { read: true, write: false } } } },
    });
    fireEvent.click(await screen.findByTestId('beacons-filter-all'));
    const row = await screen.findByTestId(`beacon-offer-${GLYFADA}`);
    expect(within(row).queryByRole('button', { name: 'Join channel' })).toBeNull();
  });
});
