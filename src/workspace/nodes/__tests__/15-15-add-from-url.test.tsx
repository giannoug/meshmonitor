/**
 * @vitest-environment jsdom
 *
 * Board 15-15 (phone): Add node from URL is the + in the Nodes header. It is
 * today's ImportContactUrlModal with a Sends line: it sends nothing on the
 * mesh and adds a row the list marks Imported until the node is heard.
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
const route = `${g2}/nodes`;

describe('15-15-add-from-url', () => {
  it('15-15-add-from-url shows the board', async () => {
    renderChat(route, { phone: true });
    await within(await screen.findByRole('list', { name: 'Nodes' }, { timeout: 5000 })).findByText('Imported');
    fireEvent.click(screen.getByRole('button', { name: 'Add node from URL' }));
    await screen.findByRole('dialog', { name: 'Add node from URL' });
    expectBoard('15-15-add-from-url', document.body);
  });

  it('Add node posts the link for this device and confirms it', async () => {
    const posted: unknown[] = [];
    renderChat(route, {
      phone: true,
      fixtures: {
        'POST /api/nodes/import-contact-url': (_url, init) => {
          posted.push(JSON.parse(String(init?.body)));
          return { success: true, data: { node: { nodeNum: 1, user: { id: '!00000001', longName: 'Penteli Hiker' } }, alreadyKnown: false } };
        },
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add node from URL' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog', { name: 'Add node from URL' });
    expect(within(dialog).getByText(/Sends nothing on the mesh; adds the node to Station G2/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'https://meshtastic.org/v/#abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add node' }));
    expect(await screen.findByText('Added Penteli Hiker')).toBeInTheDocument();
    expect(posted).toEqual([{ url: 'https://meshtastic.org/v/#abc', sourceId: SOURCE_IDS.g2 }]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add node from URL' })).toBeNull());
  });
});
