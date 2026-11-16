/**
 * @vitest-environment jsdom
 *
 * Boards 12-13-mqtt-bridge (desktop) and 12-24-mqtt-bridge (phone), Task 5.8:
 * an MQTT bridge source's In MeshMonitor › MQTT bridge on the row kit (state
 * and save shared with today's view through useMqttBridgeConfig). It keeps
 * its own Save in the page's dock, because saving reconnects the upstream
 * broker: an edit sends nothing until Save, and Save is one PUT of the source.
 * The geo status comes from the shell's live status read: no extra request.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderSettings } from './renderSettings';
import { BRIDGE, bridgeFixtures } from './meshmonitorFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
// Leaflet's map needs a real layout engine.
vi.mock('../../../components/BBoxMapEditor', () => ({ default: () => <div data-testid="bbox-editor" /> }));

afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };
const route = `/source/${BRIDGE}/settings/mqtt-bridge`;
const calls = (what: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, init]) => `${init?.method ?? 'GET'} ${new URL(String(u), 'http://x').pathname}` === what);
const writes = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
const dock = () => screen.findByRole('region', { name: 'Unsaved bridge settings' }, T);

async function editUrl() {
  const url = await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
  fireEvent.change(url, { target: { value: 'mqtts://mqtt.athensmesh.gr:8884' } });
  return url;
}

describe('12-13-mqtt-bridge', () => {
  it('12-13-mqtt-bridge shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(route, { fixtures: bridgeFixtures() });
    await screen.findByText(/Last sweep/, {}, T);
    await editUrl();
    expect(await dock()).toHaveTextContent('1 change · Save bridge settings');
    expectBoard('12-13-mqtt-bridge', container);
  });

  it('draws the groups as kit cards, with no Classic heading or select of its own', async () => {
    renderSettings(route, { fixtures: bridgeFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    for (const name of ['Connection', 'Subscribe (incoming)', 'Publish (outgoing)', 'Forwarding', 'Topic rewrites']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('heading', { name: 'MQTT Bridge Configuration' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /LongFast/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('switch', { name: 'Skip raise on packets from this bridge' })).toBeChecked();
  });

  it('keeps its own Save: an edit sends nothing until Save, then one PUT', async () => {
    renderSettings(route, { fixtures: bridgeFixtures() });
    const url = await editUrl();
    fireEvent.blur(url);
    fireEvent.click(screen.getByRole('switch', { name: 'Relay traffic from other bridges' }));
    await act(async () => {});
    expect(writes()).toEqual([]);
    expect(await dock()).toHaveTextContent('2 changes · Save bridge settings');
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes().map(([u, init]) => `${init?.method} ${new URL(String(u), 'http://x').pathname}`)).toEqual([`PUT /api/sources/${BRIDGE}`]));
    const body = JSON.parse(String(writes()[0][1]?.body)) as { config: { upstream: { url: string }; relayOtherBridges: boolean } };
    expect(body.config.upstream.url).toBe('mqtts://mqtt.athensmesh.gr:8884');
    expect(body.config.relayOtherBridges).toBe(true);
  });

  it('Discard puts the saved values back and sends nothing', async () => {
    renderSettings(route, { fixtures: bridgeFixtures() });
    await editUrl();
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T)).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('reads the bridge\'s status once with the shell (the same query), with no poll of its own', async () => {
    renderSettings(route, { fixtures: bridgeFixtures() });
    await screen.findByText(/Last sweep/, {}, T);
    await act(async () => {});
    expect(calls(`GET /api/sources/${BRIDGE}/status`)).toHaveLength(1);
    expect(calls(`GET /api/sources/${BRIDGE}`)).toHaveLength(1);
  });
});

describe('12-24-mqtt-bridge', () => {
  it('12-24-mqtt-bridge shows the board', async () => {
    const { container } = renderSettings(route, { phone: true, fixtures: bridgeFixtures() });
    await editUrl();
    await dock();
    expectBoard('12-24-mqtt-bridge', container);
  });

  it('each group is a summary row that opens it in a sheet', async () => {
    renderSettings(route, { phone: true, fixtures: bridgeFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    const row = screen.getByRole('button', { name: /^Subscribe \(incoming\)/ });
    expect(row).toHaveTextContent('msh/EU_868/GR/# · 1 blocked · Geographic box on');
    expect(screen.getByRole('button', { name: /^Publish \(outgoing\)/ })).toHaveTextContent('Uplink LongFast, Athens · block list');
    fireEvent.click(row);
    const sheet = await screen.findByRole('dialog', { name: 'Subscribe (incoming)' });
    expect(within(sheet).getByRole('switch', { name: 'Block specific topics' })).toBeChecked();
  });
});
