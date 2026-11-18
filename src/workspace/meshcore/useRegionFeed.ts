/**
 * A MeshCore MQTT region feed's reads (Task 7.5), today's MeshCoreIngestView
 * requests: the overview (region, broker, node count, observers), polled every
 * 15 s as today; the nodes learned from adverts and the decrypted channel
 * messages (`limit=100`), read when first shown and again each time a tab
 * that shows them opens (today re-reads them on each tab open; the page calls
 * `rereadFeed`). No poll. Shared by the feed's page and its sidebar through
 * the query cache, so opening the feed reads each once.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

export interface FeedObserver {
  publicKey: string;
  online: boolean;
  lastSeenMs: number;
  batteryMv: number | null;
  uptimeSecs: number | null;
  noiseFloor: number | null;
}

export interface FeedOverview {
  connected: boolean;
  region?: string | null;
  /** Redacted broker URL, or null when this viewer may not see the host. */
  brokerUrl?: string | null;
  nodeCount: number;
  observers: FeedObserver[];
}

export interface FeedNode {
  publicKey: string;
  name?: string | null;
  advType?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  lastHeard?: number | null;
}

export interface FeedMessage {
  id?: string | number;
  channelIdx?: number | null;
  channelName?: string | null;
  legacy?: boolean;
  text?: string | null;
  fromName?: string | null;
  timestamp?: number | null;
  createdAt?: number | null;
  senderTimestamp?: number | null;
  filtered?: 'ignore' | 'block';
}

/** Today's overview cadence (MeshCoreIngestView REFRESH_MS). */
const REFRESH_MS = 15_000;

const prefix = (sourceId: string) => `/api/sources/${encodeURIComponent(sourceId)}/meshcore/ingest`;
/** Read when first shown; a tab open re-reads it (`rereadFeed`); no poll and no focus re-read. */
const onOpen = { refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 30_000 } as const;

export const feedKeys = {
  nodes: (sourceId: string) => ['meshcore-ingest', sourceId, 'nodes'] as const,
  messages: (sourceId: string) => ['meshcore-ingest', sourceId, 'messages'] as const,
};

/** A tab that shows nodes or messages opened: read them again, once, as today. */
export function rereadFeed(queryClient: QueryClient, sourceId: string, what: Array<'nodes' | 'messages'>) {
  for (const w of what) {
    const state = queryClient.getQueryState(feedKeys[w](sourceId));
    // A first read (no data yet) or one in flight is already the read for this open.
    if (state?.dataUpdatedAt && state.fetchStatus !== 'fetching') void queryClient.refetchQueries({ queryKey: feedKeys[w](sourceId) });
  }
}

export function useFeedOverview(sourceId: string) {
  return useQuery({
    queryKey: ['meshcore-ingest', sourceId, 'overview'],
    queryFn: async () => (await apiService.get<{ data?: FeedOverview }>(`${prefix(sourceId)}/overview`))?.data ?? null,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: false,
  });
}

export function useFeedNodes(sourceId: string, enabled = true) {
  return useQuery({
    queryKey: feedKeys.nodes(sourceId),
    queryFn: async () => (await apiService.get<{ data?: { nodes: FeedNode[] } }>(`${prefix(sourceId)}/nodes`))?.data?.nodes ?? [],
    enabled,
    ...onOpen,
  });
}

/** The compact list has no collapsed row, so ignored messages (#5408) are left out, as today. */
export function useFeedMessages(sourceId: string, enabled = true) {
  return useQuery({
    queryKey: feedKeys.messages(sourceId),
    queryFn: async () =>
      ((await apiService.get<{ data?: { messages: FeedMessage[] } }>(`${prefix(sourceId)}/messages?limit=100`))?.data?.messages ?? []).filter((m) => !m.filtered),
    enabled,
    ...onOpen,
  });
}

/** Messages per channel name, with the older unreadable ones under `null`. */
export function feedChannels(messages: FeedMessage[]): Array<{ name: string | null; count: number; latest: FeedMessage }> {
  const map = new Map<string | null, { name: string | null; count: number; latest: FeedMessage }>();
  for (const m of messages) {
    const name = m.legacy ? null : (m.channelName ?? (m.channelIdx != null ? `#${m.channelIdx}` : null));
    const entry = map.get(name);
    if (entry) entry.count += 1;
    else map.set(name, { name, count: 1, latest: m });
  }
  return [...map.values()];
}
