/**
 * @vitest-environment jsdom
 *
 * Boards 8-09 (desktop) and 8-26 (phone): Settings › Channels (Task 7.4): the
 * slot table with kind tags and scopes, Add channel (Hashtag / Secret /
 * Import from URL), Share as URL and QR, Reorder slots on device, and the
 * danger zone's Reset to Public. A channel write is one request per press;
 * Reset to Public asks first with what it removes.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/channels`;
// Slot 0 holds another channel, so Reset to Public has something to remove (today hides it otherwise).
const zeroTaken = {
  'GET /api/channels/all': (u: URL) =>
    u.searchParams.get('sourceId') === SOURCE_IDS.heltec
      ? [
          { id: 0, name: 'Old Public', psk: 'b3BzLXNlY3JldC1rZXktMDE=' },
          { id: 1, name: '#athens', psk: 'izOH6cXN6mrJ5e26oRXNcg==', scope: 'gr-att' },
        ]
      : undefined,
};

describe('8-09-channels', () => {
  it('8-09-channels shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(route, { meshcore: { slot0Renamed: true } });
    await screen.findByText('Key from the name');
    fireEvent.click(screen.getAllByRole('button', { name: 'Share' })[0]);
    await screen.findByText('As a URL and QR code');
    fireEvent.click(screen.getByRole('button', { name: /Add channel/ }));
    await screen.findByText('Add channel · slot 3');
    fireEvent.click(screen.getByRole('radio', { name: 'Secret' }));
    expectBoard('8-09-channels', container);
  });

  it('lists the device\'s slots (not the virtual channels) with their kind and scope', async () => {
    renderMeshCore(route);
    const list = await screen.findByRole('list', { name: 'Channels' });
    await within(list).findByText('Key from the name');
    expect(within(list).queryByText('Athens Ops')).toBeNull();
    expect(within(list).getByText('Public channel, fixed by the firmware')).toBeInTheDocument();
    expect(within(list).getByText('Free')).toBeInTheDocument();
    expect(screen.getByText(/3 of 8 slots used/)).toBeInTheDocument();
  });

  it('a channel write is one PUT per press, with today\'s body; opening and Share send nothing', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText('Key from the name');
    fireEvent.click(screen.getAllByRole('button', { name: 'Share' })[0]);
    await screen.findByText(/meshcore:\/\/channel\/add/);
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Add channel/ }));
    const name = await screen.findByLabelText('Name');
    fireEvent.change(name, { target: { value: '#coast' } });
    expect(screen.getAllByText('Sends nothing on the mesh · writes the channel to the radio').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save to device' }));
    await waitFor(() => expect(log.writes.filter((w) => w.method === 'PUT')).toHaveLength(1));
    const put = log.writes.find((w) => w.method === 'PUT')!;
    expect(put.path).toBe('/api/channels/3');
    expect(put.body).toMatchObject({ name: '#coast', scope: '', sourceId: SOURCE_IDS.heltec });
    // The hashtag key is the name's, re-derived at save (#3607): 16 bytes.
    expect(atob((put.body as { psk: string }).psk)).toHaveLength(16);
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(log.writes).toHaveLength(1);
  });

  it('Reset to Public asks with what it removes, then sends one DELETE; Cancel sends nothing', async () => {
    const { log } = renderMeshCore(route, { fixtures: zeroTaken });
    fireEvent.click(await screen.findByRole('button', { name: 'Reset to Public' }));
    let sheet = await screen.findByRole('dialog', { name: 'Reset slot 0 to Public?' });
    expect(within(sheet).getByText('Old Public')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Public' }));
    sheet = await screen.findByRole('dialog', { name: 'Reset slot 0 to Public?' });
    // No typed word (today): the sheet's button alone sends.
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset to Public' }));
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ method: 'DELETE', path: '/api/channels/0' });
  });

  it('Reset to Public is hidden while slot 0 already holds the Public channel (today)', async () => {
    renderMeshCore(route);
    await screen.findByText('Key from the name');
    expect(screen.queryByRole('button', { name: 'Reset to Public' })).toBeNull();
  });

  it('a channel draft asks before a link leaves the page', async () => {
    const { log } = renderMeshCore(route);
    fireEvent.click(await screen.findByRole('button', { name: /Add channel/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '#coast' } });
    fireEvent.click(screen.getByRole('link', { name: 'Radio' }));
    expect(await screen.findByRole('dialog', { name: /Discard|unsaved|Keep/i })).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
  });
});

describe('8-26-channels', () => {
  it('8-26-channels shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true, meshcore: { slot0Renamed: true } });
    await screen.findAllByText('Scope: inherit default');
    fireEvent.click(screen.getByRole('button', { name: /Add channel/ }));
    await screen.findByText('Add channel · slot 3');
    expectBoard('8-26-channels', joined(container, document.body));
  });

  it('Share opens a sheet with the QR and Copy URL', async () => {
    renderMeshCore(route, { phone: true });
    await screen.findAllByText('Scope: inherit default');
    fireEvent.click(screen.getAllByRole('button', { name: 'Share' })[0]);
    const sheet = await screen.findByRole('dialog', { name: /Share/ });
    expect(within(sheet).getByRole('button', { name: 'Copy URL' })).toBeInTheDocument();
    expect(sheet.querySelector('canvas')).not.toBeNull();
  });
});
