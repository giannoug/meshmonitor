/**
 * @vitest-environment jsdom
 *
 * Board b-set-d5-notifications (desktop), Task 5.8: Station G2's
 * Notifications, saving as you make them through today's notification
 * preferences. Delivery (Web Push on this browser, Apprise with its URLs,
 * audio), Notify me about, and Advanced. Replies and Mentions (cs2, D13) show
 * for a Meshtastic radio (today Mentions is MeshCore only) and start off.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, mqtt, renderSettings } from './renderSettings';
import { meshmonitorFixtures } from './meshmonitorFixtures';
import { stubPush } from '../../test/pushStub';
import { defaultNotificationPreferences } from '../../../utils/notificationDefaults';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const prefPosts = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([u, init]) => init?.method === 'POST' && String(u).includes('/api/push/preferences'))
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);

describe('b-set-d5-notifications', () => {
  it('b-set-d5-notifications shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('switch', { name: 'Emoji Reactions' }, T));
    await screen.findByText('Saved', {}, T);
    expectBoard('b-set-d5-notifications', container);
  });

  it('a preference saves on change, only the field it changes, for this source', async () => {
    renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('switch', { name: 'Newly Found Nodes' }, T));
    await waitFor(() => expect(prefPosts()).toEqual([{ notifyOnNewNode: true, sourceId: SOURCE_IDS.g2 }]));
  });

  it('Replies and Mentions show for a Meshtastic radio and start off', async () => {
    renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    expect(await screen.findByRole('switch', { name: 'Replies' }, T)).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Mentions' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Mentions' }));
    await waitFor(() => expect(prefPosts()).toEqual([{ notifyOnMention: true, sourceId: SOURCE_IDS.g2 }]));
  });

  it('an MQTT source has no node of its own: no Replies or Mentions', async () => {
    renderSettings(`${mqtt}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    await screen.findByRole('switch', { name: 'Direct Messages' }, T);
    expect(screen.queryByRole('switch', { name: 'Replies' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Mentions' })).toBeNull();
  });

  it('Channels opens a sheet whose ticks each save the channel list', async () => {
    renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: /LongFast, Local/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Channels' });
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'gauntlet' }));
    await waitFor(() => expect(prefPosts()).toEqual([{ enabledChannels: [0, 2, 1], sourceId: SOURCE_IDS.g2 }]));
  });

  it('Apprise URLs keep an inline Save in their sheet', async () => {
    renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: /2 URLs/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Apprise Configuration' });
    const box = within(sheet).getByLabelText('Notification Service URLs');
    fireEvent.change(box, { target: { value: 'discord://a/b\n\n tgram://x/y ' } });
    fireEvent.blur(box);
    await act(async () => {});
    expect(prefPosts()).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(prefPosts()).toEqual([{ appriseUrls: ['discord://a/b', 'tgram://x/y'], sourceId: SOURCE_IDS.g2 }]));
  });

  it('a keyword list saves on blur, cleaned as today', async () => {
    renderSettings(`${g2}/settings/notifications`, { fixtures: meshmonitorFixtures() });
    const advanced = await screen.findByRole('button', { name: /^Advanced · message format/ }, T);
    if (advanced.getAttribute('aria-expanded') !== 'true') fireEvent.click(advanced);
    const box = await screen.findByLabelText('Whitelist (Always Notify)', {}, T);
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: ' storm \n<b>\n' } });
    await act(async () => {});
    expect(prefPosts()).toEqual([]);
    fireEvent.blur(box);
    await waitFor(() => expect(prefPosts()).toEqual([{ whitelist: ['storm', '&lt;b&gt;'], sourceId: SOURCE_IDS.g2 }]));
  });

  it('Web Push on this browser: a failed Web Push service write shows on the row, not Saved', async () => {
    stubPush();
    renderSettings(`${g2}/settings/notifications`, {
      fixtures: meshmonitorFixtures({
        'POST /api/push/subscription-status': () => ({ subscribed: false, otherSources: 0 }),
        'GET /api/push/vapid-key': () => ({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' }),
        'POST /api/push/subscribe': () => ({ success: true }),
        'GET /api/push/preferences': () => ({ ...defaultNotificationPreferences(), enableWebPush: false }),
        'POST /api/push/preferences': () => new Response(JSON.stringify({ error: 'no' }), { status: 500 }),
      }),
    });
    const row = await screen.findByRole('switch', { name: 'Web Push on this browser' }, T);
    await waitFor(() => expect(row).toBeEnabled());
    fireEvent.click(row);
    expect(await screen.findByText('Failed to save notification preferences', {}, T)).toBeInTheDocument();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('on phone, the Apprise sheet\'s buttons are 44 px targets (the sheet says phone itself)', async () => {
    renderSettings(`${g2}/settings/notifications`, { phone: true, fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: /2 URLs/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Apprise Configuration' });
    expect(within(sheet).getByRole('button', { name: 'Save' }).closest('[data-phone]')).not.toBeNull();
    expect(within(sheet).getByLabelText('Notification Service URLs').closest('[data-phone]')).not.toBeNull();
  });
});
