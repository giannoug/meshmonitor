/**
 * @vitest-environment jsdom
 *
 * Board f6-overview (desktop, ds3): the Overview sidebar (the all-devices
 * tools, This MeshMonitor, the devices with "N of M connected") beside the
 * all-devices map. Users is for admins and Audit log needs audit:read, as in
 * Classic.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import WorkspaceApp from '../../WorkspaceApp';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const renderAt = (route: string, opts: RenderWorkspaceOptions = {}) => renderWorkspace(<WorkspaceApp />, { route, ...opts });
const sidebar = () => screen.findByRole('complementary', { name: 'Overview' });

describe('f6-overview', () => {
  it('f6-overview shows the board', async () => {
    const { container } = renderAt('/overview/map');
    await screen.findByText('All devices · 4 of 5 connected');
    await within(await sidebar()).findByText('12 online');
    expectBoard('f6-overview', container);
  });

  it.each(['/', '/overview', '/overview/map'])('%s marks All-devices map as the current row', async (route) => {
    renderAt(route);
    const row = await within(await sidebar()).findByRole('link', { name: 'All-devices map' });
    expect(row).toHaveAttribute('aria-current', 'page');
    expect(row).toHaveAttribute('href', '/overview/map');
  });

  it('lists the tools in board order with their Overview URLs', async () => {
    renderAt('/overview/map');
    const side = await sidebar();
    const tools = within(side).getByRole('list', { name: 'Overview' });
    expect(within(tools).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['All-devices map', '/overview/map'],
      ['Dashboard', '/overview/dashboard'],
      ['Unified Messages', '/overview/messages'],
      ['Unified Telemetry', '/overview/telemetry'],
      ['Unified Packets', '/overview/packets'],
      ['Map Analysis', '/overview/analysis'],
      ['Analysis & Reports', '/overview/reports'],
    ]);
    const install = within(side).getByRole('list', { name: 'This MeshMonitor' });
    expect(within(install).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Automation Engine', '/overview/automations'],
      ['Users', '/overview/users'],
      ['Audit Log', '/overview/audit'],
    ]);
  });

  it('each device row opens the device and shows its state', async () => {
    renderAt('/overview/map');
    const devices = within(await sidebar()).getByRole('list', { name: 'Devices' });
    await within(devices).findByText('12 online');
    const row = (name: string) => within(devices).getByRole('link', { name: new RegExp(name) });
    expect(row('Station G2')).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}`);
    expect(row('Rooftop RAK')).toHaveTextContent('Disconnected');
    expect(row('Athens MQTT')).toHaveTextContent('Receive-only');
  });

  it('a non-admin without audit:read sees neither Users nor Audit log, nor devices they cannot read', async () => {
    renderAt('/overview/map', {
      permissions: { global: { automations: { read: true, write: false } }, bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } },
    });
    const side = await sidebar();
    await within(side).findByText('All devices · 1 of 1 connected');
    expect(within(side).getByRole('link', { name: 'Automation Engine' })).toBeInTheDocument();
    expect(within(side).queryByRole('link', { name: 'Users' })).toBeNull();
    expect(within(side).queryByRole('link', { name: 'Audit Log' })).toBeNull();
    expect(within(side).queryByText('Heltec MeshCore')).toBeNull();
  });

  it('a non-admin with audit:read sees Audit log but not Users; without automations:read, no Automation Engine', async () => {
    renderAt('/overview/map', {
      permissions: { global: { audit: { read: true, write: false } }, bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } },
    });
    const side = await sidebar();
    expect(await within(side).findByRole('link', { name: 'Audit Log' })).toHaveAttribute('href', '/overview/audit');
    expect(within(side).queryByRole('link', { name: 'Users' })).toBeNull();
    expect(within(side).queryByRole('link', { name: 'Automation Engine' })).toBeNull();
  });
});
