/**
 * @vitest-environment jsdom
 *
 * Board 15-18 (phone): Purge Data as a bottom sheet from the Data tile, a
 * plain confirm with no typed word (s15n5): today's four purges, keep / delete
 * locally / purge from the device, the tracked-asset warning and the device
 * line. No item counts (Ruling 2.4: no count API).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const KIF = 0xa1b2c301;
const posted = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes(path) && (i?.method ?? 'GET') !== 'GET');
const ok = () => ({ success: true, deletedCount: 3, messagesDeleted: 3, traceroutesDeleted: 2, telemetryDeleted: 1 });

async function openPurge(opts = {}) {
  renderChat(kifisia, {
    phone: true,
    fixtures: { 'DELETE /api/messages/nodes/:nodeNum': ok, 'DELETE /api/messages/nodes/:nodeNum/telemetry': ok },
    ...opts,
  });
  await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: 'Data' }));
  const actions = await screen.findByRole('dialog', { name: /Node actions/ });
  fireEvent.click(within(actions).getByRole('button', { name: /^Purge Data/ }));
  return screen.findByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' });
}

describe('15-18-node-dialogs', () => {
  it('15-18-node-dialogs shows the board', async () => {
    const sheet = await openPurge();
    // The board shows the device choice's line and "Keep the node"; the device line shows once it is picked.
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Purge from Device AND Database' }));
    expectBoard('15-18-node-dialogs', sheet);
  });

  it('is a bottom sheet, alone (the Node actions sheet closed)', async () => {
    const sheet = await openPurge();
    expect(sheet).toHaveAttribute('data-side', 'bottom');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it("Delete Node runs the picked purges, then today's local delete, and leaves the node page", async () => {
    const sheet = within(await openPurge());
    fireEvent.click(sheet.getByRole('checkbox', { name: 'Purge Telemetry' }));
    fireEvent.click(sheet.getByRole('radio', { name: 'Delete Node (Local Database Only)' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Purge' }));
    await waitFor(() => expect(posted(`/api/messages/nodes/${KIF}`).filter(([u]) => String(u).endsWith(`/nodes/${KIF}`))).toHaveLength(1));
    expect(posted(`/api/messages/nodes/${KIF}/telemetry`)).toHaveLength(1);
    const del = posted(`/api/messages/nodes/${KIF}`).find(([u]) => String(u).endsWith(`/nodes/${KIF}`))!;
    expect(del[1]!.method).toBe('DELETE');
    expect(JSON.parse(String(del[1]!.body))).toEqual({ sourceId: SOURCE_IDS.g2 });
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'Kifisia Rooftop' })).toBeNull());
  });

  it('is off without messages:write, with the reason', async () => {
    renderChat(kifisia, {
      phone: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: true }, messages: { read: true, write: false } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    const actions = within(await screen.findByRole('dialog', { name: /Node actions/ }));
    expect(actions.getByRole('button', { name: /^Purge Data/ })).toHaveAttribute('title', 'Needs messages:write');
  });
});
