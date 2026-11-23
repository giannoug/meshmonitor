/**
 * @vitest-environment jsdom
 *
 * Mesh impact (CLAUDE.md checklist; Task 8.3): opening and re-rendering every
 * built-in's page sends nothing; the reads are today's, once per visit; the
 * only timers are today's (Auto Ping's sessions, the airtime status, the
 * logs); Run now asks first and runs once per press.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { BUILTIN_IDS } from '../ids';
import { AUTO, renderAutomations, requests, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('Automations mesh impact', () => {
  it.each(BUILTIN_IDS.map((id) => [id]))('opening and re-rendering %s sends nothing, and mounts no Classic section', async (id) => {
    const { log, rerenderWorkspace } = renderAutomations(`${AUTO}/${id}`);
    await screen.findByRole('heading', { level: 1 });
    await screen.findAllByText(/Sends|sends|^1 |^Up to|^On |^Cooldown|^No trigger|^Pauses|^Off|^60 s|^When on/);
    rerenderWorkspace();
    await settle(120);
    expect(log.writes).toHaveLength(0);
    expect(document.querySelector('.automation-section-header, .settings-section')).toBeNull();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('the door reads today\'s settings once for all the built-ins that share it (plus the settings context\'s own read, as the Dashboard)', async () => {
    renderAutomations();
    await screen.findByText('Weather bot');
    await settle(200);
    expect(requests('GET', '/api/settings')).toBe(2);
    expect(requests('GET', '/api/automations')).toBe(1);
    // No page-only reads on the door: logs, status, scripts, candidates.
    expect(requests('GET', /\/(traceroute-log|key-repair-log|airtime-status|airtime-candidates|scripts)$/)).toBe(0);
  });

  it('Auto Delete by Distance\'s Run now asks first (Enter does nothing) and runs once per press', async () => {
    const { log } = renderAutomations(`${AUTO}/auto-delete-by-distance`);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Now' }));
    const sheet = await screen.findByRole('dialog', { name: 'Run Now' });
    fireEvent.keyDown(sheet, { key: 'Enter' });
    await settle();
    expect(writes(log, '/distance-delete/run-now')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run Now' }));
    await waitFor(() => expect(writes(log, '/distance-delete/run-now')).toHaveLength(1));
    await settle();
    expect(writes(log, '/distance-delete/run-now')).toHaveLength(1);
  });

  it('a save per family sends that family\'s today\'s requests once: one settings write, the per-route ones, and the node filters\' three', async () => {
    const cases: Array<{ id: string; label: string; value: string; tails: string[] }> = [
      { id: 'auto-key-management', label: 'Interval Between Attempts (minutes)', value: '10', tails: ['/api/settings'] },
      { id: 'auto-ping', label: 'Max Pings Per Session', value: '10', tails: ['/api/settings/auto-ping'] },
      { id: 'auto-time-sync', label: 'Sync Interval (minutes)', value: '120', tails: ['/api/settings/time-sync-nodes'] },
      { id: 'auto-localstats', label: 'Request Interval (minutes)', value: '120', tails: ['/api/settings', '/api/settings/remote-localstats-nodes', '/api/settings/remote-localstats-interval'] },
    ];
    for (const c of cases) {
      const { log, unmount } = renderAutomations(`${AUTO}/${c.id}`);
      const input = await screen.findByLabelText(new RegExp(`^${c.label.replace(/[()]/g, '\\$&')}`));
      fireEvent.change(input, { target: { value: c.value } });
      fireEvent.blur(input);
      fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
      await waitFor(() => expect(log.writes.length).toBe(c.tails.length));
      await settle();
      expect(log.writes.map((w) => w.path)).toEqual(c.tails);
      unmount();
    }
  });

  it('Auto Ping polls its sessions only while one runs (today\'s 5 s), and the door adds no other timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAutomations();
      await screen.findByText('Weather bot');
      const before = requests('GET', '/api/settings/auto-ping');
      await vi.advanceTimersByTimeAsync(31_000);
      expect(requests('GET', '/api/settings/auto-ping')).toBe(before);
      expect(requests('GET', '/api/settings')).toBe(2);
      expect(requests('GET', '/api/automations')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
