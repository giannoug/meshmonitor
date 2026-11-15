/**
 * @vitest-environment jsdom
 *
 * Board 5-07-overview-home (phone, s5n0): `/overview` below 768 px is the
 * Overview's own Home under the shell's "Overview ▾" header: tiles for the
 * all-devices tools, then This MeshMonitor (Automations, Users for admins,
 * Audit log with audit:read). The tab bar stays Home · DMs · Activity · You.
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

const renderHome = (opts: RenderWorkspaceOptions = {}) => renderWorkspace(<WorkspaceApp />, { route: '/overview', phone: true, ...opts });
const tileLinks = (name: string) =>
  within(screen.getByRole('navigation', { name })).getAllByRole('link').map((a) => [a.querySelector('[data-row-title]')?.textContent, a.getAttribute('href')]);

describe('5-07-overview-home', () => {
  it('5-07-overview-home shows the board', async () => {
    const { container } = renderHome();
    await screen.findByText('All devices · 4 of 5 connected');
    await screen.findByText('118 nodes');
    expectBoard('5-07-overview-home', container);
  });

  it('the tiles lead to the Overview tools', async () => {
    renderHome();
    await screen.findByText('118 nodes');
    expect(tileLinks('All devices')).toEqual([
      ['All-devices map', '/overview/map'],
      ['Dashboard', '/overview/dashboard'],
      ['Unified Messages', '/overview/messages'],
      ['Unified Telemetry', '/overview/telemetry'],
      ['Unified Packets', '/overview/packets'],
      ['Map Analysis', '/overview/analysis'],
      ['Analysis & Reports', '/overview/reports'],
    ]);
    expect(tileLinks('This MeshMonitor')).toEqual([
      ['Automation Engine', '/overview/automations'],
      ['Users', '/overview/users'],
      ['Audit Log', '/overview/audit'],
    ]);
  });

  it('the header names the Overview and opens the switcher; Home is the current tab', async () => {
    renderHome();
    expect(await screen.findByRole('button', { name: 'Overview: switch device' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('aria-current', 'page');
  });

  it('a non-admin sees no Users tile, and Audit log only with audit:read', async () => {
    renderHome({ permissions: { global: {}, bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } } });
    await screen.findByText('All devices · 1 of 1 connected');
    expect(screen.queryByRole('navigation', { name: 'This MeshMonitor' })).toBeNull();
    expect(screen.queryByText('Users')).toBeNull();
  });

  it('a non-admin with audit:read gets the Audit log tile only', async () => {
    renderHome({ permissions: { global: { audit: { read: true, write: false } }, bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } } });
    await screen.findByText('All devices · 1 of 1 connected');
    expect(tileLinks('This MeshMonitor')).toEqual([['Audit Log', '/overview/audit']]);
  });
});
