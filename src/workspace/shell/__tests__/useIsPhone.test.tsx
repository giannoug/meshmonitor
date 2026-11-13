/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PHONE_QUERY, useIsPhone } from '../useIsPhone';

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

describe('useIsPhone', () => {
  it('follows the phone media query as it changes', () => {
    let matches = false;
    const listeners = new Set<(e: { matches: boolean }) => void>();
    window.matchMedia = vi.fn((query: string) => {
      expect(query).toBe(PHONE_QUERY);
      return {
        get matches() {
          return matches;
        },
        addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
        removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
      };
    }) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach((l) => l({ matches: true }));
    });
    expect(result.current).toBe(true);
  });
});
