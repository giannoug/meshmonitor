/**
 * What the MeshCore sidebar and phone Home list (Task 7.1): the channels,
 * room servers, DM threads and their unread state, for one device.
 *
 * Read with today's requests only, each once per device and connection state
 * (TanStack, shared with the open conversation, which refreshes them after its
 * own writes): the channel list (`/api/channels/all`), contacts (rooms and
 * names), DM threads (`/messages/dm-peers`), saved room passwords, and the
 * viewer's mutes. Unread comes from today's `useMeshCoreUnread`, with its own
 * 15 s poll of the channel and room stats, unchanged. No socket, no sound, and
 * nothing here sends.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { useMeshCoreUnread } from '../../components/MeshCore/hooks/useMeshCoreUnread';
import { loadChannelLastRead, loadDmLastRead, subscribeUnreadChanged } from '../../components/MeshCore/meshcoreUnreadStore';
import type { MeshCoreMessage } from '../../components/MeshCore/hooks/useMeshCore';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import { toChannelRow, type McChannelRow } from './meshcoreLabels';

const NO_MESSAGES: MeshCoreMessage[] = [];

interface MuteRule {
  channelId?: number;
  nodeUuid?: string;
  muteUntil?: number | null;
}

/** A mute rule in force (no end, or an end still ahead): SettingsContext's test. */
const active = (r: MuteRule | undefined) => !!r && (r.muteUntil === null || (r.muteUntil ?? 0) > Date.now());

export const mcKeys = {
  channels: (id: string) => ['workspace', 'meshcore', 'channels', id] as const,
  contacts: (id: string) => ['workspace', 'meshcore', 'contacts', id] as const,
  dmPeers: (id: string) => ['workspace', 'meshcore', 'dm-peers', id] as const,
  roomCreds: (id: string) => ['workspace', 'meshcore', 'room-creds', id] as const,
  mutes: (id: string) => ['workspace', 'meshcore', 'mutes', id] as const,
};

/** Today's channel list for a device (the Channels view's request), shared by the sidebar and the thread. */
export function channelsQuery(sourceId: string, connected: boolean) {
  return {
    queryKey: [...mcKeys.channels(sourceId), connected],
    queryFn: async (): Promise<McChannelRow[]> => {
      const raw = await apiService.get<unknown>(`/api/channels/all?sourceId=${encodeURIComponent(sourceId)}`);
      return Array.isArray(raw)
        ? raw.filter((c) => typeof c?.id === 'number').map(toChannelRow).sort((a, b) => a.id - b.id)
        : [];
    },
  };
}

export function useMeshCoreLists(sourceId: string, connected: boolean) {
  const { authStatus, hasPermission } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const scope = { sourceId };
  const canMessages = hasPermission('messages', 'read', scope);
  const canNodes = hasPermission('nodes', 'read', scope);
  const mc = `/api/sources/${encodeURIComponent(sourceId)}/meshcore`;

  const channels = useQuery(channelsQuery(sourceId, connected));
  const contacts = useQuery({
    queryKey: mcKeys.contacts(sourceId),
    enabled: canNodes,
    queryFn: async () => (await apiService.get<{ data?: MeshCoreContact[] }>(`${mc}/contacts`))?.data ?? [],
  });
  const dmPeers = useQuery({
    queryKey: [...mcKeys.dmPeers(sourceId), connected],
    enabled: canMessages,
    queryFn: async () =>
      (await apiService.get<{ data?: Array<{ publicKey: string; lastMessageAt: number }> }>(`${mc}/messages/dm-peers`))?.data ?? [],
  });
  const roomCreds = useQuery({
    queryKey: mcKeys.roomCreds(sourceId),
    enabled: signedIn && canMessages,
    queryFn: async () => {
      const body = await apiService.get<{ canRemember?: boolean; stored?: Array<{ publicKey: string }> }>(`${mc}/rooms/credentials`);
      return { canRemember: body?.canRemember === true, stored: new Set((body?.stored ?? []).map((s) => s.publicKey)) };
    },
  });
  const mutes = useQuery({
    queryKey: mcKeys.mutes(sourceId),
    enabled: signedIn,
    queryFn: () => apiService.get<{ mutedChannels?: MuteRule[]; mutedDMs?: MuteRule[] }>(`/api/push/preferences?sourceId=${encodeURIComponent(sourceId)}`),
  });

  const contactList = contacts.data ?? [];
  const self = contactList.find((c) => c.isLocal === true);
  const isChannelMuted = useMemo(() => {
    const rules = mutes.data?.mutedChannels ?? [];
    return (idx: number) => active(rules.find((r) => r.channelId === idx));
  }, [mutes.data]);
  const isDMMuted = useMemo(() => {
    const rules = mutes.data?.mutedDMs ?? [];
    return (key: string) => active(rules.find((r) => r.nodeUuid === key));
  }, [mutes.data]);

  const unread = useMeshCoreUnread({
    baseUrl: appBasename,
    sourceId,
    messages: NO_MESSAGES,
    contacts: contactList,
    selfKey: self?.publicKey,
    enabled: canMessages,
    isChannelMuted,
    isDMMuted,
  });

  // Last-read markers live in localStorage and the read-state cache: re-read when one moves.
  const [readTick, setReadTick] = useState(0);
  useEffect(() => subscribeUnreadChanged(() => setReadTick((n) => n + 1)), []);
  const unreadChannels = useMemo(() => {
    void readTick;
    const lastRead = loadChannelLastRead(sourceId);
    return new Set(
      Object.entries(unread.channelLatest)
        .filter(([idx, ts]) => !isChannelMuted(Number(idx)) && ts > (lastRead[Number(idx)] ?? 0))
        .map(([idx]) => Number(idx)),
    );
  }, [readTick, sourceId, unread.channelLatest, isChannelMuted]);
  // A DM thread is unread when its newest message is past its marker (dm-peers' time).
  const unreadDms = useMemo(() => {
    void readTick;
    const lastRead = loadDmLastRead(sourceId);
    return new Set(
      (dmPeers.data ?? []).filter((p) => !isDMMuted(p.publicKey) && p.lastMessageAt > (lastRead[p.publicKey] ?? 0)).map((p) => p.publicKey),
    );
  }, [readTick, sourceId, dmPeers.data, isDMMuted]);

  return {
    channels: (channels.data ?? []) as McChannelRow[],
    channelsLoading: channels.isPending,
    contacts: contactList,
    self,
    rooms: contactList.filter((c) => c.advType === 3),
    dmPeers: dmPeers.data ?? [],
    savedRooms: roomCreds.data?.stored ?? new Set<string>(),
    unread,
    unreadChannels,
    unreadDms,
    isChannelMuted,
    isDMMuted,
    canMessages,
  };
}
