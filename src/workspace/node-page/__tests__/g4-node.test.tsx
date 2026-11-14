/**
 * @vitest-environment jsdom
 *
 * Board g4-node (phone): the node page's header (Back to Nodes, ⋯, the node,
 * the four tiles) over its tabs and the Overview. Scrolled down, the header
 * collapses to one bar with the node and ⋯ (s15n5): an IntersectionObserver
 * on the full header, no timer.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { g2, kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
const prevObserver = globalThis.IntersectionObserver;
afterEach(() => {
  globalThis.IntersectionObserver = prevObserver;
  observers.length = 0;
});

describe('g4-node', () => {
  it('g4-node shows the board', async () => {
    const { container } = renderChat(kifisia, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    await screen.findByText('Heard on');
    expectBoard('g4-node', container);
  });

  it('shows Message and the three node menus as tiles, with Back to Nodes and ⋯', async () => {
    renderChat(kifisia, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    for (const tile of ['Ask the node', 'Organise', 'Data']) expect(screen.getByRole('button', { name: tile })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toHaveAttribute('href', `${g2}/nodes`);
    expect(screen.getByRole('button', { name: 'Node actions' })).toBeInTheDocument();
  });

  it('collapses the header to one bar once the full header scrolls away', async () => {
    globalThis.IntersectionObserver = class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
    renderChat(kifisia, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    const bar = screen.getByTestId('node-bar');
    expect(bar).not.toHaveAttribute('data-collapsed');
    act(() => observers.forEach((cb) => cb([{ isIntersecting: false }])));
    expect(bar).toHaveAttribute('data-collapsed', 'true');
    expect(bar).toHaveTextContent('Kifisia Rooftop');
    act(() => observers.forEach((cb) => cb([{ isIntersecting: true }])));
    expect(bar).not.toHaveAttribute('data-collapsed');
  });
});
