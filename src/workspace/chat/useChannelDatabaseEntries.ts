/**
 * The viewer's Channel Database entries (server-decrypted channels), which
 * name and gate channels 100+ as in Classic's Channels tab. App reads them
 * once on mount; here they are read only when a channel 100+ is in view, and
 * shared by the sidebar list and the thread through the query cache.
 */
import { useQuery } from '@tanstack/react-query';
import apiService, { type ChannelDatabaseEntry } from '../../services/api';

const EMPTY: ChannelDatabaseEntry[] = [];

export function useChannelDatabaseEntries(enabled: boolean): { entries: ChannelDatabaseEntry[]; isPending: boolean } {
  const { data, isPending } = useQuery({
    queryKey: ['channelDatabase', 'meshtastic'],
    // As App: a viewer with no access gets no entries (the server answers 403).
    queryFn: async () => (await apiService.getChannelDatabaseEntries()).data ?? EMPTY,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { entries: data ?? EMPTY, isPending: enabled && isPending };
}
