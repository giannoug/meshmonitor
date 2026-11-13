/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserPreferences } from '../../prefs/useUserPreferences';

const prevFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = prevFetch;
});

function setup(stored: Record<string, unknown>, putStatus: number) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/config')) return json({ baseUrl: '' });
    if (init?.method === 'PUT') return json(putStatus === 200 ? { success: true } : { error: 'nope' }, putStatus);
    return json({ success: true, data: { preferences: stored } });
  }) as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUserPreferences(), { wrapper });
}

describe('useUserPreferences', () => {
  it('refetches after a successful write, so the cache holds the full map', async () => {
    const stored: Record<string, unknown> = { theme: 'latte' };
    const { result } = setup(stored, 200);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    stored.layout = 'workspace';
    await act(() => result.current.setPref('layout', 'workspace'));
    await waitFor(() => expect(result.current.prefs).toEqual({ theme: 'latte', layout: 'workspace' }));
  });

  it('rolls back and rethrows when the write fails', async () => {
    const { result } = setup({ layout: 'classic' }, 403);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await expect(result.current.setPref('layout', 'workspace')).rejects.toThrow();
    });
    expect(result.current.prefs).toEqual({ layout: 'classic' });
  });
});
