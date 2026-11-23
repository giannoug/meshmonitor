/**
 * @vitest-environment jsdom
 *
 * Boards j3-overview-dashboard (desktop) and 16-04-overview-dashboard (phone):
 * the Overview dashboard (Task 8.2, notes ds9, s16n0) at `/overview/dashboard`.
 * One row per device the viewer can read, worked out from what the shell and
 * the page already read (the devices' status polls and the all-devices
 * bundle), each opening that device's dashboard; then the user's own Overview
 * board (`dashboard.overview`, D12) mixing widgets and charts from any device,
 * each tagged with its device. Reading only: nothing here sends on the mesh.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS as S } from '../../__fixtures__/athens';
import { dashboardFixtures, OV, overviewBoard, type DashboardFixtureOptions, type DashboardLog } from '../../__fixtures__/dashboard';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import WorkspaceApp from '../../WorkspaceApp';
import { requests } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const URL_ = '/overview/dashboard';

/** The whole Workspace at `route`, against the Dashboard fixture. */
function renderDashboard(route: string, opts: RenderWorkspaceOptions & { dashboard?: DashboardFixtureOptions } = {}) {
  const log: DashboardLog = { writes: [] };
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderWorkspace(<WorkspaceApp />, { route, ...opts, fixtures: { ...dashboardFixtures(log, opts.dashboard), ...opts.fixtures } });
  return { ...view, log };
}
const READ = { read: true, write: false };
const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const cards = () => screen.getAllByTestId('board-card');
const titles = () => cards().map((c) => within(c).getByRole('heading').textContent);
const devices = () => screen.getByRole('table', { name: 'Devices' });
const deviceRow = (name: string) => within(devices()).getByRole('row', { name: new RegExp(name) });

async function loaded(): Promise<void> {
  await screen.findByTestId('device-rows');
  await screen.findByRole('heading', { name: /^Kifisia Rooftop/ });
  await waitFor(() => {
    if ((screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled) throw new Error('Edit is not enabled yet');
  });
}

async function edit(): Promise<void> {
  await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByRole('list', { name: 'Your board' });
}

async function done(): Promise<void> {
  const button = screen.getByRole('button', { name: 'Done' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
}

describe('j3-overview-dashboard', () => {
  it('j3-overview-dashboard shows the board', async () => {
    const { container } = renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await loaded();
    expect(screen.queryByTestId('page-app')).toBeNull();
    expect(screen.getByTestId('overview-dashboard')).toBeInTheDocument();
    expectBoard('j3-overview-dashboard', container);
  });

  it('16-04-overview-dashboard shows the board', async () => {
    const { container } = renderDashboard(URL_, { phone: true, dashboard: { overview: overviewBoard } });
    await loaded();
    expect(screen.getByRole('link', { name: /Overview/ })).toHaveAttribute('href', '/overview');
    expectBoard('16-04-overview-dashboard', container);
  });

  it("one row per device, from the devices' own numbers, each opening that device's dashboard", async () => {
    renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await loaded();
    const g2 = deviceRow('Station G2');
    await waitFor(() => expect(g2).toHaveTextContent('27%'));
    expect(g2).toHaveTextContent('12 / 47');
    expect(g2).toHaveTextContent('3.1%');
    expect(within(g2).getByText('27%')).toHaveAttribute('data-amber');
    expect(within(g2).getByRole('link', { name: /Station G2/ })).toHaveAttribute('href', `/source/${S.g2}/dashboard`);
    // MeshCore's Dashboard is today's `telemetry` view.
    expect(within(deviceRow('Heltec MeshCore')).getByRole('link', { name: /Heltec MeshCore/ })).toHaveAttribute('href', `/source/${S.heltec}/telemetry`);
    const rak = deviceRow('Rooftop RAK');
    expect(rak).toHaveTextContent('— / 31');
    expect(rak).toHaveTextContent('Disconnected');
    expect(within(devices()).getAllByRole('row')).toHaveLength(6); // header + five devices
  });

  it('every card is tagged with its device, in the saved order, with no write', async () => {
    const { log } = renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await loaded();
    expect(titles()).toEqual([expect.stringContaining('Kifisia Rooftop'), 'Live Mesh Activity', 'Hop Distribution']);
    expect(within(cards()[0]).getByTitle('Station G2')).toHaveTextContent('SG');
    expect(within(cards()[1]).getByTitle('Athens MQTT')).toHaveTextContent('AM');
    expect(within(cards()[2]).getByTitle('Station G2')).toHaveTextContent('SG');
    await pause();
    expect(log.writes).toEqual([]);
  });

  it('with no saved Overview board it is empty, and seeds nothing', async () => {
    const { log } = renderDashboard(URL_);
    await screen.findByTestId('device-rows');
    expect(await screen.findByText('Nothing on your board yet')).toBeInTheDocument();
    await pause();
    expect(log.writes).toEqual([]);
    expect(requests('GET', '/api/settings', `sourceId=`)).toBe(0);
  });
});

describe('Overview dashboard: per-device visibility', () => {
  const ONLY_G2_MQTT = {
    global: {},
    bySource: {
      [S.g2]: { dashboard: READ, nodes: READ },
      [S.mqtt]: { dashboard: READ, nodes: READ },
    },
  };
  const RAK_CHART = `${S.rak}/!a1b2c301-batteryLevel`;
  const withRak = {
    ...overviewBoard,
    widgets: [...overviewBoard.widgets, { id: 'ov-rak', type: 'nodeStatus', nodeIds: ['!a1b2c301'], sourceId: S.rak }],
    charts: [...overviewBoard.charts, { sourceId: S.rak, nodeId: '!a1b2c301', telemetryType: 'batteryLevel' }],
    order: [...overviewBoard.order, 'ov-rak', RAK_CHART],
  };

  it('shows only the devices the viewer can read; a saved widget from another shows no data', async () => {
    renderDashboard(URL_, { permissions: ONLY_G2_MQTT, dashboard: { overview: withRak } });
    await loaded();
    const table = devices();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(table).not.toHaveTextContent('Rooftop RAK');
    expect(table).not.toHaveTextContent('Heltec MeshCore');
    const rak = cards()[3];
    expect(rak).toHaveTextContent('Node Status');
    expect(rak).toHaveTextContent("You don't have permission to do this");
    expect(rak).not.toHaveTextContent('Rooftop RAK');
    expect(rak).not.toHaveTextContent('Kifisia');
    // M7: a chart from that device is titled by its metric alone, with no node name and no device tag.
    const rakChart = cards()[4];
    expect(within(rakChart).getByRole('heading')).toHaveTextContent(/^Battery Level$/);
    expect(rakChart).toHaveTextContent("You don't have permission to do this");
    expect(rakChart).not.toHaveTextContent('Kifisia');
    expect(rakChart).not.toHaveTextContent('Rooftop RAK');
    expect(within(rakChart).queryByTitle('Rooftop RAK')).toBeNull();
    expect(within(rakChart).queryByText('RR')).toBeNull();
    await pause();
    expect(requests('GET', '/api/nodes', `sourceId=${S.rak}`)).toBe(0);
    const unified = vi.mocked(fetch).mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/api/unified/dashboard'));
    expect(unified.length).toBeGreaterThan(0);
    for (const u of unified) expect(decodeURIComponent(u)).not.toContain(S.rak);
  });

  it('without dashboard:read the rows open nothing and the board shows no data', async () => {
    const perms = { global: {}, bySource: { [S.g2]: { messages: READ }, [S.mqtt]: { messages: READ } } };
    renderDashboard(URL_, { permissions: perms, dashboard: { overview: overviewBoard } });
    await screen.findByTestId('device-rows');
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(within(devices()).queryAllByRole('link')).toEqual([]);
    for (const card of cards()) expect(card).toHaveTextContent("You don't have permission to do this");
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await pause();
    expect(requests('GET', '/api/nodes')).toBe(0);
    expect(requests('GET', '/api/packets/stats/node-activity')).toBe(0);
    expect(requests('GET', /^\/api\/telemetry\//)).toBe(0);
  });

  it('M3: a widget from a readable but disabled device says the device is disabled, and reads nothing for it', async () => {
    const sources = athensFixture.sources.map((s) => (s.id === S.mqtt ? { ...s, enabled: false } : s));
    renderDashboard(URL_, { dashboard: { overview: overviewBoard }, fixtures: { 'GET /api/sources': () => sources } });
    await loaded();
    const live = cards()[1];
    expect(live).toHaveTextContent('Athens MQTT is disabled, so this widget shows nothing.');
    expect(live).not.toHaveTextContent("You don't have permission");
    expect(within(devices()).queryByText('Athens MQTT')).toBeNull();
    await pause();
    expect(requests('GET', '/api/nodes', `sourceId=${S.mqtt}`)).toBe(0);
    expect(requests('GET', '/api/packets/stats/node-activity')).toBe(0);
  });
});

describe('Overview dashboard: review fixes', () => {
  it('I1: an Overview chart card has no solar overlay button, even with solar monitoring on', async () => {
    renderDashboard(URL_, {
      dashboard: { overview: overviewBoard },
      fixtures: { 'GET /api/settings': () => ({ ...athensFixture.settings, solarMonitoringEnabled: '1' }) },
    });
    await loaded();
    const chart = cards()[0];
    await within(chart).findByRole('button', { name: 'Export CSV' });
    expect(within(chart).queryByRole('button', { name: /solar/i })).toBeNull();
  });

  it('HY: with two devices on the board, the page adds no timer but the bundle\'s own', async () => {
    const pollingKeys = (qc: QueryClient) =>
      qc.getQueryCache().getAll().flatMap((q) => (q.observers.some((o) => Boolean(o.options.refetchInterval)) ? [JSON.stringify(q.queryKey)] : []));
    const twoDevices = {
      widgets: [
        { id: 'ov-hops', type: 'hopDistribution', sourceId: S.g2 },
        { id: 'ov-status', type: 'nodeStatus', nodeIds: [], sourceId: S.mqtt },
      ],
      order: ['ov-hops', 'ov-status'],
    };
    const empty = renderDashboard(URL_);
    await screen.findByText('Nothing on your board yet');
    await pause();
    const baseline = pollingKeys(empty.queryClient).sort();
    empty.unmount();

    const { queryClient } = renderDashboard(URL_, { dashboard: { overview: twoDevices } });
    await screen.findByRole('heading', { name: 'Node Status' });
    await waitFor(() => expect(requests('GET', '/api/nodes', `sourceId=${S.mqtt}`)).toBe(1));
    await pause();
    // The board's two devices are read once, on the device dashboard's key, with no interval here.
    const nodeQueries = queryClient.getQueryCache().findAll({ queryKey: ['dashboard', 'nodes'] });
    expect(nodeQueries.map((q) => q.queryKey[2]).sort()).toEqual([S.g2, S.mqtt].sort());
    for (const q of nodeQueries) expect(q.observers.filter((o) => Boolean(o.options.refetchInterval))).toEqual([]);
    // Only the bundle's 15 s poll is the page's own, and it has one observer.
    const bundle = queryClient.getQueryCache().findAll({ queryKey: ['dashboard', 'unified-dashboard'] }).filter((q) => q.observers.length > 0);
    expect(bundle).toHaveLength(1);
    expect(bundle[0].observers.filter((o) => Boolean(o.options.refetchInterval))).toHaveLength(1);
    expect(pollingKeys(queryClient).sort()).toEqual(baseline);
    expect(baseline.filter((k) => k.includes('unified-dashboard'))).toHaveLength(1);
  });

  it('M4: Change device in the Add widget sheet leaves the chart help', async () => {
    renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Station G2/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Telemetry chart/ }));
    await screen.findByText("Open the node's page.");
    fireEvent.click(screen.getByRole('button', { name: 'Change device' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Athens MQTT/ }));
    const add = await screen.findByRole('dialog', { name: 'Add widget' });
    expect(within(add).getByRole('button', { name: 'Add Node Status' })).toBeInTheDocument();
    expect(within(add).queryByText("Open the node's page.")).toBeNull();
  });

  it('M5: a chart pinned in this edit is titled by its node name, not its id', async () => {
    renderDashboard(URL_, { dashboard: { overview: { widgets: [overviewBoard.widgets[1]], order: [OV.live] } } });
    await screen.findByRole('heading', { name: 'Live Mesh Activity' });
    const editButton = screen.getByRole('button', { name: 'Edit' });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Add widget' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Station G2/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Telemetry chart/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Add Kifisia Rooftop/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const titles = within(screen.getByRole('list', { name: 'Your board' })).getAllByTestId('row-title').map((r) => r.textContent);
    expect(titles).toEqual(['Live Mesh Activity', 'Kifisia Rooftop']);
  });
});

describe('Overview dashboard: edit', () => {
  it('Add widget picks the device, then the widget; Done writes only dashboard.overview, once', async () => {
    const { log } = renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    const pick = await screen.findByRole('dialog', { name: 'Add widget' });
    // Only devices with a dashboard: not the MeshCore MQTT feed (none here), every readable one.
    fireEvent.click(within(pick).getByRole('button', { name: /Athens MQTT/ }));
    const add = await screen.findByRole('dialog', { name: 'Add widget' });
    expect(add).toHaveTextContent('Athens MQTT');
    fireEvent.click(within(add).getByRole('button', { name: 'Add Distance Distribution' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const list = screen.getByRole('list', { name: 'Your board' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    await done();
    await pause();
    expect(log.writes).toHaveLength(1);
    expect(log.writes[0]).toMatchObject({ method: 'PUT', path: '/api/user/preferences/dashboard.overview' });
    const saved = log.writes[0].body?.value as { widgets: Array<{ type: string; sourceId: string }>; order: string[] };
    expect(saved.widgets.at(-1)).toMatchObject({ type: 'distanceDistribution', sourceId: S.mqtt });
    expect(saved.order).toHaveLength(4);
    expect(requests('POST', '/api/settings')).toBe(0);
  });

  it("a device's starred chart can be pinned; taking a chart off unstars nothing", async () => {
    const { log } = renderDashboard(URL_, { dashboard: { overview: { ...overviewBoard, charts: [], order: [OV.live, OV.hops] } } });
    await screen.findByTestId('device-rows');
    await screen.findByRole('heading', { name: 'Hop Distribution' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add widget' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Station G2/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add widget' })).getByRole('button', { name: /Telemetry chart/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Add Kifisia Rooftop/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await done();
    await screen.findByRole('heading', { name: /^Kifisia Rooftop/ });
    expect(log.writes).toHaveLength(1);
    const saved = log.writes[0].body?.value as { charts: unknown[] };
    expect(saved.charts).toEqual([{ sourceId: S.g2, nodeId: '!a1b2c301', telemetryType: 'batteryLevel' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const list = await screen.findByRole('list', { name: 'Your board' });
    fireEvent.click(within(list).getByRole('button', { name: /^Remove Kifisia Rooftop/ }));
    await done();
    await pause();
    expect(log.writes).toHaveLength(2);
    expect(requests('POST', '/api/settings')).toBe(0);
  });

  it('Escape closes the add sheet only; edit mode stays', async () => {
    renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add widget' });
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('list', { name: 'Your board' })).toBeInTheDocument();
  });
});

describe('Overview dashboard: mesh impact', () => {
  it('opening, editing, saving and re-rendering send nothing over the air', async () => {
    const { log, rerenderWorkspace } = renderDashboard(URL_, { dashboard: { overview: overviewBoard } });
    await loaded();
    await pause();
    // One all-devices bundle; one node read per device on the board, none for the others.
    expect(requests('GET', '/api/unified/dashboard')).toBe(1);
    expect(requests('GET', '/api/nodes', `sourceId=${S.g2}`)).toBe(1);
    expect(requests('GET', '/api/nodes', `sourceId=${S.mqtt}`)).toBe(1);
    expect(requests('GET', '/api/nodes', `sourceId=${S.rak}`)).toBe(0);
    expect(requests('GET', /^\/api\/sources\/[^/]+\/meshcore\/nodes$/)).toBe(0);
    // The device settings the per-device dashboard reads are not read here.
    expect(requests('GET', '/api/settings', 'sourceId=')).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const list = await screen.findByRole('list', { name: 'Your board' });
    fireEvent.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button', { name: 'Move Live Mesh Activity down' }));
    await done();
    rerenderWorkspace();
    await pause();

    const nonGets = vi.mocked(fetch).mock.calls.filter(([u, i]) => (i?.method ?? 'GET') !== 'GET' && !String(u).includes('csrf'));
    expect(nonGets.map(([u, i]) => `${i?.method} ${String(u)}`)).toEqual([expect.stringMatching(/^PUT .*\/api\/user\/preferences\/dashboard\.overview$/)]);
    expect(log.writes).toHaveLength(1);
    const radio = /\/api\/(messages\/send|traceroute|admin|nodes\/[^/]+\/(request|exchange)|position\/request|telemetry\/request)/;
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => radio.test(new URL(String(u), 'http://x').pathname))).toEqual([]);
  });
});
