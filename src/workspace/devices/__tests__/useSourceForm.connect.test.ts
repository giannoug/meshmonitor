/**
 * @vitest-environment jsdom
 *
 * `connectSourceAndWait` (S20): one connect per source runs one wait loop. The loop takes no caller's
 * signal, so the surface that started it leaving does not end the wait for a surface that joined it;
 * each caller ends only its own wait with its own signal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { connectSourceAndWait } from '../useSourceForm';

vi.mock('../../../services/api', async (orig) => ({ ...(await orig<object>()), default: { post: vi.fn(async () => ({})) } }));

let connected = false;
const queryClient = {
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(async () => {}),
  getQueriesData: vi.fn(() => [[['dashboard', 'status', 's1'], { connected }]]),
} as unknown as QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  connected = false;
  vi.mocked(api.post).mockClear();
});
afterEach(() => vi.useRealTimers());

const settled = (p: Promise<void>) => {
  const state = { done: false };
  void p.then(() => (state.done = true));
  return state;
};

describe('connectSourceAndWait', () => {
  it('a joiner still resolves when the starter aborts: it waits for the connection, on one connect', async () => {
    const starter = new AbortController();
    const first = connectSourceAndWait(queryClient, 's1', starter.signal);
    const joiner = settled(connectSourceAndWait(queryClient, 's1', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(100);
    starter.abort();
    await first;
    await vi.advanceTimersByTimeAsync(4000);
    expect(joiner.done).toBe(false);
    connected = true;
    await vi.advanceTimersByTimeAsync(1600);
    expect(joiner.done).toBe(true);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('a caller\'s own abort ends its wait at once, and not the other\'s', async () => {
    const a = new AbortController();
    const b = new AbortController();
    const pa = settled(connectSourceAndWait(queryClient, 's1', a.signal));
    const pb = settled(connectSourceAndWait(queryClient, 's1', b.signal));
    await vi.advanceTimersByTimeAsync(100);
    b.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(pb.done).toBe(true);
    expect(pa.done).toBe(false);
    a.abort();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(pa.done).toBe(true);
  });
});
