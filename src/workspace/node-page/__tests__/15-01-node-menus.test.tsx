/**
 * @vitest-environment jsdom
 *
 * Board 15-01 (desktop): the node page header's three menus, Ask the node,
 * Organise and Data, with today's gates. The board draws the three open
 * together only to fit the canvas (s15n0); in the product one opens at a time
 * (D9c), so the check runs over each menu in turn. Data ends with the
 * "Who can use these" card, today's gates in words.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

/** The board's viewer: every ask and edit, but not settings:write (Scan for Admin is off). */
const operator = {
  permissions: {
    bySource: {
      [SOURCE_IDS.g2]: {
        nodes: { read: true, write: true }, messages: { read: true, write: true }, traceroute: { read: true, write: true },
      },
    },
  },
};

type MenuName = 'Ask the node' | 'Organise' | 'Data';

async function openPage(opts = {}) {
  renderChat(kifisia, opts);
  return screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
}

function openMenu(name: MenuName) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  return screen.getByRole('group', { name });
}

describe('15-01-node-menus', () => {
  it('15-01-node-menus shows the board', async () => {
    await openPage(operator);
    const names = ['Ask the node', 'Organise', 'Data'] as const;
    const texts = names.map((name) => {
      const text = openMenu(name).parentElement!.textContent ?? '';
      fireEvent.click(screen.getByRole('button', { name })); // closes it again
      return text;
    });
    expectBoard('15-01-node-menus', joined(...names.map((name) => screen.getByRole('button', { name })), ...texts));
  });

  it('opens one menu at a time', async () => {
    await openPage();
    openMenu('Ask the node');
    openMenu('Data');
    expect(screen.queryByRole('group', { name: 'Ask the node' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Data' })).toBeInTheDocument();
  });

  it("Data ends with today's gates in words: Who can use these", async () => {
    await openPage();
    const card = within(openMenu('Data').parentElement!).getByRole('note', { name: 'Who can use these' });
    expect(card).toHaveTextContent('An item you lack stays listed, off.');
    expect(card).toHaveTextContent('traceroute:write · Traceroute, Request Neighbors');
    expect(card).toHaveTextContent('messages:write · Exchange Node Info, Exchange Position, Request Telemetry, Purge Data');
    expect(card).toHaveTextContent('settings:write · Scan for Admin');
    expect(card).toHaveTextContent('nodes:write · Organise items, Override Position; Copy NodeInfo, with nodes:read on its source');
    expect(card).toHaveTextContent('admins only + nodes:write · Merge history…');
  });

  it('Data items say what each dialog does', async () => {
    await openPage();
    const data = within(openMenu('Data'));
    expect(data.getByRole('button', { name: /^Override Position/ })).toHaveTextContent('Set latitude, longitude, altitude · private');
    expect(data.getByRole('button', { name: /^Copy NodeInfo/ })).toHaveTextContent('From another source: compare each field, push to the radio');
    expect(data.getByRole('button', { name: /^Merge history…/ })).toHaveTextContent('Move history from its old node number · dry run first');
    expect(data.getByRole('button', { name: /^Purge Data/ })).toHaveTextContent('Messages, traceroutes, telemetry, position history, the node · asks first');
  });
});
