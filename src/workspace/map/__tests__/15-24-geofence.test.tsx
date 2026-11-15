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
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

import { mapRoute, openWaypointPopup, sent, waypointsUrl } from './mapEditHelpers';

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
});
