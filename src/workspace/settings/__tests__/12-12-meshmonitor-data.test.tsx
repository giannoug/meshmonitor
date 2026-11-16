/**
 * @vitest-environment jsdom
 *
 * Boards 12-12-meshmonitor-data (desktop) and 12-23-meshmonitor-data (phone),
 * Task 5.8: Station G2's In MeshMonitor pages save as you go. 12-12 carries
 * Node display, Packet monitor, Telemetry, PKI DMs, Reliable PKI and Data side
 * by side only to fit the canvas (s12n0); each is its own page, so the test
 * opens each and joins their texts (Ruling 2.3's way).
 *
 * Mesh checklist 3: the rows whose save re-arms a server timer (the inactive
 * check, LocalStats) keep a Save and send nothing until it; an autosaved
 * scheduler setting (aircraft age-out) never writes its last-run timestamp.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, renderSettings } from './renderSettings';
import { meshmonitorFixtures, meshmonitorServer } from './meshmonitorFixtures';
import { posted } from './settingsPosts';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };

async function pageText(category: string, ready: string, act?: () => Promise<void>) {
  const view = renderSettings(`${g2}/settings/${category}`, { fixtures: meshmonitorFixtures() });
  await screen.findAllByText(ready, {}, T);
  await act?.();
  const text = document.body.textContent ?? '';
  view.unmount();
  return text;
}

describe('12-12-meshmonitor-data', () => {
  it('12-12-meshmonitor-data shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const texts = [
      await pageText('node-display', 'Node list & map window (hours)', async () => {
        // A save shows its Saved tick.
        fireEvent.click(screen.getByRole('switch', { name: 'Hide Incomplete Nodes' }));
        await screen.findByText('Saved', {}, T);
      }),
      await pageText('packet-monitor', 'Maximum Packets to Store'),
      await pageText('telemetry', 'Telemetry Visualization (Hours)'),
      await pageText('pki-dm', 'Decrypt PKI direct messages for this source'),
      await pageText('reliable-pki', 'Reliable PKI for this source'),
      await pageText('data', 'Erase Node List'),
    ];
    const all = document.createElement('div');
    all.textContent = texts.join(' ');
    expectBoard('12-12-meshmonitor-data', all);
  });

  it('a toggle saves on change to its own key, with SettingsTab\'s split', async () => {
    renderSettings(`${g2}/settings/node-display`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('switch', { name: 'Hide Incomplete Nodes' }, T));
    await screen.findByText('Saved', {}, T);
    expect(posted()).toEqual([{ path: '/api/settings', sourceId: SOURCE_IDS.g2, body: { hideIncompleteNodes: '1' } }]);
  });

  it('a number saves on blur, not per keystroke; a global key goes to the unscoped POST', async () => {
    renderSettings(`${g2}/settings/packet-monitor`, { fixtures: meshmonitorFixtures() });
    const field = await screen.findByLabelText('Maximum Packets to Store', {}, T);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '20' } });
    fireEvent.change(field, { target: { value: '2000' } });
    await act(async () => {});
    expect(posted()).toEqual([]);
    fireEvent.blur(field);
    await waitFor(() => expect(posted()).toEqual([{ path: '/api/settings', sourceId: null, body: { packet_log_max_count: '2000' } }]));
  });

  it('an invalid number is never sent', async () => {
    renderSettings(`${g2}/settings/telemetry`, { fixtures: meshmonitorFixtures() });
    const field = await screen.findByLabelText('Telemetry Visualization (Hours)', {}, T);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.blur(field);
    await act(async () => {});
    expect(posted()).toEqual([]);
  });

  it('a failed save shows today\'s words and the row goes back to the stored value', async () => {
    renderSettings(`${g2}/settings/node-display`, {
      fixtures: meshmonitorFixtures({ 'POST /api/settings': () => new Response(JSON.stringify({ error: 'no' }), { status: 500 }) }),
    });
    const toggle = await screen.findByRole('switch', { name: 'Hide Incomplete Nodes' }, T);
    fireEvent.click(toggle);
    expect(await screen.findByText('Failed to save settings. Please try again.', {}, T)).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('mesh checklist 3: the inactive-node rows send nothing until their own Save', async () => {
    renderSettings(`${g2}/settings/node-display`, { fixtures: meshmonitorFixtures() });
    const field = await screen.findByLabelText('Inactive Node Check Interval (minutes)', {}, T);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '30' } });
    fireEvent.blur(field);
    await act(async () => {});
    expect(posted()).toEqual([]);
    const card = field.closest('section') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(posted()).toEqual([{ path: '/api/settings', sourceId: SOURCE_IDS.g2, body: { inactiveNodeCheckIntervalMinutes: '30' } }]),
    );
  });

  it('mesh checklist 3: autosaving aircraft age-out leaves its persisted last-run time alone', async () => {
    const server = meshmonitorServer();
    renderSettings(`${g2}/settings/node-display`, { fixtures: server.fixtures });
    fireEvent.click(await screen.findByRole('button', { name: /^Advanced/ }, T));
    fireEvent.click(await screen.findByRole('switch', { name: 'Age out likely aircraft' }, T));
    await screen.findByText('Saved', {}, T);
    expect(posted()).toEqual([{ path: '/api/settings', sourceId: SOURCE_IDS.g2, body: { aircraftAgeOutEnabled: 'true' } }]);
    expect(JSON.stringify(posted())).not.toContain('aircraftAgeOutLastRunAt');
    // The server's row is as it was before the save. Tautological against this fixture, which writes only
    // the keys a POST names: the body assertion above is the real check, as 5.3's lastAnnouncementTime test.
    expect(server.stored(SOURCE_IDS.g2).aircraftAgeOutLastRunAt).toBe('1700000000000');
  });

  it('a viewer without settings:write sees View only and cannot change a row', async () => {
    renderSettings(`${g2}/settings/node-display`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: false }, configuration: { read: true, write: false } } } },
      fixtures: meshmonitorFixtures(),
    });
    const main = await screen.findByRole('main', {}, T);
    expect(await within(main).findByText('View only', {}, T)).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'Hide Incomplete Nodes' }, T)).toBeDisabled();
  });

  it('Data: each purge asks first with today\'s words, then purges this source only', async () => {
    renderSettings(`${g2}/settings/data`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: 'Erase Nodes' }, T));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/erase this source's nodes and traceroute history/)).toBeInTheDocument();
    expect(within(sheet).getByText('Auto-Traceroute and Auto-Time-Sync node selections will be cleared')).toBeInTheDocument();
    expect(within(sheet).getByText('This action cannot be undone!')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Erase Nodes' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/purge/nodes'), expect.objectContaining({ method: 'POST' })));
    const call = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/purge/nodes'))!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ olderThanHours: 0, sourceId: SOURCE_IDS.g2 });
  });
});

describe('Reliable PKI', () => {
  it('is a segmented choice saved on change to this source', async () => {
    renderSettings(`${g2}/settings/reliable-pki`, { fixtures: meshmonitorFixtures() });
    const group = await screen.findByRole('radiogroup', { name: 'Reliable PKI for this source' }, T);
    expect(within(group).getByRole('radio', { name: 'As needed' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Avoid PKI' }));
    await waitFor(() => expect(posted()).toEqual([{ path: '/api/settings', sourceId: SOURCE_IDS.g2, body: { reliablePkiSourceMode: 'avoid' } }]));
    expect(await screen.findByText(/readable by anyone on that channel/, {}, T)).toBeInTheDocument();
  });
});

describe('12-23-meshmonitor-data', () => {
  it('12-23-meshmonitor-data shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/data`, { phone: true, fixtures: meshmonitorFixtures() });
    await screen.findByText('Erase Node List', {}, T);
    expectBoard('12-23-meshmonitor-data', container);
  });
});
