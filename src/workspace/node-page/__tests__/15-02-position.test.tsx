/**
 * @vitest-environment jsdom
 *
 * Board 15-02 (desktop): the Position tab. The node's map (a BaseMap page
 * section) draws its position history with today's trail and, for a tracked
 * asset, today's playback bar; beside it the history switches (shared with the
 * device map, s15n0), the position facts and the override. The 2.8 opt-in
 * notice is today's. Nothing here sends.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { rover } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `${rover}/position`;
const trailPaths = () => document.querySelectorAll('.leaflet-overlay-pane path');

describe('15-02-position', () => {
  it('15-02-position shows the board', async () => {
    const { container } = renderChat(route);
    await screen.findByTestId('asset-playback-bar', {}, { timeout: 5000 });
    expectBoard('15-02-position', container);
  });

  it('loads the asset\'s trail once, draws it, and the switch hides it and the playback bar', async () => {
    renderChat(route);
    await screen.findByTestId('asset-playback-bar', {}, { timeout: 5000 });
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes(`/api/assets/${0xa1b2c302}/track`))).toHaveLength(1);
    await waitFor(() => expect(trailPaths().length).toBeGreaterThan(0));
    expect(screen.getByText(/16 fixes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Show Position History' }));
    await waitFor(() => expect(screen.queryByTestId('asset-playback-bar')).toBeNull());
    expect(trailPaths().length).toBe(0);
  });

  it('shows the position facts and points the override to Data', async () => {
    renderChat(route);
    await screen.findByTestId('asset-playback-bar', {}, { timeout: 5000 });
    expect(screen.getByText('37.9755, 23.7348')).toBeInTheDocument();
    expect(screen.getByText('164 m')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Position history duration' })).toBeInTheDocument();
    expect(screen.getByText('Override Position')).toBeInTheDocument();
  });
});
