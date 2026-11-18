/**
 * @vitest-environment jsdom
 *
 * Boards 8-13 (desktop) and 8-30 (phone): a MeshCore radio's Info (Task 7.5),
 * native at `/source/:id/info`: Identity, Radio, Current health, Cumulative
 * counters, Clock with Sync (today's `config/sync-time`, once per press, sends
 * nothing on the mesh) and History with today's per-metric favourite.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const syncs = (log: { writes: Array<{ path: string }> }) => log.writes.filter((w) => w.path.endsWith('/config/sync-time'));

describe('8-13-info', () => {
  it('8-13-info shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/info`);
    await screen.findByText('Heltec V3');
    await screen.findAllByRole('button', { name: 'Add to favorites' });
    expectBoard('8-13-info', container);
  });

  it('8-30-info shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/info`, { phone: true });
    await screen.findByText('Heltec V3', { exact: false });
    expect(screen.getByRole('link', { name: /Tools/ })).toBeInTheDocument();
    expectBoard('8-30-info', container);
  });

  it('Sync sends today\'s one sync-time request per press and says it sends nothing on the mesh', async () => {
    const { log } = renderMeshCore(`${HELTEC}/info`);
    const sync = await screen.findByRole('button', { name: 'Sync' });
    expect(screen.getByText(/Sends nothing on the mesh/)).toBeInTheDocument();
    expect(syncs(log)).toHaveLength(0);
    fireEvent.click(sync);
    await waitFor(() => expect(syncs(log)).toHaveLength(1));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(syncs(log)).toHaveLength(1);
  });

  it('opening the page and changing the range send nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/info`);
    await screen.findByText('Heltec V3');
    fireEvent.click(await screen.findByRole('button', { name: '7d' }));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(log.writes).toHaveLength(0);
  });

  it("without connection:read the body is today's permission note", async () => {
    renderMeshCore(`${HELTEC}/info`, {
      fixtures: {
        'GET /api/auth/status': () => ({ authenticated: true, user: { id: 2, username: 'guest', isAdmin: false }, permissions: { global: {}, bySource: {} } }),
      },
    });
    expect(await screen.findByText('You do not have permission to view this MeshCore source.')).toBeInTheDocument();
  });
});
