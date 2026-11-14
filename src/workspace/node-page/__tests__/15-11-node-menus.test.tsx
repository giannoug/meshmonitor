/**
 * @vitest-environment jsdom
 *
 * Board 15-11 (phone): the node page's Organise tile opens the Node actions
 * sheet on its tab (s15n5). The board's viewer lacks nodes:write, so every
 * item stays listed, off, with today's reason.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

/** Reads the node and its messages; changes nothing. */
const reader = { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false }, messages: { read: true, write: false } } } } };

async function openTile(name: 'Organise' | 'Data') {
  renderChat(kifisia, { phone: true, ...reader });
  await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog', { name: /Node actions/ });
}

describe('15-11-node-menus', () => {
  it('15-11-node-menus shows the board', async () => {
    const sheet = await openTile('Organise');
    expect(within(sheet).getByRole('tab', { name: 'Organise' })).toHaveAttribute('aria-selected', 'true');
    expectBoard('15-11-node-menus', sheet);
  });

  it('every Organise item is off without nodes:write, the Aircraft marks and Apply to all sources too', async () => {
    const sheet = within(await openTile('Organise'));
    for (const label of ['Add to favorites', 'Set Favorite Lock', 'Ignore Node', 'Hide from Map', 'Mark as aircraft', 'Clear aircraft override']) {
      expect(sheet.getByRole('button', { name: new RegExp(`^${label}`) })).toBeDisabled();
    }
    expect(sheet.getByRole('checkbox', { name: 'Apply to all sources' })).toBeDisabled();
  });
});
