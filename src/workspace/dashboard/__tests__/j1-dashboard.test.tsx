/**
 * @vitest-environment jsdom
 *
 * Boards j1-dashboard (desktop) and k1-dashboard (phone): a device's
 * Dashboard (Task 8.1), native at `/source/:id/dashboard`. The Mesh health
 * strip comes from what the page already reads (the device's nodes and status);
 * below it the user's own board (D12), seeded from today's install-wide board
 * with no write until the user edits.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { savedBoard } from '../../__fixtures__/dashboard';
import { boardLoaded, G2, renderDashboard, requests } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const titles = () => screen.getAllByTestId('board-card').map((c) => within(c).getByRole('heading').textContent);

describe('j1-dashboard', () => {
  it('j1-dashboard shows the board', async () => {
    const { container } = renderDashboard(`${G2}/dashboard`, { dashboard: { saved: savedBoard } });
    await boardLoaded();
    await screen.findByText('Live Mesh Activity');
    expect(screen.queryByTestId('page-app')).toBeNull();
    expectBoard('j1-dashboard', container);
  });

  it('k1-dashboard shows the board', async () => {
    const { container } = renderDashboard(`${G2}/dashboard`, { phone: true, dashboard: { saved: savedBoard } });
    await boardLoaded();
    expect(screen.getAllByRole('link', { name: /Home/ }).length).toBeGreaterThan(0);
    expectBoard('k1-dashboard', container);
  });

  it('the strip is worked out from the device and its nodes, and each tile opens its filtered view', async () => {
    renderDashboard();
    await boardLoaded();
    const strip = screen.getByRole('list', { name: 'Mesh health' });
    const tile = (name: string) => within(strip).getByRole('link', { name: new RegExp(`^${name}`) });
    expect(tile('Nodes online')).toHaveTextContent('12');
    expect(tile('Nodes online')).toHaveTextContent('of 47');
    expect(tile('Nodes online')).toHaveAttribute('href', `${G2}/nodes?show=online`);
    // Station G2's own channel utilisation, amber over 25 %.
    expect(tile('Channel util.')).toHaveTextContent('27%');
    expect(tile('Channel util.')).toHaveAttribute('data-amber');
    expect(tile('Channel util.')).toHaveAttribute('href', `${G2}/node/!a1b2c300/telemetry`);
    expect(tile('Airtime TX')).toHaveTextContent('3.1%');
    expect(tile('Airtime TX')).not.toHaveAttribute('data-amber');
    expect(tile('Low battery')).toHaveTextContent(/3.*Athens Rover, Glyfada Beach \+1/);
    expect(tile('Low battery')).toHaveAttribute('href', `${G2}/nodes?show=low-battery`);
    expect(tile('New today')).toHaveTextContent('3');
    expect(tile('New today')).toHaveAttribute('href', `${G2}/nodes?show=new-today`);
    expect(within(strip).getAllByRole('link')).toHaveLength(6);
  });

  it("with no saved board it shows today's board and writes nothing", async () => {
    const { log, rerenderWorkspace } = renderDashboard();
    await boardLoaded();
    await screen.findByRole('heading', { name: /^Kifisia Rooftop/ });
    // Today's order: the widgets, then the starred charts.
    expect(titles()).toEqual(['Node Status', 'Hop Distribution', 'Live Mesh Activity', expect.stringContaining('Kifisia Rooftop')]);
    rerenderWorkspace();
    await pause();
    expect(log.writes).toEqual([]);
  });

  it("a saved board keeps the user's order", async () => {
    renderDashboard(`${G2}/dashboard`, { dashboard: { saved: savedBoard } });
    await boardLoaded();
    await screen.findByRole('heading', { name: /^Kifisia Rooftop/ });
    expect(titles()).toEqual([expect.stringContaining('Kifisia Rooftop'), 'Node Status', 'Hop Distribution', 'Live Mesh Activity']);
  });

  it('the time range re-reads the charts at the new window and writes nothing', async () => {
    const { log } = renderDashboard();
    await boardLoaded();
    const range = screen.getByRole('group', { name: 'Time range' });
    expect(within(range).getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(requests('GET', '/api/telemetry/!a1b2c301', 'hours=24')).toBeGreaterThan(0));
    fireEvent.click(within(range).getByRole('button', { name: '7 d' }));
    await waitFor(() => expect(requests('GET', '/api/telemetry/!a1b2c301', 'hours=168')).toBeGreaterThan(0));
    expect(log.writes).toEqual([]);
  });

  it('a widget setting saves to your account, once, and not to the install-wide board', async () => {
    const { log } = renderDashboard();
    await boardLoaded();
    const live = screen.getAllByTestId('board-card').find((c) => within(c).queryByRole('heading', { name: 'Live Mesh Activity' }))!;
    fireEvent.change(await within(live).findByRole('combobox'), { target: { value: '30' } });
    await waitFor(() => expect(log.writes).toHaveLength(1));
    await pause();
    expect(log.writes).toHaveLength(1);
    expect(log.writes[0]).toMatchObject({ method: 'PUT', path: '/api/user/preferences/dashboard.src-g2' });
    const saved = log.writes[0].body?.value as { widgets: Array<{ id: string; windowMinutes?: number }> };
    expect(saved.widgets.find((w) => w.id === 'w-live')?.windowMinutes).toBe(30);
    expect(requests('POST', '/api/settings')).toBe(0);
  });

  it('without dashboard:read the page is the permission note and reads nothing', async () => {
    renderDashboard(`${G2}/dashboard`, { permissions: { global: {}, bySource: { 'src-g2': { messages: { read: true, write: false } } } } });
    expect(await screen.findByText(/permission/i)).toBeInTheDocument();
    await pause();
    expect(requests('GET', '/api/nodes')).toBe(0);
  });

  it('without dashboard:write the board cannot be edited', async () => {
    renderDashboard(`${G2}/dashboard`, { permissions: { global: {}, bySource: { 'src-g2': { dashboard: { read: true, write: false } } } } });
    await screen.findByText('Nodes online');
    await screen.findByText('Node Status');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  });
});
