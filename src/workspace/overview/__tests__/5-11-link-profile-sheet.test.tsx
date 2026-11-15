/**
 * @vitest-environment jsdom
 *
 * Board 5-11-link-profile-sheet (phone): Tools › Link Profile, two taps on the
 * map, and today's Link Profile drawer as a bottom sheet: the chart above the
 * verdict, the budget and today's inputs (stacked, not side by side). It is
 * not modal, so the map above takes the A and B taps.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { openPhoneSheet, openTools, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function linkProfile() {
  fireEvent.click(within(await openPhoneSheet('Tools')).getByRole('radio', { name: 'Link Profile' }));
  const drawer = await screen.findByTestId('link-profile-drawer');
  const map = document.querySelector<HTMLElement>('.leaflet-container')!;
  fireEvent.click(map, { clientX: 200, clientY: 500 });
  fireEvent.click(map, { clientX: 700, clientY: 150 });
  await within(drawer).findByText(/^Clear · \+[\d.]+ dB margin$/, {}, { timeout: 5000 });
  return drawer;
}

describe('5-11-link-profile-sheet', () => {
  it('5-11-link-profile-sheet shows the board', async () => {
    const { container } = renderOverview('/overview/map', { phone: true });
    await linkProfile();
    expectBoard('5-11-link-profile-sheet', container);
  });

  it('the drawer is stacked as a sheet on the phone, and not modal', async () => {
    renderOverview('/overview/map', { phone: true });
    const drawer = await linkProfile();
    expect(drawer.className).toMatch(/stacked/);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Today's close ends the tool.
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close link profile' }));
    expect(screen.queryByTestId('link-profile-drawer')).toBeNull();
  });

  it('on desktop it stays today\'s drawer, side by side', async () => {
    renderOverview('/overview/map');
    fireEvent.click(within(await openTools()).getByRole('menuitemradio', { name: /^Link Profile/ }));
    expect((await screen.findByTestId('link-profile-drawer')).className).not.toMatch(/stacked/);
  });
});
