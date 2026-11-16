/**
 * @vitest-environment jsdom
 *
 * Boards 12-01-channels (desktop) and 12-14-channels (phone): the eight slots
 * with today's chips and the Channel Database collision warning, Add channel,
 * Import to slot N, and Reorder mode, which takes the save dock with Cancel /
 * Apply Order (Apply writes every slot and the node reboots; it sends nothing
 * on the mesh). With all 8 slots used, Add channel is off with today's text.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, goTo, realUrl, renderSettings } from './renderSettings';
import { boardChannels, pollWith } from './categoryFixtures';
import type { Channel } from '../../../types/device';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const reorders: unknown[] = [];
const fixtures = {
  ...pollWith(boardChannels),
  'POST /api/channels/reorder': (_url: URL, init?: RequestInit) => {
    reorders.push(JSON.parse(String(init?.body)));
    return { success: true, requiresReboot: true };
  },
};
const loaded = () => screen.findByText('LongFast', {}, { timeout: 5000 });
const dock = () => screen.findByRole('region', { name: 'Reorder mode' });

/** Reorder mode, then slot 2 moved to the top (the move buttons beside the drag handle). */
async function moveAthensUp() {
  fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
  await dock();
  fireEvent.click(screen.getByRole('button', { name: 'Move Athens Ops up' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Athens Ops up' }));
}

describe('12-01-channels', () => {
  it('12-01-channels shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/channels`, { fixtures });
    await loaded();
    expect(screen.getByText('3 of 8 slots used')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    const region = await dock();
    expect(region).toHaveTextContent('Apply Order writes every slot and reboots Station G2');
    expectBoard('12-01-channels', container);
  });

  it('12-14-channels shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/channels`, { fixtures, phone: true });
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    await dock();
    expectBoard('12-14-channels', container);
  });

  it('a slot opens its page; Add channel opens the next free slot', async () => {
    renderSettings(`${g2}/settings/channels`, { fixtures });
    await loaded();
    fireEvent.click(screen.getByRole('link', { name: /gauntlet/ }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/channels/1`));
    goTo(`${g2}/settings/channels`);
    fireEvent.click(await screen.findByRole('link', { name: 'Add channel' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/channels/3`));
  });

  it('with all 8 slots used, Add channel is off with today\'s text', async () => {
    const eight: Channel[] = Array.from({ length: 8 }, (_, i) => ({ ...boardChannels[Math.min(i, 2)], id: i, name: `Ch${i}`, role: i === 0 ? 1 : 2 }));
    renderSettings(`${g2}/settings/channels`, { fixtures: pollWith(eight) });
    await screen.findByText('Ch7', {}, { timeout: 5000 });
    expect(screen.getByRole('button', { name: 'Add channel' })).toBeDisabled();
    expect(screen.getByText('All 8 channel slots are in use. Delete a channel to free a slot.')).toBeInTheDocument();
    expect(screen.queryByText(/Import to slot/)).toBeNull();
  });

  it('Reorder mode takes the dock: the radio bar yields, Cancel restores, Apply Order writes the new order once', async () => {
    reorders.length = 0;
    renderSettings(`${g2}/settings/channels`, { fixtures });
    await loaded();
    await moveAthensUp();
    const region = await dock();
    expect(region).toHaveTextContent('Channel order changed. Apply to device?');
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
    fireEvent.click(within(region).getByRole('button', { name: 'Apply Order' }));
    await waitFor(() => expect(reorders).toEqual([{ newOrder: [2, 0, 1, 3, 4, 5, 6, 7], sourceId: 'src-g2' }]));
  });

  it('Cancel leaves reorder mode and writes nothing', async () => {
    reorders.length = 0;
    renderSettings(`${g2}/settings/channels`, { fixtures });
    await loaded();
    await moveAthensUp();
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Reorder mode' })).toBeNull());
    expect(reorders).toEqual([]);
    expect(screen.getAllByText(/^Slot \d$/).map((n) => n.textContent).slice(0, 3)).toEqual(['Slot 0', 'Slot 1', 'Slot 2']);
  });
});
