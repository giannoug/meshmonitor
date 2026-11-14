/**
 * @vitest-environment jsdom
 *
 * Board Main (desktop): the device map with its toolbar, the "On the map"
 * list, and a node's peek (Message, the three node menus, Open node page).
 * The map screen owns its node state (Ruling AD): App is not mounted.
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
  const list = await screen.findByRole('list', { name: 'On the map' }, { timeout: 5000 });
  fireEvent.click(await within(list).findByRole('button', { name: new RegExp(name) }));
  return screen.findByRole('complementary', { name });
}

describe('Main', () => {
  it('Main shows the board', async () => {
    const { container } = renderChat(route);
    await openPeek();
    expectBoard('Main', container);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('the list counts the positioned nodes and leads to Nodes', async () => {
    renderChat(route);
    const list = await screen.findByRole('list', { name: 'On the map' });
    // Seven Athens nodes have a position; Marousi Mobile and Kifisia Weather do not.
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(7));
    expect(screen.getByText('· 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Nodes/ })).toHaveAttribute('href', `${g2}/nodes`);
  });

  it('the peek shows the node, Message and Open node page, and closes', async () => {
    renderChat(route);
    const peek = await openPeek();
    expect(within(peek).getByText('!a1b2c301')).toBeInTheDocument();
    expect(within(peek).getByText('Hops')).toBeInTheDocument();
    expect(within(peek).getByRole('link', { name: /Message/ })).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    for (const menu of ['Ask the node', 'Organise', 'Data']) {
      expect(within(peek).getByRole('button', { name: menu })).toBeInTheDocument();
    }
    expect(within(peek).getByRole('link', { name: /Open node page/ })).toHaveAttribute('href', `${g2}/node/!a1b2c301`);
    fireEvent.click(within(peek).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Kifisia Rooftop' })).toBeNull());
  });

  it('a guest sees the peek without Message or the node menus', async () => {
    renderChat(route, { anonymous: true, permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } } });
    const peek = await openPeek();
    expect(within(peek).queryByRole('link', { name: /Message/ })).toBeNull();
    expect(within(peek).queryByRole('button', { name: 'Organise' })).toBeNull();
    expect(within(peek).getByRole('link', { name: /Open node page/ })).toBeInTheDocument();
  });

  it('More filters opens today\'s filter popup', async () => {
    renderChat(route);
    fireEvent.click(await screen.findByRole('button', { name: /More filters/ }));
    expect(await screen.findByText('Filter Mode')).toBeInTheDocument();
  });

  it('Center on Map in a DM header opens the device map on that node (Ruling AJ closed)', async () => {
    renderChat(`${g2}/dm/!a1b2c301`);
    const head = await screen.findByTestId('dm-header');
    await within(head).findByText('Kifisia Rooftop');
    fireEvent.click(within(head).getByRole('button', { name: 'Organise' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Organise' })).getByRole('button', { name: /Center on Map/ }));
    const peek = await screen.findByRole('complementary', { name: 'Kifisia Rooftop' }, { timeout: 5000 });
    expect(within(peek).getByText('!a1b2c301')).toBeInTheDocument();
  });
});
