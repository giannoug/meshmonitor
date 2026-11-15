/**
 * @vitest-environment jsdom
 *
 * Board 5-09-tools-time (phone): Tools and Time open one sheet. Its Tools
 * list is the desktop menu's (one tool at a time, today's gates, the
 * waypoint's Sends line); picking one closes the sheet so the next tap lands
 * on the map. Its Time section is today's Time Slider switch; the slider is
 * today's, on the map.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { DEFAULT_CONFIG } from '../../../hooks/useMapAnalysisConfig';
import { openPhoneSheet, renderOverview, storedConfig } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const tool = (sheet: HTMLElement, name: string) => within(sheet).getByRole('radio', { name });

describe('5-09-tools-time', () => {
  it('5-09-tools-time shows the board', async () => {
    renderOverview('/overview/map', { phone: true, config: { timeSlider: { ...DEFAULT_CONFIG.timeSlider, enabled: true } } });
    await openPhoneSheet('Tools');
    expectBoard('5-09-tools-time', document.body);
  });

  it('lists the five tools in board order, each with what it does; Add Waypoint carries its Sends line', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = await openPhoneSheet('Tools');
    expect(within(sheet).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Measure', 'Link Profile', 'Site Planner', 'Add Waypoint', 'Add Local Marker',
    ]);
    expect(within(sheet).getByText('One at a time. Pick one, then tap the map.')).toBeInTheDocument();
    expect(within(sheet).getByText('Sends a waypoint on the channel you pick · Virtual sends nothing')).toBeInTheDocument();
  });

  it('picking a tool closes the sheet and starts it; picking another stops the first', async () => {
    renderOverview('/overview/map', { phone: true });
    fireEvent.click(tool(await openPhoneSheet('Tools'), 'Link Profile'));
    expect(screen.queryByRole('dialog', { name: 'Tools' })).toBeNull();
    expect(await screen.findByTestId('link-profile-drawer')).toBeInTheDocument();

    const again = await openPhoneSheet('Tools');
    expect(tool(again, 'Link Profile')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(tool(again, 'Site Planner'));
    expect(await screen.findByText('Predict coverage')).toBeInTheDocument();
    expect(screen.queryByTestId('link-profile-drawer')).toBeNull();
  });

  it('Time opens the same sheet; its Time Slider switch turns today\'s slider on', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = await openPhoneSheet('Time');
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Time Slider' }));
    expect(storedConfig().timeSlider.enabled).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('time-slider')).toBeInTheDocument();
  });

  it('a gated tool shows today\'s reason and cannot be picked', async () => {
    renderOverview('/overview/map', { phone: true, fixtures: { 'GET /api/unified/dashboard': () => [] } });
    const sheet = await openPhoneSheet('Tools');
    const measure = tool(sheet, 'Measure');
    expect(measure).toHaveAttribute('aria-disabled', 'true');
    expect(within(sheet).getAllByText('Measure — need at least two positioned nodes').length).toBeGreaterThan(0);
    fireEvent.click(measure);
    expect(screen.getByRole('dialog', { name: 'Tools' })).toBeInTheDocument();
  });

  it('a viewer without waypoints:write gets no pin tools', async () => {
    renderOverview('/overview/map', { phone: true, permissions: { global: {}, bySource: {} } });
    const sheet = await openPhoneSheet('Tools');
    expect(within(sheet).queryByRole('radio', { name: 'Add Waypoint' })).toBeNull();
    expect(within(sheet).queryByRole('radio', { name: 'Add Local Marker' })).toBeNull();
  });

  it('Add Waypoint: the next tap on the map opens the waypoint sheet, with its Sends line; placing sends nothing', async () => {
    renderOverview('/overview/map', { phone: true });
    fireEvent.click(tool(await openPhoneSheet('Tools'), 'Add Waypoint'));
    expect(await screen.findByText('Click the map to place the waypoint. Nothing is sent until you save.')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.leaflet-container')!, { clientX: 300, clientY: 200 });
    const sheet = await screen.findByRole('dialog', { name: 'New waypoint' }, { timeout: 5000 });
    expect(within(sheet).getByText(/^Sends 1 waypoint on /)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toEqual([]);
  });
});
