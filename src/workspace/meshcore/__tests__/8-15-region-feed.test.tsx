/**
 * @vitest-environment jsdom
 *
 * Boards 8-15 (desktop) and 8-23 (phone): a MeshCore MQTT region feed (Task
 * 7.5), native at the source's URL as a receive-only device: today's banner,
 * Region / Broker / Nodes / Observers, the observers' heartbeats, the nodes
 * learned from adverts, the decrypted channel lines ("(older, key unknown)")
 * and its packets. Today's reads only (`meshcore/ingest/*`); nothing here can
 * send.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { regionFeedFixtures, REGION_FEED_ID } from '../../__fixtures__/meshcoreTools';
import { expectBoard } from '../../test/boardChecks';
import { renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const FEED = `/source/${REGION_FEED_ID}`;

describe('8-15-mqtt-region-feed', () => {
  it('8-15-mqtt-region-feed shows the board', async () => {
    const { container } = renderMeshCore(FEED, { fixtures: regionFeedFixtures() });
    await screen.findByText('Lycabettus Repeater');
    expect((await screen.findAllByText('Penteli Repeater')).length).toBeGreaterThan(1);
    expectBoard('8-15-mqtt-region-feed', container);
  });

  it('8-23-region-feed shows the board', async () => {
    const { container } = renderMeshCore(FEED, { phone: true, fixtures: regionFeedFixtures() });
    await screen.findByText('Lycabettus Repeater');
    expectBoard('8-23-region-feed', container);
  });

  it('has no composer and nothing that sends; opening reads today\'s overview once', async () => {
    const { log } = renderMeshCore(FEED, { fixtures: regionFeedFixtures() });
    await screen.findByText('Lycabettus Repeater');
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('textbox', { name: /message/i })).toBeNull();
    expect(log.writes).toHaveLength(0);
    expect(requests('GET', `/api/sources/${REGION_FEED_ID}/meshcore/ingest/overview`)).toBe(1);
  });

  it('the Packets tab is the packet monitor, fed by every observer', async () => {
    renderMeshCore(`${FEED}/packets`, { fixtures: regionFeedFixtures() });
    expect(await screen.findByRole('heading', { name: 'Packet Monitor' })).toBeInTheDocument();
    expect((await screen.findAllByTestId('mc-packet-row')).length).toBe(2);
  });

  it('the Channels tab shows decrypted lines and the older ones with no key', async () => {
    renderMeshCore(`${FEED}/channels`, { fixtures: regionFeedFixtures() });
    expect(await screen.findByText(/Morning, anyone on the coast road\?/)).toBeInTheDocument();
    expect(screen.getByText(/14 messages \(older, key unknown\)/)).toBeInTheDocument();
  });

  it('the tabs are links under the source URL', async () => {
    renderMeshCore(FEED, { fixtures: regionFeedFixtures() });
    const nodes = await screen.findByRole('link', { name: 'Nodes' });
    fireEvent.click(nodes);
    expect(await screen.findByText('Glyfada Beach')).toBeInTheDocument();
  });
});
