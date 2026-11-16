/** Web Push in jsdom for the Task 5.8 tests: granted, with one endpoint this browser holds. */
import { vi, onTestFinished } from 'vitest';

export const ENDPOINT = 'https://push.example/abc';

/** A browser with push, subscribed (endpoint held) and permission granted. */
export function stubPush() {
  const subscription = { endpoint: ENDPOINT, getKey: () => new Uint8Array([1, 2, 3]).buffer, unsubscribe: vi.fn(async () => true) };
  const pushManager = { getSubscription: vi.fn(async () => subscription), subscribe: vi.fn(async () => subscription) };
  const prevNotification = (window as { Notification?: unknown }).Notification;
  const prevPush = (window as { PushManager?: unknown }).PushManager;
  Object.assign(window, { Notification: { permission: 'granted', requestPermission: vi.fn(async () => 'granted') }, PushManager: function PushManager() {} });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  onTestFinished(() => {
    Object.assign(window, { Notification: prevNotification, PushManager: prevPush });
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });
}
