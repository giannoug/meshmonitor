/**
 * @vitest-environment jsdom
 *
 * Board 8-22 (phone): a MeshCore radio's settings list page (Task 7.4): This
 * radio ▾, On the radio · N with each page's summary (Radio's preset, Channels
 * "3 of 8", Contacts, Console "Serial CLI"), In MeshMonitor · N (Connection
 * "TCP"). Also today's settings URLs: `configuration`, its section anchors and
 * `#configuration` open the page that holds them, in the settings frame.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../../components/ToastContainer';
import { meshcoreFixtures } from '../../__fixtures__/meshcore';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-22-settings-list', () => {
  it('8-22-settings-list shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/settings`, { phone: true });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await within(nav).findByText('EU/UK (Narrow)');
    expect(within(nav).getByText('On the radio · 12')).toBeInTheDocument();
    expect(within(nav).getByText('In MeshMonitor · 8')).toBeInTheDocument();
    await within(nav).findByText('3 of 8');
    expect(within(nav).getByText('Serial CLI')).toBeInTheDocument();
    expect(within(nav).getByText('TCP')).toBeInTheDocument();
    expectBoard('8-22-settings-list', container);
  });

  it('opening the list sends nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings`, { phone: true });
    await screen.findByRole('navigation', { name: 'Settings' });
    expect(log.writes).toHaveLength(0);
  });
});

function Where() {
  const { pathname } = useLocation();
  return <span data-testid="where">{pathname}</span>;
}

function renderAt(route: string) {
  Element.prototype.scrollIntoView ??= () => {};
  return renderWorkspace(
    <ToastProvider>
      <Where />
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
    </ToastProvider>,
    { route, fixtures: meshcoreFixtures() },
  );
}

describe('MeshCore settings URLs (Task 7.4: no URL regresses)', () => {
  const where = () => screen.getByTestId('where').textContent;

  it.each([
    // `settings` opens the first page on desktop.
    [`${HELTEC}/configuration`, `${HELTEC}/settings/name`],
    [`${HELTEC}/configuration#meshcore-config-radio`, `${HELTEC}/settings/radio`],
    [`${HELTEC}/configuration#meshcore-channels`, `${HELTEC}/settings/channels`],
    [`${HELTEC}/configuration#meshcore-device-management`, `${HELTEC}/settings/maintenance`],
    [`${HELTEC}/configuration#meshcore-local-console`, `${HELTEC}/settings/console`],
    [`${HELTEC}/#configuration`, `${HELTEC}/settings/name`],
  ])('%s opens %s in the settings frame', async (from, to) => {
    renderAt(from);
    await waitFor(() => expect(where()).toBe(to));
    expect(await screen.findByRole('navigation', { name: 'Settings' })).toBeInTheDocument();
  });

  it('settings opens the first page on desktop; settings/maintenance is the page, not a group', async () => {
    const first = renderAt(`${HELTEC}/settings`);
    await waitFor(() => expect(where()).toBe(`${HELTEC}/settings/name`));
    first.unmount();
    renderAt(`${HELTEC}/settings/maintenance`);
    expect(await screen.findAllByText('Radio contact list')).not.toHaveLength(0);
    expect(where()).toBe(`${HELTEC}/settings/maintenance`);
  });

  it('settings/console without a target is this radio\'s serial console', async () => {
    renderAt(`${HELTEC}/settings/console`);
    expect(await screen.findByRole('region', { name: 'Device console' })).toBeInTheDocument();
    expect(where()).toBe(`${HELTEC}/settings/console`);
  });
});
