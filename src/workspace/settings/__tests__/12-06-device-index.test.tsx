/**
 * @vitest-environment jsdom
 *
 * Board 12-06-device-index (desktop): the sidebar is the settings list with
 * "← Station G2"; Device › opens its index: the hardware categories, each with
 * today's restart rule for the firmware (configRebootRules). The one-line
 * summaries, Bluetooth and Pins in use are Task 5.6's; ⌘, is Task 5.4's.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const index = () => screen.findByRole('list', { name: 'Categories' }, { timeout: 5000 });

describe('12-06-device-index', () => {
  it('12-06-device-index shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/device`);
    await within(await index()).findByText('Network');
    expectBoard('12-06-device-index', container, { staged: ['Bluetooth', 'CLIENT', 'Pins in use', 'GPIO', '⌘,'] });
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('each row links to its category and carries the restart rule for firmware 2.7.15', async () => {
    renderSettings(`${g2}/settings/device`);
    const rows = await index();
    await within(rows).findByText('Network');
    expect(within(rows).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['DeviceMay restart', `${g2}/settings/device/device`],
      ['PositionRestarts', `${g2}/settings/device/position`],
      ['PowerMay restart', `${g2}/settings/device/power`],
      ['DisplayMay restart', `${g2}/settings/device/display`],
      ['NetworkRestarts', `${g2}/settings/device/network`],
    ]);
    expect(screen.getByText('On the radio · 5 categories this hardware has')).toBeInTheDocument();
  });

  it('the sidebar swaps to the settings list, with Back to the device and Device marked open', async () => {
    renderSettings(`${g2}/settings/device`);
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    const back = within(side).getByTestId('settings-back');
    expect(back).toHaveAttribute('href', g2);
    expect(back).toHaveTextContent('Station G2');
    expect(back).toHaveTextContent('Settings');
    expect(await within(side).findByRole('link', { name: 'Device' })).toHaveAttribute('aria-current', 'page');
  });

  it('an open child is listed under its parent', async () => {
    renderSettings(`${g2}/settings/device/position`);
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    expect(await within(side).findByRole('link', { name: 'Position' })).toHaveAttribute('aria-current', 'page');
  });
});
