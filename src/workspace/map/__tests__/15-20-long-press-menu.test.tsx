/**
 * @vitest-environment jsdom
 *
 * Board 15-20 (phone): a long-press on the map opens the same menu as the
 * desktop's right-click (touch browsers fire `contextmenu` on a hold, which
 * Leaflet passes on), with the phone's hint chip.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

import { mapRoute, openMapMenu } from './mapEditHelpers';

describe('15-20-long-press-menu', () => {
  it('15-20-long-press-menu shows the board', async () => {
    renderChat(mapRoute, { phone: true });
    await openMapMenu();
    expectBoard('15-20-long-press-menu', document.body);
  });

  it('the menu lists the three actions, and the map button is the non-gesture path', async () => {
    renderChat(mapRoute, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Map actions' }, { timeout: 5000 }));
    const menu = await screen.findByRole('menu', { name: 'Map actions' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^Add waypoint here/), expect.stringMatching(/^Add local marker here/), expect.stringMatching(/^Measure from here/),
    ]);
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
