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
}));
vi.mock('../../App', async () => ({ default: (await import('./pageStub')).pageStub('app') }));
vi.mock('../../pages/DashboardPage', async () => ({ default: (await import('./pageStub')).pageStub('dashboard') }));
vi.mock('../../pages/MapAnalysisPage', async () => ({ default: (await import('./pageStub')).pageStub('analysis') }));
vi.mock('../../pages/ReportsPage', async () => ({ default: (await import('./pageStub')).pageStub('reports') }));
vi.mock('../../components/automations/AutomationsPage', async () => ({ default: (await import('./pageStub')).pageStub('automations') }));
vi.mock('../../pages/UnifiedMessagesPage', async () => ({ default: (await import('./pageStub')).pageStub('unified-messages') }));
vi.mock('../../pages/UnifiedTelemetryPage', async () => ({ default: (await import('./pageStub')).pageStub('unified-telemetry') }));
vi.mock('../../pages/UnifiedPacketMonitorPage', async () => ({ default: (await import('./pageStub')).pageStub('unified-packets') }));
vi.mock('../../pages/GlobalSettingsPage', async () => ({ default: (await import('./pageStub')).pageStub('global-settings') }));
vi.mock('../../pages/UsersPage', async () => ({ default: (await import('./pageStub')).pageStub('users') }));
vi.mock('../../pages/MeshCoreSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('meshcore') }));
vi.mock('../../pages/MeshCoreIngestSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('meshcore-ingest') }));
vi.mock('../../pages/ReticulumSourcePage', async () => ({ default: (await import('./pageStub')).pageStub('reticulum') }));
vi.mock('../chat/ChannelThread', async () => ({ default: (await import('./pageStub')).pageStub('channel-thread') }));
vi.mock('../chat/DmConversation', async () => ({ default: (await import('./pageStub')).pageStub('dm-conversation') }));
vi.mock('../chat/DmInbox', async () => ({ default: (await import('./pageStub')).pageStub('dm-inbox') }));
vi.mock('../chat/PhoneHome', async () => ({ default: (await import('./pageStub')).pageStub('phone-home') }));

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
    ['/', 'dashboard'],
    ['/overview', 'dashboard'],
    ['/overview/map', 'dashboard'],
    ['/overview/dashboard', 'dashboard'],
    ['/overview/audit', 'dashboard'],
    ['/overview/messages', 'unified-messages'],
    ['/overview/telemetry', 'unified-telemetry'],
    ['/overview/packets', 'unified-packets'],
    ['/overview/analysis', 'analysis'],
    ['/overview/reports', 'reports'],
    ['/overview/reports/coverage', 'reports'],
    ['/overview/automations', 'automations'],
    ['/overview/users', 'users'],
    ['/unified/messages', 'unified-messages'],
    ['/unified/telemetry', 'unified-telemetry'],
    ['/unified/packets', 'unified-packets'],
    ['/analysis', 'analysis'],
    ['/reports', 'reports'],
    ['/automations', 'automations'],
    ['/automations/12', 'automations'],
    ['/automations/12/runs', 'automations'],
    ['/automations/12/trace', 'automations'],
    ['/users', 'users'],
    ['/preferences/units', 'global-settings'],
    ['/server/general', 'global-settings'],
    [`${g2}/nodes`, 'app'],
    [`${g2}/settings`, 'app'],
    [`${g2}/settings/lora`, 'app'],
    [`${g2}/node/!a1b2c301`, 'app'],
    [`${g2}/node/!a1b2c301/telemetry`, 'app'],
    [`${g2}/activity`, 'app'],
    // A Meshtastic channel is the Workspace's own thread, with App not mounted (Task 2.3, Ruling AD).
    [`${g2}/channel/0`, 'channel-thread'],
    [`${g2}/channel/0/beacons`, 'channel-thread'],
    [`/source/${SOURCE_IDS.mqtt}/channel/2`, 'channel-thread'],
    [`${g2}/channels`, 'app'],
    // A Meshtastic DM is the Workspace's own conversation, with App not mounted (Task 2.4, Ruling AD).
    [`${g2}/dm/!a1b2c301`, 'dm-conversation'],
    [`/source/${SOURCE_IDS.mqtt}/dm/!a1b2c301`, 'dm-conversation'],
    [`/source/${SOURCE_IDS.mqtt}/nodes`, 'app'],
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

  it('honours the default landing page only on /', async () => {
    renderAt('/');
    expect(await expectPage('dashboard')).toHaveAttribute('data-show-list', 'false');
  });

  it('/you/layout shows the Layout page (Task 1.8)', async () => {
    renderAt('/you/layout');
    expect(await screen.findByText('Only you · on every browser you sign in from')).toBeInTheDocument();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
  });

  it('/server/general shows the Layout and Sources cards above today\'s General (Task 1.8)', async () => {
    renderAt('/server/general');
    const card = await screen.findByText('Default layout for new users');
    const page = await expectPage('global-settings');
    expect(card.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('/you shows the You page (Task 1.7)', async () => {
    renderAt('/you');
    expect(await screen.findByText('Athens Ops')).toBeInTheDocument();
    expect(screen.queryByTestId('page-dashboard')).toBeNull();
  });

  it.each(['/overview', '/overview/map'])('%s shows the overview without the landing jump', async (route) => {
    renderAt(route);
    await waitFor(() => expect(screen.getByTestId('page-dashboard')).toHaveAttribute('data-show-list', 'true'));
    expect(realUrl()).toBe(route);
  });

  it('renders inside the Workspace shell', async () => {
    const { container } = renderAt('/overview');
    const page = await expectPage('dashboard');
    expect(container.querySelector('[data-workspace-shell]')).toContainElement(page);
  });
});

describe('redirects', () => {
  it.each([
    ['/settings', true, '/server/general'],
    ['/settings', false, '/preferences/appearance#settings-appearance'],
    ['/settings#settings-language', true, '/preferences/language#settings-language'],
    ['/settings#settings-remote-admin', true, '/server/remote-admin#settings-remote-admin'],
    [`${g2}/configuration`, true, `${g2}/settings`],
    [`${g2}/configuration#config-lora`, true, `${g2}/settings/lora#config-lora`],
    [`${g2}/settings#settings-node-display`, true, `${g2}/settings/node-display#settings-node-display`],
    [`${g2}/admin`, true, `${g2}/settings?node=`],
    [`${g2}/notifications`, true, `${g2}/settings/notifications`],
  ])('%s (admin=%s) lands on %s', async (route, isAdmin, to) => {
    renderAt(route, isAdmin ? {} : { isAdmin: false });
    await waitFor(() => expect(realUrl()).toBe(to));
  });

  it.each([
    [`${g2}/settings/lora`, `${g2}/configuration#config-lora`],
    [`${g2}/settings/node-display`, `${g2}/settings#settings-node-display`],
    [`${g2}/settings/notifications`, `${g2}/notifications`],
    [`${g2}/settings?node=`, `${g2}/admin`],
    [`${g2}/settings`, `${g2}/configuration`],
  ])('the re-hosted App at %s sees %s', async (route, seen) => {
    renderAt(route);
    await expectPage('app');
    await waitFor(() => expect(screen.getByTestId('seen-location')).toHaveTextContent(seen));
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
    [`${g2}/nodes`, 'app'],
    [`${heltec}/nodes`, 'meshcore'],
    [`${rns}/destinations`, 'reticulum'],
    ['/overview/reports', 'reports'],
    ['/', 'dashboard'],
    ['/source/no-such-device/nodes', 'dashboard'],
  ])('%s has exactly one WebSocketProvider', async (route, page) => {
    const { container } = renderAt(route);
    await expectPage(page);
    expect(container.querySelectorAll('[data-ws-provider]')).toHaveLength(1);
  });
});

describe('re-hosted pages stay mounted while the URL is fixed up', () => {
  it.each([
    [`${g2}/nodes`, `${g2}/settings/lora`, `${g2}/settings/lora#config-lora`, 'app'],
    [`${g2}/nodes`, `${g2}/configuration`, `${g2}/settings`, 'app'],
    [`${g2}/nodes`, `${g2}/configuration#config-lora`, `${g2}/settings/lora#config-lora`, 'app'],
    ['/server/general', '/server/backup', '/server/backup#settings-backup', 'global-settings'],
    ['/overview', '/overview/map', '/overview/map', 'dashboard'],
    [`${heltec}/nodes`, `${heltec}/admin`, `${heltec}/nodes`, 'meshcore'],
  ])('%s → %s (lands on %s) keeps one %s', async (from, to, lands, page) => {
    renderAt(from);
    await expectPage(page);
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
