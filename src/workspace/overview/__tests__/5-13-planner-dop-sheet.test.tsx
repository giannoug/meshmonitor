/**
 * @vitest-environment jsdom
 *
 * Board 5-13-planner-dop-sheet (phone): Tools › Site Planner and Layers ›
 * GNSS DOP open today's two panels, stacked in one bottom sheet over the map
 * (not modal: a tap on the map moves the planner's origin). Both are
 * server-side computations; nothing goes on the mesh.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { DEFAULT_CONFIG } from '../../../hooks/useMapAnalysisConfig';
import { nonGets, openPhoneSheet, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function plannerAndDop() {
  const layers = within(await openPhoneSheet('Layers'));
  fireEvent.click(layers.getByRole('switch', { name: 'GNSS DOP' }));
  fireEvent.click(layers.getByRole('button', { name: 'Close' }));
  fireEvent.click(within(await openPhoneSheet('Tools')).getByRole('radio', { name: 'Site Planner' }));
  await screen.findByText('Predict coverage');
  await screen.findByText('GNSS DOP overlay');
}

describe('5-13-planner-dop-sheet', () => {
  it('5-13-planner-dop-sheet shows the board', async () => {
    const { container } = renderOverview('/overview/map', { phone: true });
    await plannerAndDop();
    expectBoard('5-13-planner-dop-sheet', container);
  });

  it('the two panels share one bottom column, not modal, and opening them sends nothing', async () => {
    renderOverview('/overview/map', { phone: true });
    await plannerAndDop();
    expect(screen.getByTestId('map-tool-column').className).toMatch(/bottomColumn/);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nonGets()).toEqual([]);
  });

  it('a tap on the map sets the planner\'s origin', async () => {
    renderOverview('/overview/map', { phone: true });
    await plannerAndDop();
    fireEvent.click(document.querySelector('.leaflet-container')!, { clientX: 400, clientY: 200 });
    await waitFor(() => expect(screen.getByTestId('site-planner-origin')).toHaveTextContent(/^Predicting from/));
  });

  // Fix round 1 (I1): one owner for the bottom of the phone map. Layout is not computed in jsdom, so the
  // structure is asserted: everything at the bottom is in one dock that scrolls as one, the slider at its foot.
  it('GNSS DOP, the Link Profile drawer and the Time Slider share one bottom dock, the slider last', async () => {
    renderOverview('/overview/map', { phone: true, config: { timeSlider: { ...DEFAULT_CONFIG.timeSlider, enabled: true } } });
    const layers = within(await openPhoneSheet('Layers'));
    fireEvent.click(layers.getByRole('switch', { name: 'GNSS DOP' }));
    fireEvent.click(layers.getByRole('button', { name: 'Close' }));
    fireEvent.click(within(await openPhoneSheet('Tools')).getByRole('radio', { name: 'Link Profile' }));
    const dock = screen.getByTestId('map-tool-column');
    const drawer = await screen.findByTestId('link-profile-drawer');
    expect(dock).toContainElement(drawer);
    expect(dock).toContainElement(screen.getByTestId('gnss-dop-panel'));
    expect(dock).toContainElement(within(drawer).getByRole('button', { name: 'Close link profile' }));
    expect(dock.lastElementChild).toBe(screen.getByTestId('time-slider'));
    expect(screen.getAllByTestId('link-profile-drawer')).toHaveLength(1);
    expect(screen.getAllByTestId('time-slider')).toHaveLength(1);
  });

  it('on desktop the drawer and the slider stay where Map Analysis puts them', async () => {
    renderOverview('/overview/map', { config: { timeSlider: { ...DEFAULT_CONFIG.timeSlider, enabled: true } } });
    const slider = await screen.findByTestId('time-slider', {}, { timeout: 5000 });
    expect(screen.getByTestId('map-tool-column')).not.toContainElement(slider);
  });
});
