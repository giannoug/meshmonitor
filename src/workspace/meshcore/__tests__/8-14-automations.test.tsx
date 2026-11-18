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

  it('Auto-announce\'s Send now carries its Sends line and sends once per press', async () => {
    const { log } = renderMeshCore(`${HELTEC}/automations/auto-announce`);
    const send = await screen.findByRole('button', { name: 'Send Now' });
    const card = send.closest('section') as HTMLElement;
    expect(within(card).getByText(/Sends 1 message/)).toBeInTheDocument();
    fireEvent.click(send);
    await waitFor(() => expect(posts(log, '/announce/send')).toHaveLength(1));
    await settle();
    expect(posts(log, '/announce/send')).toHaveLength(1);
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
});
