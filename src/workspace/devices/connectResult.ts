/**
 * What Save found (Task 6.6): the saved device's status, read once on the
 * key the shell's device poll fills (`useSourceStatuses`), so this adds no
 * timer; and a Meshtastic node's channel list, once it is connected.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardSource, SourceStatus } from '../../hooks/useDashboardData';
import api from '../../services/api';
import type { SourceForm } from './useSourceForm';

/** Today's auto-connect flag for the form's type; null where today's form has none (MQTT broker, bridge). */
export function autoConnectOf(f: SourceForm): { checked: boolean; set(v: boolean): void } | null {
  if (f.formType === 'meshtastic_tcp' || f.formType === 'meshcore') return { checked: f.formAutoConnect, set: f.setFormAutoConnect };
  if (f.formType === 'meshcore_mqtt') return { checked: f.formMcMqttAutoConnect, set: f.setFormMcMqttAutoConnect };
  if (f.formType === 'reticulum') return { checked: f.formRnsAutoConnect, set: f.setFormRnsAutoConnect };
  return null;
}

export type ConnectPhase = 'pending' | 'connected' | 'idle' | 'failed';

/** The saved device's status, read once (shared with the shell's poll), and what it means here. */
export function useConnectResult(saved: DashboardSource, autoConnect: boolean) {
  const { authStatus } = useAuth();
  const isAuthenticated = authStatus?.authenticated ?? false;
  const status = useQuery({
    // useSourceStatuses' key: its poll (the rail's) and today's Connect re-poll fill it too.
    queryKey: ['dashboard', 'status', saved.id, isAuthenticated],
    queryFn: () => api.get<SourceStatus>(`/api/sources/${saved.id}/status`),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const live = status.data;
  const connected = live?.connected === true;
  const phase: ConnectPhase = connected
    ? 'connected'
    : !status.isFetched
      ? 'pending'
      : !autoConnect && !live?.authStopped && !live?.evictionStopped
        ? 'idle'
        : 'failed';
  const channels = useQuery({
    queryKey: ['workspace', 'add-device', 'channels', saved.id],
    queryFn: () => api.get<unknown[]>(`/api/sources/${saved.id}/channels`),
    enabled: connected && saved.type === 'meshtastic_tcp',
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { phase, live, channelCount: Array.isArray(channels.data) ? channels.data.length : null };
}

