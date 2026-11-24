/**
 * Readers of queries something else already polls, so a list or a screen adds
 * no polling observer of its own (TanStack runs one refetch timer per observer).
 */
import { skipToken, useQuery } from '@tanstack/react-query';
import type { FirstUnreadData } from '../../hooks/useFirstUnread';
import type { UnreadCountsData } from '../../hooks/useUnreadCounts';
import { appBasename } from '../../init';

/** The open device's unread counts: the key `useWorkspaceSources` polls with useUnreadCounts. */
export function useOpenDeviceUnread(sourceId: string | null | undefined) {
  return useQuery<UnreadCountsData>({ queryKey: ['unreadCounts', appBasename, sourceId ?? null, false], queryFn: skipToken });
}

/** The conversation's first-unread anchors: the key its MessagingProvider polls with useFirstUnread. */
export function useProviderFirstUnread(sourceId: string | null | undefined, showMqttMessages: boolean) {
  return useQuery<FirstUnreadData>({ queryKey: ['firstUnread', appBasename, sourceId ?? null, !showMqttMessages], queryFn: skipToken });
}
