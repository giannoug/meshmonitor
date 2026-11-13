/**
 * @vitest-environment jsdom
 *
 * The desktop shell (Task 1.6): rail, sidebar modes, the 768–1023 px drawer,
 * Review Focus 1, 2 and 4, and the hashchange bridge for Classic's SectionNav.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import type { DashboardSource } from '../../../hooks/useDashboardData';
import WorkspaceShell from '../WorkspaceShell';

function RealUrl() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="real-url">{pathname + search + hash}</output>
      <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />
    </>
  );
}

const realUrl = () => screen.getByTestId('real-url').textContent;
const goTo = (path: string) => fireEvent.change(screen.getByTestId('goto'), { target: { value: path } });

function renderShell(route: string, opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <RealUrl />
      </WorkspaceShell>
    </ToastProvider>,
    { route, ...opts },
  );
}

const rail = () => screen.findByRole('navigation', { name: 'Devices' });
const squares = async () =>
  within(await rail())
    .getAllByRole('link')
    .map((a) => a.getAttribute('aria-label'));

describe('DeviceRail', () => {
  it('shows Overview, the devices in API order with unread badges, Add device, Global Settings and You', async () => {
    renderShell('/source/src-g2/nodes');
    await waitFor(async () => expect(await squares()).toContain('Heltec MeshCore, 2 unread'));
    expect(await squares()).toEqual([
      'Overview: all devices',
      // G2: one DM (unread-by-source) plus two on LongFast (the open device's channel unread).
      'Station G2, 3 unread',
      'Heltec MeshCore, 2 unread',
      'Rooftop RAK',
      'Reticulum node',
      'Athens MQTT',
      'Add device',
      'Global Settings',
      'Your account',
    ]);
    const r = await rail();
    expect(within(r).getByRole('link', { name: 'Station G2, 3 unread' })).toHaveAttribute('aria-current', 'page');
    expect(within(r).getByRole('link', { name: 'Add device' })).toHaveAttribute('href', '/server/devices?add=1');
    expect(within(r).getByRole('link', { name: 'Rooftop RAK' })).toHaveAttribute('data-status', 'offline');
  });

  it('drops disabled devices from the rail (ds6)', async () => {
    const sources = athensFixture.sources.map((s) => (s.id === SOURCE_IDS.rak ? { ...s, enabled: false } : s));
    renderShell('/overview', { fixtures: { 'GET /api/sources': () => sources } });
    await waitFor(async () => expect(await squares()).toContain('Athens MQTT'));
    expect(await squares()).not.toContain('Rooftop RAK');
  });

  it('a device square opens the device and the Overview square opens the Overview', async () => {
    renderShell('/overview');
    const r = await rail();
    fireEvent.click(await within(r).findByRole('link', { name: 'Reticulum node' }));
    expect(realUrl()).toBe('/source/src-rns');
    fireEvent.click(within(r).getByRole('link', { name: 'Overview: all devices' }));
    expect(realUrl()).toBe('/overview');
  });

  it('hides Add device and Global Settings from non-admins', async () => {
    renderShell('/overview', {
      permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } },
    });
    await waitFor(async () => expect(await squares()).toContain('Your account'));
    const labels = (await squares()).map((l) => l?.replace(/, \d+ unread$/, ''));
    expect(labels).toEqual(['Overview: all devices', 'Station G2', 'Your account']);
  });

  it('offers Login, not the account avatar, to anonymous viewers', async () => {
    renderShell('/overview', {
      anonymous: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } },
    });
    const r = await rail();
    const login = await within(r).findByRole('button', { name: 'Login' });
    expect(within(r).queryByRole('link', { name: 'Your account' })).toBeNull();
    fireEvent.click(login);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('Review Focus 2: a user who can read only source A gets no square for B', async () => {
    renderShell('/overview', {
      permissions: {
        bySource: {
          [SOURCE_IDS.g2]: { messages: { read: true, write: false } },
          [SOURCE_IDS.heltec]: { messages: { read: false, write: false } },
        },
      },
    });
    await waitFor(async () => expect(await squares()).toContain('Station G2'));
    const labels = await squares();
    for (const name of ['Heltec MeshCore', 'Rooftop RAK', 'Reticulum node', 'Athens MQTT']) {
      expect(labels.some((l) => l?.startsWith(name))).toBe(false);
    }
  });

  it('Review Focus 1: sixteen devices all get a square, in a rail that scrolls', async () => {
    const many: DashboardSource[] = Array.from({ length: 16 }, (_, i) => ({
      id: `src-${i}`,
      name: `Very long device name number ${i} on the Lycabettus hill`,
      type: 'meshtastic_tcp',
      enabled: true,
    }));
    renderShell('/overview', { fixtures: { 'GET /api/sources': () => many, 'GET /api/sources/:id/status': () => ({ connected: true }) } });
    await waitFor(async () => expect((await squares()).filter((l) => l?.startsWith('Very long'))).toHaveLength(16));
    // Layout is checked in Playwright (rail.spec.ts); jsdom has none.
    expect((await rail()).dataset.scroll).toBe('y');
  });
});

describe('DeviceSidebar', () => {
  it('device mode: header with name and status line, tools, Channels and Direct messages', async () => {
    renderShell('/source/src-g2/channels');
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    await within(side).findByText('12 online');
    expect(within(side).getByText('Connected · !a1b2c300')).toBeInTheDocument();
    const links = within(side).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Map', '/source/src-g2/nodes'],
      ['Nodes12 online', '/source/src-g2/nodes'],
      ['Dashboard', '/source/src-g2/dashboard'],
      ['Automation', '/source/src-g2/automation'],
      ['Device Configuration', '/source/src-g2/settings'],
      ['More tools…', '/source/src-g2/info'],
      ['Open channels', '/source/src-g2/channels'],
      ['Message a node', '/source/src-g2/messages'],
    ]);
  });

  it('device mode follows the device type (MeshCore views)', async () => {
    renderShell('/source/src-heltec/nodes');
    const side = await screen.findByRole('complementary', { name: 'Heltec MeshCore' });
    expect(await within(side).findByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/source/src-heltec/telemetry');
    expect(within(side).getByRole('link', { name: 'Message a node' })).toHaveAttribute('href', '/source/src-heltec/dms');
  });

  it('shows an offline device as Disconnected', async () => {
    renderShell('/source/src-rak/nodes');
    const side = await screen.findByRole('complementary', { name: 'Rooftop RAK' });
    expect(await within(side).findByText('Disconnected')).toBeInTheDocument();
  });

  it('collapses a section from its header', async () => {
    renderShell('/source/src-g2/channels');
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    const header = await within(side).findByRole('button', { name: 'Direct messages' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(within(side).queryByRole('link', { name: 'Message a node' })).toBeNull();
  });

  it.each([
    ['/overview/reports', 'Overview', 'Analysis & Reports', '/overview/reports'],
    ['/source/src-g2/settings/lora', 'Station G2', 'LoRa', '/source/src-g2/settings/lora'],
    ['/server/general', 'Global Settings', 'System Backup', '/server/backup'],
    ['/preferences/units', 'Preferences', 'Units & Formats', '/preferences/units'],
  ])('%s shows the %s list', async (route, name, label, href) => {
    renderShell(route);
    const side = await screen.findByRole('complementary', { name });
    expect(await within(side).findByRole('link', { name: label })).toHaveAttribute('href', href);
  });
});

describe('WorkspaceShell layout', () => {
  it('phone: no rail or sidebar (the phone shell is Task 1.7)', async () => {
    renderShell('/source/src-g2/nodes', { phone: true });
    await screen.findByTestId('real-url');
    expect(screen.queryByRole('navigation', { name: 'Devices' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('768–1023 px: the sidebar is a drawer toggled from the header', async () => {
    renderShell('/source/src-g2/nodes', { width: 900 });
    await rail();
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    fireEvent.keyDown(side, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).toBeNull();
    // Following a sidebar link closes the drawer too.
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Dashboard' }));
    expect(realUrl()).toBe('/source/src-g2/dashboard');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('desktop: no drawer button', async () => {
    renderShell('/source/src-g2/nodes');
    await screen.findByRole('complementary', { name: 'Station G2' });
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).toBeNull();
  });
});

describe('Review Focus 4: the open device goes away', () => {
  it('navigates to the Overview with a toast when the open source is removed', async () => {
    let sources = athensFixture.sources;
    renderShell('/source/src-rak/nodes', { fixtures: { 'GET /api/sources': () => sources } });
    await screen.findByRole('complementary', { name: 'Rooftop RAK' });
    sources = athensFixture.sources.filter((s) => s.id !== SOURCE_IDS.rak);
    // Refetch on focus, as a returning tab would.
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(realUrl()).toBe('/overview'));
    expect(await screen.findByText('This device is no longer available.')).toBeInTheDocument();
  });

  it('leaves an unknown source URL alone (WorkspaceSource shows its not-found state)', async () => {
    renderShell('/source/no-such-device/nodes');
    await waitFor(async () => expect(await squares()).toContain('Athens MQTT'));
    expect(realUrl()).toBe('/source/no-such-device/nodes');
  });
});

describe('hashchange bridge (SectionNav)', () => {
  it('fires hashchange on a client-side move to a new #section, not on mount', async () => {
    const onHash = vi.fn();
    window.addEventListener('hashchange', onHash);
    try {
      renderShell('/source/src-g2/settings/lora#config-lora');
      await screen.findByTestId('real-url');
      expect(onHash).not.toHaveBeenCalled();
      goTo('/source/src-g2/settings/power#config-power');
      expect(onHash).toHaveBeenCalledTimes(1);
      goTo('/source/src-g2/nodes');
      expect(onHash).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('hashchange', onHash);
    }
  });
});
