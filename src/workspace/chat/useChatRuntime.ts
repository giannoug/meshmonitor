/**
 * App's poll processing for a Workspace conversation screen (channel thread or
 * DM, Ruling AD): the poll while the device is connected, the local node,
 * `applyPollMessages`, and the message hook App wires for itself.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useData } from '../../contexts/DataContext';
import { useSource } from '../../contexts/SourceContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useMeshtasticMessageActions } from '../../hooks/useMeshtasticMessageActions';
import { useMessagingView } from '../../hooks/useMessagingView';
import { usePoll } from '../../hooks/usePoll';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { useShellDevices } from '../shell/shellDevices';

/** `selectedChannel` is the open channel, or -1 on a DM (App's selectedChannelRef). */
export function useChatRuntime(selectedChannel: number) {
  const { sourceId } = useSource();
  const { sources } = useShellDevices();
  const linkUp = sources.find((s) => s.id === sourceId)?.status === 'connected';
  const { connectionStatus, setConnectionStatus, setCurrentNodeId, setDeviceInfo, setDeviceConfig } = useData();
  const csrfFetch = useCsrfFetch();

  // App's connection state machine is not here; the shell's per-source status stands in for it.
  useEffect(() => setConnectionStatus(linkUp ? 'connected' : 'disconnected'), [linkUp, setConnectionStatus]);
  const { data: pollData, refetch: refetchPoll } = usePoll({ enabled: connectionStatus === 'connected' });

  const view = useMessagingView();
  const { applyPollMessages } = view;
  const localNodeIdRef = useRef('');
  const selectedChannelRef = useRef(selectedChannel);
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  useEffect(() => {
    if (!pollData) return;
    const localNodeId =
      (pollData.deviceConfig?.basic?.nodeId as string | undefined) ||
      pollData.config?.localNodeInfo?.nodeId ||
      localNodeIdRef.current;
    if (localNodeId) {
      localNodeIdRef.current = localNodeId;
      setCurrentNodeId(localNodeId);
    }
    if (pollData.messages) applyPollMessages(pollData, localNodeId, selectedChannelRef.current);
    if (pollData.config) setDeviceInfo(pollData.config);
    if (pollData.deviceConfig) setDeviceConfig(pollData.deviceConfig);
  }, [pollData, applyPollMessages, setCurrentNodeId, setDeviceInfo, setDeviceConfig]);

  // The homoglyph setting, read at send time (App keeps it in a ref too). Same query as useTranslationSettings.
  const { data: homoglyph = false } = useQuery({
    queryKey: ['settings', 'translation'],
    queryFn: () => apiService.get<Record<string, string>>('/api/settings'),
    staleTime: 60_000,
    select: (s: Record<string, string>) => s.homoglyphEnabled === 'true',
  });
  const homoglyphEnabledRef = useRef(false);
  useEffect(() => {
    homoglyphEnabledRef.current = homoglyph;
  }, [homoglyph]);

  // shortcut: csrfFetch has no CSRF-refresh retry or 10 s timeout like App's authFetch (Ruling AG); share one if a stale token shows up.
  const authFetch = useCallback((url: string, options?: RequestInit) => csrfFetch(url, options), [csrfFetch]);
  const actions = useMeshtasticMessageActions({
    baseUrl: appBasename,
    authFetch,
    refetchPoll,
    setMessages: view.setMessages,
    setChannelMessages: view.setChannelMessages,
    pendingMessagesRef: view.pendingMessagesRef,
    channelMessagesContainerRef: view.channelMessagesContainerRef,
    dmMessagesContainerRef: view.dmMessagesContainerRef,
    localNodeIdRef,
    homoglyphEnabledRef,
  });

  return { view, actions, homoglyph, deviceConfig: pollData?.deviceConfig, pollData };
}
