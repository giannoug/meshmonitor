/**
 * The join step of the beacons list (#4723, #5232): which slot, accept,
 * cancel. Shared by Classic's BeaconsPanel and the Workspace Beacons page
 * (#6365 Rule X: moved out of BeaconsPanel unchanged).
 */
import { useCallback, useMemo, useState } from 'react';
import { JOINABLE_SLOTS, type PendingAccept, type PublicBeaconOffer } from './types';
import type { UseBeaconOffers } from './useBeaconOffers';

export function useBeaconJoin(
  channels: Array<{ id: number; name: string }> | undefined,
  beacons: Pick<UseBeaconOffers, 'accept' | 'clearError'>,
) {
  const [pending, setPending] = useState<PendingAccept | null>(null);
  const [busy, setBusy] = useState(false);

  const occupiedBySlot = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of channels ?? []) {
      if (c.name) map.set(c.id, c.name);
    }
    return map;
  }, [channels]);

  /** Wrap a write so a failure cannot leave the row's buttons permanently disabled. */
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // The hook has already surfaced the message on `beacons.error`.
    } finally {
      setBusy(false);
    }
  }, []);

  const startJoin = useCallback((offer: PublicBeaconOffer) => {
    const free = JOINABLE_SLOTS.find((s) => !occupiedBySlot.has(s));
    setPending({ offer, slot: free ?? JOINABLE_SLOTS[0] });
  }, [occupiedBySlot]);

  const confirmAccept = useCallback(async (overwrite: boolean) => {
    if (!pending) return;
    await run(async () => {
      await beacons.accept(pending.offer.nodeNum, pending.slot, overwrite);
      setPending(null);
    });
  }, [beacons, pending, run]);

  const cancel = useCallback(() => {
    setPending(null);
    beacons.clearError();
  }, [beacons]);

  return { pending, setPending, busy, occupiedBySlot, run, startJoin, confirmAccept, cancel };
}
