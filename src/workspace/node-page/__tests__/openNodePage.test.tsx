/**
 * @vitest-environment jsdom
 *
 * ds1: a node gets its own page. The Nodes list row, the DM header and a
 * message's node (the details' relay candidates) open the page directly; a
 * pin on the device map opens the peek, which leaves the map in view.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { g2 } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

withRowLayout();

const nodePage = (name: string) => screen.findByRole('heading', { level: 1, name }, { timeout: 5000 });

describe('opening the node page (ds1)', () => {
  it('a Nodes list row opens the node page', async () => {
    renderChat(`${g2}/nodes`, { phone: true });
    const list = await screen.findByRole('list', { name: 'Nodes' }, { timeout: 5000 });
    fireEvent.click(await within(list).findByRole('button', { name: /Hymettus Relay/ }));
    await nodePage('Hymettus Relay');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('the DM header\'s name opens the node page', async () => {
    renderChat(`${g2}/dm/!a1b2c301`);
    const head = await screen.findByTestId('dm-header', {}, { timeout: 5000 });
    fireEvent.click(await within(head).findByRole('link', { name: /Kifisia Rooftop/ }));
    await nodePage('Kifisia Rooftop');
    expect(screen.queryByTestId('dm-header')).toBeNull();
  });

  it('a message\'s node (the details\' relay candidate) opens the node page', async () => {
    const poll = {
      ...athensFixture.poll,
      messages: athensFixture.poll.messages!.map((m) => (m.text === 'Can you run a traceroute to me?' ? { ...m, relayNode: 0xa1b2c306 } : m)),
    };
    renderChat(`${g2}/dm/!a1b2c301`, { fixtures: { 'GET /api/poll': () => poll } });
    fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }, { timeout: 5000 }));
    const row = within((await screen.findByText('Can you run a traceroute to me?')).closest('[data-message-id]') as HTMLElement);
    fireEvent.click(row.getByRole('button', { name: 'More actions' }));
    fireEvent.click(row.getByRole('button', { name: /^Details/ }));
    const panel = await screen.findByRole('complementary', { name: /Details$/ });
    fireEvent.click(await within(panel).findByRole('button', { name: /Hymettus Relay/ }));
    await nodePage('Hymettus Relay');
  });

  it('a pin on the device map opens the peek, not the page', async () => {
    // jsdom lays nothing out; Leaflet places markers only on a map with a size.
    const size = (prop: 'clientWidth' | 'clientHeight', px: number) =>
      vi.spyOn(HTMLElement.prototype, prop, 'get').mockReturnValue(px);
    size('clientWidth', 1000);
    size('clientHeight', 700);
    renderChat(`${g2}/map`);
    await screen.findByRole('list', { name: 'On the map' }, { timeout: 5000 });
    const pin = await waitFor(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')).find((m) => m.textContent?.includes('KFR'));
      expect(el).toBeTruthy();
      return el!;
    });
    fireEvent.click(pin);
    expect(await screen.findByRole('complementary', { name: 'Kifisia Rooftop' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Kifisia Rooftop' })).toBeNull();
    vi.restoreAllMocks();
  });
});
