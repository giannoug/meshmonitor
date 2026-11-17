/**
 * @vitest-environment jsdom
 *
 * Workspace routes (spec §5.5) and re-hosting (§5.4): every route renders its
 * page embedded, Classic URLs redirect, source URLs pick the page by source
 * type and drive the MeshCore/Reticulum view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../test/renderWorkspace';
import { SOURCE_IDS } from '../__fixtures__/athens';
import WorkspaceApp from '../WorkspaceApp';
import { mounts } from './pageStub';

// One marker element per provider, so a test can count the sockets a route opens.
vi.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => <div data-ws-provider="">{children}</div>,
  useOptionalSocket: () => null,
}));
vi.mock('../../App', async () => ({ default: (await import('./pageStub')).pageStub('app') }));
vi.mock('../../pages/DashboardPage', async () => ({ default: (await import('./pageStub')).pageStub('dashboard') }));
vi.mock('../../components/automations/AutomationsPage', async () => ({ default: (await import('./pageStub')).pageStub('automations') }));
vi.mock('../../pages/UnifiedTelemetryPage', async () => ({ default: (await import('./pageStub')).pageStub('unified-telemetry') }));
vi.mock('../../pages/UnifiedPacketMonitorPage', async () => ({ default: (await import('./pageStub')).pageStub('unified-packets') }));
// Overview › Telemetry and Packets and the MQTT receptions page are the Workspace's own (Task 4.7).
vi.mock('../overview/OverviewTelemetry', async () => ({ default: (await import('./pageStub')).pageStub('overview-telemetry') }));
vi.mock('../overview/OverviewPackets', async () => ({ default: (await import('./pageStub')).pageStub('overview-packets') }));
vi.mock('../overview/users/UsersPage', async () => ({ default: (await import('./pageStub')).pageStub('overview-users') }));
vi.mock('../overview/audit/AuditPage', async () => ({ default: (await import('./pageStub')).pageStub('overview-audit') }));
vi.mock('../tools/MqttReceptions', async () => ({ default: (await import('./pageStub')).pageStub('mqtt-receptions') }));
vi.mock('../../pages/GlobalSettingsPage', async () => ({ default: (await import('./pageStub')).pageStub('global-settings') }));
vi.mock('../../pages/UsersPage', async () => ({ default: (await import('./pageStub')).pageStub('users') }));
vi.mock('../../pages/MeshCoreSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('meshcore') }));
vi.mock('../../pages/MeshCoreIngestSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('meshcore-ingest') }));
vi.mock('../../pages/ReticulumSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('reticulum') }));
vi.mock('../chat/ChannelThread', async () => ({ default: (await import('./pageStub')).pageStub('channel-thread') }));
vi.mock('../chat/DmConversation', async () => ({ default: (await import('./pageStub')).pageStub('dm-conversation') }));
vi.mock('../chat/DmInbox', async () => ({ default: (await import('./pageStub')).pageStub('dm-inbox') }));
vi.mock('../chat/PhoneHome', async () => ({ default: (await import('./pageStub')).pageStub('phone-home') }));
vi.mock('../activity/ActivityFeed', async () => ({ default: (await import('./pageStub')).pageStub('activity') }));
vi.mock('../nodes/NodesPage', async () => ({ default: (await import('./pageStub')).pageStub('nodes') }));
vi.mock('../node-page/NodePage', async () => ({ default: (await import('./pageStub')).pageStub('node-page') }));
vi.mock('../overview/OverviewMap', async () => ({ default: (await import('./pageStub')).pageStub('overview-map') }));
// Reports are the Workspace's own list and report pages (Task 4.4); their tests live in reports/__tests__.
vi.mock('../reports/ReportsRoute', async () => ({ default: (await import('./pageStub')).pageStub('reports-route') }));
vi.mock('../overview/OverviewHome', async () => ({ default: (await import('./pageStub')).pageStub('overview-home') }));
// Overview › Messages and its export are the Workspace's own (Task 4.6); their tests live in overview/__tests__.
vi.mock('../overview/OverviewMessages', async () => ({ default: (await import('./pageStub')).pageStub('overview-messages') }));
vi.mock('../overview/ExportMessagesPage', async () => ({ default: (await import('./pageStub')).pageStub('export-messages') }));
// Device settings are the Workspace's own frame (Task 5.2); their tests live in settings/__tests__.
vi.mock('../settings/SettingsFrame', async () => ({ default: (await import('./pageStub')).pageStub('settings-frame') }));

/** Shows the real URL, and navigates client-side when its input changes. */
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

const goTo = (path: string) => fireEvent.change(screen.getByTestId('goto'), { target: { value: path } });

beforeEach(() => {
  for (const k of Object.keys(mounts)) delete mounts[k];
});

function renderAt(route: string, opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <>
      <WorkspaceApp />
      <RealUrl />
    </>,
    { route, ...opts },
  );
}

const realUrl = () => screen.getByTestId('real-url').textContent;

async function expectPage(name: string) {
  const page = await screen.findByTestId(`page-${name}`);
  expect(page).toHaveTextContent(`${name} body`);
  expect(page).toHaveAttribute('data-embedded', 'true');
  return page;
}

const g2 = `/source/${SOURCE_IDS.g2}`;
const heltec = `/source/${SOURCE_IDS.heltec}`;
const rns = `/source/${SOURCE_IDS.rns}`;

describe('WorkspaceApp routes (spec §5.5)', () => {
  it.each([
    ['/overview/dashboard', 'dashboard'],
    ['/overview/automations', 'automations'],
    ['/automations', 'automations'],
    ['/automations/12', 'automations'],
    ['/automations/12/runs', 'automations'],
    ['/automations/12/trace', 'automations'],
    // Categories Tasks 6.5 and 6.6 rebuild stay re-hosted.
    ['/server/scripts', 'global-settings'],
    // Nodes is the Workspace's own table and list, with App not mounted (Task 3.3, Ruling AD).
    [`${g2}/nodes`, 'nodes'],
    // Device settings are the Workspace's own frame, with App not mounted (Task 5.2, Ruling AD), the remote target too (Task 5.9).
    [`${g2}/settings`, 'settings-frame'],
    [`${g2}/settings/lora`, 'settings-frame'],
    [`/source/${SOURCE_IDS.mqtt}/settings/node-display`, 'settings-frame'],
    [`${g2}/settings?node=`, 'settings-frame'],
    [`${g2}/settings/lora?node=!a1b2c3d4`, 'settings-frame'],
    // A node is the Workspace's own node page, with App not mounted (Task 3.4, Ruling AD).
    [`${g2}/node/!a1b2c301`, 'node-page'],
    [`${g2}/node/!a1b2c301/telemetry`, 'node-page'],
    [`/source/${SOURCE_IDS.mqtt}/node/!a1b2c301/links`, 'node-page'],
    [`${heltec}/node/n1`, 'meshcore'],
    // Activity is the Workspace's own feed on a Meshtastic-family device (Task 2.8, Ruling AD); MeshCore keeps its page.
    [`${g2}/activity`, 'activity'],
    [`/source/${SOURCE_IDS.mqtt}/activity`, 'activity'],
    [`${heltec}/activity`, 'meshcore'],
    // A Meshtastic channel is the Workspace's own thread, with App not mounted (Task 2.3, Ruling AD).
    [`${g2}/channel/0`, 'channel-thread'],
    [`${g2}/channel/0/beacons`, 'channel-thread'],
    [`/source/${SOURCE_IDS.mqtt}/channel/2`, 'channel-thread'],
    [`${g2}/channels`, 'app'],
    // A Meshtastic DM is the Workspace's own conversation, with App not mounted (Task 2.4, Ruling AD).
    [`${g2}/dm/!a1b2c301`, 'dm-conversation'],
    [`/source/${SOURCE_IDS.mqtt}/dm/!a1b2c301`, 'dm-conversation'],
    [`/source/${SOURCE_IDS.mqtt}/nodes`, 'nodes'],
    // The DM inbox is the Workspace's own (Task 2.6, Ruling AD); a desktop bare source URL keeps App.
    [`${g2}/dms`, 'dm-inbox'],
    [`/source/${SOURCE_IDS.mqtt}/dms`, 'dm-inbox'],
    [g2, 'app'],
    [`${heltec}/dms`, 'meshcore'],
    [`${heltec}/room/r1`, 'meshcore'],
    [`${rns}/interfaces`, 'reticulum'],
  ])('%s re-hosts %s', async (route, page) => {
    renderAt(route);
    await expectPage(page);
  });

  it('a node URL with an unknown tab shows the node page and moves to its Overview', async () => {
    renderAt(`${g2}/node/!a1b2c301/bogus`);
    await expectPage('node-page');
    await waitFor(() => expect(realUrl()).toBe(`${g2}/node/!a1b2c301`));
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('Activity does not mount the re-hosted App (one owner per screen)', async () => {
    renderAt(`${g2}/activity`);
    await expectPage('activity');
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('a Meshtastic DM does not mount the re-hosted App (one owner per screen)', async () => {
    renderAt(`${g2}/dm/!a1b2c301`);
    await expectPage('dm-conversation');
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it.each([
    [`${g2}/dms`, 'dm-inbox', false],
    [`${g2}/dms`, 'dm-inbox', true],
    [g2, 'phone-home', true],
  ])('%s shows %s, with App not mounted (one owner per screen; phone: %s)', async (route, page, phone) => {
    renderAt(route, { phone: phone as boolean });
    await expectPage(page as string);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('a MeshCore device keeps its own page on the phone Home URL', async () => {
    renderAt(heltec, { phone: true });
    await expectPage('meshcore');
    expect(screen.queryByTestId('page-phone-home')).toBeNull();
  });

  // The landing jump itself is OverviewMap's (overview/__tests__/OverviewMap.test.tsx).
  it.each([
    ['/', 'overview-map'],
    ['/overview', 'overview-map'],
    ['/overview/map', 'overview-map'],
    // Map Analysis is merged into the all-devices map (Task 4.2, s5n1).
    ['/overview/analysis', 'overview-map'],
    ['/analysis', 'overview-map'],
  ])('%s shows the Workspace all-devices map (Tasks 4.1, 4.2), not today\'s Dashboard or Map Analysis', async (route, page) => {
    renderAt(route);
    expect(await screen.findByTestId(`page-${page}`)).toHaveAttribute('data-embedded', 'false');
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
    expect(screen.queryByTestId('page-analysis')).toBeNull();
    expect(realUrl()).toBe(route);
  });

  it.each(['/overview/reports', '/overview/reports/coverage', '/reports', '/reports/mesh-issues'])(
    '%s shows the Workspace Reports (Task 4.4), not today\'s Reports page',
    async (route) => {
      renderAt(route);
      expect(await screen.findByTestId('page-reports-route')).toHaveAttribute('data-embedded', 'false');
      expect(realUrl()).toBe(route);
    },
  );

  it.each([
    ['/overview/messages', 'overview-messages'],
    ['/unified/messages', 'overview-messages'],
    ['/overview/messages/export', 'export-messages'],
  ])('%s shows the Workspace %s (Task 4.6), not today\'s Unified Messages', async (route, page) => {
    renderAt(route);
    expect(await screen.findByTestId(`page-${page}`)).toHaveAttribute('data-embedded', 'false');
    expect(screen.queryByTestId('page-unified-messages')).toBeNull();
    expect(realUrl()).toBe(route);
  });

  it.each([
    ['/overview/telemetry', 'overview-telemetry'],
    ['/unified/telemetry', 'overview-telemetry'],
    ['/overview/packets', 'overview-packets'],
    ['/unified/packets', 'overview-packets'],
  ])('%s shows the Workspace %s (Task 4.7), not today\'s Unified page', async (route, page) => {
    renderAt(route);
    expect(await screen.findByTestId(`page-${page}`)).toHaveAttribute('data-embedded', 'false');
    expect(screen.queryByTestId('page-unified-telemetry')).toBeNull();
    expect(screen.queryByTestId('page-unified-packets')).toBeNull();
    expect(realUrl()).toBe(route);
  });

  it.each([
    ['/overview/users', 'overview-users'],
    ['/users', 'overview-users'],
    ['/overview/audit', 'overview-audit'],
  ])('%s shows the Workspace %s (Task 4.8), not today\'s page', async (route, page) => {
    renderAt(route);
    expect(await screen.findByTestId(`page-${page}`)).toHaveAttribute('data-embedded', 'false');
    expect(screen.queryByTestId('page-users')).toBeNull();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
    expect(realUrl()).toBe(route);
  });

  it('an MQTT device\'s packet monitor is the Workspace receptions page, with App not mounted (Task 4.7)', async () => {
    renderAt(`/source/${SOURCE_IDS.mqtt}/packetmonitor`);
    expect(await screen.findByTestId('page-mqtt-receptions')).toBeInTheDocument();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('a Meshtastic device\'s packet monitor stays today\'s (Task 8.5)', async () => {
    renderAt(`${g2}/packetmonitor`);
    await expectPage('app');
    expect(screen.queryByTestId('page-mqtt-receptions')).toBeNull();
  });

  it('/overview on a phone is the Overview Home (5-07)', async () => {
    renderAt('/overview', { phone: true });
    await screen.findByTestId('page-overview-home');
    expect(screen.queryByTestId('page-overview-map')).toBeNull();
  });

  it('/you/layout shows the Layout page (Task 1.8)', async () => {
    renderAt('/you/layout');
    expect(await screen.findByText('Only you · on every browser you sign in from')).toBeInTheDocument();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
  });

  it.each([
    ['/server/general', 'Default layout for new users'],
    ['/server/notification-services', 'Links in notifications'],
    ['/server/backup', 'System backups'],
  ])('%s is the Workspace page, with no Classic page mounted (Task 6.4)', async (route, text) => {
    renderAt(route);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId('page-global-settings')).toBeNull();
  });

  it('/you shows the You page (Task 1.7)', async () => {
    renderAt('/you');
    // The page's account head, and the You sidebar's (Task 6.1).
    expect(await screen.findAllByText('Athens Ops')).toHaveLength(2);
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
  });

  it.each([
    ['/preferences/units', 'Units & Formats'],
    ['/preferences/appearance', 'Appearance Mode'],
    ['/preferences/map', 'Map Click Zoom Gate'],
    ['/you/help', 'Show all news'],
  ])('%s is the Workspace page, with no Classic page mounted (Task 6.3)', async (route, text) => {
    renderAt(route);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId('page-global-settings')).toBeNull();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
  });

  it.each([
    ['/you/security', 'Only you · applies to your account on this MeshMonitor'],
    ['/you/token', 'Only you · one token per user, for scripts and automations'],
    ['/you/password', 'Current Password'],
  ])('%s is the Workspace page, with no Classic page mounted (Task 6.1)', async (route, text) => {
    renderAt(route);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
    expect(realUrl()).toBe(route);
  });

  it.each(['/overview/dashboard'])('%s shows today\'s Dashboard without the landing jump', async (route) => {
    renderAt(route);
    await waitFor(() => expect(screen.getByTestId('page-dashboard')).toHaveAttribute('data-show-list', 'true'));
    expect(realUrl()).toBe(route);
  });

  it('renders inside the Workspace shell', async () => {
    const { container } = renderAt('/overview/dashboard');
    const page = await expectPage('dashboard');
    expect(container.querySelector('[data-workspace-shell]')).toContainElement(page);
  });
});

describe('redirects', () => {
  it.each([
    ['/settings', true, '/server/general'],
    // Preferences are the Workspace's own (Task 6.3): no `#settings-` scroll target.
    ['/settings', false, '/preferences/appearance'],
    ['/settings#settings-language', true, '/preferences/language'],
    ['/settings#settings-units', true, '/preferences/language'],
    ['/settings#settings-remote-admin', true, '/server/remote-admin#settings-remote-admin'],
    [`${g2}/configuration`, true, `${g2}/settings`],
    [`${g2}/configuration#config-lora`, true, `${g2}/settings/lora`],
    [`${g2}/settings#settings-node-display`, true, `${g2}/settings/node-display`],
    [`${g2}/admin`, true, `${g2}/settings?node=`],
    [`${g2}/notifications`, true, `${g2}/settings/notifications`],
  ])('%s (admin=%s) lands on %s', async (route, isAdmin, to) => {
    renderAt(route, isAdmin ? {} : { isAdmin: false });
    await waitFor(() => expect(realUrl()).toBe(to));
  });

});

describe('MeshCore and Reticulum views come from the URL', () => {
  it.each([
    [`${heltec}/channels`, 'channels'],
    [`${heltec}/configuration`, 'configuration'],
    [`${heltec}/settings`, 'settings'],
    [`${heltec}/channel/0`, 'channels'],
    [`${heltec}/dm/abcd`, 'dms'],
    [`${heltec}/`, 'nodes'],
  ])('%s → %s', async (route, view) => {
    renderAt(route);
    await expectPage('meshcore');
    expect(screen.getByTestId('view')).toHaveTextContent(view);
    expect(realUrl()).toBe(route);
  });

  it('opens Configuration from the #configuration deep link and puts it in the URL', async () => {
    renderAt(`${heltec}/#configuration`);
    await waitFor(() => expect(realUrl()).toBe(`${heltec}/configuration`));
    expect(screen.getByTestId('view')).toHaveTextContent('configuration');
  });

  it('a view the user cannot open falls back, and the URL follows', async () => {
    renderAt(`${heltec}/channels`, {
      permissions: { bySource: { [SOURCE_IDS.heltec]: { connection: { read: true, write: false }, nodes: { read: true, write: false } } } },
    });
    await waitFor(() => expect(realUrl()).toBe(`${heltec}/nodes`));
    expect(screen.getByTestId('view')).toHaveTextContent('nodes');
  });

  it('a segment MeshCore has no view for goes to the fallback view', async () => {
    renderAt(`${heltec}/admin`);
    await waitFor(() => expect(realUrl()).toBe(`${heltec}/nodes`));
  });

  it('a view change from the page navigates', async () => {
    renderAt(`${heltec}/nodes`);
    await expectPage('meshcore');
    fireEvent.click(screen.getByText('go-channels'));
    await waitFor(() => expect(realUrl()).toBe(`${heltec}/channels`));
    expect(screen.getByTestId('view')).toHaveTextContent('channels');
  });

  it('Reticulum takes its view from the URL', async () => {
    renderAt(`${rns}/paths`);
    await expectPage('reticulum');
    expect(screen.getByTestId('view')).toHaveTextContent('paths');
  });

  it('MeshCore keeps /configuration (the Meshtastic redirect does not apply)', async () => {
    renderAt(`${heltec}/configuration`);
    await expectPage('meshcore');
    expect(realUrl()).toBe(`${heltec}/configuration`);
  });
});

describe('unknown sources (Review Focus 4)', () => {
  it('shows the Overview with a device-not-found state', async () => {
    renderAt('/source/no-such-device/nodes');
    await expectPage('dashboard');
    expect(screen.getByText('This device was not found.')).toBeInTheDocument();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });
});

describe('sockets (Ruling N)', () => {
  it.each([
    [`${g2}/channels`, 'app'],
    [`${heltec}/nodes`, 'meshcore'],
    [`${rns}/destinations`, 'reticulum'],
    ['/overview/reports', 'reports-route'],
    ['/', 'overview-map'],
    ['/source/no-such-device/nodes', 'dashboard'],
  ])('%s has exactly one WebSocketProvider', async (route, page) => {
    const { container } = renderAt(route);
    await (page === 'overview-map' || page === 'reports-route' ? screen.findByTestId(`page-${page}`) : expectPage(page));
    expect(container.querySelectorAll('[data-ws-provider]')).toHaveLength(1);
  });

  it('device settings open no socket (nothing on them is live)', async () => {
    const { container } = renderAt(`${g2}/settings/lora`);
    await expectPage('settings-frame');
    expect(container.querySelectorAll('[data-ws-provider]')).toHaveLength(0);
  });
});

describe('re-hosted pages stay mounted while the URL is fixed up', () => {
  it.each([
    [`${g2}/settings/lora`, `${g2}/settings/modules/mqtt`, `${g2}/settings/modules/mqtt`, 'settings-frame'],
    [`${g2}/settings/identity`, `${g2}/configuration`, `${g2}/settings`, 'settings-frame'],
    [`${g2}/settings/identity`, `${g2}/configuration#config-lora`, `${g2}/settings/lora`, 'settings-frame'],
    ['/server/scripts', '/server/analytics', '/server/analytics#settings-analytics', 'global-settings'],
    [`${heltec}/nodes`, `${heltec}/admin`, `${heltec}/nodes`, 'meshcore'],
    // The rail's Overview square (`/overview`) and the sidebar's All-devices map row (`/overview/map`).
    ['/overview', '/overview/map', '/overview/map', 'overview-map'],
    ['/overview/map', '/overview', '/overview', 'overview-map'],
    ['/', '/overview', '/overview', 'overview-map'],
    // The sidebar's Map Analysis row (Task 4.2): the same map, with the Analysis group open.
    ['/overview/map', '/overview/analysis', '/overview/analysis', 'overview-map'],
    ['/overview/analysis', '/overview/map', '/overview/map', 'overview-map'],
    ['/analysis', '/overview', '/overview', 'overview-map'],
  ])('%s → %s (lands on %s) keeps one %s', async (from, to, lands, page) => {
    renderAt(from);
    await (page === 'overview-map' ? screen.findByTestId('page-overview-map') : expectPage(page));
    goTo(to);
    await waitFor(() => expect(realUrl()).toBe(lands));
    expect(mounts[page]).toBe(1);
  });

  it('an unknown Reticulum segment goes to the default view', async () => {
    renderAt(`${rns}/nodes`);
    await waitFor(() => expect(realUrl()).toBe(`${rns}/destinations`));
    expect(screen.getByTestId('view')).toHaveTextContent('destinations');
    expect(mounts.reticulum).toBe(1);
  });
});
