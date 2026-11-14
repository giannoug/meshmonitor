/**
 * @vitest-environment jsdom
 *
 * Board 15-22 (phone): the node page's Data tile opens the Node actions sheet
 * on its tab (s15n5). The board's viewer lacks nodes:write and
 * messages:write, so every item stays listed, off, with today's reason.
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

describe('15-22-data-menu', () => {
  it('15-22-data-menu shows the board', async () => {
    const sheet = await openTile('Data');
    expect(within(sheet).getByRole('tab', { name: 'Data' })).toHaveAttribute('aria-selected', 'true');
    expectBoard('15-22-data-menu', sheet);
  });

  it("each Data item is off with today's reason", async () => {
    const sheet = within(await openTile('Data'));
    const reasons: Array<[string, string]> = [
      ['Override Position', 'Needs nodes:write'],
      ['Copy NodeInfo', 'Needs nodes:write'],
      ['Merge history…', 'Admins only, with nodes:write'],
      ['Purge Data', 'Needs messages:write'],
    ];
    for (const [label, reason] of reasons) {
      const button = sheet.getByRole('button', { name: new RegExp(`^${label}`) });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', reason);
    }
  });
});
