/**
 * @vitest-environment jsdom
 *
 * Boards 8-14 (desktop) and 8-31 (phone): a MeshCore radio's Automations (Task
 * 7.5), native at `/source/:id/automations`: today's twelve built-ins, each
 * with its state, a summary and its Sends line; All / On / Sends on the mesh;
 * the Automation Engine rules that include this device. A built-in's switch
 * queues in the page's dock; Save sends that built-in's today's request once.
 * Each built-in opens its own page (`automations/<id>`) on the row kit.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

type Log = { writes: Array<{ method: string; path: string; body: unknown }> };
const posts = (log: Log, tail: string) => log.writes.filter((w) => w.method !== 'GET' && w.path.endsWith(tail));
const settle = () => act(async () => new Promise((r) => setTimeout(r, 50)));

describe('8-14-automations', () => {
  it('8-14-automations shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Welcome new nodes');
    await screen.findByText('Remote Telemetry');
    expectBoard('8-14-automations', container);
  });

  it('8-31-automations shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/automations`, { phone: true });
    await screen.findByText('Auto-pathfinding');
    await screen.findByRole('link', { name: /New rule/ });
    expectBoard('8-31-automations', container);
  });

  it('counts On and Sends on the mesh, and filters by them', async () => {
    renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Remote Telemetry');
    fireEvent.click(screen.getByRole('button', { name: /^On/ }));
    expect(screen.queryByText('Auto Welcome')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Sends on the mesh/ }));
    expect(screen.queryByText('Auto Delete by Distance')).toBeNull();
    expect(screen.getByText('Auto-announce')).toBeInTheDocument();
  });

  it('opening the page sends nothing; a switch queues, and Save sends today\'s one request with today\'s body', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Remote Telemetry');
    await settle();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Welcome' }));
    expect(await screen.findByText('1 change in Automations')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts(log, '/automation/auto-welcome')).toHaveLength(1));
    expect(posts(log, '/automation/auto-welcome')[0].body).toEqual({
      enabled: true, message: 'Welcome to the Athens mesh, {NAME}!', target: 'dm', waitForName: true, maxHops: 3, delaySeconds: 30, maxPerHour: 4,
    });
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('a switch and Discard send nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Remote Telemetry');
    fireEvent.click(screen.getByRole('switch', { name: 'Auto-announce' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await settle();
    expect(screen.queryByText('1 change in Automations')).toBeNull();
    expect(log.writes).toHaveLength(0);
  });

  it('a responder trigger edits in a sheet and saves with today\'s body, once', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations/auto-responder`);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Weather' });
    const cooldown = within(sheet).getByLabelText('Cooldown (s)');
    fireEvent.change(cooldown, { target: { value: '120' } });
    fireEvent.blur(cooldown);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(log.writes).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts(log, '/automation/responder')).toHaveLength(1));
    const body = posts(log, '/automation/responder')[0].body as { enabled: boolean; triggers: Array<{ id: string; cooldownSeconds: number }> };
    expect(body.enabled).toBe(true);
    expect(body.triggers.map((tr) => tr.id)).toEqual(['r1', 'r2', 'r3']);
    expect(body.triggers[0].cooldownSeconds).toBe(120);
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('a transmitting built-in carries its Sends line', async () => {
    renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Remote Telemetry');
    expect(screen.getByText('1 message + 1 flood advert every 6 h')).toBeInTheDocument();
  });

  it('the rules that include this device leave out a rule for another device only', async () => {
    renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Welcome new nodes');
    expect(screen.getByText('Low battery alert')).toBeInTheDocument();
    expect(screen.queryByText('G2 only')).toBeNull();
  });

  it('a built-in\'s page saves its edits with today\'s one request, and saving does not run it', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations/auto-favorite`);
    const stale = await screen.findByLabelText('Active window (hours)');
    fireEvent.change(stale, { target: { value: '48' } });
    fireEvent.blur(stale);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts(log, '/automation/auto-favorite')).toHaveLength(1));
    expect(posts(log, '/automation/auto-favorite')[0].body).toEqual({ enabled: true, intervalHours: 6, staleHours: 48 });
    await settle();
    // Saving is not a run.
    expect(posts(log, '/auto-favorite/run')).toHaveLength(0);
    expect(log.writes).toHaveLength(1);
  });

  // F.2 D-I2 (Ruling F IX): Send Now asks first, as the Meshtastic one (Ruling 8.3).
  it('Auto-announce\'s Send Now asks first with the saved message and its channels; Enter does not send; confirm sends once', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations/auto-announce`);
    const send = await screen.findByRole('button', { name: 'Send Now' });
    const card = send.closest('section') as HTMLElement;
    expect(within(card).getByText(/Send now sends 1 announcement now, on \S/)).toBeInTheDocument();
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    const sheet = await screen.findByRole('dialog', { name: 'Send Now' });
    expect(within(sheet).getByText('MeshMonitor {VERSION} online')).toBeInTheDocument();
    expect(within(sheet).getByText(/Send now sends 1 announcement now, on \S/)).toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form') ?? sheet);
    await settle();
    expect(posts(log, '/announce/send')).toHaveLength(0);
    const go = within(sheet).getByRole('button', { name: 'Send Now' });
    fireEvent.click(go);
    fireEvent.click(go);
    await waitFor(() => expect(posts(log, '/announce/send')).toHaveLength(1));
    await settle();
    expect(posts(log, '/announce/send')).toHaveLength(1);
  });

  it('Auto-announce\'s Send Now says unsaved edits are not sent', async () => {
    renderMeshCore(`${HELTEC}/automations/auto-announce`);
    const message = await screen.findByLabelText('Announcement Message');
    fireEvent.change(message, { target: { value: 'Draft text' } });
    const send = screen.getByRole('button', { name: 'Send Now' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    const sheet = await screen.findByRole('dialog', { name: 'Send Now' });
    expect(within(sheet).getByText(/Your unsaved edits are not sent/)).toBeInTheDocument();
    expect(within(sheet).getByText('MeshMonitor {VERSION} online')).toBeInTheDocument();
  });

  // F.2 D-M4: as the Meshtastic preview, an empty message is not sent for a preview.
  it('the live preview does not ask about an empty message', async () => {
    renderMeshCore(`${HELTEC}/automations/auto-announce`);
    const message = await screen.findByLabelText('Announcement Message');
    fireEvent.change(message, { target: { value: '' } });
    await act(async () => new Promise((r) => setTimeout(r, 400)));
    const empty = vi.mocked(fetch).mock.calls.filter(([u]) => {
      const url = new URL(String(u), 'http://x');
      return url.pathname.endsWith('/announce/preview') && url.searchParams.get('message') === '';
    });
    expect(empty).toHaveLength(0);
  });

  it('every built-in has a page on the kit', async () => {
    for (const id of ['auto-pathfinding', 'auto-ack', 'auto-responder', 'auto-ping', 'forwarding', 'timer-triggers', 'delete-by-distance', 'time-sync', 'remote-telemetry', 'auto-welcome']) {
      const { unmount } = renderMeshCore(`${HELTEC}/automations/${id}`);
      await screen.findByRole('heading', { level: 1 });
      // Back to the overview, and no Classic section mounted.
      expect(document.querySelector('a[href$="/automations"]')).not.toBeNull();
      expect(document.querySelector('.automation-section-header')).toBeNull();
      unmount();
    }
  });

  it('Auto-pathfinding: the dock says a save queues a run within 5 minutes; a save sends one request, none to the filter', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations/auto-pathfinding`);
    const repeat = await screen.findByLabelText('Repeat every (hours)');
    fireEvent.change(repeat, { target: { value: '12' } });
    fireEvent.blur(repeat);
    expect(await screen.findByText('Saving queues a run within 5 minutes and restarts the cycle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts(log, '/automation/pathfinding')).toHaveLength(1));
    expect(posts(log, '/automation/pathfinding')[0].body).toEqual({ enabled: true, pathDiscoveryEnabled: true, neighborsEnabled: true, intervalMinutes: 5, repeatHours: 12 });
    await settle();
    expect(posts(log, '/pathfinding/filter')).toHaveLength(0);
    expect(log.writes).toHaveLength(1);
  });

  it('the overview dock says what a save does per built-in', async () => {
    renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Remote Telemetry');
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Welcome' }));
    expect(await screen.findByText('Auto Welcome: Saving sends nothing on the mesh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Favorite' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Favorite' }));
    expect(screen.queryByText(/changes? in Automations/)).toBeNull();
  });

  it('the flood warning is today\'s, and only for flood', async () => {
    renderMeshCore(`${HELTEC}/automations/auto-announce`);
    const reach = await screen.findByLabelText('Advert reach');
    expect(screen.getByText(/Automated flood adverts run at most once per hour per source/)).toBeInTheDocument();
    fireEvent.change(reach, { target: { value: 'zero_hop' } });
    expect(screen.queryByText(/Automated flood adverts run at most once per hour per source/)).toBeNull();
  });

  it('a timer trigger\'s Run now that sends a flood advert asks first; Enter does not send', async () => {
    const timers = { success: true, data: { triggers: [{ id: 't9', name: 'Hourly advert', enabled: true, scheduleType: 'interval', intervalMinutes: 60, responseType: 'advert', advertMode: 'flood' }] } };
    const { log } = renderMeshCore(`${HELTEC}/automations/timer-triggers`, { fixtures: { 'GET /api/sources/:id/meshcore/automation/timers': () => timers } });
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }));
    const sheet = await screen.findByRole('dialog', { name: 'Run now' });
    expect(within(sheet).getByText(/asks first/)).toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form') ?? sheet);
    await settle();
    expect(posts(log, '/timers/t9/run')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(posts(log, '/timers/t9/run')).toHaveLength(1));
  });

  // F.2 D-I2 (Ruling F IX): every Run now transmits, so a non-flood one asks first too.
  it('a timer trigger\'s non-flood Run now asks first; Enter does not send', async () => {
    const timers = { success: true, data: { triggers: [{ id: 't8', name: 'Hourly hello', enabled: true, scheduleType: 'interval', intervalMinutes: 60, responseType: 'text', channelIndex: 0, response: 'hello' }] } };
    const { log } = renderMeshCore(`${HELTEC}/automations/timer-triggers`, { fixtures: { 'GET /api/sources/:id/meshcore/automation/timers': () => timers } });
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }));
    const sheet = await screen.findByRole('dialog', { name: 'Run now' });
    expect(within(sheet).queryByText(/asks first/)).toBeNull();
    expect(within(sheet).getByText('Run now sends the saved trigger once, now')).toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form') ?? sheet);
    await settle();
    expect(posts(log, '/timers/t8/run')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(posts(log, '/timers/t8/run')).toHaveLength(1));
  });

  // F.2 D-M1: as the Meshtastic overview: one failure does not stop the rest, the dock names both, one save at a time.
  it('a failed built-in save does not stop the others, and the dock says what saved', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations`, {
      fixtures: { 'POST /api/sources/:id/meshcore/automation/auto-welcome': () => new Response(JSON.stringify({ error: 'Nope' }), { status: 500 }) },
    });
    await screen.findByText('Remote Telemetry');
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Welcome' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Favorite' }));
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(await screen.findByText(/Saved: Auto Favorite\. Not saved: Auto Welcome/)).toBeInTheDocument();
    expect(posts(log, '/automation/auto-favorite')).toHaveLength(1);
  });

  it('an engine rule switch sends one request per press and waits for it', async () => {
    let release!: () => void;
    const { log } = renderMeshCore(`${HELTEC}/automations`);
    await screen.findByText('Welcome new nodes');
    const fetchMock = vi.mocked(fetch);
    const real = fetchMock.getMockImplementation()!;
    let calls = 0;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST' && /\/api\/automations\/[^/]+\/(enable|disable)$/.test(String(input))) {
        calls += 1;
        return new Promise((resolve) => (release = () => resolve(new Response('{"success":true}', { status: 200 }))));
      }
      return real(input, init);
    });
    const rule = screen.getByRole('switch', { name: 'Welcome new nodes' });
    fireEvent.click(rule);
    await waitFor(() => expect(rule).toBeDisabled());
    fireEvent.click(rule);
    expect(calls).toBe(1);
    release();
    await waitFor(() => expect(rule).toBeEnabled());
    expect(log.writes.filter((w) => w.path.includes('/api/automations/'))).toHaveLength(0);
  });

  it('an engine rule switch that fails shows the error, as a toast', async () => {
    renderMeshCore(`${HELTEC}/automations`, { fixtures: { 'POST /api/automations/:aid/:verb': () => new Response(JSON.stringify({ error: 'Nope' }), { status: 500 }) } });
    await screen.findByText('Welcome new nodes');
    fireEvent.click(screen.getByRole('switch', { name: 'Welcome new nodes' }));
    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });
});
