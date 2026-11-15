/**
 * @vitest-environment jsdom
 *
 * Board 15-24 (phone): the waypoint editor's Geofence page, inside the
 * editor's sheet (it is a step of the editor, not a route): today's
 * WaypointGeofenceFields with Back to the editor and Done. It sends nothing
 * itself; the geofence goes out with the waypoint.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

import { mapRoute, openMapMenu, openWaypointPopup, pick, sent, waypointsUrl } from './mapEditHelpers';

async function openGeofence() {
  fireEvent.click(within(await openWaypointPopup('Trailhead')).getByRole('button', { name: 'Edit' }));
  const editor = await screen.findByRole('dialog', { name: 'Edit waypoint' });
  fireEvent.click(within(editor).getByRole('button', { name: /^Geofence/ }));
  return screen.findByRole('dialog', { name: 'Geofence' });
}

describe('15-24-geofence', () => {
  it('15-24-geofence shows the board', async () => {
    renderChat(mapRoute, { phone: true });
    expectBoard('15-24-geofence', await openGeofence());
  });

  it("carries today's stored geofence, sends nothing itself, and Done returns to the editor with it", async () => {
    renderChat(mapRoute, { phone: true });
    const page = within(await openGeofence());
    expect(page.getByRole('combobox', { name: 'Shape' })).toHaveValue('both');
    expect(page.getByText('Goes out with the waypoint when you tap Create; nothing extra is sent')).toBeInTheDocument();
    fireEvent.click(page.getByRole('checkbox', { name: 'Alert when a node leaves' }));
    fireEvent.click(page.getByRole('button', { name: 'Done' }));
    const editor = await screen.findByRole('dialog', { name: 'Edit waypoint' });
    expect(within(editor).getByRole('button', { name: /^Geofence/ })).toHaveTextContent(/alerts on enter and exit/);
    expect(sent(waypointsUrl, 'PATCH')).toHaveLength(0);
  });

  // #5649: a value the field rejects never goes on air, whichever step the sheet is on.
  it('a rejected field keeps Create off: the Geofence step cannot be opened past it, and nothing is sent', async () => {
    renderChat(mapRoute, { phone: true, fixtures: { 'POST /api/sources/:id/waypoints': () => ({ success: true, data: {} }) } });
    await pick(await openMapMenu(), /^Add waypoint here/);
    const editor = within(await screen.findByRole('dialog', { name: 'New waypoint' }));
    fireEvent.change(editor.getByLabelText(/^Rebroadcast every/), { target: { value: '5' } });
    expect(editor.getByRole('button', { name: 'Create' })).toBeDisabled();
    fireEvent.click(editor.getByRole('button', { name: /^Geofence/ }));
    expect(screen.getByRole('dialog', { name: 'New waypoint' })).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Create' })).toBeDisabled();
    fireEvent.click(editor.getByRole('button', { name: 'Create' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(sent(waypointsUrl, 'POST')).toHaveLength(0);
  });

  it('a rejected radius keeps Done and Back off, so Create stays off', async () => {
    renderChat(mapRoute, { phone: true });
    const page = within(await openGeofence());
    fireEvent.change(page.getByRole('spinbutton', { name: /^Radius/ }), { target: { value: '50' } });
    expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
    expect(page.getByRole('button', { name: 'Edit waypoint' })).toBeDisabled();
  });

  it('a save error raised on the Geofence step is shown there', async () => {
    renderChat(mapRoute, { phone: true });
    await pick(await openMapMenu(), /^Add waypoint here/);
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'New waypoint' })).getByRole('button', { name: /^Geofence/ }));
    const page = within(await screen.findByRole('dialog', { name: 'Geofence' }));
    // A box the user has not drawn: today's check refuses it before anything is sent.
    fireEvent.change(page.getByRole('combobox', { name: 'Shape' }), { target: { value: 'box' } });
    fireEvent.click(page.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(page.getByRole('alert')).toHaveTextContent('Draw the geofence box on the map'));
    expect(sent(waypointsUrl, 'POST')).toHaveLength(0);
  });
});
