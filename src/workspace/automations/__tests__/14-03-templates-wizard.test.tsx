/**
 * @vitest-environment jsdom
 *
 * Boards 14-03 (desktop) and 14-11 (phone), s14n0/s14n4: Templates, today's
 * gallery, and a template's wizard (Template › Parameters › Install). Every
 * install starts disabled; Install sends today's POST /import once per rule,
 * in order, and the results list each rule with Open.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { READ_ONLY, nonGet, renderRules } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const BRIDGE = '/overview/automations/templates/mt-mc-bridge';

describe('14-03-templates-wizard', () => {
  it('14-03-templates-wizard shows the board', async () => {
    renderRules(BRIDGE);
    const wizard = await screen.findByRole('complementary', { name: 'MT↔MC Bridge' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Advanced' }));
    await within(wizard).findByText(/Max relays per minute/);
    expectBoard('14-03-templates-wizard', document.body);
  });

  it('14-11-template-wizard shows the board', async () => {
    renderRules(BRIDGE, { phone: true });
    await screen.findByText('Meshtastic channel');
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    await screen.findByText(/Max relays per minute/);
    expectBoard('14-11-template-wizard', document.body);
  });

  it('the gallery lists today\'s templates; Use template opens its wizard', async () => {
    renderRules('/overview/automations/templates');
    for (const name of ['Auto-Ack', 'MT↔MC Bridge', 'Device Health', 'Timed Announcement']) expect(await screen.findByText(name)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Use template' });
    expect(links.map((l) => l.getAttribute('href'))).toContain(BRIDGE);
  });

  it('Install sends today\'s request once per rule, in order, and lists each with Open', async () => {
    renderRules('/overview/automations/templates/auto-ack');
    const wizard = await screen.findByRole('complementary', { name: 'Auto-Ack' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Install' }));
    fireEvent.click(within(wizard).getByRole('button', { name: /Install/ }));
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    expect(nonGet()[0]).toMatchObject({ method: 'POST', path: '/api/automations/import', body: { name: 'Auto-Ack' } });
    const results = await within(wizard).findByRole('list', { name: 'Install results' });
    expect(within(results).getByRole('link', { name: 'Open' })).toHaveAttribute('href', expect.stringMatching(/^\/automations\//));
  });

  it('without automations:write Install is off', async () => {
    renderRules('/overview/automations/templates/auto-ack', { permissions: READ_ONLY });
    const wizard = await screen.findByRole('complementary', { name: 'Auto-Ack' });
    expect(within(wizard).getByRole('button', { name: 'Install' })).toBeDisabled();
  });
});
