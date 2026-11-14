/**
 * @vitest-environment jsdom
 *
 * Board 15-06 (desktop): Merge node history as a right-docked sheet, opened
 * from the Admin tab's renumbering notice (Merge history…). Today's dry run
 * (NodeIdentityMergeDialog's logic): the per-table plan, the totals, the
 * unverified-pairing warning, Before you confirm, and — for a merge too large
 * to undo — today's check box, which must be ticked before Merge history turns
 * on (s15n2). Merging is admins only, as today.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia, renumberedFixtures } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const posted = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).endsWith(path) && (i?.method ?? 'GET') !== 'GET');

const fixtures = {
  ...renumberedFixtures,
  'POST /api/nodes/identity-changes/merge': () => ({ success: true, data: { mergeId: 'm1' } }),
};
/** nodes:write on Station G2, but not an admin. */
const writer = { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: true }, messages: { read: true, write: true } } } } };

async function openMerge() {
  renderChat(`${kifisia}/admin`, { fixtures });
  fireEvent.click(await screen.findByRole('button', { name: /Merge history…/ }, { timeout: 5000 }));
  const sheet = await screen.findByRole('dialog', { name: 'Merge node history' });
  await within(sheet).findByText('Rows moved:');
  return sheet;
}

describe('15-06-identity-merge', () => {
  it('15-06-identity-merge shows the board', async () => {
    const sheet = await openMerge();
    expectBoard('15-06-identity-merge', sheet);
  });

  it('is a right-docked sheet, not the Classic dialog, and asks for the dry run only', async () => {
    const sheet = await openMerge();
    expect(sheet).toHaveAttribute('data-side', 'right');
    expect(screen.queryByTestId('node-identity-merge-dialog')).toBeNull();
    expect(JSON.parse(String(posted('/api/nodes/identity-changes/merge/preview')[0][1]!.body))).toEqual({
      sourceId: SOURCE_IDS.g2, fromNodeNum: 0x7e01b2c4, toNodeNum: 0xa1b2c301,
    });
    expect(posted('/api/nodes/identity-changes/merge')).toHaveLength(0);
    expect(within(sheet).getByText("Sends nothing on the mesh; MeshMonitor's database only")).toBeInTheDocument();
    expect(within(sheet).getByRole('columnheader', { name: 'Column' })).toBeInTheDocument();
  });

  it('Merge history stays disabled until the check box is ticked, then merges with the acknowledgement', async () => {
    const sheet = within(await openMerge());
    const confirm = sheet.getByRole('button', { name: 'Merge history' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(posted('/api/nodes/identity-changes/merge')).toHaveLength(0);
    fireEvent.click(sheet.getByRole('checkbox', { name: 'I understand this merge is permanent and cannot be reversed.' }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(posted('/api/nodes/identity-changes/merge')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/nodes/identity-changes/merge')[0][1]!.body))).toMatchObject({
      sourceId: SOURCE_IDS.g2, fromNodeNum: 0x7e01b2c4, toNodeNum: 0xa1b2c301, acknowledgeNoUndo: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge node history' })).toBeNull());
  });

  it('an admin also reaches it from Data › Merge history…', async () => {
    renderChat(kifisia, { fixtures });
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    const item = within(screen.getByRole('group', { name: 'Data' })).getByRole('button', { name: /^Merge history…/ });
    await waitFor(() => expect(item).toBeEnabled());
    fireEvent.click(item);
    expect(await screen.findByRole('dialog', { name: 'Merge node history' })).toHaveAttribute('data-side', 'right');
  });

  it('is offered only to admins: a non-admin with nodes:write gets no notice button and an off Data item', async () => {
    renderChat(`${kifisia}/admin`, { fixtures, ...writer });
    await screen.findByText('Node number changed (Meshtastic 2.8)', undefined, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: /Merge history…/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    const item = within(screen.getByRole('group', { name: 'Data' })).getByRole('button', { name: /^Merge history…/ });
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute('title', 'Admins only, with nodes:write');
  });
});
