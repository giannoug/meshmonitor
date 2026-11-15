/**
 * @vitest-environment jsdom
 *
 * Mesh checklist / Ruling N for the settings categories that read the device
 * poll (Channels, Backup, Firmware): opening one reads `/api/poll` once and
 * starts no interval. App, which polled every 30 s here, is not mounted.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { fetched, g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const polls = () => fetched().filter((u) => u.includes('/api/poll')).length;

afterEach(() => vi.useRealTimers());

describe('the poll on settings categories', () => {
  it.each([
    ['channels', 'Channels'],
    ['maintenance/backup', 'Backup'],
  ])('%s reads /api/poll once and keeps no timer', async (path, title) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderSettings(`${g2}/settings/${path}`);
    await screen.findByRole('heading', { level: 1, name: title }, { timeout: 5000 });
    // The page's first read (the lazy chunk takes real time to load).
    await waitFor(() => expect(polls()).toBe(1), { timeout: 15_000 });
    // A 5 s timer would have read it 12 more times; today's 30 s one twice.
    await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
    expect(polls()).toBe(1);
  });

  it('firmware (FirmwareUpdateSection\'s own usePoll) reads /api/poll once and keeps no timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderSettings(`${g2}/settings/maintenance/firmware`, {
      fixtures: { 'GET /api/health': () => ({ status: 'ok', version: 'fixture', firmwareOtaEnabled: true }) },
    });
    await screen.findByRole('heading', { level: 1, name: 'Firmware Updates' }, { timeout: 5000 });
    await waitFor(() => expect(polls()).toBe(1), { timeout: 15_000 });
    const first = polls();
    await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
    expect(polls()).toBe(first);
  });
});
