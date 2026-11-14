/**
 * @vitest-environment jsdom
 *
 * markMessagesAsRead must name the active source. Without it the server falls
 * back to the primary source, so "Mark all as read" on a non-primary device
 * marked the primary's DMs instead.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagingProvider, useMessaging } from './MessagingContext';
import { SourceProvider } from './SourceContext';

vi.mock('./AuthContext', () => ({ useAuth: () => ({ authStatus: { authenticated: false } }) }));
vi.mock('./UIContext', () => ({ useUI: () => ({ showMqttMessages: true, activeTab: 'messages' }) }));
vi.mock('./CsrfContext', () => ({ useCsrf: () => ({ getToken: () => null }) }));
vi.mock('../hooks/useFirstUnread', () => ({ useFirstUnread: () => ({ data: undefined }) }));

async function markAllDms(sourceId: string | null) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ marked: 0 }) });
  vi.stubGlobal('fetch', fetchMock);
  let messaging: ReturnType<typeof useMessaging> | null = null;
  const Consumer = () => {
    messaging = useMessaging();
    return null;
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SourceProvider sourceId={sourceId}>
        <MessagingProvider>
          <Consumer />
        </MessagingProvider>
      </SourceProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    await messaging!.markMessagesAsRead(undefined, undefined, undefined, true);
  });
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/messages/mark-read'));
  expect(call).toBeDefined();
  return JSON.parse(call![1].body);
}

describe('markMessagesAsRead source scoping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the active sourceId inside a SourceProvider', async () => {
    expect(await markAllDms('src-b')).toEqual({ allDMs: true, sourceId: 'src-b' });
  });

  it('omits sourceId outside a source (legacy single-source view)', async () => {
    expect(await markAllDms(null)).toEqual({ allDMs: true });
  });
});
