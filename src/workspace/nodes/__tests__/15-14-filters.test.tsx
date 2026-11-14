/**
 * @vitest-environment jsdom
 *
 * Board 15-14 (phone): the Filters bottom sheet, the same fields as 15-10;
 * Device role and Channel open as lists (s15n5).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
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

describe('15-14-filters', () => {
  it('15-14-filters shows the board', async () => {
    renderChat(route, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }, { timeout: 5000 }));
    const sheet = await screen.findByRole('dialog', { name: /Filters/ });
    expectBoard('15-14-filters', document.body);
    // Device role opens as a list: its summary says all are chosen.
    const roles = within(sheet).getByText('Device Role').closest('details')!;
    expect(roles).not.toHaveAttribute('open');
    expect(within(roles).getAllByRole('checkbox', { hidden: true })).toHaveLength(13);
    expect(within(sheet).queryByText("The map's More filters opens the same panel. Sends nothing on the mesh.")).toBeNull();
  });
});
