/**
 * @vitest-environment jsdom
 *
 * Boards 9-05 (desktop) and 9-14 (phone): the map's Connections view, native
 * (Task 7.6): today's topology with the destination details on a click.
 * Locations is the shared map shell (BaseMap). Nothing here sends.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RNS_URL, renderReticulum } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const MAP = `${RNS_URL}/map`;

describe('9-05-map-connections', () => {
  it('9-05-map-connections shows the board', async () => {
    const { container } = renderReticulum(MAP);
    fireEvent.click(await screen.findByRole('tab', { name: 'Connections' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kifisia Sideband' }));
    await screen.findByRole('complementary', { name: 'Kifisia Sideband' });
    expectBoard('9-05-map-connections', container);
  });

  it('Locations is the shared map shell, with today\'s markers', async () => {
    const { container } = renderReticulum(MAP);
    expect(await screen.findByRole('tab', { name: 'Locations', selected: true })).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('9-14-map-connections shows the board', async () => {
    renderReticulum(MAP, { phone: true });
    fireEvent.click(await screen.findByRole('tab', { name: 'Connections' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kifisia Sideband' }));
    await screen.findByRole('dialog');
    expectBoard('9-14-map-connections', document.body);
  });
});
