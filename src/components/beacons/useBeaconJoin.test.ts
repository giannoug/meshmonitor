/**
 * @vitest-environment jsdom
 *
 * The join step shared by Classic's BeaconsPanel and the Workspace Beacons
 * page (#6365 Rule X): slot choice, accept, cancel.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBeaconJoin } from './useBeaconJoin';
import type { UseBeaconOffers } from './useBeaconOffers';
import type { PublicBeaconOffer } from './types';

const offer = { nodeNum: 7, offerChannelName: 'Hiking' } as PublicBeaconOffer;
const channels = [{ id: 0, name: 'LongFast' }, { id: 1, name: 'gauntlet' }, { id: 2, name: '' }];

function fakeBeacons(accept = vi.fn().mockResolvedValue(undefined)) {
  return { accept, clearError: vi.fn() } as unknown as UseBeaconOffers & { accept: typeof accept; clearError: ReturnType<typeof vi.fn> };
}

describe('useBeaconJoin', () => {
  it('names occupied slots and starts on the first free one', () => {
    const { result } = renderHook(() => useBeaconJoin(channels, fakeBeacons()));
    expect([...result.current.occupiedBySlot]).toEqual([[0, 'LongFast'], [1, 'gauntlet']]);
    act(() => result.current.startJoin(offer));
    expect(result.current.pending).toEqual({ offer, slot: 2 });
  });

  it('accepts with the overwrite flag, then clears the pending join', async () => {
    const beacons = fakeBeacons();
    const { result } = renderHook(() => useBeaconJoin(channels, beacons));
    act(() => result.current.startJoin(offer));
    act(() => result.current.setPending({ offer, slot: 1 }));
    await act(() => result.current.confirmAccept(true));
    expect(beacons.accept).toHaveBeenCalledWith(7, 1, true);
    expect(result.current.pending).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('a failed accept keeps the join open and clears busy', async () => {
    const beacons = fakeBeacons(vi.fn().mockRejectedValue(new Error('nope')));
    const { result } = renderHook(() => useBeaconJoin(channels, beacons));
    act(() => result.current.startJoin(offer));
    await act(() => result.current.confirmAccept(false));
    expect(result.current.pending).not.toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('cancel drops the join and the surfaced error', () => {
    const beacons = fakeBeacons();
    const { result } = renderHook(() => useBeaconJoin(channels, beacons));
    act(() => result.current.startJoin(offer));
    act(() => result.current.cancel());
    expect(result.current.pending).toBeNull();
    expect(beacons.clearError).toHaveBeenCalled();
  });
});
