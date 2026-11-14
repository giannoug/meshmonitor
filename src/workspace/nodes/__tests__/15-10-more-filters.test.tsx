/**
 * @vitest-environment jsdom
 *
 * Board 15-10 (desktop): More filters, every field of today's filter popup in
 * today's words, on the filters the map shares. A change applies at once;
 * Reset All restores the defaults. The map's More filters opens the same panel.
 */
import type { ReactNode } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
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

const table = () => screen.findByRole('table', {}, { timeout: 5000 });

async function openFilters() {
  renderChat(route);
  await within(await table()).findByText('Kifisia Rooftop');
  fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
  return screen.findByRole('dialog', { name: /More filters/ });
}

describe('15-10-more-filters', () => {
  beforeEach(() => localStorage.removeItem('nodeFilters'));

  it('15-10-more-filters shows the board', async () => {
    await openFilters();
    expectBoard('15-10-more-filters', document.body);
  });

  it('a filter applies at once and counts as on; Reset All clears it', async () => {
    const sheet = await openFilters();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Position data' }));
    // Marousi Mobile has no position.
    await waitFor(async () => expect(within(await table()).queryByText('Marousi Mobile')).toBeNull());
    expect(within(sheet).getByRole('heading', { name: /1 on/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nodeFilters') ?? '{}').showPosition).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset All' }));
    expect(await within(await table()).findByText('Marousi Mobile')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /More filters/ })).toBeNull());
  });

  it('unchecking one device role keeps the other twelve', async () => {
    const sheet = await openFilters();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Router' }));
    await waitFor(async () => expect(within(await table()).queryByText('Kifisia Rooftop')).toBeNull());
    expect(JSON.parse(localStorage.getItem('nodeFilters') ?? '{}').deviceRoles).toHaveLength(12);
  });

  it("the map's More filters opens the same panel", async () => {
    renderChat(`${g2}/map`);
    fireEvent.click(await screen.findByRole('button', { name: /More filters/ }, { timeout: 5000 }));
    const sheet = await screen.findByRole('dialog', { name: /More filters/ });
    expect(within(sheet).getByText("The map's More filters opens the same panel. Sends nothing on the mesh.")).toBeInTheDocument();
  });
});
