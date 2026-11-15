/** Shared steps for the map editing boards (15-07, 15-08, 15-13, 15-20, 15-23, 15-24, 15-26). */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { SOURCE_IDS } from '../../__fixtures__/athens';

export const g2 = `/source/${SOURCE_IDS.g2}`;
export const mapRoute = `${g2}/map`;
export const waypointsUrl = `/api/sources/${SOURCE_IDS.g2}/waypoints`;

/** Write requests sent to a path, newest last. */
export const sent = (path: string, method: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes(path) && (i?.method ?? 'GET') === method);

export const bodyOf = (call: Parameters<typeof fetch>) => JSON.parse(String(call[1]!.body));

/** Waits for the map, then right-clicks it (a long-press on touch fires the same `contextmenu`). */
export async function openMapMenu(): Promise<HTMLElement> {
  await screen.findByRole('button', { name: 'Zoom to fit all nodes' }, { timeout: 5000 });
  const map = document.querySelector('.leaflet-container') as HTMLElement;
  fireEvent.contextMenu(map, { clientX: 200, clientY: 150 });
  return screen.findByRole('menu', { name: 'Map actions' });
}

export async function pick(menu: HTMLElement, item: RegExp) {
  fireEvent.click(within(menu).getByRole('menuitem', { name: item }));
}

/** Opens a waypoint marker's popup on the map. */
export async function openWaypointPopup(name: string): Promise<HTMLElement> {
  await waitFor(() => expect(document.querySelectorAll('.waypoint-icon').length).toBeGreaterThan(1), { timeout: 5000 });
  const icons = [...document.querySelectorAll<HTMLElement>('.waypoint-icon')];
  for (const icon of icons) {
    fireEvent.click(icon);
    const popup = document.querySelector<HTMLElement>('.leaflet-popup');
    if (popup?.textContent?.includes(name)) return popup;
  }
  throw new Error(`no waypoint popup for ${name}`);
}
