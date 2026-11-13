/**
 * @vitest-environment jsdom
 *
 * Classic chrome under `ShellContext` (#6365, Task 1.4).
 *
 * 1. Without a provider each Classic page renders its chrome exactly as it did
 *    before the hook existed: the snapshots below were recorded on the tree
 *    before any page read `useShellEmbedded()`.
 * 2. With `<ShellContext.Provider value={{ embedded: true }}>` the page's own
 *    chrome (topbar, sidebar, back button) is gone and its body still renders,
 *    because the Workspace shell draws the chrome instead.
 *
 * Page bodies that are not chrome (maps, tabs, report lists) are stubbed: they
 * are not under test, and the real ones need Leaflet or a dozen endpoints.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../workspace/test/renderWorkspace';
import { SOURCE_IDS } from '../../workspace/__fixtures__/athens';
import { ShellContext } from '../ShellContext';

vi.mock('../../components/Dashboard/DashboardMap', () => ({ default: () => <div data-testid="body-dashboard-map" /> }));
vi.mock('../../components/MapAnalysis/MapAnalysisCanvas', () => ({ default: () => <div data-testid="body-analysis-canvas" /> }));
vi.mock('../../components/MapAnalysis/AnalysisInspectorPanel', () => ({ default: () => null }));
vi.mock('../../components/Analysis/AnalysisTab', () => ({ default: () => <div data-testid="body-reports" /> }));
vi.mock('../../components/UsersTab', () => ({ default: () => <div data-testid="body-users" /> }));
vi.mock('../../components/SettingsTab', () => ({ default: () => <div data-testid="body-settings" /> }));
vi.mock('../../components/MeshCore/MeshCoreIngestView', () => ({ MeshCoreIngestView: () => <div data-testid="body-ingest" /> }));
vi.mock('../../hooks/useTxStatus', () => ({ useTxStatus: () => ({ isTxDisabled: false }) }));
vi.mock('../../components/MeshCore/hooks/useMeshCore', () => ({
  useMeshCore: () => ({
    status: { connected: true, deviceType: 1, deviceTypeName: 'Companion', localNode: { name: 'Heltec MeshCore', publicKey: 'ab'.repeat(32) } },
    nodes: [],
    contacts: [],
    messages: [],
    reactionResolutions: [],
    loading: false,
    hasLoadedOnce: true,
    error: null,
    actions: { connect: vi.fn(), clearError: vi.fn(), syncDeviceTime: vi.fn() },
  }),
}));
// One stub per MeshCore view, so a test can see which view is showing.
vi.mock('../../components/MeshCore/MeshCoreNodesView', () => ({ MeshCoreNodesView: () => <div data-testid="mc-view-nodes" /> }));
vi.mock('../../components/MeshCore/MeshCoreChannelsView', () => ({ MeshCoreChannelsView: () => <div data-testid="mc-view-channels" /> }));
vi.mock('../../components/MeshCore/MeshCoreRoomsView', () => ({ MeshCoreRoomsView: () => <div data-testid="mc-view-rooms" /> }));
vi.mock('../../components/MeshCore/MeshCoreDirectMessagesView', () => ({ MeshCoreDirectMessagesView: () => <div data-testid="mc-view-dms" /> }));
vi.mock('../../components/MeshCore/MeshCoreTelemetryView', () => ({ MeshCoreTelemetryView: () => <div data-testid="mc-view-telemetry" /> }));
vi.mock('../../components/MeshCore/MeshCorePacketMonitorView', () => ({ MeshCorePacketMonitorView: () => <div data-testid="mc-view-packets" /> }));
vi.mock('../../components/MeshCore/MeshCoreInfoView', () => ({ MeshCoreInfoView: () => <div data-testid="mc-view-info" /> }));
vi.mock('../../components/MeshCore/MeshCoreConfigurationView', () => ({ MeshCoreConfigurationView: () => <div data-testid="mc-view-configuration" /> }));
vi.mock('../../components/MeshCore/MeshCoreSettingsView', () => ({ MeshCoreSettingsView: () => <div data-testid="mc-view-settings" /> }));
vi.mock('../../components/MeshCore/MeshCoreAutomationsView', () => ({ MeshCoreAutomationsView: () => <div data-testid="mc-view-automations" /> }));
vi.mock('../../components/Reticulum/hooks/useReticulum', () => ({
  useReticulum: () => ({
    status: { connected: true, mode: 'own', destinationCount: 0, interfaceCount: 0 },
    destinations: [],
    interfaces: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    toggleFavorite: vi.fn(),
    conversations: [],
    conversationsLoading: false,
    activePeerHash: null,
    messages: [],
    messagesLoading: false,
    hasMoreMessages: false,
    loadConversation: vi.fn(),
    loadMoreMessages: vi.fn(),
    sendMessage: vi.fn(),
    identity: null,
    paths: [],
    probeResult: null,
    probingHash: null,
    probe: vi.fn(),
    remoteStatus: null,
    remoteStatusLoading: false,
    queryRemoteStatus: vi.fn(),
  }),
}));
vi.mock('../../components/Reticulum/ReticulumDestinationsView', () => ({ ReticulumDestinationsView: () => <div data-testid="rns-view-destinations" /> }));
vi.mock('../../components/Reticulum/ReticulumInterfacesView', () => ({ ReticulumInterfacesView: () => <div data-testid="rns-view-interfaces" /> }));
vi.mock('../../components/Reticulum/ReticulumDmsView', () => ({ ReticulumDmsView: () => <div data-testid="rns-view-dms" /> }));
vi.mock('../../components/Reticulum/ReticulumInfoView', () => ({ ReticulumInfoView: () => <div data-testid="rns-view-info" /> }));
vi.mock('../../components/Reticulum/ReticulumSettingsView', () => ({ ReticulumSettingsView: () => <div data-testid="rns-view-settings" /> }));
vi.mock('../../components/Reticulum/ReticulumMap', () => ({ ReticulumMap: () => <div data-testid="rns-view-map" /> }));
vi.mock('../../components/Reticulum/ReticulumConfigurationView', () => ({ ReticulumConfigurationView: () => <div data-testid="rns-view-configuration" /> }));
vi.mock('../../components/Reticulum/ReticulumPathsView', () => ({ ReticulumPathsView: () => <div data-testid="rns-view-paths" /> }));

import MeshCoreSourcePage from '../../pages/MeshCoreSourcePage';
import MeshCoreIngestSourcePage from '../../pages/MeshCoreIngestSourcePage';
import ReticulumSourcePage from '../../pages/ReticulumSourcePage';
import DashboardPage from '../../pages/DashboardPage';
import MapAnalysisPage from '../../pages/MapAnalysisPage';
import ReportsPage from '../../pages/ReportsPage';
import UnifiedMessagesPage from '../../pages/UnifiedMessagesPage';
import UnifiedTelemetryPage from '../../pages/UnifiedTelemetryPage';
import UnifiedPacketMonitorPage from '../../pages/UnifiedPacketMonitorPage';
import GlobalSettingsPage from '../../pages/GlobalSettingsPage';
import UsersPage from '../../pages/UsersPage';
import PacketMonitorPage from '../../pages/PacketMonitorPage';
import AutomationsPage from '../../components/automations/AutomationsPage';
import { MeshCorePage } from '../../components/MeshCore/MeshCorePage';
import { ReticulumPage } from '../../components/Reticulum/ReticulumPage';
import { SettingsProvider } from '../SettingsContext';
import { WebSocketProvider } from '../WebSocketContext';
import App from '../../App';

/** The generic chrome selectors from the brief. */
const CHROME = 'header, nav, [class*=topbar], [class*=sidebar]';

const BACK_TO_SOURCES = 'Sources';

interface PageCase {
  name: string;
  ui: () => ReactElement;
  route?: string;
  opts?: RenderWorkspaceOptions;
  /** Resolves once the page has rendered its body. */
  ready: (c: HTMLElement) => Element | null;
  /** The page's own chrome: what the shell replaces when embedded. */
  chrome: (c: HTMLElement) => Element[];
  /** Classic only: the chrome has finished loading (e.g. the status chip left "Connecting"). */
  settled?: (c: HTMLElement) => boolean;
}

const statusSettled = (c: HTMLElement) => c.querySelector('.dashboard-topbar .status-indicator.connected') !== null;

const byText = (c: HTMLElement, selector: string, text: string) =>
  [...c.querySelectorAll(selector)].filter((el) => el.textContent?.trim() === text);
const all = (c: HTMLElement, selector: string) => [...c.querySelectorAll(selector)];
const testId = (id: string) => (c: HTMLElement) => c.querySelector(`[data-testid="${id}"]`);

const PAGES: PageCase[] = [
  {
    name: 'App',
    ui: () => (
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    ),
    route: `/source/${SOURCE_IDS.g2}/nodes`,
    ready: (c) => c.querySelector('#main-content'),
    settled: (c) => c.querySelector('.app-header .status-indicator.connected') !== null,
    // AppBanners stay: banners are content, not chrome.
    chrome: (c) => [...all(c, 'header.app-header'), ...all(c, '[data-source-nav][class~=sidebar]')],
  },
  {
    name: 'MeshCoreSourcePage',
    settled: statusSettled,
    ui: () => <MeshCoreSourcePage />,
    route: `/source/${SOURCE_IDS.heltec}/`,
    ready: (c) => c.querySelector('.meshcore-page'),
    chrome: (c) => all(c, '.dashboard-topbar'),
  },
  {
    name: 'MeshCoreIngestSourcePage',
    ui: () => <MeshCoreIngestSourcePage />,
    route: `/source/${SOURCE_IDS.heltec}/`,
    ready: testId('body-ingest'),
    chrome: (c) => all(c, '.dashboard-topbar'),
  },
  {
    name: 'ReticulumSourcePage',
    settled: statusSettled,
    ui: () => <ReticulumSourcePage />,
    route: `/source/${SOURCE_IDS.rns}/`,
    ready: testId('rns-view-destinations'),
    chrome: (c) => all(c, '.dashboard-topbar'),
  },
  {
    name: 'DashboardPage',
    ui: () => <DashboardPage />,
    route: '/',
    ready: testId('body-dashboard-map'),
    // DashboardSidebar is the source list (add/edit/connect/delete): content.
    chrome: (c) => all(c, '.dashboard-topbar'),
  },
  {
    name: 'MapAnalysisPage',
    ui: () => <MapAnalysisPage />,
    route: '/analysis',
    ready: testId('body-analysis-canvas'),
    // The toolbar is content (layers, filters); only its back button is chrome.
    chrome: (c) => all(c, '.map-analysis-back'),
  },
  {
    name: 'ReportsPage',
    ui: () => <ReportsPage />,
    route: '/reports',
    ready: testId('body-reports'),
    chrome: (c) => all(c, '.reports-header'),
  },
  {
    name: 'UnifiedMessagesPage',
    ui: () => (
      <SettingsProvider>
        <UnifiedMessagesPage />
      </SettingsProvider>
    ),
    route: '/unified/messages',
    ready: (c) => c.querySelector('.unified-body'),
    chrome: (c) => byText(c, 'button', BACK_TO_SOURCES),
  },
  {
    name: 'UnifiedTelemetryPage',
    ui: () => <UnifiedTelemetryPage />,
    route: '/unified/telemetry',
    ready: (c) => c.querySelector('.unified-btn-group'),
    chrome: (c) => byText(c, 'button', BACK_TO_SOURCES),
  },
  {
    name: 'UnifiedPacketMonitorPage',
    ui: () => <UnifiedPacketMonitorPage />,
    route: '/unified/packets',
    ready: (c) => c.querySelector('.unified-packets-page'),
    chrome: (c) => all(c, '.unified-packets-back'),
  },
  {
    name: 'GlobalSettingsPage',
    ui: () => <GlobalSettingsPage />,
    route: '/settings',
    ready: testId('body-settings'),
    chrome: (c) => byText(c, 'button', 'Back to Dashboard'),
  },
  {
    name: 'UsersPage',
    ui: () => <UsersPage />,
    route: '/users',
    ready: testId('body-users'),
    chrome: (c) => byText(c, 'button', 'Back to Dashboard'),
  },
  {
    name: 'PacketMonitorPage',
    ui: () => <PacketMonitorPage />,
    route: '/packet-monitor',
    ready: (c) => c.querySelector('.packet-monitor-panel'),
    // A pop-out window's frame: the viewport-sized wrapper and the close (×)
    // button that calls window.close().
    chrome: (c) => [
      ...all(c, ':scope > div[style*="100vw"]'),
      ...all(c, '.packet-monitor-header .close-btn'),
    ],
  },
  {
    name: 'AutomationsPage',
    ui: () => <AutomationsPage />,
    route: '/automations',
    ready: (c) => c.querySelector('.ae-tabs'),
    chrome: (c) => all(c, '.ae-topbar'),
  },
  {
    name: 'MeshCorePage',
    ui: () => <MeshCorePage baseUrl="" sourceId={SOURCE_IDS.heltec} />,
    route: `/source/${SOURCE_IDS.heltec}/`,
    ready: testId('mc-view-nodes'),
    chrome: (c) => all(c, '[data-source-nav-layout] > :not([data-source-nav-content])'),
  },
  {
    name: 'ReticulumPage',
    ui: () => <ReticulumPage baseUrl="" sourceId={SOURCE_IDS.rns} />,
    route: `/source/${SOURCE_IDS.rns}/`,
    ready: testId('rns-view-destinations'),
    chrome: (c) => all(c, '[data-source-nav-layout] > :not([data-source-nav-content])'),
  },
];

/** outerHTML of each outermost chrome element, generic selectors plus the page's own. */
function chromeSnapshot(c: HTMLElement, page: PageCase): string[] {
  const found = new Set<Element>([...c.querySelectorAll(CHROME), ...page.chrome(c)]);
  return [...found]
    .filter((el) => ![...found].some((other) => other !== el && other.contains(el)))
    .map((el) => el.outerHTML);
}

function renderPage(page: PageCase, embedded: boolean | null) {
  const ui = page.ui();
  return renderWorkspace(
    embedded === null ? ui : <ShellContext.Provider value={{ embedded }}>{ui}</ShellContext.Provider>,
    { route: page.route, ...page.opts },
  );
}

describe('Classic chrome without ShellContext (Rule X)', () => {
  it.each(PAGES.map((p) => [p.name, p] as const))('%s renders its chrome as today', async (_name, page) => {
    const { container } = renderPage(page, null);
    await waitFor(() => expect(page.ready(container)).not.toBeNull());
    if (page.settled) await waitFor(() => expect(page.settled!(container)).toBe(true), { timeout: 5000 });
    expect(page.chrome(container).length).toBeGreaterThan(0);
    expect(chromeSnapshot(container, page)).toMatchSnapshot();
  });
});

describe('Classic chrome inside the Workspace shell (embedded)', () => {
  it.each(PAGES.map((p) => [p.name, p] as const))('%s hides its own chrome and keeps its body', async (_name, page) => {
    const { container } = renderPage(page, true);
    await waitFor(() => expect(page.ready(container)).not.toBeNull());
    expect(page.chrome(container)).toEqual([]);
  });

  it('an explicit embedded=false provider renders like no provider', async () => {
    const page = PAGES.find((p) => p.name === 'MeshCoreSourcePage')!;
    const { container } = renderPage(page, false);
    await waitFor(() => expect(page.ready(container)).not.toBeNull());
    expect(page.chrome(container).length).toBeGreaterThan(0);
  });
});

describe('MeshCorePage controlled view', () => {
  it('view="rooms" renders the rooms view and a toolbar click calls onViewChange', async () => {
    const onViewChange = vi.fn();
    const { findByTestId, getByRole, queryByTestId } = renderWorkspace(
      <MeshCorePage baseUrl="" sourceId={SOURCE_IDS.heltec} view="rooms" onViewChange={onViewChange} />,
      { route: `/source/${SOURCE_IDS.heltec}/` },
    );
    expect(await findByTestId('mc-view-rooms')).toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: 'Channels' }));
    expect(onViewChange).toHaveBeenCalledWith('channels');
    // Controlled: the parent did not change `view`, so rooms stays.
    expect(queryByTestId('mc-view-rooms')).toBeInTheDocument();
    expect(queryByTestId('mc-view-channels')).toBeNull();
  });
});

describe('ReticulumPage controlled view', () => {
  it('view="interfaces" renders the interfaces view and a toolbar click calls onViewChange', async () => {
    const onViewChange = vi.fn();
    const { findByTestId, getByRole } = renderWorkspace(
      <ReticulumPage baseUrl="" sourceId={SOURCE_IDS.rns} view="interfaces" onViewChange={onViewChange} />,
      { route: `/source/${SOURCE_IDS.rns}/` },
    );
    expect(await findByTestId('rns-view-interfaces')).toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: 'Destinations' }));
    expect(onViewChange).toHaveBeenCalledWith('destinations');
  });
});
