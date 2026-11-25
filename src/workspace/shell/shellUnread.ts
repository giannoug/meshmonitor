/**
 * Readers of queries something else already polls, so a list or a screen adds
 * no polling observer of its own (TanStack runs one refetch timer per observer).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useCachedQueryData } from '../dashboard/useCachedQueryData';
import { useAuth } from '../../contexts/AuthContext';
import { readLocalShowMqttMessages } from '../../contexts/showMqttMessagesPreference';
import apiService from '../../services/api';
import type { FirstUnreadData } from '../../hooks/useFirstUnread';
import type { UnreadCountsData } from '../../hooks/useUnreadCounts';
import { appBasename } from '../../init';

export interface ShellMapPreferences {
  unreadIndicatorEnabled?: boolean;
  showMqttMessagesBySource?: Record<string, boolean>;
}

/** The viewer's map preferences: one unpolled read, shared by the shell and the unread readers. */
export function useShellMapPreferences() {
  const { authStatus } = useAuth();
  return useQuery({
    queryKey: ['user', 'map-preferences'],
    enabled: authStatus?.authenticated === true,
    staleTime: 5 * 60_000,
    queryFn: async () => (await apiService.get<{ preferences?: ShellMapPreferences | null }>('/api/user/map-preferences')).preferences ?? null,
  });
}

/**
 * "Show MQTT messages" for a device, readable above UIProvider (the shell is): the server copy, else the
 * local cache, as UIProvider seeds it. The channel toggle writes the server copy into the cache.
 */
export function useShowMqttMessages(sourceId: string | null | undefined): boolean {
  const { data } = useShellMapPreferences();
  return (sourceId ? data?.showMqttMessagesBySource?.[sourceId] : undefined) ?? readLocalShowMqttMessages(sourceId ?? undefined);
}

/** The open device's unread counts: the key `useWorkspaceSources` polls with useUnreadCounts. */
export function useOpenDeviceUnread(sourceId: string | null | undefined) {
  const excludeMqtt = !useShowMqttMessages(sourceId);
  return { data: useCachedQueryData<UnreadCountsData>(['unreadCounts', appBasename, sourceId ?? null, excludeMqtt]) };
}

/** The conversation's first-unread anchors: the key its MessagingProvider polls with useFirstUnread. `isPending` is true until that fetch has settled (data or error). */
export function useProviderFirstUnread(sourceId: string | null | undefined, showMqttMessages: boolean) {
  const queryKey = ['firstUnread', appBasename, sourceId ?? null, !showMqttMessages];
  const queryClient = useQueryClient();
  const data = useCachedQueryData<FirstUnreadData>(queryKey);
  const status = useSyncExternalStore(
    (cb) => queryClient.getQueryCache().subscribe(cb),
    () => queryClient.getQueryState(queryKey)?.status,
  );
  return { data, isPending: status === undefined || status === 'pending' };
}
