/**
 * The signed-in user's server-side preference map (`/api/user/preferences`).
 * Anonymous users read `{}` and cannot write (the server answers 403).
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

type Prefs = Record<string, unknown>;
const KEY = ['user', 'preferences'];
const path = (key: string) => `/api/user/preferences/${encodeURIComponent(key)}`;

export function useUserPreferences(): {
  prefs: Prefs;
  isLoading: boolean;
  setPref(key: string, value: unknown): Promise<void>;
  deletePref(key: string): Promise<void>;
} {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: KEY,
    queryFn: async () =>
      (await apiService.get<{ data?: { preferences?: Prefs } }>('/api/user/preferences')).data?.preferences ?? {},
    staleTime: 5 * 60_000,
  });

  // Optimistic: apply locally, send, roll back to the previous map on failure.
  const mutate = useCallback(
    async (change: (p: Prefs) => Prefs, send: () => Promise<unknown>) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const prev = queryClient.getQueryData<Prefs>(KEY);
      queryClient.setQueryData<Prefs>(KEY, change(prev ?? {}));
      try {
        await send();
      } catch (err) {
        queryClient.setQueryData<Prefs>(KEY, prev);
        throw err;
      }
    },
    [queryClient],
  );

  const setPref = useCallback(
    (key: string, value: unknown) => mutate((p) => ({ ...p, [key]: value }), () => apiService.put(path(key), { value })),
    [mutate],
  );
  const deletePref = useCallback(
    (key: string) =>
      mutate(
        (p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)),
        () => apiService.delete(path(key)),
      ),
    [mutate],
  );

  return { prefs: data ?? {}, isLoading: isPending, setPref, deletePref };
}

export function useUserPreference<T>(key: string, fallback: T): [T, (v: T) => Promise<void>] {
  const { prefs, setPref } = useUserPreferences();
  const set = useCallback((v: T) => setPref(key, v), [setPref, key]);
  return [(prefs[key] as T | undefined) ?? fallback, set];
}
