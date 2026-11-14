/**
 * Tests for useMeshtasticMessageActions — App's message send/resend/tapback/
 * delete/purge handlers moved into a hook (#6365 Task 2.2). Each test pins
 * the endpoint, method and body App sent before the move.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MeshMessage } from '../types/message';

const mockUseSource = vi.fn();
const mockUseData = vi.fn();
const mockUseMessaging = vi.fn();
const mockUseUI = vi.fn();
const mockUseToast = vi.fn();
const mockUseChannels = vi.fn();

vi.mock('../contexts/SourceContext', () => ({ useSource: () => mockUseSource() }));
vi.mock('../contexts/DataContext', () => ({ useData: () => mockUseData() }));
vi.mock('../contexts/MessagingContext', () => ({ useMessaging: () => mockUseMessaging() }));
vi.mock('../contexts/UIContext', () => ({ useUI: () => mockUseUI() }));
vi.mock('../components/ToastContainer', () => ({ useToast: () => mockUseToast() }));
vi.mock('./useServerData', () => ({ useChannels: () => mockUseChannels() }));

import { useMeshtasticMessageActions, type MeshtasticMessageActionsOptions } from './useMeshtasticMessageActions';

const BASE = 'http://localhost:3001';

function ok(json: unknown = {}) {
  return { ok: true, status: 200, json: async () => json };
}

function makeOptions(overrides: Partial<MeshtasticMessageActionsOptions> = {}): MeshtasticMessageActionsOptions {
  return {
    baseUrl: BASE,
    authFetch: vi.fn().mockResolvedValue(ok()),
    refetchPoll: vi.fn(),
    setMessages: vi.fn(),
    setChannelMessages: vi.fn(),
    pendingMessagesRef: { current: new Map() },
    channelMessagesContainerRef: { current: null },
    dmMessagesContainerRef: { current: null },
    localNodeIdRef: { current: '!0000abcd' },
    homoglyphEnabledRef: { current: false },
    ...overrides,
  };
}

function lastBody(authFetch: ReturnType<typeof vi.fn>) {
  const [, init] = authFetch.mock.calls[authFetch.mock.calls.length - 1];
  return JSON.parse(init.body as string);
}

function msg(overrides: Partial<MeshMessage> = {}): MeshMessage {
  return {
    id: 'src-1_43981_777',
    from: '!0000abcd',
    to: '!ffffffff',
    fromNodeId: '!0000abcd',
    toNodeId: '!ffffffff',
    text: 'hello',
    channel: 2,
    timestamp: new Date(),
    ...overrides,
  } as MeshMessage;
}

describe('useMeshtasticMessageActions', () => {
  let setNewMessage: ReturnType<typeof vi.fn>;
  let setReplyingTo: ReturnType<typeof vi.fn>;
  let setError: ReturnType<typeof vi.fn>;
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setNewMessage = vi.fn();
    setReplyingTo = vi.fn();
    setError = vi.fn();
    showToast = vi.fn();
    mockUseSource.mockReturnValue({ sourceId: 'src-1', sourceName: 'Test', sourceType: 'meshtastic_tcp' });
    mockUseData.mockReturnValue({ connectionStatus: 'connected', currentNodeId: '!0000abcd' });
    mockUseMessaging.mockReturnValue({
      setNewMessage,
      setReplyingTo,
      setPendingMessages: vi.fn(),
      setIsChannelScrolledToBottom: vi.fn(),
      setIsDMScrolledToBottom: vi.fn(),
    });
    mockUseUI.mockReturnValue({ setError });
    mockUseToast.mockReturnValue({ showToast });
    mockUseChannels.mockReturnValue({ channels: [{ id: 2, name: 'gauntlet' }] });
  });

  it('sendChannelMessage POSTs /api/messages/send with text, channel, replyId and sourceId', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendChannelMessage(2, 'hi there', 777);
    });
    expect(opts.authFetch).toHaveBeenCalledWith(`${BASE}/api/messages/send`, expect.objectContaining({ method: 'POST' }));
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({ text: 'hi there', channel: 2, replyId: 777, sourceId: 'src-1' });
    expect(opts.setMessages).toHaveBeenCalled();
    expect(opts.setChannelMessages).toHaveBeenCalled();
    expect(setNewMessage).toHaveBeenCalledWith('');
    expect(setReplyingTo).toHaveBeenCalledWith(null);
  });

  it('sendChannelMessage does nothing for blank text or when not connected', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendChannelMessage(0, '   ');
    });
    mockUseData.mockReturnValue({ connectionStatus: 'disconnected', currentNodeId: '!0000abcd' });
    const { result: r2 } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await r2.current.sendChannelMessage(0, 'x');
    });
    expect(opts.authFetch).not.toHaveBeenCalled();
  });

  it('sendDirectMessage POSTs channel 0 with the destination', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendDirectMessage('!12345678', 'dm text');
    });
    expect(opts.authFetch).toHaveBeenCalledWith(`${BASE}/api/messages/send`, expect.objectContaining({ method: 'POST' }));
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({
      text: 'dm text',
      channel: 0,
      destination: '!12345678',
      sourceId: 'src-1',
    });
  });

  it('sendTapback on a channel message sends emoji flag, channel and replyId', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendTapback(msg(), '+1');
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({
      text: '+1',
      channel: 2,
      replyId: 777,
      emoji: 1,
      sourceId: 'src-1',
    });
  });

  it('sendTapback on a DM I sent goes to the original recipient', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendTapback(msg({ channel: -1, toNodeId: '!12345678' }), '+1');
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({
      text: '+1',
      destination: '!12345678',
      replyId: 777,
      emoji: 1,
      sourceId: 'src-1',
    });
  });

  it('resend of a channel message POSTs text and channel', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.resend(msg());
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({ text: 'hello', channel: 2, sourceId: 'src-1' });
  });

  it('resend of a DM POSTs text and destination', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.resend(msg({ channel: -1, to: '!12345678', toNodeId: '!12345678' }));
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({
      text: 'hello',
      destination: '!12345678',
      sourceId: 'src-1',
    });
  });

  it('deleteMessage DELETEs /api/messages/:id with no body and toasts', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.deleteMessage('src-1_43981_777');
    });
    expect(opts.authFetch).toHaveBeenCalledWith(`${BASE}/api/messages/src-1_43981_777`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(showToast).toHaveBeenCalledWith('toast.message_deleted', 'success');
  });

  it('deleteMessage without a channel removes the message from every channel list', async () => {
    const setChannelMessages = vi.fn();
    const opts = makeOptions({ setChannelMessages });
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.deleteMessage('a');
    });
    const update = setChannelMessages.mock.calls[0][0] as (p: Record<number, MeshMessage[]>) => Record<number, MeshMessage[]>;
    const next = update({ 0: [msg({ id: 'a' }), msg({ id: 'b' })], 2: [msg({ id: 'a' })] });
    expect(next[0].map(m => m.id)).toEqual(['b']);
    expect(next[2]).toEqual([]);
  });

  it('purgeChannelMessages DELETEs /api/messages/channels/:id with the sourceId body', async () => {
    const opts = makeOptions({ authFetch: vi.fn().mockResolvedValue(ok({ deletedCount: 3 })) });
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.purgeChannelMessages(2);
    });
    expect(opts.authFetch).toHaveBeenCalledWith(`${BASE}/api/messages/channels/2`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'src-1' }),
    });
    expect(showToast).toHaveBeenCalledWith('toast.purged_messages_channel', 'success');
  });

  it('sendBell on a channel prepends the bell to the text', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendBell({ channel: 2, text: 'wake' });
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({ text: '\x07wake', channel: 2, sourceId: 'src-1' });
  });

  it('sendBell to a node sends a DM bell on channel 0', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendBell({ nodeId: '!12345678' });
    });
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({
      text: '\x07',
      channel: 0,
      destination: '!12345678',
      sourceId: 'src-1',
    });
  });

  it('sendPosition broadcasts a position request on the channel', async () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendPosition(1);
    });
    expect(opts.authFetch).toHaveBeenCalledWith(`${BASE}/api/position/request`, expect.objectContaining({ method: 'POST' }));
    expect(lastBody(opts.authFetch as ReturnType<typeof vi.fn>)).toEqual({ destination: 4294967295, channel: 1, sourceId: 'src-1' });
  });

  it('a tx-disabled refusal toasts the warning instead of setting an error', async () => {
    const opts = makeOptions({
      authFetch: vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: 'TX_DISABLED' }) }),
    });
    const { result } = renderHook(() => useMeshtasticMessageActions(opts));
    await act(async () => {
      await result.current.sendPosition(1);
    });
    expect(showToast).toHaveBeenCalledWith('tx_disabled.send_blocked_toast', 'warning');
    expect(setError).not.toHaveBeenCalled();
  });
});
