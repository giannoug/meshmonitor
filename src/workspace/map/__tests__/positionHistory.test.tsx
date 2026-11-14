/**
 * @vitest-environment jsdom
 *
 * Show Position History on the Workspace device map (Ruling BA): selecting a
 * mobile node loads its history the way today's Nodes map does
 * (`usePositionHistory`) and the map draws the trail (`usePositionTrail`);
 * the Layers toggle hides and redraws it, with today's duration slider.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const ROVER = 0xa1b2c302;
const NOW = Date.now();
/** Athens Rover's last hour, oldest first, as `GET /api/nodes/:id/position-history` returns it. */
const fixes = [0, 1, 2, 3].map((i) => ({ latitude: 37.96 + i * 0.005, longitude: 23.72 + i * 0.005, timestamp: NOW - (60 - i * 15) * 60_000 }));
const fixtures = {
  // Athens Rover is a mobile node here, so selecting it loads its history.
  'GET /api/poll': () => ({ ...athensFixture.poll, nodes: athensFixture.poll.nodes!.map((n) => (n.nodeNum === ROVER ? { ...n, isMobile: true } : n)) }),
  // One page, then the empty page that ends the walk back.
  'GET /api/nodes/:id/position-history': (url: URL) => (url.searchParams.has('before') ? [] : fixes),
};
const trailPaths = () => document.querySelectorAll('.leaflet-overlay-pane path');

describe('Show Position History on the device map', () => {
  it('draws the selected mobile node\'s trail from its history, and the toggle hides and redraws it', async () => {
    renderChat(`/source/${SOURCE_IDS.g2}/map`, { fixtures });
    const list = await screen.findByRole('list', { name: 'On the map' }, { timeout: 5000 });
    fireEvent.click(await within(list).findByRole('button', { name: /Athens Rover/ }));
    await screen.findByRole('complementary', { name: 'Athens Rover' });

    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/nodes/!a1b2c302/position-history'))).toBe(true),
    );
    // Three segments between the four fixes plus a dot per fix (today's trail), on by default as today.
    await waitFor(() => expect(trailPaths().length).toBe(7));

    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    const drawer = await screen.findByTestId('layers-drawer');
    const toggle = within(drawer).getByRole('switch', { name: 'Show Position History' });
    expect(within(drawer).getByRole('slider', { name: 'Position history duration' })).toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(trailPaths().length).toBe(0));
    fireEvent.click(toggle);
    await waitFor(() => expect(trailPaths().length).toBe(7));
  });
});
