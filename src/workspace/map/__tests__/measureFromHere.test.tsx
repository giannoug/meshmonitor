/**
 * @vitest-environment jsdom
 *
 * "Measure from here" on the device map: a second one at the same spot starts
 * the measurement over, and with fewer than two positioned nodes the item says why it is off.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { athensFixture } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { mapRoute, openMapMenu, pick } from './mapEditHelpers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const label = () => document.querySelector('.measure-distance-label');

describe('Measure from here', () => {
  it('twice at the same spot restarts the measurement', async () => {
    renderChat(mapRoute);
    await pick(await openMapMenu(), /^Measure from here/);
    await waitFor(() => expect(document.querySelectorAll('path.leaflet-interactive').length).toBeGreaterThan(0));
    // Pick B on the map: the line and its distance appear.
    const map = document.querySelector('.leaflet-container') as HTMLElement;
    fireEvent.click(map, { clientX: 5000, clientY: 5000 });
    await waitFor(() => expect(label()).not.toBeNull());
    // The same spot again: A is re-seeded and B is gone.
    await pick(await openMapMenu(), /^Measure from here/);
    await waitFor(() => expect(label()).toBeNull());
  });

  it('with fewer than two positioned nodes the item is off and says what it needs', async () => {
    const bare = athensFixture.poll.nodes!.map((n) => ({ ...n, position: undefined }));
    renderChat(mapRoute, { fixtures: { 'GET /api/poll': () => ({ ...athensFixture.poll, nodes: bare }) } });
    const menu = await openMapMenu();
    const item = within(menu).getByRole('menuitem', { name: /^Measure from here/ });
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Needs two nodes with a position');
  });
});
