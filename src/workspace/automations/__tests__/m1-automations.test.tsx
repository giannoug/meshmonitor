/**
 * @vitest-environment jsdom
 *
 * Boards m1 (desktop) and n1 (phone): a Meshtastic device's Automations door
 * (Task 8.3) at today's `/source/:id/automation`: a few built-ins with their
 * state, summary and Sends line, the "N more" row to the full list, then the
 * Automation Engine rules that include this device. A built-in's switch
 * queues in the dock; Save sends that built-in's today's request once.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2AutomationSettings } from '../../__fixtures__/automations';
import { AUTO, G2, renderAutomations, requests, settle, writes, nonGet } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const loaded = async () => {
  await screen.findByText('Weather bot');
  await screen.findByText('60 s cooldown per sender · stays quiet once 2 other nodes replied · DM replies are sent up to 3 times');
};

describe('m1-automations', () => {
  it('m1-automations shows the board', async () => {
    const { container } = renderAutomations();
    await loaded();
    expect(screen.queryByTestId('page-app')).toBeNull();
    expectBoard('m1-automations', container);
  });

  it('n1-automations shows the board', async () => {
    const { container } = renderAutomations(AUTO, { phone: true });
    await screen.findByText('Weather bot');
    await screen.findByText(/^Cooldown per trigger and node/);
    expectBoard('n1-automations', container);
  });

  it('lists the rules that include this device, and not another device\'s', async () => {
    renderAutomations();
    await loaded();
    expect(screen.getByText('Welcome new nodes')).toBeInTheDocument();
    expect(screen.getByText('Low battery alert')).toBeInTheDocument();
    expect(screen.queryByText('Heltec only')).toBeNull();
  });

  it('marks a rule with neither a cooldown nor a rate limit "No limit set", and Needs attention lists only it', async () => {
    renderAutomations();
    await loaded();
    const weather = screen.getByText('Weather bot').closest('li') as HTMLElement;
    expect(within(weather).getByText('No limit set')).toBeInTheDocument();
    const welcome = screen.getByText('Welcome new nodes').closest('li') as HTMLElement;
    expect(within(welcome).queryByText('No limit set')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Needs attention/ }));
    expect(screen.queryByText('Welcome new nodes')).toBeNull();
    expect(screen.getByText('Weather bot')).toBeInTheDocument();
  });

  it('the "12 more" row opens the full list', async () => {
    renderAutomations();
    await loaded();
    const more = screen.getByRole('link', { name: /^12 more/ });
    expect(more).toHaveAttribute('href', `${AUTO}/builtins`);
  });

  it('opening and re-rendering sends nothing; a switch queues, and Save sends today\'s one request with today\'s body', async () => {
    const { log, rerenderWorkspace } = renderAutomations();
    await loaded();
    rerenderWorkspace();
    await settle();
    expect(nonGet()).toHaveLength(0);
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Traceroute' }));
    expect(await screen.findByText('1 change in Automations')).toBeInTheDocument();
    expect(nonGet()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // Today's three requests for Auto Traceroute's save: settings, the filter, and the interval (which re-arms its scheduler).
    await waitFor(() => expect(writes(log, '/api/settings/traceroute-interval')).toHaveLength(1));
    expect(writes(log, '/api/settings')[0]).toMatchObject({
      search: '?sourceId=src-g2',
      body: { tracerouteIntervalMinutes: 15, tracerouteScheduleEnabled: 'false', tracerouteScheduleStart: '00:00', tracerouteScheduleEnd: '00:00' },
    });
    expect(writes(log, '/api/settings/traceroute-nodes')).toHaveLength(1);
    expect(writes(log, '/api/settings/traceroute-interval')[0].body).toEqual({ intervalMinutes: 15, sourceId: 'src-g2' });
    await settle();
    expect(nonGet()).toHaveLength(3);
  });

  it('a switch and Discard send nothing', async () => {
    renderAutomations();
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Acknowledge' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await settle();
    expect(screen.queryByText('1 change in Automations')).toBeNull();
    expect(nonGet()).toHaveLength(0);
  });

  it('saving Auto Acknowledge from its switch sends today\'s whole section body once', async () => {
    const { log } = renderAutomations();
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Acknowledge' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    const body = writes(log, '/api/settings')[0].body as Record<string, string>;
    expect(body).toMatchObject({ autoAckEnabled: 'false', autoAckRegex: g2AutomationSettings.autoAckRegex, autoAckChannels: '1', autoAckCooldownSeconds: '60', autoAckMaxResponses: '2' });
    expect(body.autoAckChannelMultiHopReplyEnabled).toBe('true');
    await settle();
    expect(nonGet()).toHaveLength(1);
  });

  it('a rule\'s switch sends today\'s disable once', async () => {
    const { log } = renderAutomations();
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Weather bot' }));
    await waitFor(() => expect(writes(log, '/api/automations/e3/disable')).toHaveLength(1));
    await settle();
    expect(nonGet()).toHaveLength(1);
  });

  it('without automation:write the switches are off, and without automations:read the rules say why', async () => {
    renderAutomations(AUTO, { permissions: { bySource: { 'src-g2': { automation: { read: true, write: false } } } } as never });
    await screen.findByText('60 s cooldown per sender · stays quiet once 2 other nodes replied · DM replies are sent up to 3 times');
    expect(screen.getByRole('switch', { name: 'Auto Acknowledge' })).toBeDisabled();
    expect(screen.getByText('You do not have permission to view Automation Engine rules.')).toBeInTheDocument();
    expect(requests('GET', '/api/automations')).toBe(0);
  });

  it('today\'s anchor `automation#auto-acknowledge` opens that built-in\'s page', async () => {
    renderAutomations(`${AUTO}#auto-acknowledge`);
    await screen.findByRole('heading', { level: 1, name: 'Auto Acknowledge' });
    expect(screen.getByRole('link', { name: /Built-ins/ })).toHaveAttribute('href', `${AUTO}/builtins`);
  });

  it('an unknown built-in goes back to the door', async () => {
    renderAutomations(`${AUTO}/nope`);
    await screen.findByText('Weather bot');
    expect(screen.queryByTestId('page-app')).toBeNull();
    expect(G2).toBe('/source/src-g2');
  });
});
