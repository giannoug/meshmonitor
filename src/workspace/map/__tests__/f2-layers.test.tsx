/**
 * @vitest-environment jsdom
 *
 * Board f2-layers (desktop): the device map with the Layers drawer open.
 * The drawer holds today's map toggles in Base map / Nodes / Links /
 * Analysis / Overlays (ds2: nothing removed); the extra test reads every
 * `setShow*` off MapContext itself and finds exactly one control for it.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { MapProvider, useMapContext } from '../../../contexts/MapContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import { appBasename } from '../../../init';
import LayersDrawer from '../LayersDrawer';
import { useDeviceLayerGroups } from '../deviceLayerGroups';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/map`;

describe('f2-layers', () => {
  it('f2-layers shows the board', async () => {
    const { container } = renderChat(route);
    fireEvent.click(await screen.findByRole('button', { name: /^Layers/ }));
    const drawer = await screen.findByTestId('layers-drawer');
    await within(drawer).findByText('Ducting');
    expectBoard('f2-layers', container);
  });

  it('folds the less-used toggles behind "N more"', async () => {
    renderChat(route);
    fireEvent.click(await screen.findByRole('button', { name: /^Layers/ }));
    const drawer = await screen.findByTestId('layers-drawer');
    expect(within(drawer).queryByRole('switch', { name: 'Show ATAK Contacts' })).toBeNull();
    fireEvent.click(within(drawer).getByRole('button', { name: /more · .*Show ATAK Contacts/ }));
    expect(within(drawer).getByRole('switch', { name: 'Show ATAK Contacts' })).toBeInTheDocument();
  });

  it('a toggle changes the map at once (MapContext, as today)', async () => {
    renderChat(route);
    fireEvent.click(await screen.findByRole('button', { name: /^Layers/ }));
    const drawer = await screen.findByTestId('layers-drawer');
    const neighbours = within(drawer).getByRole('switch', { name: 'Show Neighbor Info' });
    expect(neighbours).not.toBeChecked();
    expect(screen.queryByText(/click a link for its peek/)).toBeNull();
    fireEvent.click(neighbours);
    expect(neighbours).toBeChecked();
    expect(await screen.findByText(/click a link for its peek/)).toBeInTheDocument();
  });
});

/** Every boolean state on MapContext, by name. */
type Ctx = ReturnType<typeof useMapContext>;
const flags = (ctx: Ctx) =>
  Object.fromEntries(Object.entries(ctx).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>;

/**
 * MapContext setters the device map has no use for, each with its reason. A
 * setter added to MapContext later fails the test below until it is placed in
 * a group or listed here.
 */
const NOT_ON_THE_DEVICE_MAP: Record<string, string> = {
  setShowMeshCoreNodes: 'MeshCore nodes are drawn on the Overview map (DashboardMap) only, never on a Meshtastic device map',
};

describe('every setShow* in MapContext has exactly one control in the Layers drawer', () => {
  let ctx: Ctx;
  function Probe() {
    ctx = useMapContext();
    return null;
  }
  function Drawer() {
    const { groups } = useDeviceLayerGroups({
      mqttOnly: false,
      canUse3D: false,
      viewMode: '2d',
      setViewMode: () => {},
      effective3D: false,
      ownNodePosition: { lat: 37.98, lng: 23.73 },
      aircraftCount: 0,
      agedOutCount: 0,
      listAgeHours: 24,
      capFromQuickFilter: false,
      packetFlightsStats: null,
    });
    return <LayersDrawer groups={groups} onClose={() => {}} />;
  }

  it('maps each setter to one control', async () => {
    renderWorkspace(
      <ToastProvider>
        <SettingsProvider baseUrl={appBasename}>
          <MapProvider>
            <Probe />
            <Drawer />
          </MapProvider>
        </SettingsProvider>
      </ToastProvider>,
      { route },
    );
    const drawer = await screen.findByTestId('layers-drawer');
    await within(drawer).findByText('Ducting');
    for (const more of within(drawer).queryAllByRole('button', { name: /more ·/ })) fireEvent.click(more);

    // The table, read off MapContext: setShowX → showX.
    const table = Object.keys(ctx!)
      .filter((k) => /^setShow/.test(k) && !(k in NOT_ON_THE_DEVICE_MAP))
      .map((setter) => ({ setter, state: setter.replace(/^setS/, 's') }));
    expect(table.length).toBeGreaterThan(15);

    // Flip every switch and checkbox once, including the ones a parent reveals. Last first, so a
    // sub-toggle shown under a parent that starts on is flipped before the parent hides it.
    const controlsFor: Record<string, number> = {};
    const seen = new Set<Element>();
    for (let pass = 0; pass < 5; pass++) {
      const fresh = Array.from(drawer.querySelectorAll('input[type="checkbox"]')).filter((el) => !seen.has(el)).reverse();
      if (fresh.length === 0) break;
      for (const input of fresh) {
        seen.add(input);
        if ((input as HTMLInputElement).disabled || !input.isConnected) continue;
        const before = flags(ctx!);
        fireEvent.click(input);
        await waitFor(() => expect(flags(ctx!)).not.toEqual(before)).catch(() => {});
        const after = flags(ctx!);
        for (const key of Object.keys(after)) if (after[key] !== before[key]) controlsFor[key] = (controlsFor[key] ?? 0) + 1;
      }
    }

    const missing = table.filter(({ state }) => controlsFor[state] !== 1).map(({ setter, state }) => `${setter}: ${controlsFor[state] ?? 0}`);
    expect(missing).toEqual([]);
    // Two more of today's map toggles that are not named show*.
    expect(controlsFor.spreadNodes).toBe(1);
    expect(controlsFor.positionHistoryPointsOnly).toBe(1);
  });
});
