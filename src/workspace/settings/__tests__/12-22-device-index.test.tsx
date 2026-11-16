/**
 * @vitest-environment jsdom
 *
 * Board 12-22-device-index (phone): Device's index is a page with Back to
 * Settings, the categories with their summaries, then the pins in use (Task
 * 5.6). Bluetooth is left out (Ruling 5.6 EA: today has no Bluetooth settings).
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

describe('12-22-device-index', () => {
  it('12-22-device-index shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/device`, { phone: true });
    await within(await screen.findByRole('list', { name: 'Categories' }, { timeout: 5000 })).findByText('Network');
    await screen.findByRole('region', { name: 'Pins in use' }, { timeout: 5000 });
    expectBoard('12-22-device-index', container, { staged: ['Bluetooth'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Device' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-back')).toHaveAttribute('href', `${g2}/settings`);
    // The page draws its own header: no device switcher.
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });

  it('a category under Device goes back to Device', async () => {
    renderSettings(`${g2}/settings/device/position`, { phone: true });
    expect(await screen.findByTestId('settings-back', {}, { timeout: 5000 })).toHaveAttribute('href', `${g2}/settings/device`);
  });
});
