/**
 * @vitest-environment jsdom
 *
 * Board s2-notifications (phone), Task 5.8: You › Notifications, push per
 * device for this browser. Each device's switch subscribes or unsubscribes
 * this browser for that device (today's per-source rows) and names what it
 * pushes; what each device sends stays in its own settings.
 */
import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import { defaultNotificationPreferences } from '../../../utils/notificationDefaults';
import WorkspaceShell from '../../shell/WorkspaceShell';
import NotificationsPage from '../NotificationsPage';

const ENDPOINT = 'https://push.example/abc';

/** A browser with push, subscribed (endpoint held) and permission granted. */
function stubPush() {
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

function renderPage(opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <NotificationsPage />
      </WorkspaceShell>
    </ToastProvider>,
    {
      route: '/you/notifications',
      phone: true,
      ...opts,
      fixtures: {
        // Station G2 pushes here; the others do not.
        'POST /api/push/subscription-status': (_url, init) => ({ subscribed: JSON.parse(String(init?.body)).sourceId === SOURCE_IDS.g2, otherSources: 0 }),
        'GET /api/push/preferences': () => ({ ...defaultNotificationPreferences(), notifyOnMention: true, notifyOnReply: true }),
        'POST /api/push/preferences': () => ({ success: true }),
        'GET /api/push/vapid-key': () => ({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' }),
        'POST /api/push/subscribe': () => ({ success: true }),
        'POST /api/push/unsubscribe': () => ({ success: true, remainingSources: 1 }),
        ...opts.fixtures,
      },
    },
  );
}

const writes = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([u, init]) => init?.method === 'POST' && !String(u).includes('subscription-status'))
    .map(([u, init]) => `${new URL(String(u), 'http://x').pathname} ${String(init?.body)}`);

describe('s2-notifications', () => {
  it('s2-notifications shows the board', async () => {
    stubPush();
    const { container } = renderPage();
    await screen.findByText('DMs, mentions, replies');
    expectBoard('s2-notifications', container);
  });

  it('a device this browser is not subscribed to reads Off, receive-only for an MQTT feed', async () => {
    stubPush();
    renderPage();
    await screen.findByText('DMs, mentions, replies');
    expect(screen.getByRole('switch', { name: 'Station G2' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Rooftop RAK' })).not.toBeChecked();
    expect(screen.getByText('Off · receive-only')).toBeInTheDocument();
  });

  it('turning a device on subscribes this browser for it and turns its Web Push on; off unsubscribes it', async () => {
    stubPush();
    renderPage();
    await screen.findByText('DMs, mentions, replies');
    fireEvent.click(screen.getByRole('switch', { name: 'Rooftop RAK' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        expect.stringMatching(new RegExp(`^/api/push/subscribe .*"sourceId":"${SOURCE_IDS.rak}"`)),
        `/api/push/preferences {"enableWebPush":true,"sourceId":"${SOURCE_IDS.rak}"}`,
      ]),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Station G2' }));
    await waitFor(() => expect(writes()).toContain(`/api/push/unsubscribe {"endpoint":"${ENDPOINT}","sourceId":"${SOURCE_IDS.g2}"}`));
  });

  it('links to the open device\'s own Notifications', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: /What each device sends/ })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/settings/notifications`);
  });

  it('without push in this browser every switch is off and disabled', async () => {
    renderPage();
    const g2 = await screen.findByRole('switch', { name: 'Station G2' });
    expect(g2).toBeDisabled();
    expect(g2).not.toBeChecked();
  });
});
