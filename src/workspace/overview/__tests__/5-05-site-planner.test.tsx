/**
 * @vitest-environment jsdom
 *
 * Board 5-05-site-planner (desktop): Tools › Site Planner opens today's Site
 * Planner panel, Layers › GNSS DOP today's DOP panel (both server-side
 * computations; nothing goes on the mesh), and a local marker's popup offers
 * Edit / Delete, which open the Workspace marker sheets (3.6).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { openLayers, openTools, renderOverview } from './renderOverview';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const candidate = {
  id: 7, sourceId: SOURCE_IDS.g2, label: 'Candidate site', description: 'Rooftop survey', latitude: 37.99, longitude: 23.76,
  altitude: null, icon: 'pin', color: 'amber', createdBy: 1, createdAt: Date.now() - 86_400_000, updatedAt: Date.now() - 86_400_000,
};
const fixtures = {
  'GET /api/sources/:id/markers': (url: URL) => ({ success: true, data: url.pathname.split('/')[3] === SOURCE_IDS.g2 ? [candidate] : [] }),
};

const markerPin = () =>
  waitFor(
    () => {
      const el = document.querySelector<HTMLElement>('.leaflet-localMarkers-pane .leaflet-marker-icon');
      if (!el) throw new Error('no local marker');
      return el;
    },
    { timeout: 5000 },
  );

describe('5-05-site-planner', () => {
  it('5-05-site-planner shows the board', async () => {
    const { container } = renderOverview('/overview/map', { fixtures });
    // The marker first: while Site Planner waits for its origin, a map click picks it (today's behaviour).
    fireEvent.click(await markerPin());
    await screen.findByText('Candidate site');
    fireEvent.click(within(await openLayers()).getByRole('switch', { name: 'GNSS DOP' }));
    await screen.findByText('GNSS DOP overlay');
    fireEvent.click(within(await openTools()).getByRole('menuitemradio', { name: /^Site Planner/ }));
    await screen.findByText('Predict coverage');
    expectBoard('5-05-site-planner', container);
  });

  it('a local marker\'s Delete opens the Workspace confirm, which says nothing goes on the mesh', async () => {
    renderOverview('/overview/map', { fixtures });
    fireEvent.click(await markerPin());
    fireEvent.click(await screen.findByRole('button', { name: /^Delete/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete local marker "Candidate site"?' });
    expect(within(sheet).getByText('Sends nothing on the mesh')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([u, i]) => i?.method === 'DELETE' && String(u).includes(`/api/sources/${SOURCE_IDS.g2}/markers/7`))).toBe(true),
    );
  });

  it('a local marker\'s Edit opens the Workspace marker sheet', async () => {
    renderOverview('/overview/map', { fixtures });
    fireEvent.click(await markerPin());
    fireEvent.click(await screen.findByRole('button', { name: /^Edit/ }));
    expect(await screen.findByRole('dialog', { name: 'Edit local marker' })).toBeInTheDocument();
  });
});
