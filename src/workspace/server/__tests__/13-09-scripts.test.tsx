/**
 * @vitest-environment jsdom
 *
 * Boards 13-09 (desktop) and 13-25 (phone), Task 6.5: Server › Scripts. Admins
 * only, as today's section. The cards draw ScriptsSection's states (s13n6);
 * Check for updates reaches GitHub only when pressed; Update, Roll back, Save
 * source, Import and Delete call today's endpoints, and Delete asks first.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/scripts';
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

async function checked() {
  fireEvent.click(await screen.findByRole('button', { name: /Check for updates/ }));
  await screen.findByText('v1.5.0 available');
}

describe('13-09 / 13-25 scripts', () => {
  it.each([
    ['13-09-scripts', false],
    ['13-25-scripts', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findByText('Weather report');
    await checked();
    expectBoard(board, container);
  });

  it('reads the inventory once on open and asks GitHub only on Check for updates', async () => {
    const { log } = renderServer(PATH);
    await screen.findByText('Repeater status');
    await new Promise((r) => setTimeout(r, 50));
    expect(log.reads.filter((r) => r === '/api/scripts/inventory')).toHaveLength(1);
    expect(log.reads).not.toContain('/api/scripts/updates');
    await checked();
    expect(log.reads.filter((r) => r === '/api/scripts/updates')).toHaveLength(1);
  });

  it('draws each card as s13n6: Update and Roll back, only Roll back, only the source field', async () => {
    renderServer(PATH);
    await screen.findByText('Weather report');
    await checked();
    const card = (name: string) => screen.getByRole('article', { name });
    expect(within(card('Weather report')).getByRole('button', { name: /Update/ })).toBeInTheDocument();
    expect(within(card('Weather report')).getByRole('button', { name: /Roll back/ })).toBeInTheDocument();
    expect(within(card('Weather report')).getByText('to v1.3.2')).toBeInTheDocument();
    expect(within(card('Battery alert')).queryByRole('button', { name: /Update|Roll back/ })).toBeNull();
    expect(within(card('Sun times')).queryByRole('button', { name: /^Update$/ })).toBeNull();
    expect(within(card('Sun times')).getByRole('button', { name: /Roll back/ })).toBeInTheDocument();
    expect(within(card('Repeater status')).getByRole('button', { name: 'Save source' })).toBeDisabled();
    expect(within(card('Repeater status')).getByText('Unused')).toBeInTheDocument();
  });

  it('Update, Roll back and Save source send today\'s requests once each', async () => {
    const { log } = renderServer(PATH);
    await screen.findByText('Weather report');
    await checked();
    fireEvent.click(within(screen.getByRole('article', { name: 'Weather report' })).getByRole('button', { name: /Update/ }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/scripts/weather.py/update', body: undefined }));
    fireEvent.click(within(screen.getByRole('article', { name: 'Sun times' })).getByRole('button', { name: /Roll back/ }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/scripts/sun.py/rollback', body: undefined }));
    const repeater = screen.getByRole('article', { name: 'Repeater status' });
    fireEvent.change(within(repeater).getByRole('textbox', { name: 'GitHub path for rpt_status.sh' }), { target: { value: 'athensmesh/scripts/rpt_status.sh' } });
    fireEvent.click(within(repeater).getByRole('button', { name: 'Save source' }));
    await waitFor(() =>
      expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/scripts/rpt_status.sh/source', body: { source: 'athensmesh/scripts/rpt_status.sh' } }),
    );
    expect(log.writes.filter((w) => w.path.endsWith('/update'))).toHaveLength(1);
  });

  it('Delete on a script in use names the automations, Enter does not confirm, and Delete Anyway sends one request', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete weather.py' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete script' });
    expect(within(sheet).getByText('Delete weather.py? It is used by 2 automations listed above, which will break until reconfigured.')).toBeInTheDocument();
    expect(within(sheet).getByText('Auto Responder "Weather bot" · Station G2')).toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form') ?? sheet);
    await new Promise((r) => setTimeout(r, 20));
    expect(log.writes.filter((w) => w.method === 'DELETE')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete Anyway' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/scripts/weather.py', body: undefined }));
  });

  it('Delete on an unused script asks with today\'s plain words', async () => {
    renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete rpt_status.sh' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete script' });
    expect(within(sheet).getByText('Delete rpt_status.sh? This cannot be undone.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('filters by In use and Unused, and searches', async () => {
    renderServer(PATH);
    await screen.findByText('Weather report');
    fireEvent.click(screen.getByRole('radio', { name: 'Unused' }));
    expect(screen.queryByText('Weather report')).toBeNull();
    expect(screen.getByText('Repeater status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search scripts' }), { target: { value: 'sun' } });
    expect(screen.getByText('Sun times')).toBeInTheDocument();
    expect(screen.queryByText('Battery alert')).toBeNull();
  });

  it('shows the dependencies below the cards with today\'s Install', async () => {
    const { log } = renderServer(PATH);
    await screen.findByText('Script Dependencies');
    expect(screen.getByText('requirements.txt found · 2 package(s) installed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Install \/ Update dependencies/ }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/scripts/dependencies/install', body: undefined }));
    expect(await screen.findByText('Installed requests, astral')).toBeInTheDocument();
  });

  it('a settings writer who is not an admin: no permission, nothing read', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().some((u) => u.includes('/api/scripts'))).toBe(false);
  });
});
