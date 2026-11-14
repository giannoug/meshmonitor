/**
 * @vitest-environment jsdom
 *
 * Board 15-05 (desktop): the node dialogs as right-docked sheets: Request
 * Telemetry (Ask the node), Position Override, Copy NodeInfo and Purge Data
 * (Data). The board draws them together only to fit the canvas (s15n3); each
 * opens on its own (D9c), so the check runs over each in turn. Each keeps
 * today's request, wording and gate (CopyNodeInfoModal, PositionOverrideModal,
 * PurgeDataModal logic).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const KIF = 0xa1b2c301;
const posted = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes(path) && (i?.method ?? 'GET') !== 'GET');

const fixtures = {
  'POST /api/nodes/:nodeNum/copy-nodeinfo': () => ({ success: true, data: { copiedFields: ['shortName', 'hwModel'], pushedToDevice: true } }),
  'POST /api/nodes/:nodeId/position-override': () => ({ success: true }),
};

async function openPage(opts = {}) {
  renderChat(kifisia, { fixtures, ...opts });
  await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
}

async function openDialog(menu: 'Ask the node' | 'Data', item: RegExp, title: string | RegExp) {
  const trigger = screen.getByRole('button', { name: menu });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole('group', { name: menu })).getByRole('button', { name: item }));
  return screen.findByRole('dialog', { name: title });
}

const close = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

describe('15-05-node-dialogs', () => {
  it('15-05-node-dialogs shows the board', async () => {
    await openPage();
    const texts: string[] = [];
    const telemetry = await openDialog('Ask the node', /^Request Telemetry/, 'Request Telemetry');
    texts.push(telemetry.textContent ?? '');
    close(telemetry);
    const override = await openDialog('Data', /^Override Position/, 'Position Override: Kifisia Rooftop');
    await within(override).findByText('Latitude', { exact: false });
    texts.push(override.textContent ?? '');
    close(override);
    const copy = await openDialog('Data', /^Copy NodeInfo/, 'Copy NodeInfo');
    await within(copy).findByText('Incoming');
    texts.push(copy.textContent ?? '');
    close(copy);
    const purge = await openDialog('Data', /^Purge Data/, 'Purge Data for Kifisia Rooftop');
    texts.push(purge.textContent ?? '');
    expectBoard('15-05-node-dialogs', joined(...texts));
  });

  it('the dialogs are sheets docked to the right, one open at a time', async () => {
    await openPage();
    const copy = await openDialog('Data', /^Copy NodeInfo/, 'Copy NodeInfo');
    expect(copy).toHaveAttribute('data-side', 'right');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // The Classic modal is not used.
    expect(document.querySelector('.copy-nodeinfo-modal')).toBeNull();
  });

  describe('Copy NodeInfo', () => {
    it("compares each field, says what Push to NodeDB sends, posts today's copy and closes, as today's callers do", async () => {
      await openPage();
      const sheet = within(await openDialog('Data', /^Copy NodeInfo/, 'Copy NodeInfo'));
      expect(await sheet.findByRole('combobox', { name: 'Copy from source' })).toHaveDisplayValue(/^Athens MQTT \(7\/8 fields\)/);
      // Today's default: every field that would change is ticked (seeded once the donor is picked).
      await waitFor(() => expect(sheet.getByRole('checkbox', { name: 'Short Name' })).toBeChecked());
      expect(sheet.getByRole('checkbox', { name: 'Long Name' })).not.toBeChecked();
      expect(sheet.getByText("Sends 1 NodeInfo request on the node's channel")).toBeInTheDocument();
      fireEvent.click(sheet.getByRole('checkbox', { name: 'Push to NodeDB' }));
      fireEvent.click(sheet.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(posted(`/api/nodes/${KIF}/copy-nodeinfo`)).toHaveLength(1));
      const body = JSON.parse(String(posted(`/api/nodes/${KIF}/copy-nodeinfo`)[0][1]!.body));
      expect(body).toMatchObject({ fromSourceId: SOURCE_IDS.mqtt, toSourceId: SOURCE_IDS.g2, pushToNodeDb: true });
      expect(body.fields).toEqual(expect.arrayContaining(['shortName', 'hwModel']));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Copy NodeInfo' })).toBeNull());
    });

    it('Push to NodeDB is off by default, so a copy sends nothing', async () => {
      await openPage();
      const sheet = within(await openDialog('Data', /^Copy NodeInfo/, 'Copy NodeInfo'));
      await sheet.findByRole('combobox', { name: 'Copy from source' });
      expect(sheet.getByRole('checkbox', { name: 'Push to NodeDB' })).not.toBeChecked();
      // Confirm turns on once today's default ticks are seeded from the donor.
      await waitFor(() => expect(sheet.getByRole('button', { name: 'Confirm' })).toBeEnabled());
      fireEvent.click(sheet.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(posted(`/api/nodes/${KIF}/copy-nodeinfo`)).toHaveLength(1));
      expect(JSON.parse(String(posted(`/api/nodes/${KIF}/copy-nodeinfo`)[0][1]!.body)).pushToNodeDb).toBe(false);
    });
  });

  describe('Position Override', () => {
    it("loads the saved override, says it sends nothing, and saves through today's request", async () => {
      await openPage();
      const sheet = within(await openDialog('Data', /^Override Position/, 'Position Override: Kifisia Rooftop'));
      expect(await sheet.findByRole('checkbox', { name: 'Use this custom position' })).toBeChecked();
      expect(sheet.getByRole('checkbox', { name: /Private Position/ })).toBeChecked();
      expect(sheet.getByLabelText(/^Latitude/)).toHaveValue(38.0741);
      expect(sheet.getByText('Sends nothing on the mesh')).toBeInTheDocument();
      fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(posted('/api/nodes/!a1b2c301/position-override')).toHaveLength(1));
      expect(JSON.parse(String(posted('/api/nodes/!a1b2c301/position-override')[0][1]!.body))).toEqual({
        enabled: true, latitude: 38.0741, longitude: 23.8112, altitude: 310, isPrivate: true, sourceId: SOURCE_IDS.g2,
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});
