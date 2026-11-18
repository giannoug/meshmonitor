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

  it('offline: 6.7\'s banner with the listen-only line, and the Channels tab has the receive-only line, not a composer', async () => {
    const offline = { ...regionFeedFixtures(), 'GET /api/sources/:id/status': (u: URL) =>
      (u.pathname.split('/')[3] === REGION_FEED_ID ? { sourceId: REGION_FEED_ID, sourceName: 'Athens MeshCore feed', sourceType: 'meshcore_mqtt', connected: false } : undefined) };
    renderMeshCore(FEED, { fixtures: offline });
    expect(await screen.findByText('Athens MeshCore feed is offline. History stays here.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Channels' }));
    expect(await screen.findByText(/Morning, anyone on the coast road\?/)).toBeInTheDocument();
    expect(screen.getByText("This MQTT source has no radio of its own, so it cannot send. Open a Meshtastic source to send.")).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /message/i })).toBeNull();
  });

  it('re-reads nodes and messages each time their tab opens, as today; no poll', async () => {
    const nodes = `/api/sources/${REGION_FEED_ID}/meshcore/ingest/nodes`;
    const messages = `/api/sources/${REGION_FEED_ID}/meshcore/ingest/messages`;
    renderMeshCore(`${FEED}/nodes`, { fixtures: regionFeedFixtures() });
    expect(await screen.findByText('Glyfada Beach')).toBeInTheDocument();
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(requests('GET', nodes)).toBe(1);
    // The sidebar's channel counts read the messages once.
    expect(requests('GET', messages)).toBe(1);
    fireEvent.click(screen.getByRole('link', { name: 'Channels' }));
    await screen.findByText(/Morning, anyone on the coast road\?/);
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(requests('GET', messages)).toBe(2);
    expect(requests('GET', nodes)).toBe(1);
    fireEvent.click(screen.getByRole('link', { name: 'Nodes' }));
    await screen.findByText('Glyfada Beach');
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(requests('GET', nodes)).toBe(2);
    expect(requests('GET', messages)).toBe(2);
  });

  it('the Nodes tab is the 8-11 table with the advert columns only, read-only', async () => {
    renderMeshCore(`${FEED}/nodes`, { fixtures: regionFeedFixtures() });
    await screen.findByText('Glyfada Beach');
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(expect.arrayContaining(['Role', 'Key']));
    expect(screen.queryByRole('button', { name: /Import contact/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add to favorites/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Glyfada Beach' })).toBeNull();
  });
});
