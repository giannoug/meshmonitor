/**
 * @vitest-environment jsdom
 *
 * Boards 13-10 (desktop) and 13-26 (phone), Task 6.5: Server › Background
 * jobs. settings:write opens it (s13n2); the settings it saves are install-wide
 * keys the server keeps for admins, so only an admin changes them. Each row
 * saves as you go through today's `POST /api/settings`, and no save starts a
 * run (the schedulers keep their last run in the database).
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { AUTO_ENRICHMENT_STATUS } from '../../__fixtures__/server';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/background-jobs';
const SENDS = 'Sends 1 NodeInfo request over the mesh per enriched node · at most 25 per run, 30 s apart; the rest wait for the next run';
const settingsWrites = (log: { writes: Array<{ path: string; body?: unknown }> }) => log.writes.filter((w) => w.path === '/api/settings').map((w) => w.body);

describe('13-10 / 13-26 background jobs', () => {
  it.each([
    ['13-10-background-jobs', false],
    ['13-26-background-jobs', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findByText(SENDS);
    await screen.findByText('Airtime TX ceiling (%)');
    expectBoard(board, container);
  });

  it('the push toggle carries today\'s caps as its Sends line, and turning it off writes that one key', async () => {
    const { log } = renderServer(PATH);
    expect(await screen.findByText(SENDS)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Also push corrections to the device NodeDB' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ autoEnrichmentPushToNodeDb: 'false' }));
    expect(log.writes.some((w) => w.path.includes('run-now'))).toBe(false);
  });

  it('switching the schedule to cron sends the cron it will use with it', async () => {
    const { log } = renderServer(PATH);
    await screen.findByText(SENDS);
    fireEvent.click(screen.getByRole('radio', { name: 'Cron expression' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ autoEnrichmentScheduleType: 'cron', autoEnrichmentCron: '0 */6 * * *' }));
  });

  it('a rejected schedule shows the server\'s words', async () => {
    renderServer(PATH, {
      fixtures: {
        'POST /api/settings': () => new Response(JSON.stringify({ success: false, error: 'autoEnrichmentCron must be a valid cron expression that fires at most once an hour', code: 'INVALID_AUTO_ENRICHMENT_CRON' }), { status: 400 }),
        'GET /api/settings/auto-enrichment/status': () => ({ success: true, data: { ...AUTO_ENRICHMENT_STATUS, scheduleType: 'cron', cron: '0 */6 * * *' } }),
      },
    });
    const cron = await screen.findByLabelText('Cron expression', { selector: 'input' });
    fireEvent.change(cron, { target: { value: '* * * * *' } });
    fireEvent.blur(cron);
    expect(await screen.findByText('autoEnrichmentCron must be a valid cron expression that fires at most once an hour')).toBeInTheDocument();
  });

  it('position estimation saves each field as its key; Recalculate now runs once', async () => {
    const { log } = renderServer(PATH);
    const freq = await screen.findByLabelText('Calculation frequency');
    fireEvent.change(freq, { target: { value: '12' } });
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ position_estimation_frequency_hours: '12' }));
    const max = screen.getByLabelText('Maximum acceptable accuracy (km)');
    fireEvent.change(max, { target: { value: '3' } });
    fireEvent.blur(max);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ position_estimation_max_uncertainty_km: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate now' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/settings/position-estimation/run-now')).toHaveLength(1));
  });

  it('mesh issues: a threshold, a rule mute (with the legacy B7 key) and Run analysis now', async () => {
    const { log } = renderServer(PATH);
    const air = await screen.findByLabelText('Airtime TX ceiling (%)');
    fireEvent.change(air, { target: { value: '12' } });
    fireEvent.blur(air);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ mesh_issues_air_util_tx_pct: '12' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^A1 / }));
    await waitFor(() =>
      expect(settingsWrites(log)).toContainEqual({ mesh_issues_disabled_rules: 'A1_deprecated_role,B4_idle_router,C1_time_offset', mesh_issues_b7_enabled: 'true' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis now' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/analysis/mesh-issues/run-now')).toHaveLength(1));
  });

  it('coverage retention and solar save as you go; Fetch Estimates Now asks once', async () => {
    const { log } = renderServer(PATH);
    const days = await screen.findByLabelText('RF reception retention (days)');
    fireEvent.change(days, { target: { value: '14' } });
    fireEvent.blur(days);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ coverage_retention_days: '14' }));
    const lat = screen.getByLabelText(/^Latitude/);
    fireEvent.change(lat, { target: { value: '38.1' } });
    fireEvent.blur(lat);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ solarMonitoringLatitude: '38.1' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Solar Monitoring' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ solarMonitoringEnabled: '0' }));
  });

  it('Fetch Estimates Now triggers one solar fetch', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Fetch Estimates Now' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/solar/trigger')).toHaveLength(1));
  });

  it('reads each status once on open: no poll while nothing runs', async () => {
    const { log } = renderServer(PATH);
    await screen.findByText(SENDS);
    await new Promise((r) => setTimeout(r, 100));
    for (const path of ['/api/settings/position-estimation/status', '/api/settings/auto-enrichment/status', '/api/analysis/mesh-issues/status']) {
      expect(log.reads.filter((r) => r === path)).toHaveLength(1);
    }
  });

  it('a settings writer who is not an admin: the rows are view only, the admin runs are off with today\'s reason, Run analysis now stays', async () => {
    const { log } = renderServer(PATH, { permissions: grants({ write: true }) });
    await screen.findByText(SENDS);
    expect(screen.getByText(/Only an administrator can change these settings/)).toBeInTheDocument();
    expect(screen.getByLabelText('Calculation frequency')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Also push corrections to the device NodeDB' })).toBeDisabled();
    const recalc = screen.getByRole('button', { name: 'Recalculate now' });
    expect(recalc).toBeDisabled();
    expect(recalc).toHaveAttribute('title', 'Only an administrator can run this job. It works on every source.');
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis now' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/analysis/mesh-issues/run-now')).toHaveLength(1));
  });

  it('on phone Solar is a page of its own with the 13-10 fields', async () => {
    renderServer(PATH, { phone: true });
    const link = await screen.findByRole('link', { name: /Solar Monitoring/ });
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/background-jobs/solar'));
    expect(await screen.findByLabelText(/^Latitude/)).toHaveValue(37.98);
    const back = screen.getAllByRole('link', { name: /Background jobs/ });
    expect(back.some((a) => a.getAttribute('href') === '/server/background-jobs')).toBe(true);
    expect(within(document.body).getByRole('button', { name: 'Fetch Estimates Now' })).toBeInTheDocument();
  });

  it('settings viewers without write cannot open it', async () => {
    renderServer(PATH, { permissions: grants({ read: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });
});
