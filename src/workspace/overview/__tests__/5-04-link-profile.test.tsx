/**
 * @vitest-environment jsdom
 *
 * Board 5-04-link-profile (desktop): the Tools menu (one tool at a time:
 * Measure, Link Profile, Site Planner, Add Waypoint, Add Local Marker, with
 * today's gates) and today's Link Profile drawer. Add Waypoint opens the
 * Workspace waypoint sheet (3.6) at the spot clicked, with its Sends line.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { openTools, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const item = (menu: HTMLElement, name: string) => within(menu).getByRole('menuitemradio', { name: new RegExp(`^${name}`) });

describe('5-04-link-profile', () => {
  it('5-04-link-profile shows the board', async () => {
    const { container } = renderOverview('/overview/map');
    fireEvent.click(item(await openTools(), 'Link Profile'));
    await screen.findByTestId('link-profile-drawer');
    await openTools();
    expectBoard('5-04-link-profile', container);
  });

  it('lists the tools in board order, each with what it does', async () => {
    renderOverview('/overview/map');
    const menu = await openTools();
    expect(within(menu).getAllByRole('menuitemradio').map((i) => i.getAttribute('aria-label'))).toEqual([
      'Measure', 'Link Profile', 'Site Planner', 'Add Waypoint', 'Add Local Marker',
    ]);
    expect(within(menu).getByText('Sends a waypoint on the channel you pick · Virtual sends nothing')).toBeInTheDocument();
  });

  it('one tool at a time: picking another turns the first off', async () => {
    renderOverview('/overview/map');
    fireEvent.click(item(await openTools(), 'Link Profile'));
    expect(await screen.findByTestId('link-profile-drawer')).toBeInTheDocument();
    fireEvent.click(item(await openTools(), 'Site Planner'));
    expect(screen.queryByText('Pick two points on the map to build a link profile. Hold Space to pan without placing points.')).toBeNull();
    const menu = await openTools();
    expect(item(menu, 'Site Planner')).toHaveAttribute('aria-checked', 'true');
    expect(item(menu, 'Link Profile')).toHaveAttribute('aria-checked', 'false');
  });

  it('a gated tool shows today\'s reason', async () => {
    renderOverview('/overview/map', { fixtures: { 'GET /api/unified/dashboard': () => [] } });
    const menu = await openTools();
    expect(item(menu, 'Measure')).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getAllByText('Measure — need at least two positioned nodes').length).toBeGreaterThan(0);
  });

  it('a viewer without waypoints:write gets no pin tools', async () => {
    renderOverview('/overview/map', { permissions: { global: {}, bySource: {} } });
    const menu = await openTools();
    expect(within(menu).queryByRole('menuitemradio', { name: /^Add Waypoint/ })).toBeNull();
    expect(within(menu).queryByRole('menuitemradio', { name: /^Add Local Marker/ })).toBeNull();
  });

  it('Add Waypoint: a click on the map opens the waypoint sheet there; placing sends nothing', async () => {
    renderOverview('/overview/map');
    fireEvent.click(item(await openTools(), 'Add Waypoint'));
    expect(storedConfig().layers.waypoints.enabled).toBe(true);
    expect(await screen.findByText('Click the map to place the waypoint. Nothing is sent until you save.')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.leaflet-container')!, { clientX: 300, clientY: 200 });
    const sheet = await screen.findByRole('dialog', { name: 'New waypoint' }, { timeout: 5000 });
    expect(within(sheet).getByText(/^Sends 1 waypoint on /)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toEqual([]);
  });

  it('Add Local Marker opens the local marker sheet; it sends nothing on the mesh', async () => {
    renderOverview('/overview/map');
    fireEvent.click(item(await openTools(), 'Add Local Marker'));
    fireEvent.click(document.querySelector('.leaflet-container')!, { clientX: 300, clientY: 200 });
    const sheet = await screen.findByRole('dialog', { name: 'New local marker' }, { timeout: 5000 });
    expect(within(sheet).getByText('Sends nothing on the mesh')).toBeInTheDocument();
  });
});
