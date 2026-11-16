/**
 * @vitest-environment jsdom
 *
 * Boards 12-13-mqtt-bridge (desktop) and 12-24-mqtt-bridge (phone), Task 5.8:
 * an MQTT bridge source's In MeshMonitor › MQTT bridge, today's bridge setup.
 * It keeps its own Save, because saving reconnects the upstream broker: an
 * edit sends nothing until Save, and Save is one PUT of the source.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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

describe('12-13-mqtt-bridge', () => {
  it('12-13-mqtt-bridge shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(route, { fixtures: bridgeFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    await screen.findByText(/Last sweep/, {}, T);
    expectBoard('12-13-mqtt-bridge', container);
  });

  it('keeps its own Save: an edit sends nothing until Save, then one PUT', async () => {
    renderSettings(route, { fixtures: bridgeFixtures() });
    const url = await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    fireEvent.change(url, { target: { value: 'mqtts://mqtt.athensmesh.gr:8884' } });
    fireEvent.blur(url);
    await act(async () => {});
    const writes = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
    expect(writes()).toEqual([]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(writes().map(([u, init]) => `${init?.method} ${new URL(String(u), 'http://x').pathname}`)).toEqual([`PUT /api/sources/${BRIDGE}`]));
  });
});

describe('12-24-mqtt-bridge', () => {
  it('12-24-mqtt-bridge shows the board', async () => {
    const { container } = renderSettings(route, { phone: true, fixtures: bridgeFixtures() });
    await screen.findByDisplayValue('mqtts://mqtt.athensmesh.gr:8883', {}, T);
    expectBoard('12-24-mqtt-bridge', container);
  });
});
