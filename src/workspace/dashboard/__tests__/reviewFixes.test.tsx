/**
 * @vitest-environment jsdom
 *
 * Task 8.1 fix round 1 (rulings HV, HW):
 * - I1 (D19): Done unstars only the charts the draft removed; a star that
 *   arrives during the edit survives, and Done with no change writes nothing.
 * - I2 (N/DM): the Dashboard reads the device status from the shell's poll
 *   and adds no status timer of its own.
 * - I5 (HV): today's filters (search, node, type, role) narrow the board's
 *   charts and write nothing.
 * - M1: a chart row says that removing it unstars it for everyone.
 * - M2: with the preferences read failed, the board cannot be edited, so the
 *   seed never overwrites a saved board.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';
import { dashboardQueryKeys } from '../../../components/Dashboard/hooks/useDashboardData';
import { meshcoreFixtures } from '../../__fixtures__/meshcore';
import { boardLoaded, G2, renderDashboard } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const rows = () => within(screen.getByRole('list', { name: 'Your board' })).getAllByRole('listitem');
const BATTERY = { nodeId: '!a1b2c301', telemetryType: 'batteryLevel' };
const VOLTAGE = { nodeId: '!a1b2c301', telemetryType: 'voltage' };
const TEMPERATURE = { nodeId: '!a1b2c301', telemetryType: 'temperature' };

async function edit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByRole('list', { name: 'Your board' });
}

async function done() {
  const button = screen.getByRole('button', { name: 'Done' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
}

describe('Task 8.1 fix round 1', () => {
  it('I1: a star added elsewhere during the edit survives Done, and Done with no change writes nothing', async () => {
    const { log, fixtures, queryClient } = renderDashboard();
    await boardLoaded();
    // Someone else stars a chart (another tab, another user), and the poll brings it in.
    const starElsewhere = async (stars: object[]) => {
      (fixtures['POST /api/settings'] as FixtureHandler)(new URL('http://localhost/api/settings?sourceId=src-g2'), {
        method: 'POST',
        body: JSON.stringify({ telemetryFavorites: JSON.stringify(stars) }),
      });
      log.writes.length = 0;
      await act(() => queryClient.refetchQueries({ queryKey: dashboardQueryKeys.settings('src-g2') }));
    };

    await edit();
    await starElsewhere([BATTERY, VOLTAGE]);
    await done();
    await pause();
    expect(log.writes).toEqual([]);

    await edit();
    await starElsewhere([BATTERY, VOLTAGE, TEMPERATURE]);
    const battery = rows().find((r) => within(r).queryByText(/Battery Level/))!;
    fireEvent.click(within(battery).getByRole('button', { name: 'Remove Kifisia Rooftop' }));
    await done();
    await waitFor(() => expect(log.writes.some((w) => w.path === '/api/settings')).toBe(true));
    const post = log.writes.find((w) => w.path === '/api/settings')!;
    expect(JSON.parse(post.body?.telemetryFavorites as string)).toEqual([VOLTAGE, TEMPERATURE]);
  });

  // F.2 B-M3: the board is written first, so a failed board write never leaves stars removed for everyone.
  it('a failed board write unstars nothing', async () => {
    const { log } = renderDashboard(undefined, {
      fixtures: { 'PUT /api/user/preferences/:key': () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 }) },
    });
    await boardLoaded();
    await edit();
    const battery = rows().find((r) => within(r).queryByText(/Battery Level/))!;
    fireEvent.click(within(battery).getByRole('button', { name: 'Remove Kifisia Rooftop' }));
    const button = screen.getByRole('button', { name: 'Done' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText('Could not save your dashboard')).toBeInTheDocument();
    await pause();
    expect(log.writes.filter((w) => w.path === '/api/settings')).toEqual([]);
    // The draft stays open for a retry.
    expect(screen.getByRole('list', { name: 'Your board' })).toBeInTheDocument();
  });

  it('I2: the Dashboard adds no status poll of its own: the shell\'s observer is the only one with a timer', async () => {
    const { queryClient } = renderDashboard();
    await boardLoaded();
    const query = queryClient.getQueryCache().find({ queryKey: ['dashboard', 'status', 'src-g2', true] })!;
    expect(query).toBeDefined();
    const polling = query.observers.filter((o) => Boolean(o.options.refetchInterval));
    expect(polling).toHaveLength(1);
    // And the Dashboard still reads the shell's answer: Station G2's own node opens its telemetry.
    expect(screen.getByRole('link', { name: /^Channel util\./ })).toHaveAttribute('href', `${G2}/node/!a1b2c300/telemetry`);
  });

  it('I5: the filters narrow the board to the matching charts and write nothing', async () => {
    const { log } = renderDashboard(`${G2}/dashboard`, {
      fixtures: {
        'GET /api/settings': (u) =>
          u.searchParams.get('sourceId') === 'src-g2'
            ? {
                telemetryFavorites: JSON.stringify([BATTERY, { nodeId: '!a1b2c300', telemetryType: 'channelUtilization' }]),
                dashboardWidgets: JSON.stringify([{ id: 'w-hops', type: 'hopDistribution' }]),
              }
            : {},
      },
    });
    await screen.findByText('Nodes online');
    await waitFor(() => expect(screen.getAllByTestId('board-card')).toHaveLength(3));
    const cards = () => screen.getAllByTestId('board-card').map((c) => within(c).getByRole('heading').textContent);
    expect(cards()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    fireEvent.change(within(sheet).getByRole('combobox', { name: 'Select Node' }), { target: { value: '!a1b2c301' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    // Widgets stay, as today; only the matching charts show.
    expect(cards()).toEqual(['Hop Distribution', expect.stringContaining('Kifisia Rooftop')]);
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('1');
    await pause();
    expect(log.writes).toEqual([]);
  });

  it('M1: a chart row says that removing it unstars it for everyone', async () => {
    renderDashboard();
    await boardLoaded();
    await edit();
    const chartRow = rows().find((r) => within(r).queryByText(/Battery Level/))!;
    expect(chartRow).toHaveTextContent(/unstars it for everyone/);
    expect(rows()[0]).not.toHaveTextContent(/unstars/);
  });

  it('M2: when the preferences read fails, the board cannot be edited and nothing is written', async () => {
    const { log } = renderDashboard(`${G2}/dashboard`, {
      fixtures: { 'GET /api/user/preferences': () => new Response('{}', { status: 500 }) },
    });
    await screen.findByText('Node Status');
    await pause();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    // Widget controls that would save the board are not offered either.
    const status = screen.getAllByTestId('board-card').find((c) => within(c).queryByRole('heading', { name: 'Node Status' }))!;
    expect(within(status).queryByPlaceholderText('Search to add a node...')).toBeNull();
    expect(log.writes).toEqual([]);
  });

  it('I3: on MeshCore, tiles with no data say so and do not link; the others open MeshCore Nodes filtered', async () => {
    renderDashboard('/source/src-heltec/telemetry', { fixtures: meshcoreFixtures() });
    const strip = await screen.findByRole('list', { name: 'Mesh health' });
    await waitFor(() => expect(within(strip).getAllByRole('listitem')[0]).not.toHaveTextContent(/^Nodes online0/));
    const tile = (name: string) => within(strip).getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!;
    expect(tile('Low battery')).toHaveTextContent('—');
    expect(tile('Low battery')).toHaveTextContent('Not reported');
    expect(within(tile('Low battery')).queryByRole('link')).toBeNull();
    expect(within(tile('Nodes online')).getByRole('link')).toHaveAttribute('href', '/source/src-heltec/nodes?show=online');
  });

  it('I3: MeshCore Nodes opens on a tile\'s scope, with a chip that clears it', async () => {
    renderDashboard('/source/src-heltec/nodes?show=direct', { fixtures: meshcoreFixtures() });
    const chip = await screen.findByRole('button', { name: /^Direct/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    const table = await screen.findByRole('table');
    await within(table).findByText('Lycabettus Repeater');
    expect(within(table).queryByText('Nikos T-Echo')).toBeNull();
    fireEvent.click(chip);
    await within(table).findByText('Nikos T-Echo');
  });
});
