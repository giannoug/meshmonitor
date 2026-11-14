/**
 * @vitest-environment jsdom
 *
 * Board 10-01 (desktop): a DM in layout D. The header (node chip, Last seen,
 * Mute, the three node menus), the banners (key mismatch, not in the device
 * database, unmessageable with Message anyway), the traceroute strip, the
 * conversation with ours in every ack state, the DM composer, and Purge data
 * in its side sheet. The DM screen owns its message state (Ruling AD).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const route = `${g2}/dm/!a1b2c301`;
const header = () => screen.getByTestId('dm-header');

/** Opens the conversation past the unmessageable banner. */
async function openConversation() {
  const result = renderChat(route);
  fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
  await screen.findByText('Can you run a traceroute to me?');
  return result;
}

describe('10-01-dm-conversation', () => {
  it('10-01-dm-conversation shows the board', async () => {
    // The board draws the unmessageable banner beside the open conversation; today the banner
    // goes once overridden, so its state is captured first and checked with the rest.
    renderChat(route);
    const banner = (await screen.findByRole('button', { name: 'Message anyway' })).closest('[role="status"]')!.textContent ?? '';
    cleanup();
    const { container } = await openConversation();
    const theirs = screen.getByText('Can you run a traceroute to me?').closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(theirs).getByRole('button', { name: 'Reply' }));
    await screen.findByText('Replying to Kifisia Rooftop');
    await screen.findByText('Statistical (3 routes)', { exact: false });
    fireEvent.click(within(header()).getByRole('button', { name: 'Data' }));
    fireEvent.click(screen.getByRole('button', { name: /^Purge Data/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' });
    expectBoard('10-01-dm-conversation', joined(banner, container, sheet));
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('shows the banners: key mismatch with Clear, not in the device database, unmessageable with Message anyway', async () => {
    renderChat(route);
    const mismatch = await screen.findByTestId('key-mismatch-warning');
    expect(mismatch).toHaveTextContent("This node's public key has changed");
    expect(within(mismatch).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(screen.getByText('Not in the device database')).toBeInTheDocument();
    expect(screen.getByText(/not in the connected device's database|not in your radio's database/)).toBeInTheDocument();
    expect(screen.getByText(/reports itself as unmessageable/)).toBeInTheDocument();
    // Until Message anyway, no log and no composer (today's #4153 override).
    expect(screen.queryByText('Can you run a traceroute to me?')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Message anyway' }));
    expect(await screen.findByText('Can you run a traceroute to me?')).toBeInTheDocument();
    expect(document.querySelector('textarea')).toBeInTheDocument();
    // As today: once overridden, the banner goes.
    expect(screen.queryByText(/reports itself as unmessageable/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Message anyway' })).toBeNull();
  });

  it('Clear posts today\'s request', async () => {
    renderChat(route);
    const mismatch = await screen.findByTestId('key-mismatch-warning');
    fireEvent.click(within(mismatch).getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([u, i]) => String(u).includes(`/api/security/nodes/${0xa1b2c301}/clear`) && i?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ sourceId: SOURCE_IDS.g2 });
    });
  });

  it('ours carry the ack states Pending, Delivered, Confirmed, Failed and Timed out', async () => {
    await openConversation();
    const ack = (text: string) => (screen.getByText(text).closest('[data-message-id]') as HTMLElement);
    expect(within(ack('Running one now, should be 2 hops via Hymettus')).getByText('Confirmed')).toBeInTheDocument();
    expect(within(ack('Battery looks fine')).getByText('Delivered')).toBeInTheDocument();
    expect(within(ack('Back on LongFast later?')).getByText('Timed out')).toBeInTheDocument();
    expect(within(ack('Ping me if the relay drops')).getByText('Failed')).toBeInTheDocument();
    expect(within(ack('Thanks!')).getByText('Pending')).toBeInTheDocument();
  });

  it('the composer sends a DM, says what it sends, and offers Bell and Translate', async () => {
    await openConversation();
    expect(screen.getByText('Sends 1 message to Kifisia Rooftop, asks for an ACK')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bell' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Translate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send position' })).toBeNull();
    const box = document.querySelector('textarea')!;
    fireEvent.change(box, { target: { value: "I'll try the relay at noon" } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => {
      const send = vi.mocked(fetch).mock.calls.find(([u, i]) => String(u).includes('/api/messages/send') && i?.method === 'POST');
      expect(send).toBeDefined();
      expect(JSON.parse(String(send![1]!.body))).toMatchObject({ text: "I'll try the relay at noon", destination: '!a1b2c301' });
    });
  });

  it('the header shows the node chip, Last seen, hops and the three menus', async () => {
    renderChat(route);
    await screen.findByTestId('key-mismatch-warning');
    const head = header();
    expect(within(head).getByRole('link', { name: /Kifisia Rooftop/ })).toHaveAttribute('href', `${g2}/node/!a1b2c301`);
    expect(head).toHaveTextContent('Last seen');
    expect(head).toHaveTextContent('2 hops · !a1b2c301');
    for (const name of ['Ask the node', 'Organise', 'Data']) {
      expect(within(head).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('the traceroute strip shows the route both ways, with History and Copy', async () => {
    renderChat(route);
    const strip = await screen.findByRole('region', { name: 'Traceroute' });
    await waitFor(() => expect(strip).toHaveTextContent('Forward'));
    expect(strip).toHaveTextContent('Return');
    expect(within(strip).getByRole('button', { name: 'Show History' })).toBeInTheDocument();
    expect(within(strip).getByRole('button', { name: 'Copy Forward' })).toBeInTheDocument();
  });
});

describe('the DM sidebar rows', () => {
  it('clicking a second DM row switches the conversation', async () => {
    renderChat(route);
    await screen.findByTestId('key-mismatch-warning');
    const side = within(await screen.findByRole('complementary', { name: 'Station G2' }));
    fireEvent.click(await side.findByRole('link', { name: /Athens Rover/ }));
    expect(await screen.findByText('Heading up Hymettus, will relay this morning')).toBeInTheDocument();
    expect(screen.getByTestId('dm-header')).toHaveTextContent('Athens Rover');
    expect(screen.queryByTestId('key-mismatch-warning')).toBeNull();
  });

  it('carry a presence dot: heard in the last 2 hours, the window of the "online" count', async () => {
    // Athens Rover heard 10 minutes ago; Kifisia Rooftop 3 hours ago.
    const nowS = Math.floor(Date.now() / 1000);
    const poll = {
      ...athensFixture.poll,
      nodes: athensFixture.poll.nodes!.map((n) => (n.nodeNum === 0xa1b2c301 ? { ...n, lastHeard: nowS - 3 * 3600 } : n)),
    };
    renderChat(route, { fixtures: { 'GET /api/poll': () => poll } });
    const side = within(await screen.findByRole('complementary', { name: 'Station G2' }));
    const dot = async (name: RegExp) => (await side.findByRole('link', { name })).querySelector('[data-presence]');
    expect(await dot(/Athens Rover/)).toHaveAttribute('data-presence', 'online');
    expect(await dot(/Kifisia Rooftop/)).toHaveAttribute('data-presence', 'offline');
  });
});
