/**
 * @vitest-environment jsdom
 *
 * Board c-home-e2-switcher (Task 1.7): the phone header opens the device
 * switcher sheet: Overview first, then the readable devices in API order with
 * their state and unread, then Add device for admins (notes ds3, ds6).
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

function RealUrl() {
  const { pathname, search } = useLocation();
  return <output data-testid="real-url">{pathname + search}</output>;
}

function renderShell(route: string, opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <RealUrl />
      </WorkspaceShell>
    </ToastProvider>,
    { route, phone: true, ...opts },
  );
}

async function openSwitcher() {
  fireEvent.click(await screen.findByRole('button', { name: /switch device/i }));
  const sheet = await screen.findByRole('dialog', { name: 'Devices' });
  // Statuses and unread arrive on their own polls.
  await within(sheet).findByText('2');
  return sheet;
}

const rowNames = (sheet: HTMLElement) =>
  within(sheet)
    .getAllByRole('link')
    .map((a) => a.querySelector('[data-row-title]')?.textContent?.replace('Receive-only', ''));

describe('c-home-e2-switcher', () => {
  it('c-home-e2-switcher shows the board', async () => {
    renderShell(`/source/${SOURCE_IDS.g2}/channels`);
    await openSwitcher();
    // The whole page, as the board shows the header and tab bar behind the sheet.
    expectBoard('c-home-e2-switcher', document.body);
  });

  it('lists Overview, the devices in API order, then Add device', async () => {
    renderShell(`/source/${SOURCE_IDS.g2}/channels`);
    const sheet = await openSwitcher();
    expect(rowNames(sheet)).toEqual([
      'Overview',
      'Station G2',
      'Heltec MeshCore',
      'Rooftop RAK',
      'Reticulum node',
      'Athens MQTT',
      'Add device',
    ]);
    const current = within(sheet).getByRole('link', { name: /Station G2/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(current).getByText('Meshtastic · Connected')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Rooftop RAK/ })).toHaveTextContent('Meshtastic · Disconnected');
    expect(within(sheet).getByRole('link', { name: /Reticulum node/ })).toHaveTextContent('Reticulum · LXMF messages');
    expect(within(sheet).getByRole('link', { name: /Athens MQTT/ })).toHaveTextContent('Receive-only');
    expect(within(sheet).getByRole('link', { name: /Heltec MeshCore/ })).toHaveTextContent('2');
    expect(within(sheet).getByRole('link', { name: 'Add device' })).toHaveAttribute('href', '/server/devices?add=1');
  });

  it('drops disabled devices and hides Add device from non-admins', async () => {
    const sources = athensFixture.sources.map((s) => (s.id === SOURCE_IDS.rak ? { ...s, enabled: false } : s));
    renderShell('/overview', {
      isAdmin: false,
      permissions: { bySource: Object.fromEntries(athensFixture.sources.map((s) => [s.id, { nodes: { read: true, write: false } }])) },
      fixtures: { 'GET /api/sources': () => sources },
    });
    const sheet = await openSwitcher();
    expect(rowNames(sheet)).toEqual(['Overview', 'Station G2', 'Heltec MeshCore', 'Reticulum node', 'Athens MQTT']);
  });

  it('a device row opens the device and closes the sheet', async () => {
    renderShell('/overview');
    const sheet = await openSwitcher();
    fireEvent.click(within(sheet).getByRole('link', { name: /Reticulum node/ }));
    expect(screen.getByTestId('real-url').textContent).toBe(`/source/${SOURCE_IDS.rns}`);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the header shows the open device and the Overview elsewhere', async () => {
    renderShell(`/source/${SOURCE_IDS.g2}/channels`);
    const button = await screen.findByRole('button', { name: /switch device/i });
    await waitFor(() => expect(button).toHaveTextContent('Connected · 12 online'));
    expect(button).toHaveTextContent('Station G2');
  });

  it('has no header on You pages', async () => {
    renderShell('/you');
    await screen.findByRole('navigation', { name: 'Tabs' });
    expect(screen.queryByRole('button', { name: /switch device/i })).toBeNull();
  });
});
