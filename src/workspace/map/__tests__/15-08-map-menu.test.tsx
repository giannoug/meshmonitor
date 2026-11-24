/**
 * @vitest-environment jsdom
 *
 * Board 15-08 (desktop): the device map's right-click menu (Add waypoint here,
 * Add local marker here, Measure from here) with its hint chip, the local
 * marker sheet and the Delete waypoint confirm. The board draws the three
 * together only to fit the canvas (s15n3); each opens on its own (D9c), so the
 * check runs over each in turn.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from '../../chat/__tests__/renderChat';
import { bodyOf, mapRoute, openMapMenu, openWaypointPopup, pick, sent, waypointsUrl } from './mapEditHelpers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const markersUrl = `/api/sources/${SOURCE_IDS.g2}/markers`;
const fixtures = {
  'POST /api/sources/:id/markers': () => ({ success: true, data: { id: 9 } }),
  'DELETE /api/sources/:id/waypoints/:waypointId': () => ({ success: true }),
};
/** A non-admin with Station G2's waypoints at the given level. */
const viewer = (write: boolean) => ({
  permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false }, waypoints: { read: true, write } } } },
});

describe('15-08-map-menu', () => {
  it('15-08-map-menu shows the board', async () => {
    renderChat(mapRoute, { fixtures });
    const texts: string[] = [];
    const menu = await openMapMenu();
    texts.push(menu.textContent ?? '');
    await pick(menu, /^Add local marker here/);
    const marker = await screen.findByRole('dialog', { name: 'New local marker' });
    texts.push(marker.textContent ?? '');
    fireEvent.click(within(marker).getByRole('button', { name: 'Close' }));
    const popup = await openWaypointPopup('Trailhead');
    fireEvent.click(within(popup).getByRole('button', { name: 'Delete…' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete waypoint “Trailhead”?' });
    texts.push(confirm.textContent ?? '');
    expectBoard('15-08-map-menu', joined(...texts));
  });

  it('shows the hint chip, and the menu names the spot it was opened on', async () => {
    renderChat(mapRoute);
    const menu = await openMapMenu();
    expect(screen.getByText('Right-click the map: add a waypoint, a local marker, or measure from that point')).toBeInTheDocument();
    expect(within(menu).getByText(/^-?\d+\.\d{4}, -?\d+\.\d{4}$/)).toBeInTheDocument();
    // Opening the menu sends nothing.
    expect(vi.mocked(fetch).mock.calls.filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toHaveLength(0);
  });

  it('closes on Escape, and one thing opens at a time', async () => {
    renderChat(mapRoute);
    const menu = await openMapMenu();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Map actions' })).toBeNull());
    await pick(await openMapMenu(), /^Add waypoint here/);
    await screen.findByRole('dialog', { name: 'New waypoint' });
    expect(screen.queryByRole('menu', { name: 'Map actions' })).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('the keyboard path: the Map actions button opens the same menu at the map centre', async () => {
    renderChat(mapRoute);
    fireEvent.click(await screen.findByRole('button', { name: 'Map actions' }, { timeout: 5000 }));
    const menu = await screen.findByRole('menu', { name: 'Map actions' });
    await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus());
  });

  it('Escape returns focus to the Map actions button that opened the menu', async () => {
    renderChat(mapRoute);
    const opener = await screen.findByRole('button', { name: 'Map actions' }, { timeout: 5000 });
    opener.focus();
    fireEvent.click(opener);
    const menu = await screen.findByRole('menu', { name: 'Map actions' });
    await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('Measure from here starts at the spot: anchor A is drawn at once, and the next click measures from it', async () => {
    renderChat(mapRoute);
    /** Today's measure rings (CircleMarker) and line, drawn in its own colour. */
    const measurePaths = () => document.querySelectorAll('.leaflet-overlay-pane path[stroke="#38bdf8"]');
    const menu = await openMapMenu();
    expect(within(menu).getByText('Click a second point; snaps to nodes')).toBeInTheDocument();
    await pick(menu, /^Measure from here/);
    expect(screen.getByRole('button', { name: 'Measure Distance' })).toHaveAttribute('aria-pressed', 'true');
    // Anchor A: the node nearest the spot the menu opened on, before any click.
    await waitFor(() => expect(measurePaths()).toHaveLength(1));
    // A click far from the spot snaps to another node: B, and the line between them with its distance.
    fireEvent.click(document.querySelector('.leaflet-container')!, { clientX: 2000, clientY: 2000 });
    await waitFor(() => expect(measurePaths()).toHaveLength(3));
    expect(document.querySelector('.measure-distance-label')?.textContent).toMatch(/\d/);
  });

  it('Add local marker here saves the spot to MeshMonitor only, and says it sends nothing', async () => {
    renderChat(mapRoute, { fixtures });
    await pick(await openMapMenu(), /^Add local marker here/);
    const sheet = within(await screen.findByRole('dialog', { name: 'New local marker' }));
    expect(sheet.getByText(/never sent to the mesh/)).toBeInTheDocument();
    expect(sheet.getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(sheet.getByLabelText('Latitude')).not.toHaveValue(null);
    fireEvent.change(sheet.getByLabelText('Label'), { target: { value: 'Site B' } });
    fireEvent.change(sheet.getByLabelText('Colour'), { target: { value: 'info' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent(markersUrl, 'POST')).toHaveLength(1));
    expect(bodyOf(sent(markersUrl, 'POST')[0])).toMatchObject({ label: 'Site B', color: 'info', icon: 'pin' });
    expect(sent(waypointsUrl, 'POST')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New local marker' })).toBeNull());
  });

  it("Delete waypoint: today's broadcast words, the sending source, a Sends line, then today's DELETE", async () => {
    renderChat(mapRoute, { fixtures });
    const popup = await openWaypointPopup('Trailhead');
    fireEvent.click(within(popup).getByRole('button', { name: 'Delete…' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Delete waypoint “Trailhead”?' }));
    expect(sheet.getByText('This will be broadcast to the mesh. Sending source: Station G2')).toBeInTheDocument();
    expect(sheet.getByText('Sends 1 waypoint delete on LongFast, hop limit 3')).toBeInTheDocument();
    expect(sent(waypointsUrl, 'DELETE')).toHaveLength(0);
    fireEvent.click(sheet.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(sent(`${waypointsUrl}/101`, 'DELETE')).toHaveLength(1));
  });

  it("an MQTT mirror cannot send a waypoint (Map Analysis's rule): local markers and Measure only", async () => {
    renderChat(`/source/${SOURCE_IDS.mqtt}/map`);
    const menu = await openMapMenu();
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^Add local marker here/), expect.stringMatching(/^Measure from here/),
    ]);
    expect(screen.queryByText(/^Right-click the map/)).toBeNull();
  });

  describe("today's waypoint write gate", () => {
    it('a viewer with waypoints:write gets the editing entries and the hint', async () => {
      renderChat(mapRoute, viewer(true));
      const menu = await openMapMenu();
      expect(within(menu).getByRole('menuitem', { name: /^Add waypoint here/ })).toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: /^Add local marker here/ })).toBeInTheDocument();
      expect(screen.getByText(/^Right-click the map/)).toBeInTheDocument();
    });

    it('a read-only viewer gets Measure from here only, no hint, and no popup actions', async () => {
      renderChat(mapRoute, viewer(false));
      const menu = await openMapMenu();
      expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([expect.stringMatching(/^Measure from here/)]);
      expect(screen.queryByText(/^Right-click the map/)).toBeNull();
      const popup = await openWaypointPopup('Trailhead');
      expect(within(popup).queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(within(popup).queryByRole('button', { name: 'Delete…' })).toBeNull();
    });

    it('a guest gets Measure from here only', async () => {
      renderChat(mapRoute, { anonymous: true, permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false }, waypoints: { read: true, write: false } } } } });
      const menu = await openMapMenu();
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
      expect(within(menu).getByRole('menuitem', { name: /^Measure from here/ })).toBeInTheDocument();
    });
  });
});
