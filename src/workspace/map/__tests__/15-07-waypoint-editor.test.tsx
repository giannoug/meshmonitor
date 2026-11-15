/**
 * @vitest-environment jsdom
 *
 * Board 15-07 (desktop): the waypoint editor as a right-docked sheet, opened
 * from the map's right-click menu, with today's fields (WaypointEditorModal's
 * logic, useWaypointEditorForm), its geofence inline (GeofencePage) and a
 * Sends line; and a waypoint locked to another node, whose Edit and Delete are
 * off with today's text. The board draws the popup beside the editor only to
 * fit the canvas; each opens on its own (D9c).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined, renderChat } from '../../chat/__tests__/renderChat';
import { bodyOf, mapRoute, openMapMenu, openWaypointPopup, pick, sent, waypointsUrl } from './mapEditHelpers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const fixtures = {
  'POST /api/sources/:id/waypoints': () => ({ success: true, data: {} }),
  'PATCH /api/sources/:id/waypoints/:waypointId': () => ({ success: true, data: {} }),
};

async function openEditor() {
  await pick(await openMapMenu(), /^Add waypoint here/);
  return screen.findByRole('dialog', { name: 'New waypoint' });
}

describe('15-07-waypoint-editor', () => {
  it('15-07-waypoint-editor shows the board', async () => {
    renderChat(mapRoute, { fixtures });
    const editor = await openEditor();
    const sheet = within(editor);
    fireEvent.change(sheet.getByLabelText(/^Rebroadcast every/), { target: { value: '30' } });
    // The board's geofence draws a circle and a box; today's picker offers one shape at a time for a new waypoint.
    fireEvent.change(sheet.getByRole('combobox', { name: 'Shape' }), { target: { value: 'circle' } });
    fireEvent.click(sheet.getByRole('checkbox', { name: 'Alert when a node enters' }));
    const circle = editor.textContent ?? '';
    fireEvent.change(sheet.getByRole('combobox', { name: 'Shape' }), { target: { value: 'box' } });
    const box = editor.textContent ?? '';
    fireEvent.click(sheet.getByRole('button', { name: 'Close' }));
    const popup = await openWaypointPopup('Lycabettus summit');
    expectBoard('15-07-waypoint-editor', joined(circle, box, popup));
  });

  it("is a right-docked sheet seeded with the spot, with today's fields", async () => {
    renderChat(mapRoute);
    const editor = await openEditor();
    expect(editor).toHaveAttribute('data-side', 'right');
    const sheet = within(editor);
    expect(sheet.getByLabelText('Latitude')).not.toHaveValue(null);
    expect(sheet.getByText('Station G2')).toBeInTheDocument();
    expect(sheet.getByRole('checkbox', { name: 'Lock to this node (!a1b2c300)' })).not.toBeChecked();
    expect(sheet.getByRole('combobox', { name: 'Broadcast channel' })).toHaveDisplayValue('LongFast (Primary)');
    // Today's Android warning shows only once a rebroadcast is set.
    expect(sheet.queryByText(/^Android clients notify/)).toBeNull();
  });

  it('Save shows "Sends 1 waypoint on <channel>" and posts today\'s body once', async () => {
    renderChat(mapRoute, { fixtures });
    const sheet = within(await openEditor());
    expect(sheet.getByText('Sends 1 waypoint on LongFast')).toBeInTheDocument();
    fireEvent.change(sheet.getByRole('combobox', { name: 'Broadcast channel' }), { target: { value: '1' } });
    fireEvent.change(sheet.getByLabelText(/^Rebroadcast every/), { target: { value: '30' } });
    expect(sheet.getByText('Sends 1 waypoint on gauntlet, then again every 30 min')).toBeInTheDocument();
    expect(sheet.getByText(/^Android clients notify on every rebroadcast/)).toBeInTheDocument();
    fireEvent.change(sheet.getByLabelText('Name (≤29 bytes)'), { target: { value: 'Trailhead' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(sent(waypointsUrl, 'POST')).toHaveLength(1));
    expect(bodyOf(sent(waypointsUrl, 'POST')[0])).toMatchObject({
      name: 'Trailhead', channel: 1, rebroadcast_interval_s: 1800, virtual: false, hop_limit: null, locked_to: null,
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New waypoint' })).toBeNull());
  });

  it("today's 10-minute floor: a shorter rebroadcast is refused and nothing is sent", async () => {
    renderChat(mapRoute, { fixtures });
    const sheet = within(await openEditor());
    fireEvent.change(sheet.getByLabelText(/^Rebroadcast every/), { target: { value: '5' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Create' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(sent(waypointsUrl, 'POST')).toHaveLength(0);
  });

  it('Enter in a text field does not send the waypoint', async () => {
    renderChat(mapRoute, { fixtures });
    const editor = await openEditor();
    fireEvent.submit(editor.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent(waypointsUrl, 'POST')).toHaveLength(0);
  });

  it('Virtual sends nothing', async () => {
    renderChat(mapRoute, { fixtures });
    const sheet = within(await openEditor());
    fireEvent.click(sheet.getByRole('checkbox', { name: 'Virtual (do not broadcast)' }));
    expect(sheet.getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(sheet.queryByText(/^Sends 1 waypoint/)).toBeNull();
  });

  it("a waypoint locked to another node has Edit and Delete off, with today's text", async () => {
    renderChat(mapRoute);
    const popup = within(await openWaypointPopup('Lycabettus summit'));
    expect(popup.getByText('Locked to another node. Only that node can change it.')).toBeInTheDocument();
    expect(popup.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(popup.getByRole('button', { name: 'Delete…' })).toBeDisabled();
  });

  it("Edit on its own waypoint opens it filled, and saves through today's PATCH", async () => {
    renderChat(mapRoute, { fixtures });
    const popup = within(await openWaypointPopup('Trailhead'));
    expect(popup.queryByText(/^Locked to another node/)).toBeNull();
    fireEvent.click(popup.getByRole('button', { name: 'Edit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit waypoint' }));
    expect(sheet.getByLabelText('Name (≤29 bytes)')).toHaveValue('Trailhead');
    expect(sheet.getByText('Sends 1 waypoint on LongFast, hop limit 3, then again every 30 min')).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent(`${waypointsUrl}/101`, 'PATCH')).toHaveLength(1));
  });
});
