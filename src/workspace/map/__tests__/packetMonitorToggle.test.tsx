/**
 * @vitest-environment jsdom
 *
 * D2: the Layers sheet on a phone has no Packet monitor toggle (the panel is
 * not part of the phone map); the desktop drawer keeps it.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { MapProvider } from '../../../contexts/MapContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import { appBasename } from '../../../init';
import LayersDrawer from '../LayersDrawer';
import { useDeviceLayerGroups } from '../deviceLayerGroups';

vi.mock('../../../services/packetApi', async (orig) => ({
  ...(await orig<object>()),
  getPacketStats: vi.fn().mockResolvedValue({ enabled: true }),
}));
vi.mock('../../../contexts/AuthContext', async (orig) => ({
  ...(await orig<object>()),
  useAuth: () => ({ hasPermission: () => true }),
}));

function Drawer({ isPhone }: { isPhone: boolean }) {
  const { groups } = useDeviceLayerGroups({
    mqttOnly: false,
    canUse3D: false,
    viewMode: '2d',
    setViewMode: () => {},
    effective3D: false,
    ownNodePosition: null,
    aircraftCount: 0,
    agedOutCount: 0,
    listAgeHours: 24,
    capFromQuickFilter: false,
    packetFlightsStats: null,
    isPhone,
  });
  return <LayersDrawer groups={groups} onClose={() => {}} />;
}

/** Mounts the drawer and opens every folded "N more" row, where the toggle lives. */
async function mount(isPhone: boolean) {
  renderWorkspace(
    <ToastProvider>
      <SettingsProvider baseUrl={appBasename}>
        <MapProvider>
          <Drawer isPhone={isPhone} />
        </MapProvider>
      </SettingsProvider>
    </ToastProvider>,
    { route: `/source/${SOURCE_IDS.g2}/map` },
  );
  await screen.findByText('Ducting');
  for (const more of screen.queryAllByRole('button', { name: /more ·/ })) fireEvent.click(more);
}

describe('Packet monitor layer toggle', () => {
  it('desktop Layers drawer has it', async () => {
    await mount(false);
    expect(await screen.findByRole('switch', { name: 'Packet monitor' })).toBeInTheDocument();
  });

  it('phone Layers sheet has no Packet monitor toggle', async () => {
    await mount(true);
    await screen.findByRole('switch', { name: 'Show Animations' });
    expect(screen.queryByRole('switch', { name: 'Packet monitor' })).toBeNull();
  });
});
