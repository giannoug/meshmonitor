/**
 * @vitest-environment jsdom
 *
 * Board g1-map (phone, ds4): the device map full screen under the tab bar,
 * with Back, the search pill and Layers on top and the map buttons down the
 * right. A node's peek is a bottom sheet with Message and the three node
 * menus as tiles; swiping it up opens the node page.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const route = `${g2}/map`;

async function openPeek(name = 'Kifisia Rooftop') {
  fireEvent.click(await screen.findByRole('button', { name: 'Node list' }, { timeout: 5000 }));
  const list = await screen.findByRole('list', { name: 'On the map' });
  fireEvent.click(await within(list).findByRole('button', { name: new RegExp(name) }));
  return screen.findByRole('dialog', { name });
}

describe('g1-map', () => {
  it('g1-map shows the board', async () => {
    renderChat(route, { phone: true });
    // The board's state: Show Traceroute off (today it defaults on, with its mode banner).
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off Show Traceroute' }, { timeout: 5000 }));
    const peek = await openPeek();
    await within(peek).findByText('Swipe up for the node page');
    expectBoard('g1-map', document.body);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('is full screen: no device header, Back to Home, today\'s filter as the search pill', async () => {
    renderChat(route, { phone: true });
    const search = await screen.findByRole('searchbox', { name: 'Filter nodes' }, { timeout: 5000 });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', g2);
    expect(screen.getByRole('navigation', { name: /tab/i })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Hymettus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Node list' }));
    const list = await screen.findByRole('list', { name: 'On the map' });
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(1));
    expect(within(list).getByRole('button', { name: /Hymettus Relay/ })).toBeInTheDocument();
  });

  it('the peek has Message and the three menus as tiles, each opening the actions sheet on its tab', async () => {
    renderChat(route, { phone: true });
    const peek = await openPeek();
    expect(within(peek).getByRole('link', { name: /Message/ })).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    expect(within(peek).getByRole('link', { name: /Open node page/ })).toHaveAttribute('href', `${g2}/node/!a1b2c301`);
    fireEvent.click(within(peek).getByRole('button', { name: 'Organise' }));
    const sheet = await screen.findByRole('dialog', { name: /Node actions/ });
    expect(within(sheet).getByRole('tab', { name: 'Organise' })).toHaveAttribute('aria-selected', 'true');
    expect(within(sheet).getByRole('button', { name: /Center on Map/ })).toBeInTheDocument();
  });

  it('swiping the peek up opens the node page', async () => {
    renderChat(route, { phone: true });
    const peek = await openPeek();
    fireEvent.pointerDown(peek, { clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(peek, { clientY: 480, pointerId: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kifisia Rooftop' })).toBeNull());
    expect(await screen.findByTestId('page-app')).toBeInTheDocument();
  });

  it('a tap, a short drag or a swipe down does not leave the map', async () => {
    renderChat(route, { phone: true });
    const peek = await openPeek();
    for (const [down, up] of [[600, 600], [600, 570], [400, 600]]) {
      fireEvent.pointerDown(peek, { clientY: down, pointerId: 1 });
      fireEvent.pointerUp(peek, { clientY: up, pointerId: 1 });
    }
    expect(screen.getByRole('dialog', { name: 'Kifisia Rooftop' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('a drag up inside the node actions sheet opened from the peek does not leave the map', async () => {
    renderChat(route, { phone: true });
    const peek = await openPeek();
    fireEvent.click(within(peek).getByRole('button', { name: 'Data' }));
    const sheet = await screen.findByRole('dialog', { name: /Node actions/ });
    fireEvent.pointerDown(sheet, { clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(sheet, { clientY: 400, pointerId: 1 });
    expect(screen.getByRole('dialog', { name: 'Kifisia Rooftop' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('Center on Map from a DM on the phone opens the phone map on that node', async () => {
    renderChat(`${g2}/dm/!a1b2c301`, { phone: true });
    const head = await screen.findByTestId('dm-header');
    await within(head).findByText('Kifisia Rooftop');
    fireEvent.click(within(head).getByRole('button', { name: 'Node actions' }));
    const sheet = await screen.findByRole('dialog', { name: /Node actions/ });
    fireEvent.click(within(sheet).getByRole('tab', { name: 'Organise' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /Center on Map/ }));
    const peek = await screen.findByRole('dialog', { name: 'Kifisia Rooftop' }, { timeout: 5000 });
    expect(within(peek).getByText('Swipe up for the node page')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Filter nodes' })).toBeInTheDocument();
  });
});
