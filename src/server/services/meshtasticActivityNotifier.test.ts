/**
 * Replies and Meshtastic mentions push (#6365 Task 2.9, D13).
 *
 * Real DB (route test harness singleton), real permission rows, real
 * preference rows and the real Web Push delivery wrapper; only the push send
 * itself and the source registry are stubbed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRouteTestApp, type RouteTestHarness, type SeededUser } from '../test-helpers/routeTestApp.js';
import { PortNum } from '../constants/meshtastic.js';
import { defaultNotificationPreferences } from '../../utils/notificationDefaults.js';
import { pushNotificationService } from './pushNotificationService.js';
import { notificationService } from './notificationService.js';
import { notificationDedup } from './notificationDedup.js';
import { notifyMeshtasticActivity } from './meshtasticActivityNotifier.js';
import { sendMessagePushNotification } from './messagePushNotifier.js';

const OWN = 0x80000001;
const OWN_ID = '!80000001';
const ALICE = 0xf0000001;
const P_CH0 = 0xdeadbeef;
const P_CH1 = 0xdeadbef0;
const P_DM = 0xdeadbef1;
const P_OTHER = 0xdeadbef2;

vi.mock('../sourceManagerRegistry.js', () => {
  const manager = { sourceType: 'meshtastic_tcp', getLocalNodeInfo: () => ({ nodeNum: 0x80000001 }) };
  return {
    sourceManagerRegistry: {
      getManager: vi.fn((id: string) => (id === 'rt-source-a' ? manager : null)),
      getAllManagers: vi.fn(() => [manager]),
    },
  };
});

const hex = (n: number) => `!${n.toString(16).padStart(8, '0')}`;

describe('notifyMeshtasticActivity', () => {
  let harness: RouteTestHarness;
  let send: ReturnType<typeof vi.spyOn>;
  let packet = 1;

  const insert = (from: number, id: number, over: Record<string, unknown>) =>
    harness.db.messages.insertMessage({
      id: `${harness.sourceA}_${from}_${id}`,
      fromNodeNum: from,
      toNodeNum: 0xffffffff,
      fromNodeId: hex(from),
      toNodeId: '!ffffffff',
      text: 'own',
      channel: 0,
      portnum: PortNum.TEXT_MESSAGE_APP,
      timestamp: Date.now(),
      createdAt: Date.now(),
      ...over,
    } as never, harness.sourceA);

  const prefs = (user: SeededUser, over: Record<string, unknown>) =>
    harness.db.notifications.saveUserPreferences(user.id, { ...defaultNotificationPreferences(), ...over }, harness.sourceA);

  const subscribe = (user: SeededUser) =>
    harness.db.notificationsRepo!.saveSubscription({
      userId: user.id,
      sourceId: harness.sourceA,
      endpoint: `https://push.example.invalid/${user.username}`,
      p256dhKey: 'p',
      authKey: 'a',
    });

  /** An incoming message from Alice (a fresh packet id each call). */
  const incoming = (over: Partial<Parameters<typeof notifyMeshtasticActivity>[0]['message']> = {}) => {
    const id = packet++;
    return {
      id: `${harness.sourceA}_${ALICE}_${id}`,
      fromNodeNum: ALICE,
      toNodeNum: 0xffffffff,
      channel: 0,
      text: 'hello',
      portnum: PortNum.TEXT_MESSAGE_APP,
      ...over,
    };
  };

  const notify = (message: Parameters<typeof notifyMeshtasticActivity>[0]['message']) =>
    notifyMeshtasticActivity({ sourceId: harness.sourceA, message });

  const pushedTo = () => send.mock.calls.map((c) => (c[0] as { userId: number }).userId);
  const titles = () => send.mock.calls.map((c) => (c[1] as { title: string }).title);

  beforeEach(async () => {
    harness = await createRouteTestApp({ mount: () => {} });
    notificationDedup.clear();
    send = vi.spyOn(pushNotificationService, 'sendToSubscription').mockResolvedValue(true);
    await harness.db.nodes.upsertNode({ nodeNum: ALICE, nodeId: hex(ALICE), longName: 'Alice' }, harness.sourceA);
    await insert(OWN, P_CH0, { text: 'own ch0' });
    await insert(OWN, P_CH1, { text: 'own ch1', channel: 1 });
    await insert(OWN, P_DM, { text: 'own dm', channel: -1, toNodeNum: ALICE, toNodeId: hex(ALICE) });
    await insert(ALICE, P_OTHER, { text: 'not ours' });
    // limited reads channel 0 and DMs, not channel 1.
    await harness.grant(harness.limited.id, 'messages', 'read', harness.sourceA);
    await harness.grant(harness.limited.id, 'channel_0', 'read', harness.sourceA);
    await subscribe(harness.limited);
    await subscribe(harness.admin);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // The DB lives for the whole file; drop this test's subscriptions.
    for (const user of [harness.limited, harness.admin]) {
      await harness.db.notificationsRepo!.removeSubscription(`https://push.example.invalid/${user.username}`);
    }
    await harness.cleanup();
  });

  it('a reply to our message pushes once to a user with notifyOnReply on, not to one with it off', async () => {
    await prefs(harness.limited, { notifyOnReply: true });
    await prefs(harness.admin, { notifyOnReply: false });
    await notify(incoming({ replyId: P_CH0, text: 'yes!' }));
    expect(pushedTo()).toEqual([harness.limited.id]);
  });

  it('a user who cannot read the channel gets nothing', async () => {
    await prefs(harness.limited, { notifyOnReply: true });
    await prefs(harness.admin, { notifyOnReply: true });
    await notify(incoming({ replyId: P_CH1, channel: 1, text: 'on ch1' }));
    expect(pushedTo()).toEqual([harness.admin.id]);
  });

  it('a DM reply reaches a user with messages:read', async () => {
    await prefs(harness.limited, { notifyOnReply: true });
    await notify(incoming({ replyId: P_DM, channel: -1, toNodeNum: OWN, text: 'dm back' }));
    expect(pushedTo()).toEqual([harness.limited.id]);
  });

  it('our own message never pushes', async () => {
    await prefs(harness.limited, { notifyOnReply: true, notifyOnMention: true });
    await notify({ ...incoming({ replyId: P_CH0, text: `me @${OWN_ID}` }), id: `${harness.sourceA}_${OWN}_99`, fromNodeNum: OWN });
    expect(send).not.toHaveBeenCalled();
  });

  it('a reply that also mentions us sends exactly one push, the reply', async () => {
    await prefs(harness.limited, { notifyOnReply: true, notifyOnMention: true });
    await notify(incoming({ replyId: P_CH0, text: `sure @${OWN_ID}` }));
    expect(pushedTo()).toEqual([harness.limited.id]);
    expect(titles()[0]).toMatch(/^Reply/);
  });

  it('a mention pushes to notifyOnMention users only', async () => {
    await prefs(harness.limited, { notifyOnMention: true });
    await prefs(harness.admin, { notifyOnReply: true });
    await notify(incoming({ text: `ping @${OWN_ID.toUpperCase()} there` }));
    expect(pushedTo()).toEqual([harness.limited.id]);
    expect(titles()[0]).toMatch(/^Mention/);
  });

  it('a tapback on our message is neither a reply nor a mention', async () => {
    await prefs(harness.limited, { notifyOnReply: true, notifyOnMention: true });
    await notify(incoming({ replyId: P_CH0, emoji: 1, text: '👍' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('a reply to someone else\'s message does not push', async () => {
    await prefs(harness.limited, { notifyOnReply: true });
    await notify(incoming({ replyId: P_OTHER, text: 'to alice' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('a muted channel gets nothing', async () => {
    await prefs(harness.limited, { notifyOnReply: true, mutedChannels: [{ channelId: 0, muteUntil: null }] });
    await notify(incoming({ replyId: P_CH0, text: 'muted' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('through the message notifier, a DM reply is one notification, not a reply plus a DM push', async () => {
    vi.spyOn(notificationService, 'getServiceStatus').mockReturnValue({ webPush: true, apprise: false, desktop: false, anyAvailable: true } as never);
    vi.spyOn(pushNotificationService, 'isAvailable').mockReturnValue(true);
    await prefs(harness.limited, { notifyOnReply: true, enableDirectMessages: true });
    const msg = incoming({ replyId: P_DM, channel: -1, toNodeNum: OWN, text: 'dm reply' });
    await sendMessagePushNotification({
      message: { ...msg, fromNodeId: hex(ALICE), packetId: Number(msg.id.split('_').pop()) },
      messageText: msg.text,
      isDirectMessage: true,
      sourceId: harness.sourceA,
      localNodeNum: OWN,
    });
    // limited: the reply push only. admin (no reply opt-in): the usual DM push.
    const forLimited = send.mock.calls.filter((c) => (c[0] as { userId: number }).userId === harness.limited.id);
    expect(forLimited.map((c) => (c[1] as { title: string }).title)).toEqual([expect.stringMatching(/^Reply/)]);
    expect(pushedTo().filter((id) => id === harness.admin.id)).toHaveLength(1);
  });
});
