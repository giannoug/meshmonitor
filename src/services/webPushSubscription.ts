/**
 * Web Push for this browser, per source (#5493): the requests and the
 * endpoint rules shared by NotificationsTab and the Workspace pages (Task 5.8,
 * Rule X; moved from NotificationsTab).
 *
 * One push endpoint per browser, shared by every source; the server keeps one
 * row per source for it. So:
 *   - subscribing never re-creates the endpoint (pushManager.subscribe hands
 *     back the existing one) and only adds this source's row;
 *   - unsubscribing one source drops its row first and lets the browser
 *     endpoint go only when no source still uses it.
 */
import api from './api.js';
import { logger } from '../utils/logger.js';

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/** The browser offers notifications, service workers and push. */
export const pushSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

/** This browser's push endpoint, or null. */
export async function browserPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export interface SourcePushStatus {
  /** This source holds a row for the browser's endpoint. */
  subscribed: boolean;
  /** How many other sources use the endpoint. */
  otherSources: number;
}

/**
 * Whether `sourceId` holds a row for this browser's endpoint. When the server
 * cannot say, the browser's own endpoint is all we have: subscribed, with no
 * other sources (today's fallback).
 */
export async function sourcePushStatus(endpoint: string, sourceId: string): Promise<SourcePushStatus> {
  try {
    const status = await api.post<{ subscribed?: boolean; otherSources?: number }>('/api/push/subscription-status', {
      endpoint,
      sourceId,
    });
    return { subscribed: !!status.subscribed, otherSources: Number(status.otherSources) || 0 };
  } catch (error) {
    logger.warn('Failed to check per-source subscription status, using browser state:', error);
    return { subscribed: true, otherSources: 0 };
  }
}

export type SubscribeStep = 'vapid' | 'vapid_received' | 'subscribing' | 'saving';

/**
 * Subscribes this browser for `sourceId` (permission must already be granted).
 * `onStep` reports each step, for today's debug line.
 */
export async function subscribeSource(
  sourceId: string | undefined,
  onStep?: (step: SubscribeStep, detail?: { hasKey: boolean }) => void,
): Promise<PushSubscription> {
  onStep?.('vapid');
  logger.info('Fetching VAPID public key...');
  const response = await api.get<{ publicKey: string }>('/api/push/vapid-key');
  logger.info('VAPID key response:', response);
  onStep?.('vapid_received', { hasKey: !!response.publicKey });

  const publicKey = response.publicKey;
  if (!publicKey) {
    throw new Error('VAPID public key not available');
  }

  onStep?.('subscribing');
  logger.info('Subscribing to push notifications...');
  logger.info('VAPID public key (first 20 chars):', publicKey.substring(0, 20));
  logger.info('Converted key length:', urlBase64ToUint8Array(publicKey).length);

  const registration = await navigator.serviceWorker.ready;
  logger.info('Service worker ready, attempting subscription...');

  // One endpoint per browser, shared by every source: if this browser is
  // already subscribed on another source, subscribe() hands back that same
  // subscription, and we only add a row for this source (#5493). Never
  // unsubscribe and re-create here; that would kill the other sources.
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  logger.info('Push subscription created:', subscription);
  onStep?.('saving');

  await api.post('/api/push/subscribe', {
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      },
    },
    sourceId: sourceId ?? undefined,
  });
  return subscription;
}

/**
 * Drops `sourceId`'s row for this browser (server first); the browser endpoint
 * goes only once no source still uses it. Returns how many sources still use
 * it, or null when the browser had no endpoint.
 */
export async function unsubscribeSource(sourceId: string): Promise<{ remaining: number } | null> {
  const subscription = await browserPushSubscription();
  if (!subscription) return null;
  const result = await api.post<{ remainingSources?: number }>('/api/push/unsubscribe', {
    endpoint: subscription.endpoint,
    sourceId,
  });
  const remaining = Number(result?.remainingSources) || 0;
  if (remaining === 0) {
    await subscription.unsubscribe();
  }
  return { remaining };
}

/** Drops this browser's rows on every source and the endpoint itself. */
export async function unsubscribeAllSources(): Promise<void> {
  const subscription = await browserPushSubscription();
  if (subscription) {
    await api.post('/api/push/unsubscribe-all', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}
