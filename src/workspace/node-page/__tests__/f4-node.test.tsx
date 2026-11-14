/**
 * @vitest-environment jsdom
 *
 * Board f4-node (desktop): the node page's header (Back to Nodes, the node,
 * Message and the three node menus), its tabs and the Overview. The page owns
 * its node state (Ruling AD): App is not mounted, and opening it sends nothing.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { g2, kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const heading = () => screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });

describe('f4-node', () => {
  it('f4-node shows the board', async () => {
    const { container } = renderChat(kifisia);
    await heading();
    await screen.findByText('Hops Away');
    expectBoard('f4-node', container);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('the header leads back to Nodes and to the DM, with the node menus', async () => {
    renderChat(kifisia);
    await heading();
    expect(screen.getByRole('link', { name: 'Nodes' })).toHaveAttribute('href', `${g2}/nodes`);
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    for (const menu of ['Ask the node', 'Organise', 'Data']) expect(screen.getByRole('button', { name: menu })).toBeInTheDocument();
    expect(screen.getByText(/!a1b2c301/)).toBeInTheDocument();
    expect(screen.getByText('Router')).toBeInTheDocument();
  });

  it('each tab is a link under the node, Overview current', async () => {
    renderChat(kifisia);
    await heading();
    const tabs = within(screen.getByRole('navigation', { name: 'Kifisia Rooftop' }));
    expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    for (const [name, tab] of [['Telemetry', 'telemetry'], ['Links', 'links'], ['Position', 'position'], ['Admin', 'admin']]) {
      expect(tabs.getByRole('link', { name })).toHaveAttribute('href', `${kifisia}/${tab}`);
    }
  });

  it('the Overview shows the radio, the position and the identity', async () => {
    renderChat(kifisia);
    await heading();
    expect(await screen.findByText('38.0742, 23.8113 · 290 m')).toBeInTheDocument();
    expect(screen.getByText('2712847105')).toBeInTheDocument();
    expect(screen.getByText('# LongFast · RF')).toBeInTheDocument();
  });

  it('opening the page transmits nothing: every request is a read', async () => {
    renderChat(kifisia);
    await heading();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/poll'))).toBe(true));
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET').map(([u, i]) => `${i?.method} ${String(u)}`);
    expect(writes).toEqual([]);
  });

  it('an unknown node says so', async () => {
    renderChat(`${g2}/node/!deadbeef`);
    expect(await screen.findByText('Not found', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
