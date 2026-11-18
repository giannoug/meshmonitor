/**
 * @vitest-environment jsdom
 *
 * Boards j2-dashboard-edit (desktop), k2-dashboard-edit and k3-add-widget
 * (phone): edit mode (Task 8.1). Drag or ↑/↓, remove, Add widget (today's
 * types for the device), Choose tiles. Done saves the board to the user's
 * account once (D12); today's install-wide board (`dashboardWidgets`,
 * `telemetryCustomOrder`) is never written, so Classic's board is unchanged.
 * A starred chart taken off is unstarred for everyone, as in Classic (D19).
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dashboard from '../../../components/Dashboard/Dashboard';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { dashboardSettings, DASH } from '../../__fixtures__/dashboard';
import { boardLoaded, G2, renderDashboard, requests } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const rows = () => within(screen.getByRole('list', { name: 'Your board' })).getAllByRole('listitem');
const rowTitles = () => rows().map((r) => within(r).getByTestId('row-title').textContent);

async function edit() {
  await boardLoaded();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByRole('list', { name: 'Your board' });
}

async function done() {
  const button = screen.getByRole('button', { name: 'Done' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
}

describe('j2-dashboard-edit', () => {
  it('j2-dashboard-edit shows the board', async () => {
    renderDashboard();
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    await screen.findByRole('dialog', { name: 'Add widget' });
    expectBoard('j2-dashboard-edit', document.body);
  });

  it('k2-dashboard-edit shows the board', async () => {
    const { container } = renderDashboard(`${G2}/dashboard`, { phone: true });
    await edit();
    expectBoard('k2-dashboard-edit', container);
  });

  it('k3-add-widget shows the board', async () => {
    renderDashboard(`${G2}/dashboard`, { phone: true });
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    await screen.findByRole('dialog', { name: 'Add widget' });
    expectBoard('k3-add-widget', document.body);
  });

  it("moving with the arrows and Done saves your board once; today's board and Classic stay as they were", async () => {
    const { log, fixtures } = renderDashboard();
    await edit();
    expect(rowTitles()).toEqual(['Node Status', 'Hop Distribution', 'Live Mesh Activity', 'Kifisia Rooftop']);
    fireEvent.click(within(rows()[3]).getByRole('button', { name: 'Move Kifisia Rooftop up' }));
    fireEvent.click(within(rows()[2]).getByRole('button', { name: 'Move Kifisia Rooftop up' }));
    expect(rowTitles()).toEqual(['Node Status', 'Kifisia Rooftop', 'Hop Distribution', 'Live Mesh Activity']);
    expect(log.writes).toEqual([]);
    await done();
    await pause();
    expect(log.writes).toHaveLength(1);
    expect(log.writes[0]).toMatchObject({ method: 'PUT', path: '/api/user/preferences/dashboard.src-g2' });
    expect((log.writes[0].body?.value as { order: string[] }).order).toEqual([DASH.status, DASH.chart, DASH.hops, DASH.live]);
    expect(requests('POST', '/api/settings')).toBe(0);
    const titles = screen.getAllByTestId('board-card').map((c) => within(c).getByRole('heading').textContent);
    expect(titles).toEqual(['Node Status', expect.stringContaining('Kifisia Rooftop'), 'Hop Distribution', 'Live Mesh Activity']);

    // Classic reads the same install-wide board it read before.
    const classic = renderWorkspace(<SettingsProvider baseUrl=""><Dashboard baseUrl="" /></SettingsProvider>, { route: `${G2}/dashboard`, fixtures });
    await within(classic.container).findByText('Live Mesh Activity');
    const classicTitles = Array.from(classic.container.querySelectorAll('.dashboard-chart-title')).map((h) => h.textContent);
    expect(classicTitles.slice(0, 3)).toEqual(['Node Status', 'Hop Distribution', 'Live Mesh Activity']);
    const settings = await (await fetch('/api/settings?sourceId=src-g2')).json();
    expect(settings.dashboardWidgets).toBe(dashboardSettings.dashboardWidgets);
    expect(settings.telemetryCustomOrder).toBe(dashboardSettings.telemetryCustomOrder);
  });

  it('Cancel puts the board back and writes nothing', async () => {
    const { log } = renderDashboard();
    await edit();
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Move Node Status down' }));
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Remove Hop Distribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
    const titles = screen.getAllByTestId('board-card').map((c) => within(c).getByRole('heading').textContent);
    expect(titles.slice(0, 3)).toEqual(['Node Status', 'Hop Distribution', 'Live Mesh Activity']);
    await pause();
    expect(log.writes).toEqual([]);
  });

  it('every row has a drag handle and ↑/↓ on the phone; the ends cannot move further', async () => {
    renderDashboard(`${G2}/dashboard`, { phone: true });
    await edit();
    const all = rows();
    for (const row of all) expect(within(row).getByRole('button', { name: /^Drag / })).toBeInTheDocument();
    expect(within(all[0]).getByRole('button', { name: /up$/ })).toBeDisabled();
    expect(within(all[all.length - 1]).getByRole('button', { name: /down$/ })).toBeDisabled();
  });

  it('Add widget offers today\'s types for the device and adds one to the board on Done', async () => {
    const { log } = renderDashboard();
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add widget' });
    for (const name of ['Node Status', 'Traceroute', 'Hop Distribution', 'Distance Distribution', 'Hop/Distance Heatmap', 'Live Mesh Activity']) {
      expect(within(sheet).getByRole('button', { name: `Add ${name}` })).toBeInTheDocument();
    }
    // Telemetry chart explains starring, as today's help does.
    fireEvent.click(within(sheet).getByRole('button', { name: /Telemetry chart/ }));
    expect(within(sheet).getByText(/Star the chart/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add Traceroute' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add widget' })).toBeNull());
    expect(rowTitles()).toContain('Traceroute');
    expect(log.writes).toEqual([]);
    await done();
    await waitFor(() => expect(log.writes).toHaveLength(1));
    const saved = log.writes[0].body?.value as { widgets: Array<{ type: string }> };
    expect(saved.widgets.map((w) => w.type)).toEqual(['nodeStatus', 'hopDistribution', 'liveMeshActivity', 'traceroute']);
    expect(requests('POST', '/api/settings')).toBe(0);
  });

  it('removing a starred chart unstars it for everyone, as in Classic (D19), and saves the board once', async () => {
    const { log } = renderDashboard();
    await edit();
    fireEvent.click(within(rows()[3]).getByRole('button', { name: 'Remove Kifisia Rooftop' }));
    expect(rowTitles()).not.toContain('Kifisia Rooftop');
    await done();
    await waitFor(() => expect(log.writes).toHaveLength(2));
    const settingsWrite = log.writes.find((w) => w.path === '/api/settings')!;
    expect(settingsWrite.search).toBe('?sourceId=src-g2');
    expect(Object.keys(settingsWrite.body ?? {})).toEqual(['telemetryFavorites']);
    expect(JSON.parse(settingsWrite.body?.telemetryFavorites as string)).toEqual([]);
    expect(log.writes.filter((w) => w.path === '/api/user/preferences/dashboard.src-g2')).toHaveLength(1);
  });

  it('Choose tiles hides a tile on Done, saved with the board', async () => {
    const { log } = renderDashboard();
    await edit();
    expect(screen.getByText('Health tiles · 6 of 9 shown')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose tiles' }));
    const sheet = await screen.findByRole('dialog', { name: 'Health tiles' });
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'New today' }));
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Favorites' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Health tiles · 6 of 9 shown')).toBeInTheDocument();
    await done();
    await waitFor(() => expect(log.writes).toHaveLength(1));
    const strip = screen.getByRole('list', { name: 'Mesh health' });
    expect(within(strip).queryByRole('link', { name: /^New today/ })).toBeNull();
    expect(within(strip).getByRole('link', { name: /^Favorites/ })).toBeInTheDocument();
    expect((log.writes[0].body?.value as { tiles: string[] }).tiles).not.toContain('newToday');
  });

  it('Done with no change writes nothing; Done pressed twice saves once', async () => {
    const { log } = renderDashboard();
    await edit();
    await done();
    await pause();
    expect(log.writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('list', { name: 'Your board' });
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Move Node Status down' }));
    const button = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
    await pause();
    expect(log.writes).toHaveLength(1);
  });
});
