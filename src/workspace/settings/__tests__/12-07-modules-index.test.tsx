/**
 * @vitest-environment jsdom
 *
 * Board 12-07-modules-index (desktop): Modules › lists the modules this
 * firmware has, A–Z, each with On/Off, and folds the rest into one
 * "N not on this firmware" row that still opens them. The ☆ and ⌘, are Task 5.4's.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const supported = () => screen.findByRole('list', { name: 'Supported' }, { timeout: 5000 });

describe('12-07-modules-index', () => {
  it('12-07-modules-index shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/modules`);
    await within(await supported()).findByText('Traffic Management');
    expectBoard('12-07-modules-index', container, { staged: ['⌘,'] });
  });

  it('lists the supported modules A–Z with On/Off, and opens each one', async () => {
    renderSettings(`${g2}/settings/modules`);
    const rows = await supported();
    await within(rows).findByText('Traffic Management');
    expect(within(rows).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Ambient LightingOff', 'Canned MessagesOff', 'Detection SensorOff', 'External NotificationOn', 'MeshBeaconOff',
      'MQTTOn', 'Neighbor InfoOn', 'Range TestOff', 'Remote HardwareOff', 'Serial ModuleOff', 'Status MessageOff',
      'Store & ForwardOn', 'TelemetryOn', 'Traffic Management',
    ]);
    expect(within(rows).getByRole('link', { name: /^MQTT/ })).toHaveAttribute('href', `${g2}/settings/modules/mqtt`);
    expect(screen.getByText('On the radio · 14 of 17 on this firmware · A–Z · saving most modules restarts the node')).toBeInTheDocument();
  });

  it('the modules not on this firmware stay reachable from the folded row', async () => {
    renderSettings(`${g2}/settings/modules`);
    await within(await supported()).findByText('Traffic Management');
    expect(screen.queryByRole('link', { name: /^Paxcounter/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /3 not on this firmware/ }));
    expect(screen.getByRole('link', { name: /^Paxcounter/ })).toHaveAttribute('href', `${g2}/settings/modules/paxcounter`);
  });
});
