/**
 * Web Push on this browser, per source (Task 5.8; today's NotificationsTab
 * flow, #5493): one push endpoint per browser, shared by every source; a
 * source holds a row for it on the server. Subscribing adds this source's row
 * (never re-creates the endpoint); unsubscribing drops it and lets the browser
 * endpoint go only when no source still uses it. Same requests as today.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

async function browserSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const raw = window.atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export interface PushHere {
  /** This browser has a push endpoint at all. */
  browser: boolean;
  /** This source holds a row for it. */
  subscribed: boolean;
  /** How many other sources use this browser's endpoint. */
  otherSources: number;
}

/** Whether this browser gets this source's pushes (today's checkNotificationStatus). */
export async function pushStatusHere(sourceId: string): Promise<PushHere> {
  if (!pushSupported()) return { browser: false, subscribed: false, otherSources: 0 };
  const subscription = await browserSubscription();
  if (!subscription) return { browser: false, subscribed: false, otherSources: 0 };
  const status = await apiService.post<{ subscribed?: boolean; otherSources?: number }>('/api/push/subscription-status', {
    endpoint: subscription.endpoint,
    sourceId,
  });
  return { browser: true, subscribed: !!status.subscribed, otherSources: Number(status.otherSources) || 0 };
}

/** Today's subscribeToNotifications: permission must already be granted. */
export async function subscribeHere(sourceId: string): Promise<void> {
  const { publicKey } = await apiService.get<{ publicKey: string }>('/api/push/vapid-key');
  if (!publicKey) throw new Error('VAPID public key not available');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await apiService.post('/api/push/subscribe', {
    subscription: {
      endpoint: subscription.endpoint,
      keys: { p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!), auth: arrayBufferToBase64(subscription.getKey('auth')!) },
    },
    sourceId,
  });
}

/** Today's unsubscribeFromNotifications for one source. */
export async function unsubscribeHere(sourceId: string): Promise<void> {
  const subscription = await browserSubscription();
  if (!subscription) return;
  const result = await apiService.post<{ remainingSources?: number }>('/api/push/unsubscribe', { endpoint: subscription.endpoint, sourceId });
  if ((Number(result?.remainingSources) || 0) === 0) await subscription.unsubscribe();
}

/** Today's unsubscribeFromAllSources. */
export async function unsubscribeEverywhere(): Promise<void> {
  const subscription = await browserSubscription();
  if (!subscription) return;
  await apiService.post('/api/push/unsubscribe-all', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export const pushHereKey = (sourceId: string) => ['workspace', 'pushHere', sourceId] as const;

/** This browser's push state for `sourceId`, read once (no poll), and a reader after a change. */
export function usePushHere(sourceId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: pushHereKey(sourceId), queryFn: () => pushStatusHere(sourceId), staleTime: Infinity, retry: false });
  return { ...query, reread: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'pushHere'] }) };
}
