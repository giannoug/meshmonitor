/**
 * @vitest-environment jsdom
 *
 * Boards 8-12 (desktop) and 8-29 (phone): a MeshCore radio's packet monitor
 * (Task 7.5), native at `/source/:id/packets`, on today's `useMeshCorePackets`
 * (paging, live rows, Grouped / All, Pause) and filters; a row opens Packet
 * Decode (side panel / sheet): header, path, the group frame with today's
 * server-side decrypt (one request per open, the key never in the browser)
 * and, for a grouped row, the observers that heard it. Capture settings and
 * Clear are today's; Clear asks first.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const decodes = (log: { writes: Array<{ path: string }> }) => log.writes.filter((w) => w.path.endsWith('/packets/decode'));

async function openGroupFrame() {
  fireEvent.click(await screen.findByRole('button', { name: 'Grouped' }));
  const rows = await screen.findAllByTestId('mc-packet-row');
  fireEvent.click(rows[0]);
  return screen.findByText('#athens · key from source Athens MQTT');
}

describe('8-12-packet-detail', () => {
  it('8-12-packet-detail shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/packets`);
    await openGroupFrame();
    await screen.findByText('Lycabettus Repeater', { selector: '[data-observer]' });
    expectBoard('8-12-packet-detail', container);
  });

  it('8-29-packet-detail shows the board', async () => {
    renderMeshCore(`${HELTEC}/packets`, { phone: true });
    await openGroupFrame();
    const sheet = screen.getByRole('dialog', { name: /Packet Decode/ });
    await within(sheet).findByText('Lycabettus Repeater', { selector: '[data-observer]' });
    expectBoard('8-29-packet-detail', sheet);
  });

  it('decrypt is today\'s one request per opened frame, and opening the page sends nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/packets`);
    await screen.findAllByTestId('mc-packet-row');
    expect(log.writes).toHaveLength(0);
    await openGroupFrame();
    expect(decodes(log)).toHaveLength(1);
    expect(decodes(log)[0].path).toBe('/api/sources/src-heltec/meshcore/packets/decode');
    // The body carries the frame only, never a key.
    expect(JSON.stringify(log.writes[0])).not.toMatch(/psk|secret|key/i);
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(decodes(log)).toHaveLength(1);
    expect(screen.getByText('“Morning, anyone on the coast road? Testing a new antenna.”')).toBeInTheDocument();
  });

  it('the observers of a grouped frame come from today\'s receptions read, once', async () => {
    renderMeshCore(`${HELTEC}/packets`);
    await openGroupFrame();
    await screen.findByText('Penteli Repeater', { selector: '[data-observer]' });
    expect(requests('GET', '/api/sources/src-heltec/meshcore/packets/receptions')).toBe(1);
  });

  it('Clear asks first with today\'s words, then sends one DELETE', async () => {
    const { log } = renderMeshCore(`${HELTEC}/packets`);
    await screen.findAllByTestId('mc-packet-row');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const sheet = await screen.findByRole('dialog', { name: 'Clear' });
    expect(within(sheet).getByText('Clear the captured MeshCore packet log for this source?')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'DELETE')).toHaveLength(1));
  });

  it('capture is server-side and says it sends nothing on the mesh', async () => {
    renderMeshCore(`${HELTEC}/packets`);
    await screen.findAllByTestId('mc-packet-row');
    expect(screen.getAllByText(/capture is server-side/i).length).toBeGreaterThan(0);
  });

  it('the phone list pages as today: Load older reads the next page once per press', async () => {
    const page = (cursor: string | null) => ({
      packets: cursor ? [{ id: 99, timestamp: 1, payloadType: 4, payloadTypeName: 'ADVERT', routeType: 1, rawHex: '1100', advertName: 'Older Node', senderPubKey: 'aa'.repeat(32) }] : [
        { id: 100, timestamp: 2, payloadType: 4, payloadTypeName: 'ADVERT', routeType: 1, rawHex: '1100', advertName: 'Newer Node', senderPubKey: 'bb'.repeat(32) }],
      total: 2, hasMore: !cursor, nextCursor: cursor ? null : 'c1', enabled: true, maxCount: 1000, maxAgeHours: 24, isIngestSource: false,
    });
    renderMeshCore(`${HELTEC}/packets`, { phone: true, fixtures: { 'GET /api/sources/:id/meshcore/packets': (u: URL) => page(u.searchParams.get('cursor')) } });
    await screen.findByText('Newer Node');
    const pages = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('/meshcore/packets?') && String(u).includes('cursor=c1')).length;
    expect(pages()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Load older' }));
    expect(await screen.findByText('Older Node')).toBeInTheDocument();
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(pages()).toBe(1);
  });
});
