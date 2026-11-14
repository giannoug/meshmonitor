/**
 * @vitest-environment jsdom
 *
 * Board g2-layers (phone): the Layers sheet over the phone map. It holds the
 * same groups as the desktop drawer (f2-layers), built by the same hook; a
 * toggle changes the map at once.
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

const route = `/source/${SOURCE_IDS.g2}/map`;

async function openLayers() {
  renderChat(route, { phone: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Layers' }, { timeout: 5000 }));
  return screen.findByRole('dialog', { name: 'Layers' });
}

describe('g2-layers', () => {
  it('g2-layers shows the board', async () => {
    const sheet = await openLayers();
    await within(sheet).findByText('Ducting');
    expectBoard('g2-layers', document.body);
  });

  it('holds the desktop groups, and a toggle changes the map at once', async () => {
    const sheet = await openLayers();
    for (const group of ['Base map', 'Nodes', 'Links', 'Analysis', 'Overlays']) {
      expect(within(sheet).getByRole('heading', { name: group })).toBeInTheDocument();
    }
    const neighbours = within(sheet).getByRole('switch', { name: 'Show Neighbor Info' });
    fireEvent.click(neighbours);
    expect(neighbours).toBeChecked();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Layers' })).toBeNull());
    expect(await screen.findByText(/click a link for its peek/)).toBeInTheDocument();
  });
});
