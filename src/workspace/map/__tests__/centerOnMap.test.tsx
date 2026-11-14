/**
 * @vitest-environment jsdom
 *
 * Center on Map (Ruling AJ) arriving at the device map: on a phone it waits
 * for the 2D map before centring, so the peek offset applies even when the
 * DM page left the nodes in the cache; and the request is dropped from the
 * history entry once handled.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import L from 'leaflet';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../../components/ToastContainer';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const KIFISIA_LAT = 38.0742;

function StateProbe() {
  const { pathname, state } = useLocation();
  return <output data-testid="probe">{`${pathname} ${JSON.stringify(state)}`}</output>;
}

/** renderChat's tree plus a probe of the real location. */
function render(phone: boolean) {
  Element.prototype.scrollIntoView ??= () => {};
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
      <StateProbe />
    </ToastProvider>,
    { route: `${g2}/dm/!a1b2c301`, phone },
  );
}

async function centerOnMap(phone: boolean) {
  const head = await screen.findByTestId('dm-header');
  await within(head).findByText('Kifisia Rooftop');
  if (phone) {
    fireEvent.click(within(head).getByRole('button', { name: 'Node actions' }));
    const sheet = await screen.findByRole('dialog', { name: /Node actions/ });
    fireEvent.click(within(sheet).getByRole('tab', { name: 'Organise' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /Center on Map/ }));
  } else {
    fireEvent.click(within(head).getByRole('button', { name: 'Organise' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Organise' })).getByRole('button', { name: /Center on Map/ }));
  }
}

describe('Center on Map at the device map', () => {
  it('on a phone with the nodes already cached, centres with the peek offset (the node lands above centre)', async () => {
    // jsdom lays nothing out; give the map a height so the offsets are real.
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    try {
      render(true);
      await centerOnMap(true);
      await screen.findByRole('dialog', { name: 'Kifisia Rooftop' }, { timeout: 5000 });
      // MapCenterController's animated centring is the setView call with a duration.
      await waitFor(() => expect(setView.mock.calls.some(([, , o]) => o?.duration !== undefined)).toBe(true));
      const [center] = setView.mock.calls.find(([, , o]) => o?.duration !== undefined)!;
      // Unshifted, the controller puts the centre north of the node (node below centre, under the sheet).
      expect(L.latLng(center).lat).toBeLessThan(KIFISIA_LAT);
    } finally {
      setView.mockRestore();
      height.mockRestore();
    }
  });

  it('drops the request from the history entry once handled (desktop)', async () => {
    render(false);
    await centerOnMap(false);
    await screen.findByRole('complementary', { name: 'Kifisia Rooftop' }, { timeout: 5000 });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent(`${g2}/map null`));
  });
});
