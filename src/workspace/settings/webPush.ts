/**
 * Web Push on this browser, per source, for the Workspace pages (Task 5.8):
 * today's requests and endpoint rules from `services/webPushSubscription.ts`
 * (shared with NotificationsTab, #5493), read once per source (no poll).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  browserPushSubscription,
  pushSupported,
  sourcePushStatus,
  subscribeSource,
  unsubscribeAllSources,
  unsubscribeSource,
} from '../../services/webPushSubscription';

export { pushSupported };

export interface PushHere {
  /** This browser has a push endpoint at all. */
  browser: boolean;
  /** This source holds a row for it (today's fallback: subscribed when the server cannot say). */
  subscribed: boolean;
  /** How many other sources use this browser's endpoint. */
  otherSources: number;
}

/** Whether this browser gets `sourceId`'s pushes (today's checkNotificationStatus). */
export async function pushStatusHere(sourceId: string): Promise<PushHere> {
  if (!pushSupported()) return { browser: false, subscribed: false, otherSources: 0 };
  const subscription = await browserPushSubscription();
  if (!subscription) return { browser: false, subscribed: false, otherSources: 0 };
  return { browser: true, ...(await sourcePushStatus(subscription.endpoint, sourceId)) };
}

export const subscribeHere = (sourceId: string) => subscribeSource(sourceId).then(() => undefined);
export const unsubscribeHere = (sourceId: string) => unsubscribeSource(sourceId).then(() => undefined);
export const unsubscribeEverywhere = unsubscribeAllSources;

export const pushHereKey = (sourceId: string) => ['workspace', 'pushHere', sourceId] as const;

/**
 * This browser's push state for `sourceId`, read once. `reread()` reads this
 * source again after its own change; `rereadAll()` after leaving every source.
 */
export function usePushHere(sourceId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: pushHereKey(sourceId), queryFn: () => pushStatusHere(sourceId), staleTime: Infinity, retry: false });
  return {
    ...query,
    reread: () => queryClient.invalidateQueries({ queryKey: pushHereKey(sourceId) }),
    rereadAll: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'pushHere'] }),
  };
}
