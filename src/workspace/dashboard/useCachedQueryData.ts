import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * A query's cached data, read with no observer: it starts no request and no timer, and a refetch of the key
 * runs the queryFn its owner gave it (a second observer's `skipToken` would be the options that refetch uses).
 * `undefined` until something else has loaded the key. The reference is the cache's own, so it is stable.
 */
export function useCachedQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (cb) => queryClient.getQueryCache().subscribe(cb),
    () => queryClient.getQueryData<T>(queryKey),
  );
}
