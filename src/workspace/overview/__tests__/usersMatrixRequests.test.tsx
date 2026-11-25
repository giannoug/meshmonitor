/**
 * @vitest-environment jsdom
 *
 * Task 4.8's mandatory check: changing one permission in the Workspace sends
 * exactly the request today's UsersTab sends for the same (user, source,
 * resource) change. Today's PUT replaces the user's whole grant set for the
 * source (and the whole global set), so the Workspace must send that whole
 * set with only the one cell changed: the untouched cells round-trip, and no
 * other device is written.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import UsersTab from '../../../components/UsersTab';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { usersFixtures } from '../../__fixtures__/users';
import { cell, openUser, renderUsers, writes, type Sent } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/** Today's page: select nikos, pick the scope, run `change`, press `save`; returns the one write it sent. */
async function classicSends(scope: string, change: () => void, save = 'Save Permissions'): Promise<Sent> {
  const view = renderWorkspace(<ToastProvider><UsersTab /></ToastProvider>, { fixtures: usersFixtures });
  fireEvent.click(await screen.findByText('nikos', {}, { timeout: 5000 }));
  await screen.findByText('Node Details & DM');
  const select = view.container.querySelector<HTMLSelectElement>('#permission-scope-select')!;
  if (select.value !== scope) {
    fireEvent.change(select, { target: { value: scope } });
    await waitFor(() => expect(select.value).toBe(scope));
  }
  // The scope's grants have loaded once Node Details & DM shows them.
  await waitFor(() => expect(within(rowOf('Node Details & DM')).getByLabelText('Read')).toBeChecked());
  change();
  fireEvent.click(screen.getByRole('button', { name: save }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  const [sent] = writes();
  view.unmount();
  return sent;
}

const rowOf = (label: string) => screen.getAllByText(label, { exact: true }).map((el) => el.closest<HTMLElement>('.permission-item')).find(Boolean)!;
const tick = (row: string, box: string) => fireEvent.click(within(rowOf(row)).getByLabelText(box));

async function workspaceSends(act: () => Promise<unknown>): Promise<Sent[]> {
  renderUsers('/overview/users');
  await openUser('nikos');
  fireEvent.click(await screen.findByRole('tab', { name: 'Permissions' }));
  await act();
  await waitFor(() => expect(writes().length).toBeGreaterThan(0));
  return writes();
}

const r = { read: true, write: false };

describe('Users › one permission change sends exactly today\'s request', () => {
  it('a device cell: Node Details & DM on Heltec MeshCore, Read → Write', async () => {
    const classic = await classicSends(S.heltec, () => tick('Node Details & DM', 'Write'));
    const sent = await workspaceSends(async () => fireEvent.click(await cell('Node Details & DM', 'Heltec MeshCore')));

    expect(sent).toEqual([classic]);
    expect(sent[0]).toMatchObject({ method: 'PUT', url: '/api/users/3/permissions' });
    // The whole set for Heltec, only messages changed; the globals ride along as today; no other device.
    expect(sent[0].body).toEqual({
      sourceId: S.heltec,
      permissions: {
        dashboard: r, info: r, automations: r,
        messages: { read: true, write: true },
        nodes: { viewOnMap: true, read: true, write: false },
        connection: r, packetmonitor: r,
      },
    });
  });

  it('a channel cell: Channel 1 on Station G2, Read → Write (write implies read, as today)', async () => {
    const classic = await classicSends(S.g2, () => tick('Channel 1 (gauntlet)', 'Send Messages'));
    const sent = await workspaceSends(async () => fireEvent.click(await cell('Channel 1', 'Station G2')));
    expect(sent).toEqual([classic]);
    expect((sent[0].body as { sourceId: string }).sourceId).toBe(S.g2);
  });

  it('View on Map on a channel cell: Channel 1 on Station G2', async () => {
    const classic = await classicSends(S.g2, () => tick('Channel 1 (gauntlet)', 'View on Map'));
    const sent = await workspaceSends(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'View on Map: Channel 1 on Station G2' })));
    expect(sent).toEqual([classic]);
  });

  it('an install-wide row: Automations (all rules), Read → Write, sent as today from the first device\'s scope', async () => {
    const classic = await classicSends(S.g2, () => tick('Automations', 'Write'));
    const sent = await workspaceSends(async () =>
      fireEvent.click(within(await screen.findByRole('group', { name: 'Automations (all rules)' })).getByRole('button', { name: 'Write' })));
    expect(sent).toEqual([classic]);
  });

  it('a cell on one device never writes another: Rooftop RAK sends only Rooftop RAK\'s set', async () => {
    const sent = await workspaceSends(async () => fireEvent.click(await cell('Traceroute', 'Rooftop RAK')));
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({
      sourceId: S.rak,
      permissions: {
        dashboard: r, info: r, automations: r,
        messages: { read: true, write: true },
        nodes: { viewOnMap: false, read: true, write: false },
        channel_0: { viewOnMap: false, read: true, write: false },
        traceroute: { read: false, write: false },
      },
    });
  });

  it('a virtual channel: Read Messages on #athens, then Save, as today', async () => {
    const classic = await classicSends(S.g2, () => tick('#athens', 'Read Messages'), 'Save Virtual Channel Permissions');
    const sent = await workspaceSends(async () => {
      const entry = await screen.findByRole('group', { name: '#athens' });
      fireEvent.click(within(entry).getByLabelText('Read Messages'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Virtual Channel Permissions' }));
    });
    expect(sent).toEqual([classic]);
  });
});
