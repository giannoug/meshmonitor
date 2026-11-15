/**
 * @vitest-environment jsdom
 *
 * Board 6-07-nodeinfo-enrichment (desktop, s6n0/s6n1): NodeInfo Enrichment
 * under Reports with today's analysis, Refresh, "Also push to device NodeDB",
 * Fix All and per-row Fix (today's `POST /api/nodes/enrichment/apply`, no
 * confirm, as today), and a row's copy preview (CopyNodeInfoSheet). With push
 * on, the page carries the Sends line next to Fix All (s6n1).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports, reply } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const SENDS = 'Sends 1 NodeInfo request per row from the target device, on that node’s channel';
const ROUTE = '/overview/reports/nodeinfo-enrichment';

function applied() {
  return vi.fn((_url: URL, init?: RequestInit) => {
    const items = (JSON.parse(String(init?.body)) as { items: unknown[] }).items;
    return { success: true, data: { applied: items.map((i) => ({ ...(i as object), copiedFields: ['hwModel'], pushedToDevice: true })), totalFieldsCopied: items.length } };
  });
}

describe('6-07-nodeinfo-enrichment', () => {
  it('6-07-nodeinfo-enrichment shows the board', async () => {
    renderReports(ROUTE);
    // The page is its own chunk; the first render waits for it.
    await screen.findByText('Marousi Mobile', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also push to device NodeDB' }));
    fireEvent.click(screen.getByText('Marousi Mobile'));
    await screen.findByRole('dialog', { name: 'Copy NodeInfo' });
    await within(screen.getByRole('dialog')).findByText('Athens MQTT', { exact: false });
    expectBoard('6-07-nodeinfo-enrichment', document.body);
  });

  it('heads the page as a live report with Refresh and Back', async () => {
    renderReports(ROUTE);
    expect(await screen.findByRole('heading', { level: 1, name: 'NodeInfo Enrichment' })).toBeInTheDocument();
    expect(screen.getByText('Live · reads stored data when opened')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/overview/reports');
  });

  it('shows the Sends line next to Fix All only while push is on', async () => {
    renderReports(ROUTE);
    await screen.findByText('Marousi Mobile');
    expect(screen.queryByText(SENDS, { exact: false })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also push to device NodeDB' }));
    const line = screen.getByText(SENDS, { exact: false });
    expect(line).toHaveTextContent('Fix all now ≈ 4 packets, more with hops');
    // Beside Fix All, in the push card.
    const card = screen.getByTestId('enrichment-push');
    expect(card).toContainElement(line);
    expect(within(card).getByRole('button', { name: 'Fix All' })).toBeInTheDocument();
  });

  it('Fix All posts exactly today’s request on one click (no confirm, as today)', async () => {
    const apply = applied();
    renderReports(ROUTE, { fixtures: { 'POST /api/nodes/enrichment/apply': apply } });
    await screen.findByText('Marousi Mobile');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also push to device NodeDB' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fix All' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(apply.mock.calls[0][1]?.body))).toEqual({
      items: [
        { nodeNum: 0xa1b2c305, targetSourceId: 'src-rak', donorSourceId: 'src-g2' },
        { nodeNum: 0xa1b2c303, targetSourceId: 'src-mqtt', donorSourceId: 'src-g2' },
        { nodeNum: 0xa1b2c306, targetSourceId: 'src-rak', donorSourceId: 'src-mqtt' },
        { nodeNum: 0xa1b2c304, targetSourceId: 'src-mqtt', donorSourceId: 'src-rak' },
      ],
      pushToNodeDb: true,
    });
    expect(await screen.findByText('Copied 4 field(s) across 4 target(s)')).toBeInTheDocument();
  });

  it('a row’s Fix posts that row only, with push off by default', async () => {
    const apply = applied();
    renderReports(ROUTE, { fixtures: { 'POST /api/nodes/enrichment/apply': apply } });
    await screen.findByText('Glyfada Beach');
    const row = screen.getByText('Glyfada Beach').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Fix' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(apply.mock.calls[0][1]?.body))).toEqual({
      items: [{ nodeNum: 0xa1b2c303, targetSourceId: 'src-mqtt', donorSourceId: 'src-g2' }],
      pushToNodeDb: false,
    });
    // Fix does not also open the preview.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Today's ApiService reads a 403's body for its CSRF check first, so the toast carries its generic message.
  it('a 403 from apply shows today’s error and sends nothing more', async () => {
    const apply = vi.fn(() => reply(403, { success: false, error: 'Insufficient permission', code: 'FORBIDDEN' }));
    renderReports(ROUTE, { fixtures: { 'POST /api/nodes/enrichment/apply': apply } });
    await screen.findByText('Marousi Mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Fix All' }));
    expect(await screen.findByText('Request failed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fix All' })).not.toBeDisabled());
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('the copy preview is a confirm sheet that Enter does not submit (it can transmit)', async () => {
    const copy = vi.fn((_url: URL, _init?: RequestInit) => ({ success: true, data: { copiedFields: ['hwModel'], pushedToDevice: false } }));
    renderReports(ROUTE, { fixtures: { 'POST /api/nodes/:nodeNum/copy-nodeinfo': copy } });
    await screen.findByText('Marousi Mobile');
    fireEvent.click(screen.getByText('Marousi Mobile'));
    const sheet = await screen.findByRole('dialog', { name: 'Copy NodeInfo' });
    const confirm = await within(sheet).findByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    fireEvent.submit(sheet.querySelector('form')!);
    expect(copy).not.toHaveBeenCalled();
    expect(within(sheet).getByText("Sends 1 NodeInfo request on the node's channel")).toBeInTheDocument();
    fireEvent.click(confirm);
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    expect(String(copy.mock.calls[0][0])).toContain(`/api/nodes/${0xa1b2c305}/copy-nodeinfo`);
    expect(JSON.parse(String(copy.mock.calls[0][1]?.body))).toMatchObject({
      fromSourceId: 'src-mqtt', toSourceId: 'src-rak', pushToNodeDb: false,
    });
  });
});
