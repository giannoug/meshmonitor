/**
 * @vitest-environment jsdom
 *
 * The Map tools are one choice (M13d): a radio only starts its tool, picking
 * the active one again keeps it on, and the arrow keys move between them with
 * the checked one (or the first, with none) the only stop in the tab order.
 * Time on the phone opens the Tools sheet on its Time section (M13f).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { marker, openPhoneSheet, openTools, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('Map tools radios', () => {
  it('desktop: a second pick keeps the tool on; arrows move focus; one tab stop', async () => {
    renderOverview('/overview/map');
    await marker('KFR');
    let menu = await openTools();
    const items = () => within(menu).getAllByRole('menuitemradio');
    expect(items().map((i) => i.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    fireEvent.click(items()[0]);
    expect(screen.queryByRole('menu', { name: 'Tools' })).toBeNull();

    menu = await openTools();
    expect(items()[0]).toHaveAttribute('aria-checked', 'true');
    expect(items().map((i) => i.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    fireEvent.click(items()[0]);
    menu = await openTools();
    expect(items()[0]).toHaveAttribute('aria-checked', 'true');

    items()[0].focus();
    fireEvent.keyDown(items()[0], { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus();
    fireEvent.keyDown(items()[1], { key: 'End' });
    expect(items()[4]).toHaveFocus();
    fireEvent.keyDown(items()[4], { key: 'ArrowDown' });
    expect(items()[0]).toHaveFocus();
    fireEvent.keyDown(items()[0], { key: 'ArrowUp' });
    expect(items()[4]).toHaveFocus();
    fireEvent.keyDown(items()[4], { key: 'Home' });
    expect(items()[0]).toHaveFocus();
  });

  it('phone: the sheet\'s radios take the same keys; with a tool on, only it is a tab stop', async () => {
    renderOverview('/overview/map', { phone: true });
    let sheet = await openPhoneSheet('Tools');
    expect(within(sheet).getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Link Profile' }));
    sheet = await openPhoneSheet('Tools');
    const radios = within(sheet).getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1, -1]);
    fireEvent.click(radios[1]);
    sheet = await openPhoneSheet('Tools');
    expect(within(sheet).getByRole('radio', { name: 'Link Profile' })).toHaveAttribute('aria-checked', 'true');
    const again = within(sheet).getAllByRole('radio');
    again[1].focus();
    fireEvent.keyDown(again[1], { key: 'ArrowDown' });
    expect(again[2]).toHaveFocus();
  });

  it('phone: Time opens the tools sheet focused on the Time section', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = await openPhoneSheet('Time');
    const heading = within(sheet).getByRole('heading', { name: 'Time' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('phone: Tools opens it with focus on the sheet, not on Time', async () => {
    renderOverview('/overview/map', { phone: true });
    const sheet = await openPhoneSheet('Tools');
    expect(within(sheet).getByRole('heading', { name: 'Time' })).not.toHaveFocus();
  });
});
