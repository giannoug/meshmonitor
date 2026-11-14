/**
 * @vitest-environment jsdom
 *
 * Board 15-19 (phone): Merge node history as a bottom sheet (s15n5), here from
 * the Data tile's Merge history…; the same dry run, warnings and check box as
 * 15-06, and Merge history stays off until the box is ticked.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia, renumberedFixtures } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

async function openMerge() {
  renderChat(kifisia, { phone: true, fixtures: renumberedFixtures });
  await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: 'Data' }));
  const actions = within(await screen.findByRole('dialog', { name: /Node actions/ }));
  const item = actions.getByRole('button', { name: /^Merge history…/ });
  await waitFor(() => expect(item).toBeEnabled());
  fireEvent.click(item);
  const sheet = await screen.findByRole('dialog', { name: 'Merge node history' });
  await within(sheet).findByText('Rows moved:');
  return sheet;
}

describe('15-19-identity-merge', () => {
  it('15-19-identity-merge shows the board', async () => {
    const sheet = await openMerge();
    expectBoard('15-19-identity-merge', sheet);
  });

  it('drops the Column column, as the phone board does', async () => {
    const sheet = within(await openMerge());
    expect(sheet.getByRole('columnheader', { name: 'Action' })).toBeInTheDocument();
    expect(sheet.queryByRole('columnheader', { name: 'Column' })).toBeNull();
  });

  it('is a bottom sheet, alone, with Merge history off until the box is ticked', async () => {
    const sheet = await openMerge();
    expect(sheet).toHaveAttribute('data-side', 'bottom');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const confirm = within(sheet).getByRole('button', { name: 'Merge history' });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: /I understand this merge is permanent/ }));
    expect(confirm).toBeEnabled();
  });
});
