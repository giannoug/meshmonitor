/**
 * @vitest-environment jsdom
 *
 * Boards 17-07-outlier-cleanup (desktop) and 17-14-outlier-cleanup (phone),
 * Task 9.2: Clean telemetry outliers from Settings › Data's danger zone, on
 * today's logic (useTelemetryOutlierCleanup). Admins only. A dry run first
 * (today's preview request), then today's plain confirm in a ConfirmSheet, one
 * sheet at a time (D9c), so the board is collected in turn. It deletes rows in
 * MeshMonitor's database and sends nothing on the mesh: opening sends nothing,
 * Preview is the one dry-run request, Delete is one request per press.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, renderSettings } from '../../settings/__tests__/renderSettings';
import { outlierFixtures } from '../../__fixtures__/oddPages';
import OutlierCleanupPage from '../OutlierCleanupPage';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const writes = () =>
  vi.mocked(fetch).mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([u, init]) => `${init?.method} ${new URL(String(u), 'http://x').pathname}`);

/** Opens the sheet from the danger zone, picks Temperature, sets max 60 and runs the preview. */
async function previewSweep() {
  fireEvent.click(await screen.findByRole('button', { name: 'Clean outliers…' }, T));
  const sheet = await screen.findByRole('dialog', { name: 'Clean telemetry outliers' });
  const metric = within(sheet).getByRole('combobox', { name: 'Metric' });
  await waitFor(() => expect(metric).toBeEnabled());
  fireEvent.change(metric, { target: { value: 'temperature' } });
  fireEvent.change(within(sheet).getByLabelText('Remove values above'), { target: { value: '60' } });
  fireEvent.blur(within(sheet).getByLabelText('Remove values above'));
  const preview = within(sheet).getByRole('button', { name: 'Preview' });
  await waitFor(() => expect(preview).toBeEnabled());
  fireEvent.click(preview);
  await within(sheet).findByText('37 of 4,812 readings would be removed, across 3 of 12 nodes.');
  return sheet;
}

describe('17-07-outlier-cleanup', () => {
  it('17-07-outlier-cleanup shows the board (the preview, then the confirm)', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(`${g2}/settings/data`, { fixtures: outlierFixtures() });
    const sheet = await previewSweep();
    expect(within(sheet).getByRole('combobox', { name: 'Source' })).toHaveDisplayValue('Station G2');
    expect(within(sheet).getByRole('combobox', { name: 'Metric' })).toHaveDisplayValue('Temperature');
    const page = document.body.textContent ?? '';
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 37 readings…' }));
    const confirm = await screen.findByRole('dialog', { name: 'Clean telemetry outliers' });
    expect(within(confirm).getByText('Permanently delete 37 readings? This cannot be undone.')).toBeInTheDocument();
    expectBoard('17-07-outlier-cleanup', joined(page, confirm));
  });

  it('17-14-outlier-cleanup shows the board', async () => {
    renderSettings(`${g2}/settings/data`, { phone: true, fixtures: outlierFixtures() });
    const sheet = await previewSweep();
    expect(within(sheet).getByRole('button', { name: 'Delete 37 readings…' })).toBeInTheDocument();
    expectBoard('17-14-outlier-cleanup', sheet);
  });

  it('offers every source in the Source picker, this one picked, as today\'s Settings does', async () => {
    renderSettings(`${g2}/settings/data`, { fixtures: outlierFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Clean outliers…' }, T));
    const source = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Source' });
    await waitFor(() => expect(within(source).getAllByRole('option').length).toBeGreaterThan(2));
    expect(source).toHaveDisplayValue('Station G2');
  });

  it('sends nothing on opening; Preview is one dry run; Delete is one request with the preview\'s cutoff and fingerprint', async () => {
    renderSettings(`${g2}/settings/data`, { fixtures: outlierFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Clean outliers…' }, T));
    await screen.findByRole('dialog');
    expect(writes()).toEqual([]);
    vi.mocked(fetch).mockClear();
    const sheet = await (async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      return previewSweep();
    })();
    expect(writes()).toEqual(['POST /api/purge/telemetry/outliers/preview']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 37 readings…' }));
    const confirm = await screen.findByRole('dialog');
    const yes = within(confirm).getByRole('button', { name: 'Yes, delete' });
    // A plain confirm: no typed word; Enter does not confirm.
    expect(within(confirm).queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(yes).toBeEnabled());
    fireEvent.click(yes);
    fireEvent.click(yes);
    expect(await screen.findByText('Removed 37 readings.')).toBeInTheDocument();
    expect(writes()).toEqual(['POST /api/purge/telemetry/outliers/preview', 'POST /api/purge/telemetry/outliers']);
    const purge = vi.mocked(fetch).mock.calls.find(([u, init]) => init?.method === 'POST' && String(u).endsWith('/api/purge/telemetry/outliers'))!;
    expect(JSON.parse(String(purge[1]?.body))).toMatchObject({ sourceId: SOURCE_IDS.g2, telemetryType: 'temperature', cutoffId: 9001, fingerprint: 'f00d', max: 60 });
  });

  it('Cancel on the confirm goes back to the preview, as today; nothing is deleted', async () => {
    renderSettings(`${g2}/settings/data`, { fixtures: outlierFixtures() });
    const sheet = await previewSweep();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 37 readings…' }));
    const confirm = await screen.findByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    const back = await screen.findByRole('dialog', { name: 'Clean telemetry outliers' });
    expect(within(back).getByTestId('outlier-preview')).toHaveTextContent('37 of 4,812 readings would be removed');
    expect(writes()).toEqual(['POST /api/purge/telemetry/outliers/preview']);
  });

  it('a changed table since the preview: today\'s stale message, back to the form, preview cleared', async () => {
    renderSettings(`${g2}/settings/data`, {
      fixtures: outlierFixtures({
        'POST /api/purge/telemetry/outliers': () => new Response(JSON.stringify({ success: false, error: 'stale', code: 'PREVIEW_STALE' }), { status: 409 }),
      }),
    });
    const sheet = await previewSweep();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 37 readings…' }));
    const yes = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, delete' });
    await waitFor(() => expect(yes).toBeEnabled());
    fireEvent.click(yes);
    const message = await screen.findByText('Telemetry changed since the preview. Run the preview again.');
    const back = message.closest('[role="dialog"]') as HTMLElement;
    expect(within(back).queryByTestId('outlier-preview')).toBeNull();
  });

  it('is admins only, as today: no Clean outliers row for a non-admin', async () => {
    renderSettings(`${g2}/settings/data`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: true }, configuration: { read: true, write: true } } } },
      fixtures: outlierFixtures(),
    });
    await screen.findByRole('button', { name: 'Erase Nodes' }, T);
    expect(screen.queryByRole('button', { name: 'Clean outliers…' })).toBeNull();
  });
});

describe('the Source picker reads the shell\'s sources list', () => {
  it('adds no polling observer and no request of its own to the shell\'s list', async () => {
    const sourceReads = () => vi.mocked(fetch).mock.calls.filter(([u, init]) => (init?.method ?? 'GET') === 'GET' && new URL(String(u), 'http://x').pathname === '/api/sources').length;
    const polling = (client: import('@tanstack/react-query').QueryClient) =>
      client.getQueryCache().find({ queryKey: ['dashboard', 'sources'] })!.observers.filter((o) => o.options.refetchInterval).length;

    // Another settings page of the same device: the shell's own observers.
    const other = renderSettings(`${g2}/settings/node-display`, { fixtures: outlierFixtures() });
    await screen.findAllByText('Node list & map window (hours)', {}, T);
    const baseline = polling(other.queryClient);
    other.unmount();

    const view = renderSettings(`${g2}/settings/data`, { fixtures: outlierFixtures() });
    await screen.findByRole('button', { name: 'Clean outliers…' }, T);
    const query = view.queryClient.getQueryCache().find({ queryKey: ['dashboard', 'sources'] })!;
    expect(polling(view.queryClient)).toBe(baseline);
    expect(query.observers.some((o) => !o.options.refetchInterval)).toBe(true);
    const before = sourceReads();
    fireEvent.click(screen.getByRole('button', { name: 'Clean outliers…' }));
    const source = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Source' });
    expect(within(source).getAllByRole('option').length).toBeGreaterThan(2);
    expect(sourceReads()).toBe(before);
  });
});

describe('outlier sheet from a telemetry chart (node mode)', () => {
  it('has no Source picker and names the node and the metric', async () => {
    renderWorkspace(
      <OutlierCleanupPage isOpen onClose={() => {}} sourceId={SOURCE_IDS.g2} telemetryType="temperature" nodeId="!penteli" nodeLabel="Penteli Hut" getTypeLabel={() => 'Temperature'} />,
      { fixtures: outlierFixtures() },
    );
    const sheet = await screen.findByRole('dialog', { name: 'Clean outliers: Temperature' });
    expect(within(sheet).queryByRole('combobox', { name: 'Source' })).toBeNull();
    expect(within(sheet).getByText(/Penteli Hut's Temperature history/)).toBeInTheDocument();
    // Node mode reads no metric list.
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/outliers/types'))).toBe(false);
  });

});
