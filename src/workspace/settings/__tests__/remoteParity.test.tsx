/**
 * @vitest-environment jsdom
 *
 * Task 5.9 fix round 1: a remote node's pages work as today's Admin Commands
 * does for it (I1, I4, M8, M10), say what they send (M2, M3, I2/M6), and run
 * no timer or poll beyond today's (M4, M5).
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { clearRemote } from '../remote/remoteTargetStore';
import { fetched, g2, goTo, renderSettings } from './renderSettings';
import { HILLTOP, NODE, meshRequests, remoteFixtures, requests } from './remoteFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => clearRemote(SOURCE_IDS.g2));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const T = { timeout: 10_000 };
const page = (category: string) => `${g2}/settings/${category}?node=${NODE}`;
const commands = () => meshRequests().filter((r) => r.what === 'POST /api/admin/commands').map((r) => r.body);
const sidebar = () => screen.getByRole('navigation', { name: 'Settings' });
const readNow = async () => fireEvent.click(await screen.findByRole('button', { name: 'Read from node' }, T));
const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' }, T);

describe('I1: what MeshMonitor knows of the node', () => {
  it('Traffic Management is editable after a read, with no firmware lock', async () => {
    renderSettings(page('modules/trafficmanagement'), { fixtures: remoteFixtures() });
    await readNow();
    const field = await screen.findByLabelText('Minimum Interval (seconds)', {}, T);
    expect(screen.queryByText(/Unsupported by this device/)).toBeNull();
    expect(field).not.toBeDisabled();
  });

  it('Status Message has no MeshMonitor re-apply row on a remote node', async () => {
    renderSettings(page('modules/statusmessage'), { fixtures: remoteFixtures({ 'GET /api/sources/:id/status-message-reapply': () => ({ enabled: false }) }) });
    await readNow();
    await screen.findByText(/Showing values read/, {}, T);
    expect(screen.queryByText(/Unsupported by device firmware/)).toBeNull();
    expect(screen.queryByText('Re-apply after a reboot')).toBeNull();
  });

  it('Protection Level follows the firmware MeshMonitor holds for the node, with no metadata request', async () => {
    renderSettings(page('security'), { fixtures: remoteFixtures() });
    await readNow();
    await screen.findByText(/Showing values read/, {}, T);
    expect(screen.queryByText(/firmware version is not known/)).toBeNull();
    expect(meshRequests().map((r) => r.what)).not.toContain('POST /api/admin/get-device-metadata');
  });

  it('Identity names the node’s own id and role', async () => {
    renderSettings(page('identity'), { fixtures: remoteFixtures() });
    await readNow();
    await screen.findByDisplayValue('HTR', {}, T);
    expect(screen.getByText(NODE)).toBeInTheDocument();
    expect(screen.queryByText('!a1b2c300')).toBeNull();
    expect(screen.getByRole('link', { name: /Device Role/ })).toHaveTextContent('ROUTER');
  });
});

describe('I4: MQTT on a remote node', () => {
  it('goes out with Send to node, one setMQTTConfig, and never touches this radio’s source', async () => {
    renderSettings(page('modules/mqtt'), { fixtures: remoteFixtures({ 'PUT /api/sources/:id': () => ({ success: true }) }) });
    await readNow();
    fireEvent.click(await screen.findByRole('switch', { name: 'Enable MQTT' }, T));
    const b = await bar();
    expect(within(b).getByText('Sends 1 admin packet per changed category')).toBeInTheDocument();
    expect(screen.queryByText(/Quick-configure|Quick configure/)).toBeNull();
    fireEvent.click(within(b).getByRole('button', { name: 'Send to node' }));
    await waitFor(() => expect(commands()).toHaveLength(1), T);
    expect(commands()[0]).toMatchObject({ command: 'setMQTTConfig', nodeNum: HILLTOP });
    expect(requests().filter((r) => r.what.startsWith('PUT /api/sources'))).toEqual([]);
  });
});

describe('M2, M3, M5: what Send and Read say and do', () => {
  it('Review on a remote target says what Send to node sends, with no restart tags', async () => {
    renderSettings(page('device/position'), { fixtures: remoteFixtures() });
    await readNow();
    fireEvent.change(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T), { target: { value: '3600' } });
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Review' }));
    const sheet = await screen.findByRole('dialog', { name: 'Review changes' }, T);
    expect(within(sheet).getByText('Sends 1 admin packet per changed category')).toBeInTheDocument();
    expect(within(sheet).queryByText(/restart/i)).toBeNull();
  });

  it('Read counts the passkey request when no passkey is held', async () => {
    renderSettings(page('device/position'), {
      fixtures: remoteFixtures({ 'POST /api/admin/session-passkey-status': () => ({ success: true, isLocalNode: false, hasPasskey: false, remainingSeconds: null }) }),
    });
    expect(await screen.findByText('Sends 1 request to Hilltop Relay over the mesh, plus 1 for a session passkey, 3 hops', {}, T)).toBeInTheDocument();
  });

  it('two changed categories go out one after another, one command each, in list order', async () => {
    renderSettings(page('device/device'), { fixtures: remoteFixtures() });
    await readNow();
    fireEvent.change(await screen.findByLabelText('Node Info Broadcast Interval (seconds)', {}, T), { target: { value: '7200' } });
    goTo(page('device/position'));
    await readNow();
    fireEvent.change(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T), { target: { value: '3600' } });
    const b = await bar();
    expect(b).toHaveTextContent('2 changes in Device and Position');
    fireEvent.click(within(b).getByRole('button', { name: 'Send to node' }));
    await waitFor(() => expect(commands()).toHaveLength(2), T);
    expect(commands().map((c) => c?.command)).toEqual(['setDeviceConfig', 'setPositionConfig']);
  });
});

describe('M4, M5: no timer beyond today’s', () => {
  it('a remote target reads the node list once, with no poll interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderSettings(page('node-management'), { fixtures: remoteFixtures() });
    await screen.findByRole('heading', { level: 1, name: 'Node management' }, { timeout: 5000 });
    await waitFor(() => expect(fetched().filter((u) => u.includes('/api/poll')).length).toBe(1), { timeout: 15_000 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });
    expect(fetched().filter((u) => u.includes('/api/poll')).length).toBe(1);
    expect(requests().filter((r) => r.what === 'POST /api/admin/session-passkey-status')).toHaveLength(1);
  }, 30_000);

  it('the passkey countdown stops on a node switch and on unmount', async () => {
    const live = new Set<unknown>();
    const realSet = globalThis.setInterval;
    const realClear = globalThis.clearInterval;
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      const id = realSet(fn, ms);
      if (ms === 1000) live.add(id);
      return id;
    }) as typeof setInterval);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(((id: ReturnType<typeof setInterval>) => {
      live.delete(id);
      realClear(id);
    }) as typeof clearInterval);
    const view = renderSettings(page('remote-console'), { fixtures: remoteFixtures() });
    await screen.findByText('meshtastic --dest !7c3e10a2', {}, T);
    const remoteOn = live.size;
    expect(remoteOn).toBeGreaterThanOrEqual(1);
    // Switch node: the old countdown stops as the new one starts.
    fireEvent.click(screen.getByRole('button', { name: /Configuring/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Configuring' }, T)).getByRole('button', { name: /Psychiko Base/ }));
    await screen.findByText('meshtastic --dest !5d21aa07', {}, T);
    expect(live.size).toBe(remoteOn);
    view.unmount();
    expect(live.size).toBe(0);
  });
});

describe('M8, M10, M6: a remote node’s channels', () => {
  const openSlot0 = async (fixtures = {}) => {
    renderSettings(page('channels'), { fixtures: remoteFixtures(fixtures) });
    await readNow();
    fireEvent.click(await screen.findByRole('link', { name: /LongFast/ }, T));
    await screen.findByLabelText('Channel Name', {}, T);
  };

  it('a channel Save shows Sent in the list', async () => {
    await openSlot0();
    fireEvent.change(screen.getByLabelText('Channel Name'), { target: { value: 'Hill' } });
    const dock = await screen.findByRole('region', { name: 'Unsaved channel changes' }, T);
    fireEvent.click(within(dock).getAllByRole('button').find((b) => /Save/.test(b.textContent ?? ''))!);
    await within(sidebar()).findByText('Sent', {}, T);
  });

  it('Delete disables a remote slot with one setChannel, as today’s remote edit does', async () => {
    renderSettings(page('channels'), { fixtures: remoteFixtures() });
    await readNow();
    fireEvent.click(await screen.findByRole('link', { name: /Ridge/ }, T));
    const del = await screen.findByRole('button', { name: /Delete/ }, T);
    expect(screen.getAllByText(/Disables slot 1 on Hilltop Relay/).length).toBeGreaterThan(0);
    fireEvent.click(del);
    const sheet = await screen.findByRole('dialog', {}, T);
    expect(within(sheet).getByText('Sends 1 admin packet to Hilltop Relay over the mesh')).toBeInTheDocument();
    fireEvent.click(within(sheet).getAllByRole('button').find((b) => /Delete/.test(b.textContent ?? '') && !b.hasAttribute('disabled'))!);
    await waitFor(() => expect(commands()).toHaveLength(1), T);
    expect(commands()[0]).toMatchObject({ command: 'setChannel', nodeNum: HILLTOP, channelIndex: 1, config: { name: '', role: 0 } });
    expect(requests().filter((r) => r.what.startsWith('DELETE'))).toEqual([]);
  });

  it('JSON import writes the file’s channel with one setChannel; export needs no request', async () => {
    await openSlot0();
    const before = meshRequests().length;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    window.URL.createObjectURL ??= () => 'blob:x';
    window.URL.revokeObjectURL ??= () => {};
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(meshRequests().length).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
    const sheet = await screen.findByRole('dialog', {}, T);
    expect(within(sheet).getByText('Sends 1 admin packet to Hilltop Relay over the mesh')).toBeInTheDocument();
    const file = new File([JSON.stringify({ channel: { name: 'Ridge', psk: 'AQ==', role: 1 } })], 'c.json', { type: 'application/json' });
    fireEvent.change(sheet.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await within(sheet).findByText(/Ridge/, {}, T);
    fireEvent.click(within(sheet).getByRole('button', { name: /Import Channel|Import/ }));
    await waitFor(() => expect(commands()).toHaveLength(1), T);
    expect(commands()[0]).toMatchObject({ command: 'setChannel', nodeNum: HILLTOP, channelIndex: 0, config: { name: 'Ridge', psk: 'AQ==', role: 1 } });
  });

  it('AEAD reads as unknown on a remote node, not off', async () => {
    await openSlot0();
    expect(screen.getByText(/Whether Hilltop Relay can use AEAD is not known/)).toBeInTheDocument();
  });

  it('config-URL share and import are this radio’s only: no URL control, no import or export request (GE, GH)', async () => {
    renderSettings(page('channels'), { fixtures: remoteFixtures() });
    await readNow();
    await screen.findByRole('link', { name: /LongFast/ }, T);
    expect(screen.queryByRole('link', { name: 'Share and import channels' })).toBeNull();
    // The share page's URL itself is not served for a remote node: it goes back to the channel list.
    goTo(page('channels/share'));
    await waitFor(() => expect(screen.queryByLabelText('Meshtastic Configuration URL')).toBeNull(), T);
    expect(screen.queryByRole('button', { name: 'Decode URL' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import Selected' })).toBeNull();
    expect(requests().filter((r) => /\/(import-config|export-config|encode-url|decode-url)$/.test(r.what))).toEqual([]);
  });
});
